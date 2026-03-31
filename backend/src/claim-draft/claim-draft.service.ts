import { Injectable, NotFoundException, BadRequestException, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

const CLAIM_DRAFTER_URL = process.env.CLAIM_DRAFTER_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';

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
    this.callClaimDrafter(draft.id, {
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
    }).catch(err => {
      console.error(`[ClaimDraft] Pipeline failed for draft ${draft.id}:`, err.message);
      this.prisma.claimDraft.update({
        where: { id: draft.id },
        data: { status: 'ERROR', completedAt: new Date() },
      }).catch(() => {});
    });

    return draft;
  }

  /**
   * Call the Python claim-drafter service and save results.
   */
  private async callClaimDrafter(draftId: string, requestBody: any) {
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
}
