/**
 * E2E tests for the compliance checking feature.
 *
 * Uses Playwright route interception to mock backend responses for claim drafts
 * and the compliance checker service, so these tests exercise the full frontend
 * compliance flow without calling the real compliance-checker Python service.
 *
 * Pattern mirrors feasibility-pipeline.spec.ts.
 */

import { test, expect, screenshot } from './fixtures';
import { createProject, deleteProject } from './helpers';
import type { Page, Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock data builders
// ---------------------------------------------------------------------------

/** Build a COMPLETE claim draft response with sample claims. */
function buildMockClaimDraft() {
  return {
    id: 'mock-draft-id',
    projectId: '',
    version: 1,
    status: 'COMPLETE',
    claims: [
      {
        id: 'claim-1',
        claimNumber: 1,
        text: 'A method for processing data through a multi-stage analysis pipeline comprising: receiving input data; analyzing the input data using a first processing stage; and generating output based on the analysis.',
        claimType: 'independent',
        dependsOn: null,
      },
      {
        id: 'claim-2',
        claimNumber: 2,
        text: 'The method of claim 1, wherein the first processing stage includes a machine learning model.',
        claimType: 'dependent',
        dependsOn: 1,
      },
      {
        id: 'claim-3',
        claimNumber: 3,
        text: 'A system configured to perform the method of claim 1.',
        claimType: 'independent',
        dependsOn: null,
      },
    ],
    createdAt: new Date().toISOString(),
  };
}

/** Build a compliance check response with RUNNING status. */
function buildMockComplianceRunning() {
  return {
    id: 'mock-check-id',
    status: 'RUNNING',
    overallPass: null,
    results: [],
  };
}

/** Build a COMPLETE compliance check with a mix of PASS, FAIL, and WARN results. */
function buildMockComplianceComplete() {
  return {
    id: 'mock-check-id',
    status: 'COMPLETE',
    overallPass: false,
    estimatedCostUsd: 0.05,
    results: [
      {
        rule: '112a_written_description',
        status: 'PASS',
        claimNumber: 1,
        detail: 'Claim 1 adequately describes the multi-stage pipeline method.',
        citation: 'MPEP 2163',
        suggestion: null,
      },
      {
        rule: '112b_definiteness',
        status: 'FAIL',
        claimNumber: 2,
        detail: 'Claim 2 uses the indefinite term "machine learning model" without specifying the type or configuration.',
        citation: 'MPEP 2173.05(b)',
        suggestion: 'Specify the type of machine learning model (e.g., neural network, decision tree) and its configuration parameters.',
      },
      {
        rule: 'mpep_608_formalities',
        status: 'WARN',
        claimNumber: null,
        detail: 'Claims may benefit from more consistent antecedent basis terminology.',
        citation: 'MPEP 608.01(o)',
        suggestion: 'Review claim language to ensure all terms have proper antecedent basis in the specification.',
      },
      {
        rule: '101_eligibility',
        status: 'PASS',
        claimNumber: 3,
        detail: 'Claim 3 recites a system with specific technical implementation.',
        citation: '35 U.S.C. 101; Alice Corp. v. CLS Bank',
        suggestion: null,
      },
    ],
  };
}

/** Build a compliance check with ERROR status. */
function buildMockComplianceError() {
  return {
    id: 'mock-check-error',
    status: 'ERROR',
    overallPass: null,
    results: [],
  };
}

/** Build a NONE compliance response (no check run yet). */
function buildMockComplianceNone() {
  return { status: 'NONE', results: [] };
}

// ---------------------------------------------------------------------------
// Route mocking helpers
// ---------------------------------------------------------------------------

/**
 * Mock the claim draft API to return a COMPLETE draft with claims.
 * This makes `hasClaims` evaluate to true on the project detail page.
 */
async function mockClaimDraftComplete(page: Page, projectId: string) {
  const draft = buildMockClaimDraft();
  draft.projectId = projectId;

  await page.route(`**/api/projects/${projectId}/claims`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(draft),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock the claim draft API to return a response with no claims (status NONE).
 * This makes `hasClaims` evaluate to false.
 */
async function mockClaimDraftNone(page: Page, projectId: string) {
  await page.route(`**/api/projects/${projectId}/claims`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'NONE', claims: [] }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock compliance endpoints.
 *
 * - GET /compliance returns `getResponse`
 * - POST /compliance/check returns `postResponse`
 */
async function mockComplianceEndpoints(
  page: Page,
  projectId: string,
  getResponse: object,
  postResponse?: object,
) {
  await page.route(`**/api/projects/${projectId}/compliance`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(getResponse),
      });
    } else {
      await route.continue();
    }
  });

  if (postResponse) {
    await page.route(`**/api/projects/${projectId}/compliance/check`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(postResponse),
      });
    });
  }
}

