import { PriorArtSearch, PatentDetail } from './types';

const BASE = '/api';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.message || json.error || text;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  projects: {
    list: () => req<any[]>('GET', '/projects'),
    create: (title: string) => req<any>('POST', '/projects', { title }),
    get: (id: string) => req<any>('GET', `/projects/${id}`),
    delete: (id: string) => req<void>('DELETE', `/projects/${id}`),
  },
  invention: {
    get: (projectId: string) => req<any>('GET', `/projects/${projectId}/invention`),
    upsert: (projectId: string, data: unknown) => req<any>('PUT', `/projects/${projectId}/invention`, data),
  },
  priorArt: {
    get: (projectId: string) => req<PriorArtSearch>('GET', `/projects/${projectId}/prior-art`),
    status: (projectId: string) =>
      req<{ status: string; resultCount: number; completedAt: string | null }>(
        'GET',
        `/projects/${projectId}/prior-art/status`,
      ),
  },
  feasibility: {
    start: (projectId: string, body?: { narrative?: string }) =>
      req<any>('POST', `/projects/${projectId}/feasibility/run`, body ?? {}),
    get: (projectId: string) => req<any>('GET', `/projects/${projectId}/feasibility`),
    cancel: (projectId: string) => req<any>('POST', `/projects/${projectId}/feasibility/cancel`),
    patchRun: (projectId: string, data: { status?: string; finalReport?: string }) =>
      req<any>('PATCH', `/projects/${projectId}/feasibility/run`, data),
    patchStage: (projectId: string, stageNumber: number, data: unknown) =>
      req<any>('PATCH', `/projects/${projectId}/feasibility/stages/${stageNumber}`, data),
    exportToDisk: (projectId: string) =>
      req<{ folderPath: string; mdFile: string; htmlFile: string }>('POST', `/projects/${projectId}/feasibility/export`),
    exportToDocx: async (projectId: string): Promise<Blob> => {
      const res = await fetch(`${BASE}/projects/${projectId}/feasibility/export/docx`);
      if (!res.ok) {
        const text = await res.text();
        let message = text;
        try { const json = JSON.parse(text); message = json.message || json.error || text; } catch {}
        throw new Error(message);
      }
      return res.blob();
    },
    runs: (projectId: string) => req<any[]>('GET', `/projects/${projectId}/feasibility/runs`),
    getVersion: (projectId: string, version: number) =>
      req<any>('GET', `/projects/${projectId}/feasibility/${version}`),
    rerunFromStage: (projectId: string, fromStage: number) =>
      req<any>('POST', `/projects/${projectId}/feasibility/rerun`, { fromStage }),
  },
  patents: {
    getDetail: (patentNumber: string) =>
      req<PatentDetail>('GET', `/patents/${patentNumber}`),
    getClaims: (patentNumber: string) =>
      req<{ claimsText: string | null; claimCount: number | null }>('GET', `/patents/${patentNumber}/claims`),
    getFamily: (patentNumber: string) =>
      req<Array<{
        patentNumber: string | null;
        applicationNumber: string | null;
        relationship: string;
        filingDate: string | null;
        grantDate: string | null;
        title: string | null;
        status: string | null;
      }>>('GET', `/patents/${patentNumber}/family`),
  },
  claimDraft: {
    start: (projectId: string) => req<any>('POST', `/projects/${projectId}/claims/draft`),
    getLatest: (projectId: string) => req<any>('GET', `/projects/${projectId}/claims`),
    getVersion: (projectId: string, version: number) =>
      req<any>('GET', `/projects/${projectId}/claims/${version}`),
    updateClaim: (projectId: string, claimId: string, text: string) =>
      req<any>('PUT', `/projects/${projectId}/claims/edit/${claimId}`, { text }),
    regenerateClaim: (projectId: string, claimNumber: number) =>
      req<any>('POST', `/projects/${projectId}/claims/${claimNumber}/regenerate`),
  },
  compliance: {
    startCheck: (projectId: string, draftVersion?: number) =>
      req<any>('POST', `/projects/${projectId}/compliance/check`, draftVersion ? { draftVersion } : {}),
    getLatest: (projectId: string) =>
      req<any>('GET', `/projects/${projectId}/compliance`),
    getVersion: (projectId: string, version: number) =>
      req<any>('GET', `/projects/${projectId}/compliance/${version}`),
  },
  settings: {
    get: () => req<any>('GET', '/settings'),
    update: (data: unknown) => req<any>('PUT', '/settings', data),
  },
};
