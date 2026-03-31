/**
 * Tests for server-side cost cap enforcement.
 * Verifies that pipelines are blocked when cumulative cost exceeds the cap.
 */

import { FeasibilityService } from './feasibility.service';

// Mock PrismaService
const mockPrisma = {
  feasibilityStage: {
    findMany: jest.fn(),
  },
  feasibilityRun: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('Cost Cap Enforcement', () => {
  let service: FeasibilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FeasibilityService(mockPrisma as any);
  });

  describe('getProjectCumulativeCost', () => {
    it('returns 0 when no stages have cost data', async () => {
      mockPrisma.feasibilityStage.findMany.mockResolvedValue([]);

      const cost = await service.getProjectCumulativeCost('project-1');
      expect(cost).toBe(0);
    });

    it('sums estimatedCostUsd across all stages', async () => {
      mockPrisma.feasibilityStage.findMany.mockResolvedValue([
        { estimatedCostUsd: 0.50 },
        { estimatedCostUsd: 0.75 },
        { estimatedCostUsd: 0.25 },
        { estimatedCostUsd: 1.00 },
      ]);

      const cost = await service.getProjectCumulativeCost('project-1');
      expect(cost).toBe(2.50);
    });

    it('handles null estimatedCostUsd values', async () => {
      mockPrisma.feasibilityStage.findMany.mockResolvedValue([
        { estimatedCostUsd: 0.50 },
        { estimatedCostUsd: null },
        { estimatedCostUsd: 1.00 },
      ]);

      const cost = await service.getProjectCumulativeCost('project-1');
      expect(cost).toBe(1.50);
    });

    it('queries only stages belonging to the given project', async () => {
      mockPrisma.feasibilityStage.findMany.mockResolvedValue([]);

      await service.getProjectCumulativeCost('project-xyz');

      expect(mockPrisma.feasibilityStage.findMany).toHaveBeenCalledWith({
        where: {
          feasibilityRun: { projectId: 'project-xyz' },
          estimatedCostUsd: { not: null },
        },
        select: { estimatedCostUsd: true },
      });
    });
  });
});
