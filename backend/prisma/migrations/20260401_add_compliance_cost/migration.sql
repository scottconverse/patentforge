-- AlterTable
ALTER TABLE "ComplianceCheck" ADD COLUMN "estimatedCostUsd" REAL;

-- Update default model
UPDATE "AppSettings" SET "defaultModel" = 'claude-haiku-4-5-20251001' WHERE "defaultModel" = '' OR "defaultModel" IS NULL;
