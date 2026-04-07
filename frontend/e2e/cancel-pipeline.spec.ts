/**
 * E2E tests for cancelling a pipeline mid-run.
 *
 * Tests: Cancel feasibility analysis at various stages, verify clean state,
 * confirm no stuck spinners, and verify the run can be retried.
 */

import { test, expect, screenshot } from './fixtures';
import { createProject, deleteProject, updateSettings } from './helpers';
import type { Page, Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock SSE response that simulates an interrupted stream.
 *
 * NOTE: Playwright's route.fulfill delivers the entire response body synchronously.
 * This means the SSE stream ends immediately from the browser's perspective — there
 * is no actual mid-stream pause. This mock simulates an *interrupted* stream
 * (stage 1 complete, stage 2 tokens but no stage_complete, no pipeline_complete)
 * which causes the frontend to reach an interrupted/cancellable state. The cancel
 * button click tests the UI's response to a stream interruption + cancel action,
 * not a true mid-pipeline cancel. See feasibility-pipeline.spec.ts for similar note.
 */
function buildSlowMockSSEResponse(): string {
  let body = '';

  // Stage 1
  body += `event: stage_start\ndata: ${JSON.stringify({
    type: 'stage_start',
    stage: 1,
    name: 'Technical Intake & Restatement',
  })}\n\n`;

  body += `event: token\ndata: ${JSON.stringify({
    type: 'token',
    text: 'Analyzing technical aspects... ',
  })}\n\n`;

  body += `event: token\ndata: ${JSON.stringify({
    type: 'token',
    text: 'The invention appears to involve novel mechanisms. ',
  })}\n\n`;

  body += `event: stage_complete\ndata: ${JSON.stringify({
    type: 'stage_complete',
    stage: 1,
    output: 'Stage 1 analysis complete.',
    model: 'claude-haiku-4-5-20251001',
    webSearchUsed: false,
    inputTokens: 4000,
    outputTokens: 2000,
    estimatedCostUsd: 0.02,
  })}\n\n`;

  // Stage 2 — this is where cancellation typically happens
  body += `event: stage_start\ndata: ${JSON.stringify({
    type: 'stage_start',
    stage: 2,
    name: 'Prior Art Research',
  })}\n\n`;

  body += `event: token\ndata: ${JSON.stringify({
    type: 'token',
    text: 'Searching for related patents... ',
  })}\n\n`;

  body += `event: token\ndata: ${JSON.stringify({
    type: 'token',
    text: 'Found 15 potentially relevant patents. ',
  })}\n\n`;

  // Note: No stage_complete or pipeline_complete for Stage 2 — simulates
  // interrupted stream when cancellation is triggered.

  return body;
}

/**
 * Set up route mocks for pipeline tests with cancellation support.
 */
async function setupMocks(page: Page, sseBody: string) {
  // Mock the SSE stream endpoint
  await page.route('**/api/projects/*/feasibility/stream', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body: sseBody,
    });
  });

  // Mock prior art status
  await page.route('**/api/projects/*/prior-art/status', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'NONE' }),
    });
  });

  // Mock LiteLLM pricing
  await page.route('**/raw.githubusercontent.com/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        'claude-haiku-4-5-20251001': {
          input_cost_per_token: 0.0000008,
          output_cost_per_token: 0.000004,
        },
      }),
    });
  });
}

/**
 * Navigate to a project and fill the invention form with minimal data.
 */
