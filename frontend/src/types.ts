export type ProjectStatus = 'INTAKE' | 'FEASIBILITY' | 'PRIOR_ART' | 'DRAFTING' | 'COMPLIANCE' | 'APPLICATION' | 'FILED' | 'ABANDONED';
export type RunStatus = 'PENDING' | 'RUNNING' | 'COMPLETE' | 'ERROR' | 'CANCELLED' | 'STALE';

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  invention?: InventionInput;
  feasibility?: FeasibilityRun[];
}

export interface InventionInput {
  id: string;
  projectId: string;
  title: string;
  description: string;
  problemSolved?: string;
  howItWorks?: string;
  aiComponents?: string;
  threeDPrintComponents?: string;
  whatIsNovel?: string;
  currentAlternatives?: string;
  whatIsBuilt?: string;
  whatToProtect?: string;
  additionalNotes?: string;
}

export interface FeasibilityRun {
  id: string;
  projectId: string;
  version: number;
  status: RunStatus;
  startedAt?: string;
  completedAt?: string;
  finalReport?: string;
  stages: FeasibilityStage[];
}

export interface FeasibilityStage {
  id: string;
  feasibilityRunId: string;
  stageNumber: number;
  stageName: string;
  status: RunStatus;
  outputText?: string;
  model?: string;
  webSearchUsed: boolean;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface AppSettings {
  id: string;
  anthropicApiKey: string;
  defaultModel: string;
  researchModel: string;
  maxTokens: number;
  interStageDelaySeconds: number;
  pqaiApiToken: string;
  pqaiMode: string;
}
