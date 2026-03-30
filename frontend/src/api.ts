const BASE = '/api';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
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
  feasibility: {
    start: (projectId: string) => req<any>('POST', `/projects/${projectId}/feasibility/run`),
    get: (projectId: string) => req<any>('GET', `/projects/${projectId}/feasibility`),
    cancel: (projectId: string) => req<any>('POST', `/projects/${projectId}/feasibility/cancel`),
    patchRun: (projectId: string, data: { status?: string; finalReport?: string }) =>
      req<any>('PATCH', `/projects/${projectId}/feasibility/run`, data),
    patchStage: (projectId: string, stageNumber: number, data: unknown) =>
      req<any>('PATCH', `/projects/${projectId}/feasibility/stages/${stageNumber}`, data),
  },
  settings: {
    get: () => req<any>('GET', '/settings'),
    update: (data: unknown) => req<any>('PUT', '/settings', data),
  },
};
