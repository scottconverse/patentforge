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
    "usptoApiKey" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_AppSettings" ("anthropicApiKey", "costCapUsd", "defaultModel", "exportPath", "id", "interStageDelaySeconds", "maxTokens", "researchModel") SELECT "anthropicApiKey", "costCapUsd", "defaultModel", "exportPath", "id", "interStageDelaySeconds", "maxTokens", "researchModel" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
