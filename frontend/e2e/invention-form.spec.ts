import { test, expect } from '@playwright/test';
import { createProject, deleteProject } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('patentforge_disclaimer_accepted', new Date().toISOString());
  });
});

test.describe('Invention Form', () => {
  let projectId: string;

  test.beforeEach(async () => {
    projectId = await createProject('E2E Invention Form Test');
  });

  test.afterEach(async () => {
    await deleteProject(projectId);
  });

  test('shows invention form with required fields on project detail page', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);

    // Wait for the form to load — look for the "Title" label
    await expect(page.locator('label:has-text("Title")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('label:has-text("Description")')).toBeVisible();

    // Required field indicators should be present
    await expect(page.locator('button:has-text("Save Draft")')).toBeVisible();
  });

  test('can fill and save invention form fields', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await expect(page.locator('label:has-text("Title")')).toBeVisible({ timeout: 10_000 });

    // Fill required fields
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill('Self-Healing Concrete Monitor');

    const descInput = page.locator('textarea').first();
    await descInput.fill('An IoT sensor network that monitors concrete structures.');

    // Click save and verify the API call succeeds (no error state)
    await page.click('button:has-text("Save Draft")');

    // Should not show any error messages
    await page.waitForTimeout(500);
    await expect(page.locator('.text-red-300, .text-red-400')).not.toBeVisible();

    // Verify via API that the invention was persisted
    const res = await page.request.get(`http://localhost:3000/projects/${projectId}/invention`);
    const invention = await res.json();
    expect(invention.title).toBe('Self-Healing Concrete Monitor');
    expect(invention.description).toContain('IoT sensor network');
  });
});
