-- AlterTable
ALTER TABLE "ClaimDraft" ADD COLUMN "examinerFeedback" TEXT;
ALTER TABLE "ClaimDraft" ADD COLUMN "plannerStrategy" TEXT;
ALTER TABLE "ClaimDraft" ADD COLUMN "revisionNotes" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "claimNumber" INTEGER NOT NULL,
    "claimType" TEXT NOT NULL,
    "scopeLevel" TEXT,
    "statutoryType" TEXT,
    "parentClaimNumber" INTEGER,
    "text" TEXT NOT NULL,
    "examinerNotes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Claim_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ClaimDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Claim" ("claimNumber", "claimType", "draftId", "id", "parentClaimNumber", "text") SELECT "claimNumber", "claimType", "draftId", "id", "parentClaimNumber", "text" FROM "Claim";
DROP TABLE "Claim";
ALTER TABLE "new_Claim" RENAME TO "Claim";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
