import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fetchEnrichedPatent } from './patentsview-enrichment';

const CACHE_TTL_DAYS = 30;

@Injectable()
export class PatentDetailService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get enriched detail for a patent. Checks local cache first (30-day TTL),
   * then fetches from PatentsView if stale or missing.
   */
  async getDetail(patentNumber: string) {
    // Check cache
    const cached = await this.prisma.patentDetail.findUnique({
      where: { patentNumber },
    });

    if (cached && !this.isStale(cached.fetchedAt)) {
      return this.formatResponse(cached);
    }

    // Fetch from PatentsView
    const enriched = await fetchEnrichedPatent(patentNumber);
    if (!enriched) {
      if (cached) return this.formatResponse(cached); // stale cache is better than nothing
      throw new NotFoundException(`Patent ${patentNumber} not found in PatentsView`);
    }

    // Upsert into cache
    const data = {
      patentNumber,
      title: enriched.title,
      abstract: enriched.abstract,
      filingDate: enriched.filingDate,
      grantDate: enriched.grantDate,
      assignee: JSON.stringify(enriched.assignees),
      inventors: JSON.stringify(enriched.inventors),
      cpcClassifications: JSON.stringify(enriched.cpcClassifications),
      claimsText: enriched.claims.map(c => `${c.number}. ${c.text}`).join('\n\n'),
      claimCount: enriched.claimCount,
      patentType: enriched.patentType,
      fetchedAt: new Date(),
    };

    const detail = await this.prisma.patentDetail.upsert({
      where: { patentNumber },
      create: { ...data },
      update: { ...data },
    });

    return this.formatResponse(detail);
  }

  /**
   * Get just the claims text for a patent (lazy-loaded by frontend).
   */
  async getClaims(patentNumber: string) {
    // Try cache first
    const cached = await this.prisma.patentDetail.findUnique({
      where: { patentNumber },
      select: { claimsText: true, claimCount: true },
    });

    if (cached?.claimsText) {
      return { claimsText: cached.claimsText, claimCount: cached.claimCount };
    }

    // Fetch if not cached
    const detail = await this.getDetail(patentNumber);
    return { claimsText: detail.claimsText, claimCount: detail.claimCount };
  }

  /**
   * Batch-fetch details for CSV export. Fetches missing ones from PatentsView.
   */
  async enrichBatch(patentNumbers: string[]): Promise<Map<string, any>> {
    const result = new Map<string, any>();

    // Load all cached
    const cached = await this.prisma.patentDetail.findMany({
      where: { patentNumber: { in: patentNumbers } },
    });

    for (const c of cached) {
      result.set(c.patentNumber, this.formatResponse(c));
    }

    // Fetch any missing (but don't block CSV on failed fetches)
    const missing = patentNumbers.filter(pn => !result.has(pn));
    for (const pn of missing) {
      try {
        const detail = await this.getDetail(pn);
        result.set(pn, detail);
      } catch {
        // Leave as unresolved — CSV will have empty columns
      }
    }

    return result;
  }

  private isStale(fetchedAt: Date): boolean {
    const ageMs = Date.now() - fetchedAt.getTime();
    return ageMs > CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  }

  private formatResponse(detail: any) {
    return {
      patentNumber: detail.patentNumber,
      title: detail.title,
      abstract: detail.abstract,
      filingDate: detail.filingDate,
      grantDate: detail.grantDate,
      assignee: this.parseJsonArray(detail.assignee),
      inventors: this.parseJsonArray(detail.inventors),
      cpcClassifications: this.parseJsonArray(detail.cpcClassifications),
      claimsText: detail.claimsText,
      claimCount: detail.claimCount,
      patentType: detail.patentType,
    };
  }

  private parseJsonArray(json: string | null): any[] {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  }
}
