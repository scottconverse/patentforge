/**
 * Tests for ClaimDraftService — ownership checks, validation, concurrency guards.
 */

import { NotFoundException } from '@nestjs/common';
import { ClaimDraftService } from './claim-draft.service';

const mockPrisma = {
  claim: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  claimDraft: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  feasibilityStage: { findMany: jest.fn() },
  feasibilityRun: { findFirst: jest.fn() },
  priorArtSearch: { findFirst: jest.fn() },
  patentDetail: { findUnique: jest.fn() },
  project: { findUnique: jest.fn() },
};

const mockSettings = {
  getSettings: jest.fn().mockResolvedValue({
    anthropicApiKey: 'test-key',
    defaultModel: 'claude-haiku-4-5-20251001',
    researchModel: '',
    maxTokens: 16000,
    costCapUsd: 0,
  }),
};

describe('ClaimDraftService', () => {
  let service: ClaimDraftService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClaimDraftService(mockPrisma as any, mockSettings as any);
  });

  describe('updateClaim', () => {
    it('updates claim when it belongs to the project', async () => {
      mockPrisma.claim.findFirst.mockResolvedValue({
        id: 'claim-1',
        text: 'old text',
      });
      mockPrisma.claim.update.mockResolvedValue({
        id: 'claim-1',
        text: 'new text',
      });

      const result = await service.updateClaim('project-1', 'claim-1', 'new text');
      expect(result.text).toBe('new text');
      expect(mockPrisma.claim.findFirst).toHaveBeenCalledWith({
        where: { id: 'claim-1', draft: { projectId: 'project-1' } },
      });
    });

    it('throws NotFoundException when claim does not belong to project', async () => {
      mockPrisma.claim.findFirst.mockResolvedValue(null);

      await expect(service.updateClaim('project-1', 'claim-999', 'text'))
        .rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when claim does not exist', async () => {
      mockPrisma.claim.findFirst.mockResolvedValue(null);

      await expect(service.updateClaim('project-1', 'nonexistent', 'text'))
        .rejects.toThrow(/not found/);
    });
  });
});
