import { FeasibilityStage, RunStatus } from '../types';

interface StageProgressProps {
  stages: FeasibilityStage[];
  activeStage?: number;
}

function StatusIcon({ status }: { status: RunStatus }) {
  if (status === 'COMPLETE') {
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-900 text-green-400 text-xs font-bold">
        ✓
      </span>
    );
  }
  if (status === 'RUNNING') {
    return (
      <span className="flex items-center justify-center w-6 h-6">
        <span className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </span>
    );
  }
  if (status === 'ERROR') {
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-900 text-red-400 text-xs font-bold">
        ✗
      </span>
    );
  }
  if (status === 'CANCELLED') {
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-700 text-gray-400 text-xs font-bold">
        ✗
      </span>
    );
  }
  // PENDING / STALE
  return (
    <span className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-gray-700 bg-gray-900" />
  );
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export default function StageProgress({ stages, activeStage }: StageProgressProps) {
  if (!stages || stages.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic">No stages yet.</div>
    );
  }

  return (
    <div className="space-y-2">
      {stages.map((stage) => {
        const isActive = activeStage === stage.stageNumber;
        const duration = formatDuration(stage.startedAt, stage.completedAt);

        return (
          <div
            key={stage.stageNumber}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive ? 'bg-blue-950 border border-blue-800' : 'bg-gray-900 border border-gray-800'
            }`}
          >
            <StatusIcon status={stage.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-mono">#{stage.stageNumber}</span>
                <span className={`text-sm truncate ${isActive ? 'text-blue-300' : 'text-gray-300'}`}>
                  {stage.stageName}
                </span>
              </div>
              {stage.errorMessage && (
                <div className="text-xs text-red-400 mt-0.5 truncate">{stage.errorMessage}</div>
              )}
            </div>
            {duration && (
              <span className="text-xs text-gray-500 font-mono shrink-0">{duration}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
