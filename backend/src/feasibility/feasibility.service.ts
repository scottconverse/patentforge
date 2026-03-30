import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PatchStageDto } from './dto/patch-stage.dto';

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
