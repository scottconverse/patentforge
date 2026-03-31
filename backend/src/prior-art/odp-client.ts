/**
 * USPTO Open Data Portal (ODP) client for prior art patent search.
 * Replaces the dead PatentsView API with data.uspto.gov.
 *
 * Rate limit rules (from ODP docs):
 *   - Burst = 1: one request at a time, no parallel requests with the same key
 *   - On HTTP 429: wait at least 5 seconds before retrying
 *   - Sequential requests only with delays between calls
 *
 * @see https://data.uspto.gov/apis/patent-file-wrapper/search
 * @see https://data.uspto.gov/apis/api-rate-limits
 */

import { PatentsViewPatent } from './patentsview-client';

const SEARCH_URL = 'https://api.uspto.gov/api/v1/patent/applications/search';
const TIMEOUT_MS = 30_000;
const DELAY_BETWEEN_QUERIES_MS = 1_500;
const RETRY_DELAY_ON_429_MS = 10_000;
const MAX_RETRIES_ON_429 = 1;
const RESULTS_PER_QUERY = 25;

interface ODPSearchBody {
  q: string;
  filters: { name: string; value: string[] }[];
  rangeFilters?: { field: string; valueFrom: string; valueTo: string }[];
  pagination: { offset: number; limit: number };
  sort: { field: string; order: string }[];
  fields: string[];
}

interface ODPApplicationMetaData {
  inventionTitle?: string;
  patentNumber?: string;
  grantDate?: string;
  filingDate?: string;
  effectiveFilingDate?: string;
  cpcClassificationBag?: string[];
  inventorBag?: { firstName?: string; lastName?: string; inventorNameText?: string }[];
  applicantBag?: { applicantNameText?: string }[];
  firstApplicantName?: string;
  applicationStatusDescriptionText?: string;
  publicationCategoryBag?: string[];
  applicationTypeLabelName?: string;
}

interface ODPSearchResult {
  applicationNumberText?: string;
  applicationMetaData?: ODPApplicationMetaData;
}

interface ODPSearchResponse {
  count: number;
  patentFileWrapperDataBag?: ODPSearchResult[];
  requestIdentifier?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a single ODP search query. Returns raw results.
 * Handles 429 with a single retry after a 10-second wait.
 */
async function queryODP(
  queryText: string,
  apiKey: string,
  retryCount = 0,
): Promise<ODPSearchResult[]> {
  const body: ODPSearchBody = {
    q: `applicationMetaData.inventionTitle:${queryText}`,
    filters: [
      { name: 'applicationMetaData.applicationTypeLabelName', value: ['Utility'] },
      { name: 'applicationMetaData.publicationCategoryBag', value: ['Granted/Issued'] },
    ],
    rangeFilters: [
      { field: 'applicationMetaData.filingDate', valueFrom: '2005-01-01', valueTo: '2026-12-31' },
    ],
    pagination: { offset: 0, limit: RESULTS_PER_QUERY },
    sort: [{ field: 'applicationMetaData.filingDate', order: 'Desc' }],
    fields: ['applicationNumberText', 'applicationMetaData'],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal as any,
    });

    if (res.status === 429) {
      if (retryCount < MAX_RETRIES_ON_429) {
        console.warn(`[ODP] Rate limited (429) for query "${queryText}", waiting ${RETRY_DELAY_ON_429_MS / 1000}s before retry...`);
        await sleep(RETRY_DELAY_ON_429_MS);
        return queryODP(queryText, apiKey, retryCount + 1);
      }
      console.warn(`[ODP] Rate limited (429) for query "${queryText}" after ${MAX_RETRIES_ON_429} retry, skipping`);
      return [];
    }

    if (res.status === 403) {
      console.warn('[ODP] API key rejected (403). Check that the USPTO API key is valid.');
      return [];
    }

    if (!res.ok) {
      console.warn(`[ODP] HTTP ${res.status} for query "${queryText}"`);
      return [];
    }

    const data = (await res.json()) as ODPSearchResponse;
    return data.patentFileWrapperDataBag ?? [];
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn(`[ODP] Timeout for query "${queryText}"`);
    } else {
      console.warn(`[ODP] Error for query "${queryText}":`, err.message);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Map an ODP search result to the PatentsViewPatent interface used by the rest of the system.
 * Returns null if the result doesn't have a patent number (not yet granted).
 */
function mapToPatentsViewPatent(result: ODPSearchResult): PatentsViewPatent | null {
  const meta = result.applicationMetaData;
  if (!meta) return null;

  // We only want granted patents with patent numbers
  const patentNumber = meta.patentNumber;
  if (!patentNumber) return null;

  return {
    patent_id: `US${patentNumber}`,
    patent_title: meta.inventionTitle ?? '(untitled)',
    patent_abstract: null, // ODP metadata doesn't include abstracts
    patent_date: meta.grantDate ?? meta.filingDate ?? null,
    patent_type: meta.applicationTypeLabelName ?? 'utility',
  };
}

/**
 * Search the USPTO Open Data Portal for patents matching the given queries.
 * Runs queries sequentially with delays to respect rate limits.
 * Returns results in the same PatentsViewPatent format for compatibility.
 */
export async function searchODPMulti(
  queries: string[],
  apiKey: string,
): Promise<PatentsViewPatent[]> {
  const seen = new Set<string>();
  const combined: PatentsViewPatent[] = [];

  // Limit to 3 queries to stay within rate limits
  const limitedQueries = queries.slice(0, 3);

  for (let i = 0; i < limitedQueries.length; i++) {
    if (i > 0) await sleep(DELAY_BETWEEN_QUERIES_MS);

    try {
      const results = await queryODP(limitedQueries[i], apiKey);
      for (const r of results) {
        const mapped = mapToPatentsViewPatent(r);
        if (mapped && !seen.has(mapped.patent_id)) {
          seen.add(mapped.patent_id);
          combined.push(mapped);
        }
      }
    } catch (err) {
      console.warn(`[ODP] Query "${limitedQueries[i]}" failed:`, (err as Error).message);
    }
  }

  return combined;
}
