-- CreateTable
CREATE TABLE "PatentDetail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patentNumber" TEXT NOT NULL,
    "title" TEXT,
    "abstract" TEXT,
    "filingDate" TEXT,
    "grantDate" TEXT,
    "assignee" TEXT,
    "inventors" TEXT,
    "cpcClassifications" TEXT,
    "claimsText" TEXT,
    "claimCount" INTEGER,
    "patentType" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PatentDetail_patentNumber_key" ON "PatentDetail"("patentNumber");
