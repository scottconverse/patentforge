import { test, expect } from '@playwright/test';

// Dismiss the disclaimer modal before each test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('patentforge_disclaimer_accepted', new Date().toISOString());
  });
});

test.describe('Navigation', () => {
  test('home page loads and shows project list', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PatentForge/i);
    await expect(page.locator('h1')).toContainText('Projects');
  });

  test('settings link navigates to settings page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/settings"]');
    await expect(page).toHaveURL(/\/settings/);
  });

  test('logo navigates back to home from settings', async ({ page }) => {
    await page.goto('/settings');
    await page.click('a:has-text("PatentForge")');
    await expect(page).toHaveURL('/');
  });
});