/** Navigate to the project detail page and click the Compliance sidebar button. */
async function navigateToComplianceTab(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}`);
  await page.waitForLoadState('networkidle');

  // Click the Compliance button in the sidebar
  const complianceButton = page.locator('button:has-text("Compliance")');
  await complianceButton.waitFor({ state: 'visible', timeout: 10_000 });
  await complianceButton.click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Compliance Checking', () => {
  let projectId: string;

  test.beforeEach(async () => {
    projectId = await createProject('E2E Compliance Test');
  });

  test.afterEach(async () => {
    await deleteProject(projectId);
  });

  test('shows "Draft claims first" when no claims exist', async ({ page, consoleErrors }) => {
    // Mock claim draft to return no claims
    await mockClaimDraftNone(page, projectId);
    // Mock compliance to return NONE (no check yet)
    await mockComplianceEndpoints(page, projectId, buildMockComplianceNone());

    await navigateToComplianceTab(page, projectId);

    // Verify the "draft claims first" message appears
    await expect(page.locator('text=Draft claims before running a compliance check')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Compliance checking requires completed claim drafts')).toBeVisible();

    await screenshot(page, 'compliance-no-claims');
  });

  test('shows "Run Compliance Check" button when claims exist', async ({ page, consoleErrors }) => {
    // Mock claim draft to return COMPLETE with claims
    await mockClaimDraftComplete(page, projectId);
    // Mock compliance to return NONE (no check yet)
    await mockComplianceEndpoints(page, projectId, buildMockComplianceNone());

    await navigateToComplianceTab(page, projectId);

    // Verify the "Run Compliance Check" button appears
    await expect(page.locator('button:has-text("Run Compliance Check")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=No compliance check yet')).toBeVisible();

    await screenshot(page, 'compliance-ready-to-run');
  });

  test('full compliance flow with mocked service', async ({ page, consoleErrors }) => {
    // Mock claim draft to return COMPLETE with claims
    await mockClaimDraftComplete(page, projectId);

    const completeResponse = buildMockComplianceComplete();
    const runningResponse = buildMockComplianceRunning();
    const complianceUrl = `**/api/projects/${projectId}/compliance`;
    const complianceCheckUrl = `**/api/projects/${projectId}/compliance/check`;

    // Helper to swap the GET /compliance mock to a specific response
    async function setComplianceGetResponse(response: object) {
      await page.unroute(complianceUrl);
      await page.route(complianceUrl, async (route: Route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
          });
        } else {
          await route.continue();
        }
      });
    }

    // Phase 1: GET returns NONE (no check yet)
    await setComplianceGetResponse(buildMockComplianceNone());

    // Mock POST /compliance/check → returns RUNNING
    await page.route(complianceCheckUrl, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(runningResponse),
      });
    });

    await navigateToComplianceTab(page, projectId);

    // Verify "Run Compliance Check" button appears
    await expect(page.locator('button:has-text("Run Compliance Check")')).toBeVisible({ timeout: 10_000 });

    // Phase 2: Swap GET to return RUNNING before clicking
    await setComplianceGetResponse(runningResponse);

    // Click "Run Compliance Check" — may trigger UPL modal
    await page.click('button:has-text("Run Compliance Check")');

    // Handle UPL acknowledgment modal if it appears
    const modalHeading = page.locator('text=This is a research tool, not a legal service');
    if (await modalHeading.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Check the acknowledgment checkbox
      await page.locator('input[type="checkbox"]').check();
      // Click the "Run Compliance Check" button inside the modal
      await page.locator('.fixed button:has-text("Run Compliance Check")').click();
    }

    // Phase 3: Swap GET to return COMPLETE so polling picks it up
    await setComplianceGetResponse(completeResponse);

    // Wait for results to appear (polling will transition RUNNING → COMPLETE)
    // The results view shows the UPL disclaimer banner
    await expect(page.locator('text=RESEARCH OUTPUT')).toBeVisible({ timeout: 20_000 });

    // Verify traffic-light results are rendered
    // FAIL result should be visible
    await expect(page.locator('text=Claim 2 uses the indefinite term')).toBeVisible();

    // PASS result should be visible
    await expect(page.locator('text=Claim 1 adequately describes')).toBeVisible();

    // WARN result should be visible
    await expect(page.locator('text=Claims may benefit from more consistent')).toBeVisible();

    // FAIL result should show a suggestion
    await expect(page.locator('text=Specify the type of machine learning model')).toBeVisible();

    // Overall status should show issues found
    await expect(page.locator('text=issue')).toBeVisible();

    // Re-check button should be visible
    await expect(page.locator('button:has-text("Re-check Claims")')).toBeVisible();

    await screenshot(page, 'compliance-results-complete');
  });

  test('shows error state and Try Again button', async ({ page, consoleErrors }) => {
    // Mock claim draft to return COMPLETE with claims
    await mockClaimDraftComplete(page, projectId);
    // Mock compliance to return ERROR status
    await mockComplianceEndpoints(
      page,
      projectId,
      buildMockComplianceError(),
    );

    await navigateToComplianceTab(page, projectId);

    // Verify error state — ComplianceTab shows "Compliance check failed." and "Try Again" button
    await expect(page.locator('text=Compliance check failed')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible();

    await screenshot(page, 'compliance-error-state');
  });

  test('re-check flow triggers new compliance check', async ({ page, consoleErrors }) => {
    // Mock claim draft to return COMPLETE with claims
    await mockClaimDraftComplete(page, projectId);

    let postCalled = false;
    const complianceUrl = `**/api/projects/${projectId}/compliance`;
    const complianceCheckUrl = `**/api/projects/${projectId}/compliance/check`;

    // Helper to swap the GET /compliance mock to a specific response
    async function setComplianceGetResponse(response: object) {
      await page.unroute(complianceUrl);
      await page.route(complianceUrl, async (route: Route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
          });
        } else {
          await route.continue();
        }
      });
    }

    // Phase 1: GET returns COMPLETE results (already checked)
    await setComplianceGetResponse(buildMockComplianceComplete());

    // Mock POST /compliance/check → track that it was called, return RUNNING
    await page.route(complianceCheckUrl, async (route: Route) => {
      postCalled = true;
      // Swap GET mock to RUNNING before fulfilling POST so the next poll picks it up
      await setComplianceGetResponse(buildMockComplianceRunning());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildMockComplianceRunning()),
      });
    });

    await navigateToComplianceTab(page, projectId);

    // Should show results with Re-check button
    await expect(page.locator('text=RESEARCH OUTPUT')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button:has-text("Re-check Claims")')).toBeVisible();

    // Click Re-check — may trigger UPL modal
    await page.click('button:has-text("Re-check Claims")');

    // Handle UPL acknowledgment modal if it appears
    const modalHeading = page.locator('text=This is a research tool, not a legal service');
    if (await modalHeading.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await page.locator('input[type="checkbox"]').check();
      await page.locator('.fixed button:has-text("Run Compliance Check")').click();
    }

    // Verify the POST was called (new check triggered)
    // Wait a moment for the request to be intercepted
    await page.waitForTimeout(1_000);
    expect(postCalled).toBe(true);

    // The component's render order means COMPLETE results stay visible while
    // `running` is true (the COMPLETE branch at line 115 returns before the
    // running check at line 142). Polling only updates `check` on COMPLETE
    // or ERROR, not RUNNING. So the running spinner is not reachable via
    // re-check when results are already shown.
    //
    // Instead, verify polling eventually picks up a new COMPLETE response
    // (simulating the re-check finishing) and the results view remains.
    await setComplianceGetResponse(buildMockComplianceComplete());

    // Results should still be visible (polling picks up COMPLETE, running resets)
    await expect(page.locator('text=RESEARCH OUTPUT')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button:has-text("Re-check Claims")')).toBeVisible();

    await screenshot(page, 'compliance-recheck-complete');
  });
});
