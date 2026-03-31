import { test, expect, screenshot, checkViewport } from './fixtures';
import { createProject, deleteProject } from './helpers';

test.describe('Invention Form', () => {
  let projectId: string;

  test.beforeEach(async () => {
    projectId = await createProject('E2E Invention Form Test');
  });

  test.afterEach(async () => {
    await deleteProject(projectId);
  });

  test('shows invention form with required fields', async ({ page, consoleErrors }) => {
    await page.goto(`/projects/${projectId}`);

    await expect(page.locator('label:has-text("Title")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('label:has-text("Description")')).toBeVisible();
    await expect(page.locator('button:has-text("Save Draft")')).toBeVisible();
    await screenshot(page, 'invention-form-empty');
  });

  test('can fill and save invention form fields', async ({ page, consoleErrors }) => {
    await page.goto(`/projects/${projectId}`);
    await expect(page.locator('label:has-text("Title")')).toBeVisible({ timeout: 10_000 });

    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill('Self-Healing Concrete Monitor');

    const descInput = page.locator('textarea').first();
    await descInput.fill('An IoT sensor network that monitors concrete structures.');

    await screenshot(page, 'invention-form-filled');
    await page.click('button:has-text("Save Draft")');

    // Should not show any error messages
    await page.waitForTimeout(500);
    await expect(page.locator('.text-red-300, .text-red-400')).not.toBeVisible();
    await screenshot(page, 'invention-form-saved');

    // Verify via API that the invention was persisted
    const res = await page.request.get(`http://localhost:3000/projects/${projectId}/invention`);
    const invention = await res.json();
    expect(invention.title).toBe('Self-Healing Concrete Monitor');
    expect(invention.description).toContain('IoT sensor network');
  });

  test('responsive: invention form at mobile viewport', async ({ page, consoleErrors }) => {
    await page.goto(`/projects/${projectId}`);
    await expect(page.locator('label:has-text("Title")')).toBeVisible({ timeout: 10_000 });
    await checkViewport(page, 'invention-form-mobile', 375, 812);

    // Form elements should still be usable at mobile width
    await expect(page.locator('button:has-text("Save Draft")')).toBeVisible();
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });
});
