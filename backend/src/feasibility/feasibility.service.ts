import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PatchStageDto } from './dto/patch-stage.dto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { marked } from 'marked';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } from 'docx';

function resolveExportDir(customExportPath?: string): string {
  if (customExportPath && customExportPath.trim()) {
    return customExportPath.trim();
  }
  const home = os.homedir();
  const oneDriveDesktop = path.join(home, 'OneDrive', 'Desktop');
  const regularDesktop = path.join(home, 'Desktop');
  return fs.existsSync(oneDriveDesktop) ? oneDriveDesktop : regularDesktop;
}

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' };
const TABLE_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER, insideH: THIN_BORDER, insideV: THIN_BORDER };

function parseBoldRuns(text: string): TextRun[] {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) => new TextRun({ text: part, bold: i % 2 === 1 }));
}

function parseTableLines(tableLines: string[]): Table {
  const rows: TableRow[] = [];
  let isFirstDataRow = true;
  for (const line of tableLines) {
    // Skip separator rows like |---|---|
    if (/^\|[\s\-:|]+\|$/.test(line.trim())) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    const isHeader = isFirstDataRow;
    isFirstDataRow = false;
    rows.push(new TableRow({
      tableHeader: isHeader,
      children: cells.map(cellText => new TableCell({
        borders: TABLE_BORDERS,
        shading: isHeader ? { type: ShadingType.SOLID, color: '2D3748' } : undefined,
        children: [new Paragraph({ children: parseBoldRuns(cellText.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`(.*?)`/g, '$1')) })],
        width: { size: Math.floor(9000 / cells.length), type: WidthType.DXA },
      })),
    }));
  }
  return new Table({ rows, width: { size: 9000, type: WidthType.DXA }, borders: TABLE_BORDERS });
}

