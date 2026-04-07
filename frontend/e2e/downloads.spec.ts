/**
 * E2E tests for download/export buttons across all pipeline tabs.
 *
 * These tests require a project with completed pipeline data (feasibility,
 * claims, compliance, and application). If no such project exists in the
 * test environment, all tests skip gracefully.
 *
 * Verified buttons:
 *   - Feasibility tab: Export HTML, Export Word
 *   - Claims tab: Export Word
 *   - Compliance tab: Export Word
 *   - Application tab: Export HTML, Export Word
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000/api';

let projectId: string | undefined;

test.describe('Download Buttons — Export to Disk', () => {
  test.beforeAll(async () => {
    const res = await fetch(`${API_BASE}/projects`);
    const projects: Array<{ id: string; status: string }> = await res.json();
    const completed = projects.find((p) => p.status !== 'INTAKE');
    if (completed) {
      projectId = completed.id;
    }
  });

  test('feasibility HTML export downloads a file', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.click('text=Feasibility');
    await page.waitForLoadState('networkidle');

    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Export HTML');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.html$/);
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('feasibility Word export downloads a file', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.click('text=Feasibility');
    await page.waitForLoadState('networkidle');

    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Export Word');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('claims Word export downloads a file', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.click('text=Claims');
    await page.waitForLoadState('networkidle');

    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Export Word');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('compliance Word export downloads a file', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.click('text=Compliance');
    await page.waitForLoadState('networkidle');

    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Export Word');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('application HTML export downloads a file', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.click('text=Application');
    await page.waitForLoadState('networkidle');

    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Export HTML');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.html$/);
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('application Word export downloads a file', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.click('text=Application');
    await page.waitForLoadState('networkidle');

    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Export Word');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});
