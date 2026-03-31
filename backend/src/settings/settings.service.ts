import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { encrypt, decrypt } from './encryption';

const SINGLETON_ID = 'singleton';

/** Fields that contain sensitive data and should be encrypted at rest. */
const ENCRYPTED_FIELDS = ['anthropicApiKey', 'usptoApiKey'] as const;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get settings with API keys decrypted for use.
   */
  async getSettings() {
    const raw = await this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });

    // Decrypt sensitive fields
    return {
      ...raw,
      anthropicApiKey: decrypt(raw.anthropicApiKey),
      usptoApiKey: decrypt(raw.usptoApiKey),
    };
  }

  /**
   * Update settings, encrypting API keys before storage.
   */
  async updateSettings(dto: UpdateSettingsDto) {
    const data: Record<string, unknown> = {};
    if (dto.anthropicApiKey !== undefined) data.anthropicApiKey = encrypt(dto.anthropicApiKey);
    if (dto.defaultModel !== undefined) data.defaultModel = dto.defaultModel;
    if (dto.researchModel !== undefined) data.researchModel = dto.researchModel;
    if (dto.maxTokens !== undefined) data.maxTokens = dto.maxTokens;
    if (dto.interStageDelaySeconds !== undefined) data.interStageDelaySeconds = dto.interStageDelaySeconds;
    if (dto.exportPath !== undefined) data.exportPath = dto.exportPath;
    if (dto.costCapUsd !== undefined) data.costCapUsd = dto.costCapUsd;
    if (dto.usptoApiKey !== undefined) data.usptoApiKey = encrypt(dto.usptoApiKey);

    const raw = await this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });

    // Return decrypted for API response
    return {
      ...raw,
      anthropicApiKey: decrypt(raw.anthropicApiKey),
      usptoApiKey: decrypt(raw.usptoApiKey),
    };
  }
}
