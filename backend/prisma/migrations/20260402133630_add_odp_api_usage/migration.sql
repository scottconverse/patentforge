-- CreateTable
CREATE TABLE "PatentFamily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patentNumber" TEXT NOT NULL,
    "members" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OdpApiUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "queriesAttempted" INTEGER NOT NULL,
    "resultsFound" INTEGER NOT NULL,
    "hadRateLimit" BOOLEAN NOT NULL DEFAULT false,
    "hadError" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "calledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdpApiUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "anthropicApiKey" TEXT NOT NULL DEFAULT '',
    "defaultModel" TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    "researchModel" TEXT NOT NULL DEFAULT '',
    "maxTokens" INTEGER NOT NULL DEFAULT 32000,
    "interStageDelaySeconds" INTEGER NOT NULL DEFAULT 5,
    "exportPath" TEXT NOT NULL DEFAULT '',
    "costCapUsd" REAL NOT NULL DEFAULT 5.00,
    "usptoApiKey" TEXT NOT NULL DEFAULT '',
    "encryptionSalt" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_AppSettings" ("anthropicApiKey", "costCapUsd", "defaultModel", "encryptionSalt", "exportPath", "id", "interStageDelaySeconds", "maxTokens", "researchModel", "usptoApiKey") SELECT "anthropicApiKey", "costCapUsd", "defaultModel", "encryptionSalt", "exportPath", "id", "interStageDelaySeconds", "maxTokens", "researchModel", "usptoApiKey" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PatentFamily_patentNumber_key" ON "PatentFamily"("patentNumber");

-- CreateIndex
CREATE INDEX "OdpApiUsage_calledAt_idx" ON "OdpApiUsage"("calledAt");
