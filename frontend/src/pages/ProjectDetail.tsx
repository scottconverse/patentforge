import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { Project, InventionInput, FeasibilityRun, FeasibilityStage, RunStatus, AppSettings, FeasibilityRunSummary, PriorArtSearch } from '../types';
import InventionForm from './InventionForm';
import ReportViewer from '../components/ReportViewer';
import StageProgress from '../components/StageProgress';
import StreamingOutput from '../components/StreamingOutput';
import Toast from '../components/Toast';
import CostConfirmModal from '../components/CostConfirmModal';
import ClaimsTab from '../components/ClaimsTab';
import ComplianceTab from '../components/ComplianceTab';
import PriorArtPanel from '../components/PriorArtPanel';
import PatentDetailDrawer from '../components/PatentDetailDrawer';
import { formatCost } from '../utils/format';

// ----- Narrative builder -----
function toNarrative(inv: InventionInput): string {
  const parts: string[] = [];
  function add(label: string, value?: string) {
    if (value && value.trim()) parts.push(`**${label}:** ${value.trim()}`);
  }
  add('Invention Title', inv.title);
  add('Description', inv.description);
  add('Problem Solved', inv.problemSolved);
  add('How It Works', inv.howItWorks);
  add('AI / ML Components', inv.aiComponents);
  add('3D Printing / Physical Design Components', inv.threeDPrintComponents);
  add('What I Believe Is Novel', inv.whatIsNovel);
  add('Current Alternatives / Prior Solutions', inv.currentAlternatives);
  add('What Has Been Built So Far', inv.whatIsBuilt);
  add('What I Want Protected', inv.whatToProtect);
  add('Additional Notes', inv.additionalNotes);
  return parts.join('\n\n');
}

// ----- Status badge -----
const statusColors: Record<string, string> = {
  INTAKE: 'bg-gray-700 text-gray-300',
  FEASIBILITY: 'bg-blue-900 text-blue-300',
  PRIOR_ART: 'bg-purple-900 text-purple-300',
  DRAFTING: 'bg-yellow-900 text-yellow-300',
  COMPLIANCE: 'bg-orange-900 text-orange-300',
  APPLICATION: 'bg-green-900 text-green-300',
  FILED: 'bg-emerald-900 text-emerald-300',
  ABANDONED: 'bg-red-900 text-red-300',
};

// ----- Default stage placeholders (shown before a run starts) -----
const DEFAULT_STAGE_NAMES = [
  'Technical Intake & Restatement',
  'Prior Art Research',
  'Patentability Analysis',
  'Deep Dive Analysis',
  'IP Strategy & Recommendations',
  'Comprehensive Report',
];

function makePlaceholderStages(): FeasibilityStage[] {
  return DEFAULT_STAGE_NAMES.map((name, idx) => ({
    id: `placeholder-${idx + 1}`,
    feasibilityRunId: '',
    stageNumber: idx + 1,
    stageName: name,
    status: 'PENDING' as RunStatus,
    webSearchUsed: false,
  }));
}

// ----- Cost estimation -----
// Fallback prices (used if LiteLLM fetch fails)
// Seed values from Anthropic pricing page — updated whenever a live LiteLLM fetch succeeds,
// so the fallback is at most as stale as the last successful fetch (days, not months).
let _fallbackPricing: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'claude-haiku-4-5-20251001': { inputPer1M: 0.80,  outputPer1M: 4.00 },
  'claude-sonnet-4-20250514':  { inputPer1M: 3.00,  outputPer1M: 15.00 },
  'claude-opus-4-20250514':    { inputPer1M: 15.00, outputPer1M: 75.00 },
};

// LiteLLM pricing cache (community-maintained, updated within days of Anthropic price changes)
// Source: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
const LITELLM_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
let _pricingCache: Record<string, { inputPer1M: number; outputPer1M: number }> | null = null;
let _pricingCachedAt = 0;
const PRICING_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchLivePricing(): Promise<Record<string, { inputPer1M: number; outputPer1M: number }>> {
  if (_pricingCache && Date.now() - _pricingCachedAt < PRICING_TTL_MS) return _pricingCache;
  try {
    const res = await fetch(LITELLM_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json() as Record<string, any>;
    const result: Record<string, { inputPer1M: number; outputPer1M: number }> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (val?.input_cost_per_token != null && val?.output_cost_per_token != null) {
        result[key] = {
          inputPer1M:  val.input_cost_per_token  * 1_000_000,
          outputPer1M: val.output_cost_per_token * 1_000_000,
        };
      }
    }
    _pricingCache = result;
    _pricingCachedAt = Date.now();
    // Update fallback with latest live data so future failed fetches use recent prices
    _fallbackPricing = { ..._fallbackPricing, ...result };
    return result;
  } catch {
    return _fallbackPricing;
  }
}

// Web search: Anthropic charges $0.01 per search. Stage 2 always searches;
// other stages occasionally do. Estimate ~15 searches per run.
const WEB_SEARCH_COST_PER_SEARCH = 0.01;
const ESTIMATED_SEARCHES_PER_RUN = 15;
const ESTIMATED_WEB_SEARCH_COST = ESTIMATED_SEARCHES_PER_RUN * WEB_SEARCH_COST_PER_SEARCH;

