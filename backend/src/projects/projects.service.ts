import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateInventionDto } from './dto/update-invention.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        title: dto.title,
        status: 'INTAKE',
      },
    });
  }

  async findAll() {
    const projects = await this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        feasibility: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    return projects;
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        invention: true,
        feasibility: {
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            stages: {
              orderBy: { stageNumber: 'asc' },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }

  async delete(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    await this.prisma.project.delete({ where: { id } });
  }

  async upsertInvention(projectId: string, dto: UpdateInventionDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return this.prisma.inventionInput.upsert({
      where: { projectId },
      create: {
        projectId,
        title: dto.title,
        description: dto.description,
        problemSolved: dto.problemSolved ?? '',
        howItWorks: dto.howItWorks ?? '',
        aiComponents: dto.aiComponents ?? '',
        threeDPrintComponents: dto.threeDPrintComponents ?? '',
        whatIsNovel: dto.whatIsNovel ?? '',
        currentAlternatives: dto.currentAlternatives ?? '',
        whatIsBuilt: dto.whatIsBuilt ?? '',
        whatToProtect: dto.whatToProtect ?? '',
        additionalNotes: dto.additionalNotes ?? '',
      },
      update: {
        title: dto.title,
        description: dto.description,
        problemSolved: dto.problemSolved ?? '',
        howItWorks: dto.howItWorks ?? '',
        aiComponents: dto.aiComponents ?? '',
        threeDPrintComponents: dto.threeDPrintComponents ?? '',
        whatIsNovel: dto.whatIsNovel ?? '',
        currentAlternatives: dto.currentAlternatives ?? '',
        whatIsBuilt: dto.whatIsBuilt ?? '',
        whatToProtect: dto.whatToProtect ?? '',
        additionalNotes: dto.additionalNotes ?? '',
      },
    });
  }

  async getInvention(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const invention = await this.prisma.inventionInput.findUnique({
      where: { projectId },
    });

    if (!invention) {
      throw new NotFoundException(`Invention for project ${projectId} not found`);
    }

    return invention;
  }
}