function parseMarkdownToDocxParagraphs(markdown: string): (Paragraph | Table)[] {
  const lines = markdown.split('\n');
  const elements: (Paragraph | Table)[] = [];
  let tableBuffer: string[] = [];

  function flushTable() {
    if (tableBuffer.length > 0) {
      elements.push(parseTableLines(tableBuffer));
      elements.push(new Paragraph({ text: '' }));
      tableBuffer = [];
    }
  }

  for (const line of lines) {
    if (line.trimStart().startsWith('|')) {
      tableBuffer.push(line);
      continue;
    }
    flushTable();

    if (line.startsWith('# ')) {
      elements.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith('## ')) {
      elements.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('### ')) {
      elements.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith('#### ')) {
      elements.push(new Paragraph({ text: line.slice(5), heading: HeadingLevel.HEADING_4 }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
    } else if (line.trim() === '' || line.startsWith('---')) {
      elements.push(new Paragraph({ text: '' }));
    } else {
      elements.push(new Paragraph({ children: parseBoldRuns(line) }));
    }
  }
  flushTable();
  return elements;
}

export const STAGE_NAMES = [
  'Technical Intake & Restatement',
  'Prior Art Research',
  'Patentability Analysis',
  'Deep Dive Analysis',
  'IP Strategy & Recommendations',
  'Comprehensive Report',
];

@Injectable()
export class FeasibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async startRun(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const existingCount = await this.prisma.feasibilityRun.count({
      where: { projectId },
    });
    const version = existingCount + 1;

    const run = await this.prisma.feasibilityRun.create({
      data: {
        projectId,
        version,
        status: "PENDING",
        startedAt: new Date(),
        stages: {
          create: STAGE_NAMES.map((stageName, index) => ({
            stageNumber: index + 1,
            stageName,
            status: "PENDING",
          })),
        },
      },
      include: {
        stages: {
          orderBy: { stageNumber: 'asc' },
        },
      },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: "FEASIBILITY" },
    });

    return run;
  }

  async getLatest(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const run = await this.prisma.feasibilityRun.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      include: {
        stages: {
          orderBy: { stageNumber: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`No feasibility runs found for project ${projectId}`);
    }

    return run;
  }

  async getByVersion(projectId: string, version: number) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const run = await this.prisma.feasibilityRun.findFirst({
      where: { projectId, version },
      include: {
        stages: {
          orderBy: { stageNumber: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Feasibility run version ${version} not found for project ${projectId}`);
    }

    return run;
  }

  async patchStage(projectId: string, stageNumber: number, dto: PatchStageDto) {
    const run = await this.prisma.feasibilityRun.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });

    if (!run) {
      throw new NotFoundException(`No feasibility runs found for project ${projectId}`);
    }

    const stage = await this.prisma.feasibilityStage.findFirst({
      where: { feasibilityRunId: run.id, stageNumber },
    });

    if (!stage) {
      throw new NotFoundException(`Stage ${stageNumber} not found`);
    }

    const updateData: any = {};
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.outputText !== undefined) updateData.outputText = dto.outputText;
    if (dto.model !== undefined) updateData.model = dto.model;
    if (dto.webSearchUsed !== undefined) updateData.webSearchUsed = dto.webSearchUsed;
    if (dto.errorMessage !== undefined) updateData.errorMessage = dto.errorMessage;
    if (dto.startedAt !== undefined) updateData.startedAt = new Date(dto.startedAt);
    if (dto.completedAt !== undefined) updateData.completedAt = new Date(dto.completedAt);
    if (dto.inputTokens !== undefined) updateData.inputTokens = dto.inputTokens;
    if (dto.outputTokens !== undefined) updateData.outputTokens = dto.outputTokens;
    if (dto.estimatedCostUsd !== undefined) updateData.estimatedCostUsd = dto.estimatedCostUsd;

    return this.prisma.feasibilityStage.update({
      where: { id: stage.id },
      data: updateData,
    });
  }

  async patchRun(projectId: string, dto: { status?: string; finalReport?: string; startedAt?: string; completedAt?: string }) {
    const run = await this.prisma.feasibilityRun.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });

    if (!run) {
      throw new NotFoundException(`No feasibility runs found for project ${projectId}`);
    }

    const updateData: any = {};
    if (dto.status !== undefined) {
      updateData.status = dto.status;
      if (dto.status === "COMPLETE" || dto.status === "ERROR" || dto.status === "CANCELLED") {
        updateData.completedAt = new Date();
      }
      if (dto.status === "RUNNING") {
        updateData.startedAt = new Date();
      }
    }
    if (dto.finalReport !== undefined) updateData.finalReport = dto.finalReport;
    if (dto.startedAt !== undefined) updateData.startedAt = new Date(dto.startedAt);
    if (dto.completedAt !== undefined) updateData.completedAt = new Date(dto.completedAt);

    return this.prisma.feasibilityRun.update({
      where: { id: run.id },
      data: updateData,
      include: { stages: { orderBy: { stageNumber: 'asc' } } },
    });
  }

  async cancelRun(projectId: string) {
    const run = await this.prisma.feasibilityRun.findFirst({
      where: { projectId, status: { in: ["RUNNING", "PENDING"] } },
      orderBy: { version: 'desc' },
    });

    if (!run) {
      throw new NotFoundException(`No running feasibility run found for project ${projectId}`);
    }

    return this.prisma.feasibilityRun.update({
      where: { id: run.id },
      data: { status: "CANCELLED" },
      include: {
        stages: {
          orderBy: { stageNumber: 'asc' },
        },
      },
    });
  }

  async exportReportToDisk(projectId: string, customExportPath?: string): Promise<{ folderPath: string; mdFile: string; htmlFile: string }> {
    // Load project + latest completed run
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const run = await this.prisma.feasibilityRun.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
    });
    if (!run || !run.finalReport) {
      throw new NotFoundException('No completed report found for this project');
    }

    const exportDir = resolveExportDir(customExportPath);

    // Slugify project title for folder name
    const slug = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const folderPath = path.join(exportDir, slug);
    fs.mkdirSync(folderPath, { recursive: true });

    // Write markdown
    const mdFile = path.join(folderPath, `${slug}-feasibility.md`);
    fs.writeFileSync(mdFile, run.finalReport, 'utf-8');

    // Build self-contained HTML
    const bodyHtml = await marked(run.finalReport);
    const html = this.buildHtmlDoc(bodyHtml, `${project.title} — Feasibility Report`);
    const htmlFile = path.join(folderPath, `${slug}-feasibility.html`);
    fs.writeFileSync(htmlFile, html, 'utf-8');

    return { folderPath, mdFile, htmlFile };
  }

  private buildHtmlDoc(bodyHtml: string, title: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  :root { --bg: #0f1117; --surface: #1a1d27; --border: #2a2d3a; --text: #e2e8f0; --muted: #94a3b8; --accent: #3b82f6; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.7; padding: 40px 20px; }
  .container { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 2em; font-weight: 700; color: #f1f5f9; margin-bottom: 0.4em; }
  h2 { font-size: 1.4em; font-weight: 600; color: #cbd5e1; margin: 1.8em 0 0.6em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
  h3 { font-size: 1.15em; font-weight: 600; color: #cbd5e1; margin: 1.4em 0 0.5em; }
  h4 { font-size: 1em; font-weight: 600; color: #94a3b8; margin: 1.2em 0 0.4em; }
  p { margin: 0.75em 0; }
  ul, ol { margin: 0.75em 0 0.75em 1.5em; }
  li { margin: 0.3em 0; }
  strong { color: #f1f5f9; font-weight: 600; }
  em { color: #94a3b8; }
  code { background: #1e2130; color: #93c5fd; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.88em; }
  pre { background: #1e2130; padding: 1em 1.2em; border-radius: 8px; overflow-x: auto; margin: 1em 0; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid var(--accent); padding-left: 1em; color: var(--muted); margin: 1em 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.9em; }
  th { background: #1e2130; color: #cbd5e1; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid var(--border); }
  td { padding: 7px 12px; border: 1px solid var(--border); color: var(--text); }
  tr:nth-child(even) td { background: #161923; }
  hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="container">
${bodyHtml}
<hr style="margin-top: 3rem;">
<p style="font-size: 0.8rem; color: #6b7280; line-height: 1.5; margin-top: 1rem;">
  <strong style="color: #9ca3af;">Disclaimer:</strong> This report was generated by PatentForge, an open-source AI-powered patent landscape research tool. It is intended for informational and educational purposes only. This report does not constitute legal advice. No attorney-client relationship is created by this report. The author of this tool is not a lawyer. The AI system that generated this analysis is not a lawyer. Patent law is complex and fact-specific, and AI-generated analysis may contain errors, omissions, or hallucinated references — including fabricated patent numbers, inaccurate legal citations, and incorrect statutory interpretations presented with high confidence. Before making any filing, licensing, enforcement, or investment decisions based on this report, consult a registered patent attorney.
</p>
</div>
</body>
</html>`;
  }

  async getDocxBuffer(projectId: string): Promise<{ buffer: Buffer; filename: string }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const run = await this.prisma.feasibilityRun.findFirst({
      where: { projectId, status: 'COMPLETE' },
      orderBy: { version: 'desc' },
    });
    if (!run?.finalReport) throw new NotFoundException('No completed report found');

    const paragraphs = parseMarkdownToDocxParagraphs(run.finalReport);

    // Append legal disclaimer watermark
    paragraphs.push(new Paragraph({ text: '' }));
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: '---', color: '6B7280', size: 16 }),
      ],
    }));
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: 'Disclaimer: ', bold: true, color: '6B7280', size: 16, font: 'Calibri' }),
        new TextRun({
          text: 'This report was generated by PatentForge, an open-source AI-powered patent landscape research tool. It is intended for informational and educational purposes only. This report does not constitute legal advice. No attorney-client relationship is created by this report. The author of this tool is not a lawyer. The AI system that generated this analysis is not a lawyer. Patent law is complex and fact-specific, and AI-generated analysis may contain errors, omissions, or hallucinated references — including fabricated patent numbers, inaccurate legal citations, and incorrect statutory interpretations presented with high confidence. Before making any filing, licensing, enforcement, or investment decisions based on this report, consult a registered patent attorney.',
          color: '6B7280',
          size: 16,
          font: 'Calibri',
        }),
      ],
    }));

    const doc = new Document({
      creator: 'PatentForge',
      title: `${project.title} — Feasibility Report`,
      sections: [{ properties: {}, children: paragraphs }],
    });

    const buffer = await Packer.toBuffer(doc);
    const slug = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return { buffer, filename: `${slug}-feasibility.docx` };
  }

  async getAllRuns(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const runs = await this.prisma.feasibilityRun.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
      include: {
        stages: { select: { estimatedCostUsd: true } },
      },
    });

    return runs.map(run => ({
      id: run.id,
      version: run.version,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      totalCostUsd: run.stages.reduce((sum: number, s: any) => sum + (s.estimatedCostUsd ?? 0), 0),
    }));
  }

  async updateRunStatus(runId: string, status: string, finalReport?: string) {
    const data: any = { status };
    if (finalReport !== undefined) data.finalReport = finalReport;
    if (status === "COMPLETE" || status === "ERROR" || status === "CANCELLED") {
      data.completedAt = new Date();
    }

    return this.prisma.feasibilityRun.update({
      where: { id: runId },
      data,
      include: {
        stages: {
          orderBy: { stageNumber: 'asc' },
        },
      },
    });
  }
}