async function estimateRunCosts(model: string, maxTokens: number): Promise<{ tokenCost: number; webSearchCost: number }> {
  const pricing = await fetchLivePricing();
  const p = pricing[model] ?? _fallbackPricing[model] ?? { inputPer1M: 3.00, outputPer1M: 15.00 };
  const avgInputTokens = 8000;
  const stages = 6;
  const tokenCost = stages * (
    (avgInputTokens / 1_000_000) * p.inputPer1M +
    (maxTokens / 1_000_000) * p.outputPer1M
  );
  return { tokenCost, webSearchCost: ESTIMATED_WEB_SEARCH_COST };
}

type ViewMode = 'overview' | 'invention-form' | 'running' | 'report' | 'stage-output' | 'history' | 'prior-art' | 'claims' | 'compliance';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI mode
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  // Streaming state
  const [stages, setStages] = useState<FeasibilityStage[]>(makePlaceholderStages());
  const [activeStageNum, setActiveStageNum] = useState<number | undefined>();
  const [currentStageName, setCurrentStageName] = useState('');
  const [streamText, setStreamText] = useState('');
  const [isStreamComplete, setIsStreamComplete] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);

  // Stage output viewer
  const [selectedStage, setSelectedStage] = useState<FeasibilityStage | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; detail?: string; type?: 'success' | 'error' | 'info' } | null>(null);

  // Cost confirmation modal
  const [costModal, setCostModal] = useState<{
    tokenCost: number; webSearchCost: number; cap: number; model: string; maxTokens: number; stageCount?: number;
  } | null>(null);
  const pendingRunRef = useRef<(() => Promise<void>) | null>(null);

  // Run history (Feature E)
  const [runHistory, setRunHistory] = useState<FeasibilityRunSummary[]>([]);
  const [selectedRunVersion, setSelectedRunVersion] = useState<number | null>(null);
  const [historicalReport, setHistoricalReport] = useState<string | null>(null);

  // Prior art
  const [priorArtSearch, setPriorArtSearch] = useState<PriorArtSearch | null>(null);

  // Claim draft status (for compliance tab)
  const [claimDraftStatus, setClaimDraftStatus] = useState<{ status: string; claims?: any[] } | null>(null);

  // Patent detail drawer
  const [drawerPatent, setDrawerPatent] = useState<string | null>(null);

  // ----- Load project -----
  const loadProject = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.projects.get(id);
      setProject(data);

      // Load prior art search state
      api.priorArt.get(id).then(pa => setPriorArtSearch(pa)).catch(() => {});

      // Load claim draft status (for compliance tab)
      api.claimDraft.getLatest(id).then(d => setClaimDraftStatus(d)).catch(() => {});

      // Determine initial view mode
      const latestRun = getLatestRun(data);
      if (latestRun) {
        if (latestRun.status === 'COMPLETE' || latestRun.status === 'ERROR') {
          setStages(latestRun.stages?.length ? latestRun.stages : makePlaceholderStages());
          setViewMode('report');
        } else if (latestRun.status === 'RUNNING') {
          // Stale RUNNING run — the pipeline died (browser closed, service crashed, etc.)
          // No active abort controller means nothing is actually streaming. Mark it ERROR
          // in the backend, load whatever partial stage output exists, and show report view.
          const partialStages = (latestRun.stages ?? []).map(s =>
            (s.status === 'RUNNING' || s.status === 'PENDING')
              ? { ...s, status: 'ERROR' as RunStatus, errorMessage: 'Pipeline interrupted — service was restarted or browser was closed.' }
              : s
          );
          setStages(partialStages.length ? partialStages : makePlaceholderStages());
          setRunError('Pipeline was interrupted (service restarted or browser closed). Partial results shown below. Click "Re-run" to try again.');
          setViewMode('report');
          // Patch backend so it doesn't stay RUNNING forever
          try {
            await api.feasibility.patchRun(data.id, { status: 'ERROR' });
          } catch {
            // non-fatal
          }
        } else {
          setViewMode('overview');
        }
      } else if (!data.invention) {
        setViewMode('invention-form');
      } else {
        setViewMode('overview');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
    return () => {
      abortRef.current?.abort();
    };
  }, [loadProject]);

  function getLatestRun(p: Project | null): FeasibilityRun | null {
    if (!p?.feasibility || !Array.isArray(p.feasibility) || p.feasibility.length === 0) return null;
    return [...p.feasibility].sort((a, b) => b.version - a.version)[0];
  }

  // ----- History handlers (Feature E) -----
  async function handleShowHistory() {
    if (!id) return;
    try {
      const summaries = await api.feasibility.runs(id);
      setRunHistory(summaries);
      setViewMode('history');
    } catch (e: any) {
      setToast({ message: 'Failed to load history', detail: e.message, type: 'error' });
    }
  }

  async function handleLoadHistoricalRun(version: number) {
    if (!id) return;
    try {
      const run = await api.feasibility.getVersion(id, version);
      setHistoricalReport(run.finalReport ?? null);
      setSelectedRunVersion(version);
      setViewMode('report');
    } catch (e: any) {
      setToast({ message: 'Failed to load run', detail: e.message, type: 'error' });
    }
  }

  // ----- Run feasibility -----
  async function handleRunFeasibility(invention?: InventionInput) {
    if (!id) return;
    const inv = invention || project?.invention;
    if (!inv) {
      setError('Please fill in invention details first.');
      setViewMode('invention-form');
      return;
    }

    // Load settings first to show cost modal
    let appSettings: AppSettings;
    try {
      appSettings = await api.settings.get();
    } catch (e: any) {
      setToast({ message: 'Failed to load settings', detail: e.message, type: 'error' });
      return;
    }

    if (!appSettings.anthropicApiKey) {
      setToast({
        message: 'No API key configured',
        detail: 'Add your Anthropic API key in Settings before running.',
        type: 'error',
      });
      return;
    }

    const model = appSettings.defaultModel || 'claude-haiku-4-5-20251001';
    const maxTokens = appSettings.maxTokens || 32000;
    const cap = appSettings.costCapUsd ?? 5.00;
    const { tokenCost, webSearchCost } = await estimateRunCosts(model, maxTokens);

    // Store run closure and show modal
    pendingRunRef.current = async () => {
      setCostModal(null);
      await proceedWithRun(appSettings, inv);
    };
    setCostModal({ tokenCost, webSearchCost, cap, model, maxTokens });
  }

  // Resume a failed/interrupted run from the first incomplete stage,
  // reusing saved outputs from already-completed stages.
  async function handleResume() {
    if (!id || !project?.invention) return;
    const inv = project.invention;

    // Find first stage that didn't complete
    const completedOutputs: Record<number, string> = {};
    let resumeFrom = 1;
    for (const s of displayStages) {
      if (s.status === 'COMPLETE' && s.outputText) {
        completedOutputs[s.stageNumber] = s.outputText;
        resumeFrom = s.stageNumber + 1;
      } else {
        break;
      }
    }
    if (resumeFrom > 6) return; // already all done

    let appSettings: AppSettings;
    try {
      appSettings = await api.settings.get();
    } catch (e: any) {
      setToast({ message: 'Failed to load settings', detail: (e as Error).message, type: 'error' });
      return;
    }
    if (!appSettings.anthropicApiKey) {
      setToast({ message: 'No API key configured', detail: 'Add your Anthropic API key in Settings.', type: 'error' });
      return;
    }

    const model = appSettings.defaultModel || 'claude-haiku-4-5-20251001';
    const maxTokens = appSettings.maxTokens || 32000;
    const cap = appSettings.costCapUsd ?? 5.00;
    const remainingStages = 6 - resumeFrom + 1;
    // Estimate cost only for remaining stages
    const { tokenCost, webSearchCost } = await estimateRunCosts(model, maxTokens);
    const partialTokenCost = parseFloat((tokenCost * remainingStages / 6).toFixed(3));
    const partialWebCost = parseFloat((webSearchCost * remainingStages / 6).toFixed(2));

    pendingRunRef.current = async () => {
      setCostModal(null);
      await proceedWithRun(appSettings, inv, resumeFrom, completedOutputs);
    };
    setCostModal({ tokenCost: partialTokenCost, webSearchCost: partialWebCost, cap, model, maxTokens, stageCount: remainingStages });
  }

  async function proceedWithRun(appSettings: AppSettings, inv: InventionInput, startFromStage = 1, previousOutputs: Record<number, string> = {}) {
    if (!id) return;

    setRunError(null);
    setStreamText('');
    setIsStreamComplete(false);
    setActiveStageNum(undefined);
    // When resuming, preserve completed stage display; otherwise reset to placeholders
    if (startFromStage > 1) {
      setStages(prev => prev.map(s =>
        s.stageNumber < startFromStage ? s : { ...s, status: 'PENDING' as RunStatus, outputText: undefined }
      ));
    } else {
      setStages(makePlaceholderStages());
    }
    setSelectedRunVersion(null);
    setHistoricalReport(null);
    setViewMode('running');

    try {
      if (!appSettings.defaultModel) {
        throw new Error('No AI model configured. Go to Settings and select a default model before running analysis.');
      }

      // Map AppSettings → AnalysisSettings (feasibility service field names)
      // API key is NOT sent from the frontend — the backend injects it server-side
      const settings = {
        model: appSettings.defaultModel,
        researchModel: appSettings.researchModel || undefined,
        maxTokens: appSettings.maxTokens || 32000,
        interStageDelaySeconds: appSettings.interStageDelaySeconds ?? 5,
      };

      // Build narrative
      const narrative = toNarrative(inv);

      // When resuming, reuse the interrupted run (keeps all stage data intact).
      // When starting fresh, create a new run.
      let runId: string;
      if (startFromStage > 1) {
        const existingRun = getLatestRun(project);
        if (!existingRun) throw new Error('No existing run to resume');
        runId = existingRun.id;
        runIdRef.current = runId;
        try {
          await api.feasibility.patchRun(id, { status: 'RUNNING' });
        } catch { /* non-fatal */ }
      } else {
        const run = await api.feasibility.start(id, { narrative });
        runId = run.id;
        runIdRef.current = runId;
        setProject(prev => {
          if (!prev) return prev;
          const existing = prev.feasibility || [];
          return { ...prev, feasibility: [...existing, run] };
        });
        try {
          await api.feasibility.patchRun(id, { status: 'RUNNING' });
        } catch { /* non-fatal */ }
      }

      // Wait up to 45s for prior art to complete before starting pipeline
      async function waitForPriorArt(projectId: string, maxWaitMs: number): Promise<string | null> {
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
          try {
            const status = await api.priorArt.status(projectId);
            if (status.status === 'COMPLETE') {
              const search = await api.priorArt.get(projectId);
              setPriorArtSearch(search);
              if (search.results.length > 0) {
                const rows = search.results.slice(0, 10).map(r =>
                  `| ${r.patentNumber} | ${r.title.slice(0, 60)} | ${Math.round(r.relevanceScore * 100)}% |`
                );
                const table = ['| Patent | Title | Relevance |', '|---|---|---|', ...rows].join('\n');
                const abstracts = search.results.slice(0, 5).map(r =>
                  `**${r.patentNumber}** — ${r.title}\n${r.snippet || r.abstract?.slice(0, 250) || ''}`
                ).join('\n\n');
                return `${table}\n\n**Key abstracts:**\n\n${abstracts}`;
              }
              return null;
            }
            if (status.status === 'ERROR' || status.status === 'NONE') return null;
          } catch { return null; }
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        return null;
      }

      // Skip prior art wait when resuming (Stage 2 already completed with prior art context)
      const priorArtContext = startFromStage <= 2 ? await waitForPriorArt(id, 45_000) : null;

      // Connect to feasibility service via SSE
      const abortController = new AbortController();
      abortRef.current = abortController;

      // SSE stream proxied through the backend — feasibility service is internal-only
      const response = await fetch(`/api/projects/${id}/feasibility/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventionNarrative: narrative,
          settings,
          priorArtContext: priorArtContext || undefined,
          ...(startFromStage > 1 ? { startFromStage, previousOutputs } : {}),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Feasibility service error ${response.status}: ${await response.text()}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let stageOutputAccumulator = '';
      let currentStageNum = 0;
      let currentStageNameLocal = '';
      let currentStageStart: string | null = null;
      let pipelineCompleted = false;

      // Throttle stream text updates — render at most every 250ms (~4fps).
      // Even plain-text <pre> re-renders + scrollIntoView crash the browser at 60fps.
      let streamDirty = false;
      let throttleTimer: ReturnType<typeof setTimeout> | null = null;
      function scheduleStreamUpdate() {
        streamDirty = true;
        if (throttleTimer !== null) return; // already scheduled
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
          if (streamDirty) {
            setStreamText(stageOutputAccumulator);
            streamDirty = false;
          }
        }, 250);
      }
      let totalActualCost = 0;

      const updateStageStatus = (stageNum: number, updates: Partial<FeasibilityStage>) => {
        setStages(prev =>
          prev.map(s =>
            s.stageNumber === stageNum ? { ...s, ...updates } : s
          )
        );
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!; // keep incomplete last line

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            let data: any;
            try {
              data = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            const eventType = data.type || currentEvent;

            if (eventType === 'stage_start') {
              currentStageNum = data.stage;
              currentStageNameLocal = data.name || `Stage ${data.stage}`;
              currentStageStart = new Date().toISOString();
              stageOutputAccumulator = '';
              setActiveStageNum(currentStageNum);
              setCurrentStageName(currentStageNameLocal);
              setStreamText('');
              setIsStreamComplete(false);
              updateStageStatus(currentStageNum, {
                stageName: currentStageNameLocal,
                status: 'RUNNING',
                startedAt: currentStageStart,
              });

            } else if (eventType === 'token') {
              stageOutputAccumulator += data.text || '';
              streamDirty = true;
              scheduleStreamUpdate();

            } else if (eventType === 'stage_complete') {
              // Flush any pending stream update
              if (throttleTimer !== null) { clearTimeout(throttleTimer); throttleTimer = null; }
              setStreamText(stageOutputAccumulator);
              streamDirty = false;

              const completedAt = new Date().toISOString();
              const outputText = data.output || stageOutputAccumulator;
              const inputTokens: number = data.inputTokens ?? 0;
              const outputTokens: number = data.outputTokens ?? 0;
              const estimatedCostUsd: number = data.estimatedCostUsd ?? 0;
              totalActualCost += estimatedCostUsd;
              updateStageStatus(currentStageNum, {
                status: 'COMPLETE',
                outputText,
                completedAt,
                webSearchUsed: data.webSearchUsed || false,
                model: data.model,
                inputTokens,
                outputTokens,
                estimatedCostUsd,
              });
              setIsStreamComplete(true);

              // Patch the stage in the backend and check cost cap
              try {
                const patchResult = await api.feasibility.patchStage(id, currentStageNum, {
                  status: 'COMPLETE',
                  outputText,
                  ...(currentStageStart ? { startedAt: currentStageStart } : {}),
                  completedAt,
                  webSearchUsed: data.webSearchUsed || false,
                  model: data.model,
                  inputTokens,
                  outputTokens,
                  estimatedCostUsd,
                });

                // If cost cap exceeded, cancel the pipeline
                if (patchResult?.costCapExceeded) {
                  console.warn(`[CostCap] Cumulative cost $${patchResult.cumulativeCost.toFixed(2)} exceeds cap $${patchResult.costCapUsd.toFixed(2)}. Cancelling pipeline.`);
                  try { await api.feasibility.cancel(id); } catch {}
                  setError(`Cost cap reached ($${patchResult.cumulativeCost.toFixed(2)} of $${patchResult.costCapUsd.toFixed(2)}). Pipeline stopped. Increase the cap in Settings to continue.`);
                  setViewMode('overview');
                }
              } catch {
                // non-fatal
              }

            } else if (eventType === 'stage_error') {
              updateStageStatus(currentStageNum, {
                status: 'ERROR',
                errorMessage: data.error || 'Stage failed',
                completedAt: new Date().toISOString(),
              });
              setRunError(`Stage ${currentStageNum} error: ${data.error || 'Unknown error'}`);

            } else if (eventType === 'pipeline_complete') {
              pipelineCompleted = true;
              // Persist finalReport to backend
              try {
                await api.feasibility.patchRun(id, {
                  status: 'COMPLETE',
                  finalReport: data.finalReport || stageOutputAccumulator,
                });
              } catch {
                // non-fatal
              }
              // Auto-export to desktop
              try {
                const exportResult = await api.feasibility.exportToDisk(id);
                setToast({
                  message: `Analysis complete · actual cost: ${formatCost(totalActualCost)}`,
                  detail: exportResult.folderPath,
                  type: 'success',
                });
              } catch {
                setToast({
                  message: `Analysis complete · actual cost: ${formatCost(totalActualCost)}`,
                  type: 'success',
                });
              }
              await loadProject();
              return;

            } else if (eventType === 'pipeline_error') {
              setRunError(data.error || 'Pipeline failed');
              setStages(prev =>
                prev.map(s =>
                  s.status === 'RUNNING' ? { ...s, status: 'ERROR' as RunStatus } : s
                )
              );
            } else if (eventType === 'cancelled') {
              setStages(prev =>
                prev.map(s =>
                  s.status === 'RUNNING' || s.status === 'PENDING'
                    ? { ...s, status: 'CANCELLED' as RunStatus }
                    : s
                )
              );
              setRunError('Analysis was cancelled.');
            }

            currentEvent = '';
          }
        }
      }

      // Stream ended without pipeline_complete — connection dropped or service crashed
      if (!pipelineCompleted) {
        setRunError(
          `Connection to analysis service lost after Stage ${currentStageNum || '?'}. ` +
          `Check the feasibility service logs and re-run.`
        );
        setStages(prev =>
          prev.map(s =>
            s.status === 'RUNNING' || s.status === 'PENDING'
              ? { ...s, status: 'ERROR' as RunStatus }
              : s
          )
        );
      }

    } catch (e: any) {
      if (e.name === 'AbortError') {
        setRunError('Analysis cancelled.');
        return;
      }
      setRunError(e.message || 'Failed to run feasibility analysis');
      setStages(prev =>
        prev.map(s =>
          s.status === 'RUNNING' || s.status === 'PENDING'
            ? { ...s, status: 'ERROR' as RunStatus }
            : s
        )
      );
    }
  }

  async function handleCancel() {
    if (!id) return;
    try {
      setCancelling(true);
      abortRef.current?.abort();
      await api.feasibility.cancel(id);
      setStages(prev =>
        prev.map(s =>
          s.status === 'RUNNING' || s.status === 'PENDING'
            ? { ...s, status: 'CANCELLED' as RunStatus }
            : s
        )
      );
      setRunError('Analysis cancelled.');
    } catch {
      // ignore
    } finally {
      setCancelling(false);
    }
  }

  // ----- Derived state -----
  const latestRun = getLatestRun(project);
  const isRunning = viewMode === 'running' && !runError;

  // ----- Render -----
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <span className="w-6 h-6 rounded-full border-2 border-gray-600 border-t-blue-500 animate-spin mr-3" />
        Loading project...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="p-4 bg-red-900/40 border border-red-800 rounded-lg text-red-300">{error}</div>
        <button onClick={() => navigate('/')} className="mt-4 text-sm text-blue-400 hover:text-blue-300">
          ← Back to Projects
        </button>
      </div>
    );
  }

  if (!project) return null;

  const displayStages = (viewMode === 'running' || viewMode === 'report')
    ? stages
    : (latestRun?.stages?.length ? latestRun.stages : makePlaceholderStages());

  const totalRunCost = displayStages.reduce((sum, s) => sum + (s.estimatedCostUsd ?? 0), 0);

  // Report content to display (historical or latest)
  const reportContent = historicalReport ?? latestRun?.finalReport ?? null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-gray-300 transition-colors">Projects</Link>
        <span>/</span>
        <span className="text-gray-300 truncate max-w-xs">{project.title}</span>
        <span
          className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[project.status] || 'bg-gray-700 text-gray-300'}`}
        >
          {project.status}
        </span>
      </div>

      <div className="flex gap-6">
        {/* ---- LEFT SIDEBAR ---- */}
        <aside className="w-64 shrink-0 space-y-4">
          {/* Pipeline nav */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pipeline</h3>

            {/* Intake */}
            <button
              onClick={() => setViewMode(viewMode === 'invention-form' ? 'overview' : 'invention-form')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors mb-2 ${
                viewMode === 'invention-form'
                  ? 'bg-blue-900 text-blue-300 border border-blue-700'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold ${project.invention ? 'border-green-500 bg-green-900 text-green-400' : 'border-gray-600 text-gray-500'}`}>
                {project.invention ? '✓' : '1'}
              </span>
              <span>Invention Intake</span>
            </button>

            {/* Feasibility */}
            <div className={`px-3 py-2 rounded text-sm mb-2 ${
              viewMode === 'running' || viewMode === 'report'
                ? 'bg-blue-950 border border-blue-800'
                : 'text-gray-400'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                  latestRun?.status === 'COMPLETE' ? 'border-green-500 bg-green-900 text-green-400' :
                  latestRun?.status === 'RUNNING' ? 'border-blue-500' :
                  'border-gray-600 text-gray-500'
                }`}>
                  {latestRun?.status === 'COMPLETE' ? '✓' :
                   latestRun?.status === 'RUNNING' ? (
                     <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                   ) : '2'}
                </span>
                <span className={latestRun?.status === 'COMPLETE' ? 'text-green-400' : latestRun?.status === 'RUNNING' ? 'text-blue-300' : 'text-gray-400'}>
                  Feasibility
                </span>
              </div>
              <StageProgress
                stages={displayStages}
                activeStage={activeStageNum}
                pipelineIdle={viewMode !== 'running'}
                onStageClick={(stage) => {
                  setSelectedStage(stage);
                  setViewMode('stage-output');
                }}
                onRerunFromStage={async (fromStage) => {
                  if (!id || !project?.invention) return;
                  try {
                    // Create a new versioned run with stages 1..fromStage-1 copied
                    const newRun = await api.feasibility.rerunFromStage(id, fromStage);
                    runIdRef.current = newRun.id;
                    const copiedOutputs: Record<number, string> = {};
                    for (const s of newRun.stages) {
                      if (s.status === 'COMPLETE' && s.outputText) {
                        copiedOutputs[s.stageNumber] = s.outputText;
                      }
                    }
                    // Set copied stages into the UI immediately
                    setStages(newRun.stages);
                    // Delegate to existing pipeline runner
                    const appSettings = await api.settings.get();
                    await proceedWithRun(appSettings, project.invention!, fromStage, copiedOutputs);
                  } catch (err: any) {
                    setToast({ message: 'Re-run failed', detail: err.message, type: 'error' });
                  }
                }}
              />
              {totalRunCost > 0 && (
                <div className="flex justify-between text-xs text-gray-500 pt-2 px-1 border-t border-gray-800 mt-1">
                  <span>Total API cost</span>
                  <span className="text-amber-400 font-mono">{formatCost(totalRunCost)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Actions</h3>
            {project.invention && viewMode !== 'running' && (() => {
              // Show Resume button if there are completed stages but the run didn't finish
              const hasPartial = displayStages.some(s => s.status === 'COMPLETE' && s.outputText) &&
                displayStages.some(s => s.status === 'ERROR' || s.status === 'PENDING');
              return hasPartial ? (
                <div className="space-y-2">
                  <button
                    onClick={() => handleResume()}
                    className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 text-white rounded text-sm font-medium transition-colors"
                  >
                    ▶ Resume (from Stage {displayStages.find(s => s.status === 'ERROR' || s.status === 'PENDING')?.stageNumber ?? '?'})
                  </button>
                  <button
                    onClick={() => handleRunFeasibility()}
                    className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition-colors"
                  >
                    Run from Start
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleRunFeasibility()}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                >
                  Run Feasibility
                </button>
              );
            })()}
            {viewMode === 'running' && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full px-3 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Analysis'}
              </button>
            )}
            {latestRun?.status === 'COMPLETE' && viewMode !== 'running' && (
              <button
                onClick={() => setViewMode('report')}
                className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition-colors"
              >
                View Report
              </button>
            )}
            {latestRun && viewMode !== 'running' && (
              <button
                onClick={handleShowHistory}
                className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm transition-colors"
              >
                History
              </button>
            )}
            <button
              onClick={() => setViewMode('prior-art')}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center justify-between ${
                viewMode === 'prior-art' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
            >
              <span>Prior Art</span>
              {priorArtSearch && priorArtSearch.results.length > 0 && (
                <span className="text-xs bg-gray-600 text-gray-200 px-1.5 py-0.5 rounded-full">
                  {priorArtSearch.results.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('claims')}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                viewMode === 'claims' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
            >
              Claims
            </button>
            <button
              onClick={() => setViewMode('compliance')}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                viewMode === 'compliance' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
            >
              Compliance
            </button>
          </div>
        </aside>

        {/* ---- MAIN CONTENT ---- */}
        <main className="flex-1 min-w-0">
          {/* Invention form */}
          {viewMode === 'invention-form' && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-100">Invention Disclosure</h2>
                <button
                  onClick={() => setViewMode('overview')}
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  ← Back
                </button>
              </div>
              <InventionForm
                projectId={project.id}
                initialData={project.invention}
                onSaved={(inv) => {
                  setProject(prev => prev ? { ...prev, invention: inv } : prev);
                  setViewMode('overview');
                }}
                onRunFeasibility={(inv) => {
                  setProject(prev => prev ? { ...prev, invention: inv } : prev);
                  handleRunFeasibility(inv);
                }}
              />
            </div>
          )}

          {/* Overview: no invention yet */}
          {viewMode === 'overview' && !project.invention && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">📄</div>
              <h2 className="text-xl font-semibold text-gray-200 mb-2">No Invention Details Yet</h2>
              <p className="text-gray-400 text-sm mb-6">
                Fill in your invention disclosure to begin the feasibility analysis.
              </p>
              <button
                onClick={() => setViewMode('invention-form')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
              >
                Fill in Invention Details
              </button>
            </div>
          )}

          {/* Overview: has invention, show summary */}
          {viewMode === 'overview' && project.invention && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-100">Invention Summary</h2>
                  <button
                    onClick={() => setViewMode('invention-form')}
                    className="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
                  >
                    Edit
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Title</p>
                    <p className="text-gray-100 font-medium mt-0.5">{project.invention.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Description</p>
                    <p className="text-gray-300 text-sm mt-0.5 whitespace-pre-wrap">{project.invention.description}</p>
                  </div>
                  {project.invention.whatIsNovel && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">What Is Novel</p>
                      <p className="text-gray-300 text-sm mt-0.5">{project.invention.whatIsNovel}</p>
                    </div>
                  )}
                </div>
              </div>

              {!latestRun && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
                  <p className="text-gray-400 text-sm mb-4">Ready to analyze patent feasibility for this invention.</p>
                  <button
                    onClick={() => handleRunFeasibility()}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    Run Feasibility Analysis
                  </button>
                </div>
              )}

              {latestRun && latestRun.status === 'COMPLETE' && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-400">Feasibility analysis complete</p>
                    <p className="text-xs text-gray-500 mt-0.5">Version {latestRun.version}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewMode('report')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                    >
                      View Report
                    </button>
                    <button
                      onClick={() => handleRunFeasibility()}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition-colors"
                    >
                      Re-run
                    </button>
                  </div>
                </div>
              )}

              {latestRun && (latestRun.status === 'ERROR' || latestRun.status === 'CANCELLED') && (
                <div className="bg-gray-900 border border-red-900 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-400">
                      {latestRun.status === 'CANCELLED' ? 'Analysis was cancelled' : 'Analysis failed'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Version {latestRun.version}</p>
                  </div>
                  <button
                    onClick={() => handleRunFeasibility()}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Running view */}
          {viewMode === 'running' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                  <h2 className="text-lg font-semibold text-gray-100">Running Feasibility Analysis</h2>
                </div>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel'}
                </button>
              </div>

              {runError && (
                <div className="p-3 bg-red-900/40 border border-red-800 rounded text-red-300 text-sm">
                  {runError}
                  <button
                    onClick={() => setViewMode('overview')}
                    className="ml-3 text-red-400 underline hover:text-red-300"
                  >
                    Go back
                  </button>
                </div>
              )}

              {!runError && streamText && (
                <StreamingOutput
                  text={streamText}
                  stageName={currentStageName}
                  isComplete={isStreamComplete}
                />
              )}

              {!runError && !streamText && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center text-gray-500 text-sm">
                  {activeStageNum
                    ? `Stage ${activeStageNum} — waiting for first token… (large inputs may take 30–60s)`
                    : 'Starting analysis…'}
                </div>
              )}
            </div>
          )}

          {/* Report view */}
          {viewMode === 'report' && (
            <div className="space-y-4">
              {runError && (
                <div className="p-3 bg-red-900/40 border border-red-800 rounded text-red-300 text-sm">
                  {runError}
                </div>
              )}
              {selectedRunVersion && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <span>Viewing</span>
                  <span className="px-2 py-0.5 bg-gray-800 rounded font-mono text-gray-300">v{selectedRunVersion}</span>
                  <button
                    onClick={() => { setSelectedRunVersion(null); setHistoricalReport(null); }}
                    className="text-blue-400 hover:text-blue-300 ml-2 transition-colors"
                  >
                    View latest →
                  </button>
                </div>
              )}
              {reportContent ? (
                <ReportViewer
                  report={reportContent}
                  projectTitle={project.title}
                  projectId={project.id}
                />
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
                  <p className="text-gray-400">No report available yet.</p>
                  <button
                    onClick={() => setViewMode('overview')}
                    className="mt-3 text-sm text-blue-400 hover:text-blue-300"
                  >
                    Back to overview
                  </button>
                </div>
              )}
            </div>
          )}

          {/* History view (Feature E) */}
          {viewMode === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-100">Run History</h2>
                <button onClick={() => setViewMode('overview')} className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
                  ← Back
                </button>
              </div>
              {runHistory.length === 0 && (
                <p className="text-gray-500 text-sm">No runs found.</p>
              )}
              {runHistory.map(run => (
                <div key={run.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-100">Version {run.version}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        run.status === 'COMPLETE' ? 'bg-green-900 text-green-300' :
                        run.status === 'ERROR' ? 'bg-red-900 text-red-300' :
                        'bg-gray-700 text-gray-400'
                      }`}>{run.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 space-x-3">
                      {run.completedAt && <span>{new Date(run.completedAt).toLocaleString()}</span>}
                      {run.totalCostUsd > 0 && <span className="text-amber-500">{formatCost(run.totalCostUsd)}</span>}
                    </div>
                  </div>
                  {run.status === 'COMPLETE' && (
                    <button
                      onClick={() => handleLoadHistoricalRun(run.version)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                    >
                      View Report
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Prior art view */}
          {viewMode === 'prior-art' && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-100">Prior Art Search</h2>
                <button
                  onClick={() => setViewMode('overview')}
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  ← Back
                </button>
              </div>
              <PriorArtPanel
                projectId={id!}
                search={priorArtSearch}
                onUpdate={setPriorArtSearch}
                onPatentClick={(pn) => setDrawerPatent(pn)}
              />
            </div>
          )}

          {/* Claims tab */}
          {viewMode === 'claims' && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-100">Claim Drafts</h2>
                <button
                  onClick={() => setViewMode('overview')}
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  ← Back
                </button>
              </div>
              <ClaimsTab
                projectId={id!}
                hasFeasibility={!!latestRun && latestRun.status === 'COMPLETE'}
                priorArtTitles={priorArtSearch?.results?.map(r => ({ patentNumber: r.patentNumber, title: r.title }))}
              />
            </div>
          )}

          {/* Compliance tab */}
          {viewMode === 'compliance' && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-100">Compliance Check</h2>
                <button
                  onClick={() => setViewMode('overview')}
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  ← Back
                </button>
              </div>
              <ComplianceTab
                projectId={id!}
                hasClaims={!!claimDraftStatus && claimDraftStatus.status === 'COMPLETE' && Array.isArray(claimDraftStatus.claims) && claimDraftStatus.claims.length > 0}
              />
            </div>
          )}

          {/* Stage output viewer */}
          {viewMode === 'stage-output' && selectedStage && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-100">
                    Stage {selectedStage.stageNumber}: {selectedStage.stageName}
                  </h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {selectedStage.model && <span className="font-mono">{selectedStage.model}</span>}
                    {selectedStage.webSearchUsed && <span className="text-blue-400">🔍 Web search used</span>}
                    {selectedStage.inputTokens != null && (
                      <span>{selectedStage.inputTokens.toLocaleString()} in / {selectedStage.outputTokens?.toLocaleString()} out tokens</span>
                    )}
                    {selectedStage.estimatedCostUsd != null && selectedStage.estimatedCostUsd > 0 && (
                      <span className="text-amber-500">{formatCost(selectedStage.estimatedCostUsd)}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const slug = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                      const blob = new Blob([selectedStage.outputText || ''], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${slug}-stage-${selectedStage.stageNumber}.md`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 2000);
                    }}
                    className="text-sm px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => setViewMode('report')}
                    className="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
                  >
                    ← Back to Report
                  </button>
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                <div className="p-4 max-h-[600px] overflow-y-auto">
                  <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                    {selectedStage.outputText || 'No output.'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          detail={toast.detail}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Cost Confirmation Modal (Feature F) */}
      {costModal && (
        <CostConfirmModal
          tokenCost={costModal.tokenCost}
          webSearchCost={costModal.webSearchCost}
          cap={costModal.cap}
          model={costModal.model}
          maxTokens={costModal.maxTokens}
          stageCount={costModal.stageCount}
          onConfirm={() => { pendingRunRef.current?.(); }}
          onCancel={() => setCostModal(null)}
        />
      )}

      {/* Patent Detail Drawer */}
      <PatentDetailDrawer
        patentNumber={drawerPatent}
        onClose={() => setDrawerPatent(null)}
      />
    </div>
  );
}
