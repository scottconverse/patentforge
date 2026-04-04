import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import {
  FeasibilityStage,
  RunStatus,
} from '../types';
import { useProjectDetail, ViewMode } from '../hooks/useProjectDetail';
import { useRunHistory } from '../hooks/useRunHistory';
import { useFeasibilityRun, makePlaceholderStages } from '../hooks/useFeasibilityRun';
import InventionForm from './InventionForm';
import ReportViewer from '../components/ReportViewer';
import StageProgress from '../components/StageProgress';
import StreamingOutput from '../components/StreamingOutput';
import Toast from '../components/Toast';
import CostConfirmModal from '../components/CostConfirmModal';
import ClaimsTab from '../components/ClaimsTab';
import ComplianceTab from '../components/ComplianceTab';
import ApplicationTab from '../components/ApplicationTab';
import PriorArtPanel from '../components/PriorArtPanel';
import PatentDetailDrawer from '../components/PatentDetailDrawer';
import { formatCost } from '../utils/format';
import { statusColors } from '../utils/statusColors';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // UI mode
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  // ----- Project data hook -----
  const {
    project,
    setProject,
    loading,
    error,
    setError,
    loadProject,
    getLatestRun,
    priorArtSearch,
    setPriorArtSearch,
    claimDraftStatus,
  } = useProjectDetail(id, viewMode);

  // Stage output viewer
  const [selectedStage, setSelectedStage] = useState<FeasibilityStage | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; detail?: string; type?: 'success' | 'error' | 'info' } | null>(
    null,
  );

  // Cost confirmation modal
  const [costModal, setCostModal] = useState<{
    tokenCost: number;
    webSearchCost: number;
    cap: number;
    model: string;
    source: 'history' | 'static';
    runsUsed: number;
    stageCount?: number;
  } | null>(null);

  // Run history (Feature E)
  const {
    runHistory,
    selectedRunVersion,
    historicalReport,
    setSelectedRunVersion,
    setHistoricalReport,
    handleShowHistory,
    handleLoadHistoricalRun,
  } = useRunHistory(id, setViewMode, setToast);

  // Patent detail drawer
  const [drawerPatent, setDrawerPatent] = useState<string | null>(null);

  // Report content — loaded lazily via dedicated lightweight endpoint
  const [fullReportContent, setFullReportContent] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  useEffect(() => {
    if (viewMode === 'report' && id && !historicalReport && !fullReportContent) {
      api.feasibility
        .getReport(id)
        .then((data) => {
          setFullReportContent(data.report || null);
          setReportHtml(data.html || null);
        })
        .catch((_err) => {
          // Report load failure is non-fatal — UI already shows "Loading report..." fallback
        });
    }
  }, [viewMode, id, historicalReport, fullReportContent]);

  // ----- Derived state -----
  const latestRun = getLatestRun(project);

  // ----- Feasibility run hook -----
  const {
    stages,
    setStages,
    activeStageNum,
    currentStageName,
    streamText,
    isStreamComplete,
    runError,
    setRunError,
    cancelling,
    pendingRunRef,
    runIdRef,
    abortRef,
    handleRunFeasibility,
    handleResume,
    handleCancel,
    displayStages,
    proceedWithRun,
  } = useFeasibilityRun({
    projectId: id,
    project,
    setProject,
    getLatestRun,
    setViewMode,
    setToast,
    setCostModal,
    setError,
    loadProject,
    setPriorArtSearch,
    setSelectedRunVersion,
    setHistoricalReport,
    viewMode,
    latestRun,
  });

  // Abort SSE stream on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, [abortRef]);

  // View mode initialization — runs after project is loaded
  const projectLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!project || loading) return;
    // Only run view init once per project id to avoid resetting view on re-fetches
    // triggered by pipeline complete. Skip if already initialized for this project.
    if (projectLoadedRef.current === project.id) return;
    projectLoadedRef.current = project.id;

    const latestRunInit = getLatestRun(project);
    if (latestRunInit) {
      if (latestRunInit.status === 'COMPLETE' || latestRunInit.status === 'ERROR') {
        setStages(latestRunInit.stages?.length ? latestRunInit.stages : makePlaceholderStages());
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: one-time view init on project load
        setViewMode('overview');
      } else if (latestRunInit.status === 'RUNNING') {
        // Stale RUNNING run — the pipeline died (browser closed, service crashed, etc.)
        // No active abort controller means nothing is actually streaming. Mark it ERROR
        // in the backend, load whatever partial stage output exists, and show report view.
        const partialStages = (latestRunInit.stages ?? []).map((s) =>
          s.status === 'RUNNING' || s.status === 'PENDING'
            ? {
                ...s,
                status: 'ERROR' as RunStatus,
                errorMessage: 'Pipeline interrupted — service was restarted or browser was closed.',
              }
            : s,
        );
        setStages(partialStages.length ? partialStages : makePlaceholderStages());
        setRunError(
          'Pipeline was interrupted (service restarted or browser closed). Partial results shown below. Click "Re-run" to try again.',
        );
        setViewMode('report');
        // Patch backend so it doesn't stay RUNNING forever
        api.feasibility
          .patchRun(project.id, { status: 'ERROR', runId: runIdRef.current || undefined })
          .catch(() => {/* non-fatal */});
      } else {
        setViewMode('overview');
      }
    } else if (!project.invention) {
      setViewMode('invention-form');
    } else {
      setViewMode('overview');
    }
  }, [project, loading, getLatestRun, setStages, setRunError, setViewMode, runIdRef]);

  // ----- Render -----
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <span
          className="w-6 h-6 rounded-full border-2 border-gray-600 border-t-blue-500 animate-spin mr-3"
          aria-label="Loading"
        />
        Loading project...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="p-4 bg-red-900/40 border border-red-800 rounded-lg text-red-300">{error}</div>
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={() => loadProject()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
          >
            Retry
          </button>
          <button onClick={() => navigate('/')} className="text-sm text-blue-400 hover:text-blue-300">
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const totalRunCost = displayStages.reduce((sum, s) => sum + (s.estimatedCostUsd ?? 0), 0);

  const reportContent = historicalReport ?? fullReportContent;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-gray-300 transition-colors">
          Projects
        </Link>
        <span>/</span>
        <span className="text-gray-300 truncate max-w-xs">{project.title}</span>
        <span
          className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[project.status] || 'bg-gray-700 text-gray-300'}`}
        >
          {project.status}
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* ---- LEFT SIDEBAR ---- */}
        <aside className="w-full md:w-64 shrink-0 space-y-4">
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
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold ${project.invention ? 'border-green-500 bg-green-900 text-green-400' : 'border-gray-600 text-gray-500'}`}
              >
                {project.invention ? '✓' : '1'}
              </span>
              <span>Invention Intake</span>
            </button>

            {/* Feasibility */}
            <div
              className={`px-3 py-2 rounded text-sm mb-2 ${
                viewMode === 'running' || viewMode === 'report' ? 'bg-blue-950 border border-blue-800' : 'text-gray-400'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                    latestRun?.status === 'COMPLETE'
                      ? 'border-green-500 bg-green-900 text-green-400'
                      : latestRun?.status === 'RUNNING'
                        ? 'border-blue-500'
                        : 'border-gray-600 text-gray-500'
                  }`}
                >
                  {latestRun?.status === 'COMPLETE' ? (
                    '✓'
                  ) : latestRun?.status === 'RUNNING' ? (
                    <span
                      className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"
                      aria-label="Loading"
                    />
                  ) : (
                    '2'
                  )}
                </span>
                <span
                  className={
                    latestRun?.status === 'COMPLETE'
                      ? 'text-green-400'
                      : latestRun?.status === 'RUNNING'
                        ? 'text-blue-300'
                        : 'text-gray-400'
                  }
                >
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
            {project.invention &&
              viewMode !== 'running' &&
              (() => {
                // Show Resume button if there are completed stages but the run didn't finish
                const hasPartial =
                  displayStages.some((s) => s.status === 'COMPLETE' && s.outputText) &&
                  displayStages.some((s) => s.status === 'ERROR' || s.status === 'PENDING');
                return hasPartial ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleResume()}
                      className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 text-white rounded text-sm font-medium transition-colors"
                    >
                      ▶ Resume (from Stage{' '}
                      {displayStages.find((s) => s.status === 'ERROR' || s.status === 'PENDING')?.stageNumber ?? '?'})
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
            <button
              onClick={() => setViewMode('application')}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                viewMode === 'application' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
            >
              Application
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
                  setProject((prev) => (prev ? { ...prev, invention: inv } : prev));
                  setViewMode('overview');
                }}
                onRunFeasibility={(inv) => {
                  setProject((prev) => (prev ? { ...prev, invention: inv } : prev));
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
                    Re-run
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
                  <span
                    className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin"
                    aria-label="Loading"
                  />
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
                <StreamingOutput text={streamText} stageName={currentStageName} isComplete={isStreamComplete} />
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
                <div className="p-3 bg-red-900/40 border border-red-800 rounded text-red-300 text-sm">{runError}</div>
              )}
              {selectedRunVersion && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <span>Viewing</span>
                  <span className="px-2 py-0.5 bg-gray-800 rounded font-mono text-gray-300">v{selectedRunVersion}</span>
                  <button
                    onClick={() => {
                      setSelectedRunVersion(null);
                      setHistoricalReport(null);
                    }}
                    className="text-blue-400 hover:text-blue-300 ml-2 transition-colors"
                  >
                    View latest →
                  </button>
                </div>
              )}
              {reportContent ? (
                <ReportViewer
                  report={reportContent}
                  preRenderedHtml={reportHtml ?? undefined}
                  projectTitle={project.title}
                  projectId={project.id}
                />
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
                  <div className="inline-flex items-center gap-3 text-gray-400">
                    <div
                      className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"
                      aria-label="Loading"
                    />
                    Loading report...
                  </div>
                  <button
                    onClick={() => setViewMode('overview')}
                    className="mt-3 block mx-auto text-sm text-blue-400 hover:text-blue-300"
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
                <button
                  onClick={() => setViewMode('overview')}
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  ← Back
                </button>
              </div>
              {runHistory.length === 0 && <p className="text-gray-500 text-sm">No runs found.</p>}
              {runHistory.map((run) => (
                <div
                  key={run.id}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-100">Version {run.version}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          run.status === 'COMPLETE'
                            ? 'bg-green-900 text-green-300'
                            : run.status === 'ERROR'
                              ? 'bg-red-900 text-red-300'
                              : 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 space-x-3">
                      {run.completedAt && <span>{new Date(run.completedAt).toLocaleString()}</span>}
                      {run.totalCostUsd > 0 && <span className="text-amber-500">{formatCost(run.totalCostUsd)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {run.status === 'COMPLETE' && (
                      <button
                        onClick={() => handleLoadHistoricalRun(run.version)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                      >
                        View Report
                      </button>
                    )}
                    {(run.status === 'ERROR' || run.status === 'CANCELLED') && (
                      <>
                        <span className="text-xs text-gray-500">No report available</span>
                        <button
                          onClick={() => handleRunFeasibility()}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                        >
                          Re-run
                        </button>
                      </>
                    )}
                  </div>
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
                priorArtTitles={priorArtSearch?.results?.map((r) => ({ patentNumber: r.patentNumber, title: r.title }))}
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
                hasClaims={
                  !!claimDraftStatus &&
                  claimDraftStatus.status === 'COMPLETE' &&
                  Array.isArray(claimDraftStatus.claims) &&
                  claimDraftStatus.claims.length > 0
                }
              />
            </div>
          )}

          {/* Application tab */}
          {viewMode === 'application' && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-100">Patent Application</h2>
                <button
                  onClick={() => setViewMode('overview')}
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  ← Back
                </button>
              </div>
              <ApplicationTab
                projectId={id!}
                hasClaims={
                  !!claimDraftStatus &&
                  claimDraftStatus.status === 'COMPLETE' &&
                  Array.isArray(claimDraftStatus.claims) &&
                  claimDraftStatus.claims.length > 0
                }
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
                      <span>
                        {selectedStage.inputTokens.toLocaleString()} in / {selectedStage.outputTokens?.toLocaleString()}{' '}
                        out tokens
                      </span>
                    )}
                    {selectedStage.estimatedCostUsd != null && selectedStage.estimatedCostUsd > 0 && (
                      <span className="text-amber-500">{formatCost(selectedStage.estimatedCostUsd)}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const slug = project.title
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '');
                      const blob = new Blob([selectedStage.outputText || ''], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      const stageName = selectedStage.stageName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '');
                      a.download = `${slug}-${selectedStage.stageNumber}-${stageName}.md`;
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
        <Toast message={toast.message} detail={toast.detail} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Cost Confirmation Modal (Feature F) */}
      {costModal && (
        <CostConfirmModal
          tokenCost={costModal.tokenCost}
          webSearchCost={costModal.webSearchCost}
          cap={costModal.cap}
          model={costModal.model}
          source={costModal.source}
          runsUsed={costModal.runsUsed}
          stageCount={costModal.stageCount}
          onConfirm={() => {
            pendingRunRef.current?.();
          }}
          onCancel={() => setCostModal(null)}
        />
      )}

      {/* Patent Detail Drawer */}
      <PatentDetailDrawer patentNumber={drawerPatent} onClose={() => setDrawerPatent(null)} />
    </div>
  );
}
