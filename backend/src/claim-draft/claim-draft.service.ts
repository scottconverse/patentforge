import { Injectable, NotFoundException, BadRequestException, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

const CLAIM_DRAFTER_URL = process.env.CLAIM_DRAFTER_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';

/**
 * Request body sent to the Python claim-drafter service.
 * Must match the ClaimDraftRequest Pydantic model in services/claim-drafter/src/models.py.
 */
interface ClaimDraftRequestBody {
  invention_narrative: string;
  feasibility_stage_5: string;
  feasibility_stage_6: string;
  prior_art_results: Array<{
    patent_number: string;
    title: string;
    abstract: string | null;
    relevance_score: number;
    claims_text: string | null;
  }>;
  settings: {
    api_key: string;
    default_model: string;
    research_model: string;
    max_tokens: number;
  };
}

@Injectable()
export class ClaimDraftService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * On service startup, mark any RUNNING drafts from a previous crash as ERROR.
   * Prevents permanently stuck drafts that block new runs via the concurrency guard.
   */
  async onModuleInit() {
    const { count } = await this.prisma.claimDraft.updateMany({
      where: { status: 'RUNNING' },
      data: { status: 'ERROR', completedAt: new Date() },
    });
    if (count > 0) {
      console.warn(`[ClaimDraft] Cleaned up ${count} stuck RUNNING draft(s) from previous session`);
    }
  }

  /**
   * Start a new claim draft for a project.
   * Collects invention narrative, feasibility outputs, and prior art,
   * then calls the Python claim-drafter service.
   */
  async startDraft(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { invention: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.invention) throw new NotFoundException('No invention form — fill it in first');

    // Prevent concurrent drafts — only one RUNNING draft per project
    const running = await this.prisma.claimDraft.findFirst({
      where: { projectId, status: 'RUNNING' },
    });
    if (running) {
      throw new ConflictException('A claim draft is already running for this project. Wait for it to complete or try again later.');
    }

    const settings = await this.settingsService.getSettings();
    if (!settings.anthropicApiKey) {
      throw new NotFoundException('No Anthropic API key configured. Add one in Settings.');
    }

    // Enforce cost cap before starting claim drafting
    if (settings.costCapUsd > 0) {
      const stages = await this.prisma.feasibilityStage.findMany({
        where: {
          feasibilityRun: { projectId },
          estimatedCostUsd: { not: null },
        },
        select: { estimatedCostUsd: true },
      });
      const spent = stages.reduce((sum, s) => sum + (s.estimatedCostUsd ?? 0), 0);
      if (spent >= settings.costCapUsd) {
        throw new BadRequestException(
          `Cost cap exceeded. You have spent $${spent.toFixed(2)} of your $${settings.costCapUsd.toFixed(2)} cap. ` +
          `Increase the cost cap in Settings to continue.`,
        );
      }
    }

    // Get latest feasibility run
    const feasRun = await this.prisma.feasibilityRun.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
      include: { stages: { orderBy: { stageNumber: 'asc' } } },
    });

    const stage5 = feasRun?.stages?.find(s => s.stageNumber === 5)?.outputText ?? '';
    const stage6 = feasRun?.stages?.find(s => s.stageNumber === 6)?.outputText ?? '';

    // Get prior art results
    const priorArt = await this.prisma.priorArtSearch.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
      include: { results: { orderBy: { relevanceScore: 'desc' }, take: 10 } },
    });

    // Get cached claims for top prior art results
    const priorArtResults: Array<{
      patent_number: string;
      title: string;
      abstract: string | null;
      relevance_score: number;
      claims_text: string | null;
    }> = [];
    if (priorArt?.results) {
      for (const r of priorArt.results) {
        const cached = await this.prisma.patentDetail.findUnique({
          where: { patentNumber: r.patentNumber },
          select: { claimsText: true },
        });
        priorArtResults.push({
          patent_number: r.patentNumber,
          title: r.title,
          abstract: r.abstract,
          relevance_score: r.relevanceScore,
          claims_text: cached?.claimsText ?? null,
        });
      }
    }

    // Build invention narrative
    const inv = project.invention;
    const narrative = [
      `Title: ${inv.title}`,
      `Description: ${inv.description}`,
      inv.problemSolved ? `Problem Solved: ${inv.problemSolved}` : '',
      inv.howItWorks ? `How It Works: ${inv.howItWorks}` : '',
      inv.aiComponents ? `AI/ML Components: ${inv.aiComponents}` : '',
      inv.threeDPrintComponents ? `3D Print Components: ${inv.threeDPrintComponents}` : '',
      inv.whatIsNovel ? `What Is Novel: ${inv.whatIsNovel}` : '',
      inv.currentAlternatives ? `Current Alternatives: ${inv.currentAlternatives}` : '',
      inv.whatIsBuilt ? `What Is Built: ${inv.whatIsBuilt}` : '',
      inv.whatToProtect ? `What To Protect: ${inv.whatToProtect}` : '',
    ].filter(Boolean).join('\n\n');

    // Create claim draft record
    const lastDraft = await this.prisma.claimDraft.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    const version = (lastDraft?.version ?? 0) + 1;

    const draft = await this.prisma.claimDraft.create({
      data: {
        projectId,
        version,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Call claim drafter service (fire and forget — frontend polls for status)
    // finally block guarantees draft status is resolved even if error handling itself fails
    (async () => {
      try {
        await this.callClaimDrafter(draft.id, {
          invention_narrative: narrative,
          feasibility_stage_5: stage5,
          feasibility_stage_6: stage6,
          prior_art_results: priorArtResults,
          settings: {
            api_key: settings.anthropicApiKey,
            default_model: settings.defaultModel,
            research_model: settings.researchModel || '',
            max_tokens: settings.maxTokens,
          },
        });
      } catch (err: any) {
        console.error(`[ClaimDraft] Pipeline failed for draft ${draft.id}:`, err.message);
      } finally {
        // Ensure draft is never left in RUNNING status
        const current = await this.prisma.claimDraft.findUnique({ where: { id: draft.id } });
        if (current && current.status === 'RUNNING') {
          await this.prisma.claimDraft.update({
            where: { id: draft.id },
            data: { status: 'ERROR', completedAt: new Date() },
          }).catch(e => console.error(`[ClaimDraft] Failed to update draft status: ${e.message}`));
        }
      }
    })();

    return draft;
  }

  /**
   * Call the Python claim-drafter service and save results.
   */
  private async callClaimDrafter(draftId: string, requestBody: ClaimDraftRequestBody) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (INTERNAL_SECRET) {
      headers['X-Internal-Secret'] = INTERNAL_SECRET;
    }

    const res = await fetch(`${CLAIM_DRAFTER_URL}/draft/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(300_000), // 5-minute timeout
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Claim drafter returned ${res.status}: ${text}`);
    }

    const result = await res.json();

    if (result.status === 'ERROR') {
      await this.prisma.claimDraft.update({
        where: { id: draftId },
        data: { status: 'ERROR', completedAt: new Date() },
      });
      return;
    }

    // Save claims to DB
    for (const claim of result.claims) {
      await this.prisma.claim.create({
        data: {
          draftId,
          claimNumber: claim.claim_number,
          claimType: claim.claim_type,
          scopeLevel: claim.scope_level ?? null,
          statutoryType: claim.statutory_type ?? null,
          parentClaimNumber: claim.parent_claim_number ?? null,
          text: claim.text,
          examinerNotes: claim.examiner_notes ?? '',
        },
      });
    }

    // Update draft with metadata
    await this.prisma.claimDraft.update({
      where: { id: draftId },
      data: {
        status: 'COMPLETE',
        completedAt: new Date(),
        specLanguage: result.specification_language || null,
        plannerStrategy: result.planner_strategy || null,
        examinerFeedback: result.examiner_feedback || null,
        revisionNotes: result.revision_notes || null,
      },
    });
  }

  /**
   * Get the latest claim draft for a project.
   */
  async getLatest(projectId: string) {
    const draft = await this.prisma.claimDraft.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      include: { claims: { orderBy: { claimNumber: 'asc' } } },
    });
    return draft || { status: 'NONE', claims: [] };
  }

  /**
   * Get a specific claim draft version.
   */
  async getByVersion(projectId: string, version: number) {
    const draft = await this.prisma.claimDraft.findFirst({
      where: { projectId, version },
      include: { claims: { orderBy: { claimNumber: 'asc' } } },
    });
    if (!draft) throw new NotFoundException(`Claim draft version ${version} not found`);
    return draft;
  }

  /**
   * Regenerate a single claim by re-calling the claim drafter with focused instructions.
   */
  async regenerateClaim(projectId: string, claimNumber: number) {
    const draft = await this.prisma.claimDraft.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
      include: { claims: { orderBy: { claimNumber: 'asc' } } },
    });
    if (!draft) throw new NotFoundException('No completed claim draft found');

    const claim = draft.claims.find(c => c.claimNumber === claimNumber);
    if (!claim) throw new NotFoundException(`Claim ${claimNumber} not found in latest draft`);

    const settings = await this.settingsService.getSettings();
    if (!settings.anthropicApiKey) {
      throw new NotFoundException('No Anthropic API key configured. Add one in Settings.');
    }

    // Build context: all claims text for reference
    const allClaimsText = draft.claims.map(c =>
      `${c.claimNumber}. ${c.text}`
    ).join('\n\n');

    // Get invention narrative
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { invention: true },
    });
    const inv = project?.invention;
    const narrative = inv ? [
      `Title: ${inv.title}`,
      `Description: ${inv.description}`,
    ].filter(Boolean).join('\n\n') : '';

    // Call claim drafter with regeneration instruction
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (INTERNAL_SECRET) {
      headers['X-Internal-Secret'] = INTERNAL_SECRET;
    }

    const res = await fetch(`${CLAIM_DRAFTER_URL}/draft/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        invention_narrative: `REGENERATE CLAIM ${claimNumber} ONLY.\n\nContext — all current claims:\n${allClaimsText}\n\nInvention:\n${narrative}`,
        feasibility_stage_5: '',
        feasibility_stage_6: '',
        prior_art_results: [],
        settings: {
          api_key: settings.anthropicApiKey,
          default_model: settings.defaultModel,
          research_model: settings.researchModel || '',
          max_tokens: settings.maxTokens,
        },
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Claim regeneration failed: ${text}`);
    }

    const result = await res.json();
    if (result.status === 'ERROR' || !result.claims?.length) {
      throw new BadRequestException('Claim regeneration produced no results');
    }

    // Find the matching claim number in the result, or take the first one
    const newClaim = result.claims.find((c: any) => c.claim_number === claimNumber) || result.claims[0];

    // Update claim text in DB
    return this.prisma.claim.update({
      where: { id: claim.id },
      data: { text: newClaim.text },
    });
  }

  /**
   * Update a claim's text (user editing).
   * Verifies the claim belongs to the given project before updating.
   */
  async updateClaim(projectId: string, claimId: string, text: string) {
    // Ownership check: claim → draft → project
    const claim = await this.prisma.claim.findFirst({
      where: {
        id: claimId,
        draft: { projectId },
      },
    });
    if (!claim) {
      throw new NotFoundException(`Claim ${claimId} not found in project ${projectId}`);
    }

    return this.prisma.claim.update({
      where: { id: claimId },
      data: { text },
    });
  }

  /**
   * Generate a DOCX buffer containing all claims from the latest COMPLETE draft.
   */
  async getDocxBuffer(projectId: string): Promise<{ buffer: Buffer; filename: string }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const draft = await this.prisma.claimDraft.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
      include: { claims: { orderBy: { claimNumber: 'asc' } } },
    });
    if (!draft || !draft.claims.length) {
      throw new NotFoundException('No completed claim draft found');
    }

    const independentClaims = draft.claims.filter(c => c.claimType === 'INDEPENDENT');
    const dependentClaims = draft.claims.filter(c => c.claimType === 'DEPENDENT');

    const paragraphs: Paragraph[] = [];

    // Title
    paragraphs.push(new Paragraph({
      text: `Patent Claim Drafts — ${project.title}`,
      heading: HeadingLevel.HEADING_1,
    }));

    // UPL disclaimer
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({
          text: 'DRAFT — NOT FOR FILING. These are AI-generated research concepts. They must be reviewed by a registered patent attorney before any filing.',
          bold: true,
          color: 'B45309',
          size: 20,
        }),
      ],
    }));
    paragraphs.push(new Paragraph({ text: '' }));

    // Independent claims first
    if (independentClaims.length > 0) {
      paragraphs.push(new Paragraph({
        text: 'Independent Claims',
        heading: HeadingLevel.HEADING_2,
      }));

      for (const claim of independentClaims) {
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: `Claim ${claim.claimNumber} (Independent):`, bold: true }),
          ],
        }));
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: claim.text })],
        }));
        paragraphs.push(new Paragraph({ text: '' }));
      }
    }

    // Dependent claims
    if (dependentClaims.length > 0) {
      paragraphs.push(new Paragraph({
        text: 'Dependent Claims',
        heading: HeadingLevel.HEADING_2,
      }));

      for (const claim of dependentClaims) {
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({
              text: `Claim ${claim.claimNumber} (Dependent on ${claim.parentClaimNumber}):`,
              bold: true,
            }),
          ],
        }));
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: claim.text })],
        }));
        paragraphs.push(new Paragraph({ text: '' }));
      }
    }

    // Legal disclaimer footer
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: '---', color: '6B7280', size: 16 })],
    }));
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: 'Disclaimer: ', bold: true, color: '6B7280', size: 16, font: 'Calibri' }),
        new TextRun({
          text: 'These claims were generated by PatentForge, an open-source AI-powered patent research tool. They are draft research concepts intended for discussion with a registered patent attorney. They do not constitute legal advice. Claims may be too broad, too narrow, or contain fabricated technical details. Every claim must be reviewed, revised, and finalized by a registered patent attorney before any filing.',
          color: '6B7280',
          size: 16,
          font: 'Calibri',
        }),
      ],
    }));

    const doc = new Document({
      creator: 'PatentForge',
      title: `${project.title} — Claim Drafts`,
      sections: [{ properties: {}, children: paragraphs }],
    });

    const buffer = await Packer.toBuffer(doc);
    const slug = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return { buffer, filename: `${slug}-claims.docx` };
  }
}
