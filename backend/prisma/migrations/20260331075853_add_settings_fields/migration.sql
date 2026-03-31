/*
  Warnings:

  - You are about to drop the column `pqaiApiToken` on the `AppSettings` table. All the data in the column will be lost.
  - You are about to drop the column `pqaiMode` on the `AppSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PriorArtSearch" ADD COLUMN "feasibilityRunId" TEXT;

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
    "costCapUsd" REAL NOT NULL DEFAULT 5.00
);
INSERT INTO "new_AppSettings" ("anthropicApiKey", "defaultModel", "id", "interStageDelaySeconds", "maxTokens", "researchModel") SELECT "anthropicApiKey", "defaultModel", "id", "interStageDelaySeconds", "maxTokens", "researchModel" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
CREATE TABLE "new_PriorArtResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "searchId" TEXT NOT NULL,
    "patentNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "relevanceScore" REAL NOT NULL,
    "snippet" TEXT,
    "claimMapping" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PatentsView',
    CONSTRAINT "PriorArtResult_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "PriorArtSearch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PriorArtResult" ("abstract", "claimMapping", "id", "patentNumber", "relevanceScore", "searchId", "snippet", "source", "title") SELECT "abstract", "claimMapping", "id", "patentNumber", "relevanceScore", "searchId", "snippet", "source", "title" FROM "PriorArtResult";
DROP TABLE "PriorArtResult";
ALTER TABLE "new_PriorArtResult" RENAME TO "PriorArtResult";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
