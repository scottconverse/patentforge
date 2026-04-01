import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { encrypt, decrypt, generateSalt } from './encryption';

const SINGLETON_ID = 'singleton';

@Injectable()
export class SettingsService implements OnModuleInit {
  private salt: string = '';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * On startup, ensure the encryption salt exists in the database.
   * Generate one if this is a fresh installation.
   */
  async onModuleInit() {
    const settings = await this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });

    if (!settings.encryptionSalt) {
      // First run — generate and store a random salt
      this.salt = generateSalt();
      await this.prisma.appSettings.update({
        where: { id: SINGLETON_ID },
        data: { encryptionSalt: this.salt },
      });
      console.log('[Settings] Generated new encryption salt');
    } else {
      this.salt = settings.encryptionSalt;
    }
  }

  /**
   * Get settings with API keys decrypted for use.
   */
  async getSettings() {
    const raw = await this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });

    return {
      ...raw,
      anthropicApiKey: decrypt(raw.anthropicApiKey, this.salt),
      usptoApiKey: decrypt(raw.usptoApiKey, this.salt),
    };
  }

  /**
   * Update settings, encrypting API keys before storage.
   */
  async updateSettings(dto: UpdateSettingsDto) {
    const data: Record<string, unknown> = {};
    if (dto.anthropicApiKey !== undefined) data.anthropicApiKey = encrypt(dto.anthropicApiKey, this.salt);
    if (dto.defaultModel !== undefined) data.defaultModel = dto.defaultModel;
    if (dto.researchModel !== undefined) data.researchModel = dto.researchModel;
    if (dto.maxTokens !== undefined) data.maxTokens = dto.maxTokens;
    if (dto.interStageDelaySeconds !== undefined) data.interStageDelaySeconds = dto.interStageDelaySeconds;
    if (dto.exportPath !== undefined) data.exportPath = dto.exportPath;
    if (dto.costCapUsd !== undefined) data.costCapUsd = dto.costCapUsd;
    if (dto.usptoApiKey !== undefined) data.usptoApiKey = encrypt(dto.usptoApiKey, this.salt);

    const raw = await this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });

    return {
      ...raw,
      anthropicApiKey: decrypt(raw.anthropicApiKey, this.salt),
      usptoApiKey: decrypt(raw.usptoApiKey, this.salt),
    };
  }

  /**
   * Get ODP API usage summary for the last 7 days.
   */
  async getOdpUsageSummary() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const usage = await this.prisma.odpApiUsage.findMany({
      where: { calledAt: { gte: weekAgo } },
      orderBy: { calledAt: 'desc' },
    });

    const totalQueries = usage.reduce((s, u) => s + u.queriesAttempted, 0);
    const totalResults = usage.reduce((s, u) => s + u.resultsFound, 0);
    const rateLimitHits = usage.filter(u => u.hadRateLimit).length;
    const errorCount = usage.filter(u => u.hadError).length;
    const lastUsed = usage.length > 0 ? usage[0].calledAt : null;

    return {
      thisWeek: {
        totalQueries,
        totalResults,
        rateLimitHits,
        errorCount,
        callCount: usage.length,
      },
      lastUsed,
      weeklyLimits: {
        patentFileWrapperDocs: 1_200_000,
        metadataRetrievals: 5_000_000,
      },
    };
  }
}
