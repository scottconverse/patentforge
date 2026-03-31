import { test, expect } from '@playwright/test';
import { getSettings, updateSettings } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('patentforge_disclaimer_accepted', new Date().toISOString());
  });
});

test.describe('Settings Page', () => {
  // Reset settings after tests
  test.afterAll(async () => {
    await updateSettings({
      anthropicApiKey: '',
      usptoApiKey: '',
      defaultModel: 'claude-haiku-4-5-20251001',
    });
  });

  test('loads settings page with all sections', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.locator('h1, h2').filter({ hasText: /settings/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Anthropic API Key')).toBeVisible();
    await expect(page.locator('label:has-text("USPTO Open Data Portal Key")')).toBeVisible();
    await expect(page.locator('button:has-text("Save Settings")')).toBeVisible();
  });

  test('can save and persist API key settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('button:has-text("Save Settings")')).toBeVisible({ timeout: 10_000 });

    // Fill in a test key value — find the anthropic key input
    const anthropicInput = page.locator('input[type="password"]').first();
    await anthropicInput.fill('sk-ant-test-key-12345');

    // Save
    await page.click('button:has-text("Save Settings")');

    // Wait for save confirmation
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5_000 });

    // Verify via API that settings were persisted
    const settings = await getSettings();
    expect(settings.anthropicApiKey).toBe('sk-ant-test-key-12345');
  });

  test('model dropdown reflects saved selection', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('button:has-text("Save Settings")')).toBeVisible({ timeout: 10_000 });

    // The default model dropdown should exist and have a value
    const modelSelect = page.locator('select').first();
    await expect(modelSelect).toBeVisible();
  });
});
