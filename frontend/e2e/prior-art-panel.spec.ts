import { test, expect } from '@playwright/test';
import { createProject, deleteProject } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('patentforge_disclaimer_accepted', new Date().toISOString());
  });
});

test.describe('Prior Art Panel', () => {
  let projectId: string;

  test.beforeEach(async () => {
    projectId = await createProject('E2E Prior Art Test');
  });

  test.afterEach(async () => {
    await deleteProject(projectId);
  });

  test('project detail page loads without errors', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=E2E Prior Art Test')).toBeVisible({ timeout: 10_000 });
  });
});