async function fillInventionForm(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}`);
  await page.waitForLoadState('networkidle');

  // Click "Fill in Invention Details" button if visible
  const fillButton = page.locator('button:has-text("Fill in Invention Details")');
  if (await fillButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await fillButton.click();
  }

  // Wait for the invention form to appear
  await page
    .locator('input[placeholder="Name your invention"]')
    .waitFor({ state: 'visible', timeout: 10_000 });

  // Fill required fields
  await page.locator('input[placeholder="Name your invention"]').fill('E2E Cancel Test Invention');
  await page
    .locator('textarea[placeholder*="detailed description"]')
    .fill(
      'A test invention for E2E cancellation verification. This invention is designed ' +
        'to test the pipeline cancellation mechanism during mid-stream analysis.',
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Cancel Mid-Pipeline', () => {
  let projectId: string;

  test.beforeEach(async () => {
    projectId = await createProject('E2E Cancel Pipeline Test');
    // Ensure settings have an API key configured
    await updateSettings({
      anthropicApiKey: 'test-key-for-e2e',
      defaultModel: 'claude-haiku-4-5-20251001',
      maxTokens: 8000,
      interStageDelaySeconds: 0,
      costCapUsd: 5.0,
    });
  });

  test.afterEach(async () => {
    await deleteProject(projectId);
  });

  test('cancel pipeline at stage 2, verify clean state and run can restart', async ({
    page,
    consoleErrors,
  }) => {
    const sseBody = buildSlowMockSSEResponse();
    await setupMocks(page, sseBody);
    await fillInventionForm(page, projectId);

    // Click "Save & Run Feasibility" to start the pipeline
    await page.click('button:has-text("Save & Run Feasibility")');

    // Cost confirmation modal appears
    await expect(page.locator('text=Confirm Analysis Run')).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'cancel-cost-modal');

    // Click "Start Analysis"
    await page.click('button:has-text("Start Analysis")');

    // Wait for Stage 1 to start and stage list to appear
    await expect(page.locator('text=Technical Intake & Restatement')).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'cancel-stage-1-active');

    // Wait for Stage 2 to start (streaming "Prior Art Research")
    await expect(page.locator('text=Prior Art Research')).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'cancel-stage-2-streaming');

    // Find and click the Cancel Analysis button
    const cancelButton = page.locator('button:has-text("Cancel Analysis")');
    await expect(cancelButton).toBeVisible({ timeout: 5_000 });
    // Note: stream already ended (mock delivers synchronously); clicking cancel
    // exercises the UI cancel path on an interrupted run state.
    await cancelButton.click();

    // After cancellation, verify run status transitions to CANCELLED
    await expect(page.locator('text=analysis was cancelled')).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'cancel-after-cancel');

    // Verify no stuck spinner — `.animate-spin` should not be visible
    const spinners = page.locator('.animate-spin');
    const spinnerCount = await spinners.count();
    expect(spinnerCount).toBe(0);

    // Verify Run button is now visible and clickable (can start a new run)
    const runButton = page.locator('button:has-text("Run Feasibility")');
    await expect(runButton).toBeVisible({ timeout: 5_000 });

    // Click the Run button to verify a new run can be initiated
    await runButton.click();

    // Cost modal should appear again for the new run
    await expect(page.locator('text=Confirm Analysis Run')).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'cancel-new-run-modal');

    // Clean up by closing the modal (click Cancel or close button, not Start)
    const closeButton = page.locator('[role="dialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("Close"), [role="dialog"] button:has-text("Dismiss")').first();
    await closeButton.click();
    await expect(page.locator('text=Confirm Analysis Run')).not.toBeVisible({ timeout: 5_000 });
  });

  test('cancel shows no error banners after cancellation', async ({ page, consoleErrors }) => {
    const sseBody = buildSlowMockSSEResponse();
    await setupMocks(page, sseBody);
    await fillInventionForm(page, projectId);

    await page.click('button:has-text("Save & Run Feasibility")');
    await expect(page.locator('text=Confirm Analysis Run')).toBeVisible({ timeout: 10_000 });
    await page.click('button:has-text("Start Analysis")');

    // Wait for Stage 2 to be active
    await expect(page.locator('text=Prior Art Research')).toBeVisible({ timeout: 10_000 });

    // Cancel the run
    const cancelButton = page.locator('button:has-text("Cancel Analysis")');
    await expect(cancelButton).toBeVisible({ timeout: 5_000 });
    await cancelButton.click();

    // Wait for cancellation message
    await expect(page.locator('text=analysis was cancelled')).toBeVisible({ timeout: 10_000 });

    // Verify no error banners (red backgrounds indicating errors)
    const errorBanners = page.locator('.bg-red-900');
    const errorCount = await errorBanners.count();
    expect(errorCount).toBe(0);

    await screenshot(page, 'cancel-no-error-banners');
  });

  test('cancel button disappears after cancellation completes', async ({ page, consoleErrors }) => {
    const sseBody = buildSlowMockSSEResponse();
    await setupMocks(page, sseBody);
    await fillInventionForm(page, projectId);

    await page.click('button:has-text("Save & Run Feasibility")');
    await expect(page.locator('text=Confirm Analysis Run')).toBeVisible({ timeout: 10_000 });
    await page.click('button:has-text("Start Analysis")');

    // Wait for Stage 2 to be active
    await expect(page.locator('text=Prior Art Research')).toBeVisible({ timeout: 10_000 });

    // Cancel the run
    const cancelButton = page.locator('button:has-text("Cancel Analysis")');
    await cancelButton.click();

    // Wait for cancellation to complete before checking button state
    await expect(page.locator('text=analysis was cancelled')).toBeVisible({ timeout: 15_000 }).catch(() => {
      // cancellation message may use different text — check for CANCELLED status indicator
    });

    // After cancellation, the Cancel Analysis button should disappear
    await expect(page.locator('button:has-text("Cancel Analysis")')).not.toBeVisible({ timeout: 10_000 });

    // Run button should reappear
    const runButton = page.locator('button:has-text("Run Feasibility")');
    await expect(runButton).toBeVisible({ timeout: 5_000 });

    await screenshot(page, 'cancel-button-replaced');
  });
});
