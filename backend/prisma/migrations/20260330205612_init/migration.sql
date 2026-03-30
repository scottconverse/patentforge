-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INTAKE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InventionInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "problemSolved" TEXT NOT NULL DEFAULT '',
    "howItWorks" TEXT NOT NULL DEFAULT '',
    "aiComponents" TEXT NOT NULL DEFAULT '',
    "threeDPrintComponents" TEXT NOT NULL DEFAULT '',
    "whatIsNovel" TEXT NOT NULL DEFAULT '',
    "currentAlternatives" TEXT NOT NULL DEFAULT '',
    "whatIsBuilt" TEXT NOT NULL DEFAULT '',
    "whatToProtect" TEXT NOT NULL DEFAULT '',
    "additionalNotes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "InventionInput_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeasibilityRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "finalReport" TEXT,
    CONSTRAINT "FeasibilityRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeasibilityStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feasibilityRunId" TEXT NOT NULL,
    "stageNumber" INTEGER NOT NULL,
    "stageName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "outputText" TEXT,
    "model" TEXT,
    "webSearchUsed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "errorMessage" TEXT,
    CONSTRAINT "FeasibilityStage_feasibilityRunId_fkey" FOREIGN KEY ("feasibilityRunId") REFERENCES "FeasibilityRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriorArtSearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "query" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "PriorArtSearch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriorArtResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "searchId" TEXT NOT NULL,
    "patentNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "relevanceScore" REAL NOT NULL,
    "snippet" TEXT,
    "claimMapping" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PQAI',
    CONSTRAINT "PriorArtResult_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "PriorArtSearch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "specLanguage" TEXT,
    CONSTRAINT "ClaimDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "claimNumber" INTEGER NOT NULL,
    "claimType" TEXT NOT NULL,
    "parentClaimNumber" INTEGER,
    "text" TEXT NOT NULL,
    CONSTRAINT "Claim_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ClaimDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "draftVersion" INTEGER NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "overallPass" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ComplianceCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "claimNumber" INTEGER,
    "detail" TEXT NOT NULL,
    "citation" TEXT,
    "suggestion" TEXT,
    CONSTRAINT "ComplianceResult_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "ComplianceCheck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatentApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "abstract" TEXT,
    "background" TEXT,
    "summary" TEXT,
    "detailedDescription" TEXT,
    "claims" TEXT,
    "figureDescriptions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatentApplication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProsecutionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "documentUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProsecutionEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "anthropicApiKey" TEXT NOT NULL DEFAULT '',
    "defaultModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    "researchModel" TEXT NOT NULL DEFAULT '',
    "maxTokens" INTEGER NOT NULL DEFAULT 32000,
    "interStageDelaySeconds" INTEGER NOT NULL DEFAULT 5,
    "pqaiApiToken" TEXT NOT NULL DEFAULT '',
    "pqaiMode" TEXT NOT NULL DEFAULT 'api'
);

-- CreateIndex
CREATE UNIQUE INDEX "InventionInput_projectId_key" ON "InventionInput"("projectId");
