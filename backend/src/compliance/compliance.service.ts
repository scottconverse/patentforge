import { Injectable, NotFoundException, BadRequestException, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

const COMPLIANCE_CHECKER_URL = process.env.COMPLIANCE_CHECKER_URL || 'http://localhost:3004';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';

/**
 * Request body sent to the Python compliance-checker service.
 * Must match the ComplianceRequest Pydantic model in services/compliance-checker/src/models.py.
 */
interface ComplianceCheckRequestBody {
  claims: Array<{
    claim_number: number;
    claim_type: string;
    parent_claim_number: number | null;
    text: string;
  }>;
  specification_text: string;
  invention_narrative: string;
  prior_art_context: string;
  settings: {
    api_key: string;
    default_model: string;
    research_model: string;
    max_tokens: number;
  };
}

@Injectable()
export class ComplianceService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * On startup, mark any RUNNING checks from a previous crash as ERROR.
   */
  async onModuleInit() {
    const { count } = await this.prisma.complianceCheck.updateMany({
      where: { status: 'RUNNING' },
      data: { status: 'ERROR', completedAt: new Date() },
    });
    if (count > 0) {
      console.warn(`[Compliance] Cleaned up ${count} stuck RUNNING check(s) from previous session`);
    }
  }

  /**
   * Start a compliance check for a project's claims.
   */
  async startCheck(projectId: string, draftVersion?: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { invention: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    // Get the claim draft (specific version or latest)
    const draft = draftVersion
      ? await this.prisma.claimDraft.findFirst({
          where: { projectId, version: draftVersion, status: 'COMPLETE' },
          include: { claims: { orderBy: { claimNumber: 'asc' } } },
        })
      : await this.prisma.claimDraft.findFirst({
          where: { projectId, status: 'COMPLETE' },
          orderBy: { version: 'desc' },
          include: { claims: { orderBy: { claimNumber: 'asc' } } },
        });

    if (!draft || !draft.claims.length) {
      throw new NotFoundException('No completed claim draft found. Generate claims first.');
    }

    // Prevent concurrent checks
    const running = await this.prisma.complianceCheck.findFirst({
      where: { projectId, status: 'RUNNING' },
    });
    if (running) {
      throw new ConflictException('A compliance check is already running for this project.');
    }

    const settings = await this.settingsService.getSettings();
    if (!settings.anthropicApiKey) {
      throw new NotFoundException('No Anthropic API key configured. Add one in Settings.');
    }

    // Enforce cost cap
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

    // Build invention narrative
    const inv = project.invention;
    const narrative = inv ? [
      `Title: ${inv.title}`,
      `Description: ${inv.description}`,
      inv.problemSolved ? `Problem Solved: ${inv.problemSolved}` : '',
      inv.howItWorks ? `How It Works: ${inv.howItWorks}` : '',
    ].filter(Boolean).join('\n\n') : '';

    // Get specification text from feasibility Stage 1
    const feasRun = await this.prisma.feasibilityRun.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
      include: { stages: { where: { stageNumber: 1 }, take: 1 } },
    });
    const specText = feasRun?.stages?.[0]?.outputText ?? '';

    // Create compliance check record
    const lastCheck = await this.prisma.complianceCheck.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    const version = (lastCheck?.version ?? 0) + 1;

    const check = await this.prisma.complianceCheck.create({
      data: {
        projectId,
        version,
        status: 'RUNNING',
        draftVersion: draft.version,
        startedAt: new Date(),
      },
    });

    // Fire and forget -- frontend polls for status
    // finally block guarantees check status is resolved even if error handling itself fails
    (async () => {
      try {
        await this.callComplianceChecker(check.id, {
          claims: draft.claims.map(c => ({
            claim_number: c.claimNumber,
            claim_type: c.claimType,
            parent_claim_number: c.parentClaimNumber,
            text: c.text,
          })),
          specification_text: specText,
          invention_narrative: narrative,
          prior_art_context: '',
          settings: {
            api_key: settings.anthropicApiKey,
            default_model: settings.defaultModel,
            research_model: settings.researchModel || '',
            max_tokens: settings.maxTokens,
          },
        });
      } catch (err: any) {
        console.error(`[Compliance] Check failed for ${check.id}:`, err.message);
      } finally {
        // Ensure check is never left in RUNNING status
        const current = await this.prisma.complianceCheck.findUnique({ where: { id: check.id } });
        if (current && current.status === 'RUNNING') {
          await this.prisma.complianceCheck.update({
            where: { id: check.id },
            data: { status: 'ERROR', completedAt: new Date() },
          }).catch(e => console.error(`[Compliance] Failed to update check status: ${e.message}`));
        }
      }
    })();

    return check;
  }

  /**
   * Call the Python compliance-checker service and save results.
   */
  private async callComplianceChecker(checkId: string, requestBody: ComplianceCheckRequestBody) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (INTERNAL_SECRET) {
      headers['X-Internal-Secret'] = INTERNAL_SECRET;
    }

    const res = await fetch(`${COMPLIANCE_CHECKER_URL}/check`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(300_000), // 5-minute timeout
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Compliance checker returned ${res.status}: ${text}`);
    }

    const result = await res.json();

    if (result.status === 'ERROR') {
      await this.prisma.complianceCheck.update({
        where: { id: checkId },
        data: { status: 'ERROR', completedAt: new Date() },
      });
      return;
    }

    // Save results to DB
    for (const r of result.results) {
      await this.prisma.complianceResult.create({
        data: {
          checkId,
          rule: r.rule,
          status: r.status,
          claimNumber: r.claim_number ?? null,
          detail: r.detail,
          citation: r.citation ?? null,
          suggestion: r.suggestion ?? null,
        },
      });
    }

    // Update check status with cost
    const hasFailure = result.results.some((r: any) => r.status === 'FAIL');
    await this.prisma.complianceCheck.update({
      where: { id: checkId },
      data: {
        status: 'COMPLETE',
        completedAt: new Date(),
        overallPass: !hasFailure,
        estimatedCostUsd: result.total_estimated_cost_usd ?? null,
      },
    });
  }

  /**
   * Get the latest compliance check for a project.
   */
  async getLatest(projectId: string) {
    const check = await this.prisma.complianceCheck.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      include: { results: true },
    });
    return check || { status: 'NONE', results: [] };
  }

  /**
   * Get a specific compliance check version.
   */
  async getByVersion(projectId: string, version: number) {
    const check = await this.prisma.complianceCheck.findFirst({
      where: { projectId, version },
      include: { results: true },
    });
    if (!check) throw new NotFoundException(`Compliance check version ${version} not found`);
    return check;
  }
}
