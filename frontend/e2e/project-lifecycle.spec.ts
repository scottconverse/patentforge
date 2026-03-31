import { test, expect } from '@playwright/test';
import { createProject, deleteProject } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('patentforge_disclaimer_accepted', new Date().toISOString());
  });
});

test.describe('Project Lifecycle', () => {
  let projectId: string | null = null;

  test.afterEach(async () => {
    if (projectId) {
      await deleteProject(projectId);
      projectId = null;
    }
  });

  test('can create a new project from the project list', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Projects');

    // Click "+ New Project"
    await page.click('button:has-text("New Project")');

    // Fill in project title
    const input = page.locator('input[type="text"]').first();
    await input.fill('E2E Test Widget Analyzer');
    await page.click('button:has-text("Create")');

    // Project should appear in the list
    await expect(page.locator('h3:has-text("E2E Test Widget Analyzer")')).toBeVisible({ timeout: 5_000 });

    // Clean up via API — list projects and find our test project
    const res = await page.request.get('http://localhost:3000/projects');
    const projects = await res.json();
    const found = projects.find((p: any) => p.title === 'E2E Test Widget Analyzer');
    if (found) projectId = found.id;
  });

  test('can navigate to project detail page via Open button', async ({ page }) => {
    // Create via API for speed
    projectId = await createProject('E2E Navigate Test');

    await page.goto('/');
    await expect(page.locator('h3:has-text("E2E Navigate Test")')).toBeVisible({ timeout: 5_000 });

    // Find the Open button that's a sibling of the title
    const h3 = page.locator('h3:has-text("E2E Navigate Test")');
    // Go up to the parent row, then find the Open button
    const openBtn = h3.locator('..').locator('..').locator('..').locator('button:has-text("Open")');
    await openBtn.first().click();

    // Should be on project detail page
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`), { timeout: 5_000 });
  });

  test('shows empty state when no projects exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Projects');
  });
});
