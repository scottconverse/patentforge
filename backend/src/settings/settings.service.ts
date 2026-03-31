import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SINGLETON_ID = 'singleton';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    return this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const data: any = {};
    if (dto.anthropicApiKey !== undefined) data.anthropicApiKey = dto.anthropicApiKey;
    if (dto.defaultModel !== undefined) data.defaultModel = dto.defaultModel;
    if (dto.researchModel !== undefined) data.researchModel = dto.researchModel;
    if (dto.maxTokens !== undefined) data.maxTokens = dto.maxTokens;
    if (dto.interStageDelaySeconds !== undefined) data.interStageDelaySeconds = dto.interStageDelaySeconds;
    if (dto.exportPath !== undefined) data.exportPath = dto.exportPath;
    if (dto.costCapUsd !== undefined) data.costCapUsd = dto.costCapUsd;
    if (dto.usptoApiKey !== undefined) data.usptoApiKey = dto.usptoApiKey;

    return this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });
  }
}
