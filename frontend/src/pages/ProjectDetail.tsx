import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { Project, InventionInput, FeasibilityRun, FeasibilityStage, RunStatus, AppSettings } from '../types';
import InventionForm from './InventionForm';
import ReportViewer from '../components/ReportViewer';
import StageProgress from '../components/StageProgress';
import StreamingOutput from '../components/StreamingOutput';

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

type ViewMode = 'overview' | 'invention-form' | 'running' | 'report';

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

  // ----- Load project -----
  const loadProject = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.projects.get(id);
      setProject(data);

      // Determine initial view mode
      const latestRun = getLatestRun(data);
      if (latestRun) {
        if (latestRun.status === 'COMPLETE' || latestRun.status === 'ERROR') {
          setStages(latestRun.stages?.length ? latestRun.stages : makePlaceholderStages());
          setViewMode('report');
        } else if (latestRun.status === 'RUNNING') {
          setStages(latestRun.stages?.length ? latestRun.stages : makePlaceholderStages());
          setViewMode('running');
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

  // ----- Run feasibility -----
  async function handleRunFeasibility(invention?: InventionInput) {
    if (!id) return;
    const inv = invention || project?.invention;
    if (!inv) {
      setError('Please fill in invention details first.');
      setViewMode('invention-form');
      return;
    }

    setRunError(null);
    setStreamText('');
    setIsStreamComplete(false);
    setActiveStageNum(undefined);
    setStages(makePlaceholderStages());
    setViewMode('running');

    try {
      // 1. Load settings
      const appSettings: AppSettings = await api.settings.get();
      if (!appSettings.anthropicApiKey) {
        setRunError('No Anthropic API key configured. Please go to Settings first.');
        setViewMode('overview');
        return;
      }

      // Map AppSettings → AnalysisSettings (feasibility service field names)
      const settings = {
        apiKey: appSettings.anthropicApiKey,
        model: appSettings.defaultModel || 'claude-sonnet-4-20250514',
        researchModel: appSettings.researchModel || undefined,
        maxTokens: appSettings.maxTokens || 32000,
        interStageDelaySeconds: appSettings.interStageDelaySeconds ?? 5,
      };

      // 2. Create the run record in the backend
      const run = await api.feasibility.start(id);
      runIdRef.current = run.id;

      // Update local project state with the new run
      setProject(prev => {
        if (!prev) return prev;
        const existing = prev.feasibility || [];
        return { ...prev, feasibility: [...existing, run] };
      });

      // 3. Build narrative
      const narrative = toNarrative(inv);

      // 3b. Mark run as RUNNING in backend
      try {
        await api.feasibility.patchRun(id, { status: 'RUNNING' });
      } catch {
        // non-fatal
      }

      // 4. Connect to feasibility service via SSE
      const abortController = new AbortController();
      abortRef.current = abortController;

      const response = await fetch('http://localhost:3001/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventionNarrative: narrative, settings }),
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
              setStreamText(stageOutputAccumulator);

            } else if (eventType === 'stage_complete') {
              const completedAt = new Date().toISOString();
              const outputText = data.output || stageOutputAccumulator;
              updateStageStatus(currentStageNum, {
                status: 'COMPLETE',
                outputText,
                completedAt,
                webSearchUsed: data.webSearchUsed || false,
                model: data.model,
              });
              setIsStreamComplete(true);

              // Patch the stage in the backend
              try {
                await api.feasibility.patchStage(id, currentStageNum, {
                  status: 'COMPLETE',
                  outputText,
                  completedAt,
                  webSearchUsed: data.webSearchUsed || false,
                  model: data.model,
                });
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
              // Persist finalReport to backend, then reload
              try {
                await api.feasibility.patchRun(id, {
                  status: 'COMPLETE',
                  finalReport: data.finalReport || stageOutputAccumulator,
                });
              } catch {
                // non-fatal
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
              <StageProgress stages={displayStages} activeStage={activeStageNum} />
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Actions</h3>
            {project.invention && viewMode !== 'running' && (
              <button
                onClick={() => handleRunFeasibility()}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
              >
                Run Feasibility
              </button>
            )}
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
                  Starting analysis...
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
              {latestRun?.finalReport ? (
                <ReportViewer
                  report={latestRun.finalReport}
                  projectTitle={project.title}
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
        </main>
      </div>
    </div>
  );
}
