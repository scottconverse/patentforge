import { Injectable, NotFoundException, BadRequestException, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

const APP_GENERATOR_URL = process.env.APPLICATION_GENERATOR_URL || 'http://localhost:3003';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'patentforge-internal';

/** Must match GenerateRequest in services/application-generator/src/models.py */
interface GenerateRequestBody {
  invention_title: string;
  invention_narrative: string;
  feasibility_stage_1: string;
  feasibility_stage_5: string;
  feasibility_stage_6: string;
  claims: Array<{
    claim_number: number;
    claim_type: string;
    scope_level: string | null;
    parent_claim_number: number | null;
    text: string;
  }>;
  specification_language: string;
  prior_art_results: Array<{
    patent_number: string;
    title: string;
    abstract: string | null;
  }>;
  compliance_passed: boolean;
  settings: {
    api_key: string;
    default_model: string;
    max_tokens: number;
  };
}

/** Section name → Prisma field mapping */
const SECTION_FIELDS: Record<string, string> = {
  title: 'title',
  abstract: 'abstract',
  cross_references: 'background', // stored in background field for now
  background: 'background',
  summary: 'summary',
  detailed_description: 'detailedDescription',
  claims: 'claims',
  figure_descriptions: 'figureDescriptions',
};

@Injectable()
export class ApplicationService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async onModuleInit() {
    const { count } = await this.prisma.patentApplication.updateMany({
      where: { status: 'RUNNING' },
      data: { status: 'ERROR' },
    });
    if (count > 0) {
      console.warn(`[Application] Cleaned up ${count} stuck RUNNING application(s) from previous session`);
    }
  }

  async startGeneration(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { invention: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.invention) throw new NotFoundException('No invention form — fill it in first');

    // Prevent concurrent generations
    const running = await this.prisma.patentApplication.findFirst({
      where: { projectId, status: 'RUNNING' },
    });
    if (running) {
      throw new ConflictException('An application is already being generated for this project.');
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
          `Cost cap exceeded. You have spent $${spent.toFixed(2)} of your $${settings.costCapUsd.toFixed(2)} cap.`,
        );
      }
    }

    // Get completed feasibility run
    const feasRun = await this.prisma.feasibilityRun.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
      include: { stages: { orderBy: { stageNumber: 'asc' } } },
    });
    if (!feasRun) {
      throw new BadRequestException('No completed feasibility run. Run feasibility analysis first.');
    }

    const MAX_STAGE_CHARS = 15_000;
    const stage1 = (feasRun.stages.find(s => s.stageNumber === 1)?.outputText ?? '').slice(0, MAX_STAGE_CHARS);
    const stage5 = (feasRun.stages.find(s => s.stageNumber === 5)?.outputText ?? '').slice(0, MAX_STAGE_CHARS);
    const stage6 = (feasRun.stages.find(s => s.stageNumber === 6)?.outputText ?? '').slice(0, MAX_STAGE_CHARS);

    // Get completed claim draft
    const claimDraft = await this.prisma.claimDraft.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
      include: { claims: { orderBy: { claimNumber: 'asc' } } },
    });
    if (!claimDraft || !claimDraft.claims.length) {
      throw new BadRequestException('No completed claim draft. Draft claims first.');
    }

    // Get compliance status
    const compliance = await this.prisma.complianceCheck.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
    });

    // Get prior art
    const priorArt = await this.prisma.priorArtSearch.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
      include: { results: { orderBy: { relevanceScore: 'desc' }, take: 10 } },
    });

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

    // Version increment
    const lastApp = await this.prisma.patentApplication.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    const version = (lastApp?.version ?? 0) + 1;

    // Create application record
    const application = await this.prisma.patentApplication.create({
      data: {
        projectId,
        version,
        status: 'RUNNING',
        title: inv.title,
      },
    });

    // Build request body
    const requestBody: GenerateRequestBody = {
      invention_title: inv.title,
      invention_narrative: narrative,
      feasibility_stage_1: stage1,
      feasibility_stage_5: stage5,
      feasibility_stage_6: stage6,
      claims: claimDraft.claims.map(c => ({
        claim_number: c.claimNumber,
        claim_type: c.claimType,
        scope_level: c.scopeLevel,
        parent_claim_number: c.parentClaimNumber,
        text: c.text,
      })),
      specification_language: claimDraft.specLanguage || '',
      prior_art_results: (priorArt?.results || []).map(r => ({
        patent_number: r.patentNumber,
        title: r.title,
        abstract: r.abstract,
      })),
      compliance_passed: compliance?.overallPass ?? false,
      settings: {
        api_key: settings.anthropicApiKey,
        default_model: settings.defaultModel,
        max_tokens: settings.maxTokens,
      },
    };

    // Fire-and-forget with guaranteed cleanup
    (async () => {
      try {
        await this.callGenerator(application.id, requestBody);
      } catch (err: any) {
        console.error(`[Application] Pipeline failed for ${application.id}:`, err.message);
      } finally {
        const current = await this.prisma.patentApplication.findUnique({ where: { id: application.id } });
        if (current && current.status === 'RUNNING') {
          await this.prisma.patentApplication.update({
            where: { id: application.id },
            data: { status: 'ERROR' },
          }).catch(e => console.error(`[Application] Failed to update status: ${e.message}`));
        }
      }
    })();

    return application;
  }

  private async callGenerator(appId: string, requestBody: GenerateRequestBody) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (INTERNAL_SECRET) {
      headers['X-Internal-Secret'] = INTERNAL_SECRET;
    }

    const result = await new Promise<any>((resolve, reject) => {
      const url = new URL(`${APP_GENERATOR_URL}/generate/sync`);
      const http = require('http');
      const data = JSON.stringify(requestBody);
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(data) },
        timeout: 1_200_000, // 20 minutes — 5 LLM calls with large context
      }, (res: any) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          if (res.statusCode !== 200) {
            reject(new Error(`Application generator returned ${res.statusCode}: ${body}`));
            return;
          }
          try { resolve(JSON.parse(body)); } catch { reject(new Error(`Invalid JSON from application generator: ${body.slice(0, 200)}`)); }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('Application generator request timed out (20 min)')); });
      req.on('error', (e: Error) => reject(new Error(`Application generator request failed: ${e.message}`)));
      req.write(data);
      req.end();
    });

    if (result.status === 'ERROR') {
      console.error(`[Application] Generator returned ERROR for ${appId}: ${result.error_message ?? 'no message'}`);
      await this.prisma.patentApplication.update({
        where: { id: appId },
        data: { status: 'ERROR' },
      });
      return;
    }

    await this.prisma.patentApplication.update({
      where: { id: appId },
      data: {
        status: 'COMPLETE',
        title: result.title || undefined,
        abstract: result.abstract || null,
        background: result.background || null,
        summary: result.summary || null,
        detailedDescription: result.detailed_description || null,
        claims: result.claims_text || null,
        figureDescriptions: result.figure_descriptions || null,
      },
    });
  }

  async getLatest(projectId: string) {
    const app = await this.prisma.patentApplication.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    return app || { status: 'NONE' };
  }

  async getByVersion(projectId: string, version: number) {
    const app = await this.prisma.patentApplication.findFirst({
      where: { projectId, version },
    });
    if (!app) throw new NotFoundException(`Application version ${version} not found`);
    return app;
  }

  async updateSection(projectId: string, sectionName: string, content: string) {
    const field = SECTION_FIELDS[sectionName];
    if (!field) throw new BadRequestException(`Unknown section: ${sectionName}`);

    const app = await this.prisma.patentApplication.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
    });
    if (!app) throw new NotFoundException('No completed application found');

    return this.prisma.patentApplication.update({
      where: { id: app.id },
      data: { [field]: content },
    });
  }

  async exportDocx(projectId: string): Promise<{ buffer: Buffer; filename: string }> {
    const app = await this.getCompleteApp(projectId);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (INTERNAL_SECRET) headers['X-Internal-Secret'] = INTERNAL_SECRET;

    const res = await fetch(`${APP_GENERATOR_URL}/export/docx`, {
      method: 'POST',
      headers,
      body: JSON.stringify(this.toExportPayload(app)),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new BadRequestException(`DOCX export failed: ${await res.text()}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const slug = (app.title || 'application').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return { buffer, filename: `${slug}-application.docx` };
  }

  async exportPdf(projectId: string): Promise<{ buffer: Buffer; filename: string }> {
    const app = await this.getCompleteApp(projectId);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (INTERNAL_SECRET) headers['X-Internal-Secret'] = INTERNAL_SECRET;

    const res = await fetch(`${APP_GENERATOR_URL}/export/pdf`, {
      method: 'POST',
      headers,
      body: JSON.stringify(this.toExportPayload(app)),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new BadRequestException(`PDF export failed: ${await res.text()}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const slug = (app.title || 'application').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return { buffer, filename: `${slug}-application.pdf` };
  }

  async exportMarkdown(projectId: string): Promise<{ text: string; filename: string }> {
    const app = await this.getCompleteApp(projectId);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (INTERNAL_SECRET) headers['X-Internal-Secret'] = INTERNAL_SECRET;

    const res = await fetch(`${APP_GENERATOR_URL}/export/markdown`, {
      method: 'POST',
      headers,
      body: JSON.stringify(this.toExportPayload(app)),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new BadRequestException(`Markdown export failed: ${await res.text()}`);

    const text = await res.text();
    const slug = (app.title || 'application').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return { text, filename: `${slug}-application.md` };
  }

  private async getCompleteApp(projectId: string) {
    const app = await this.prisma.patentApplication.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
    });
    if (!app) throw new NotFoundException('No completed application found');
    return app;
  }

  private toExportPayload(app: any) {
    return {
      title: app.title || '',
      abstract: app.abstract || '',
      cross_references: '',
      background: app.background || '',
      summary: app.summary || '',
      detailed_description: app.detailedDescription || '',
      claims_text: app.claims || '',
      figure_descriptions: app.figureDescriptions || '',
      sections: [],
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_estimated_cost_usd: 0,
      status: 'COMPLETE',
    };
  }
}
