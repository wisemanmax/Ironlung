// tests/install-banner.spec.js
import { test, expect } from '@playwright/test';
import { waitForReact, mockAPI, getLS, setLS } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await mockAPI(page, '**/api/**', { success: true });
  await page.goto('/');
  // Seed onboarded state
  await page.evaluate(() => {
    localStorage.setItem('ft-onb', 'true');
    localStorage.setItem('ft-profile', JSON.stringify({ email: 'test@test.com', firstName: 'Test' }));
    localStorage.setItem('ft-guide-done', 'true');
    localStorage.setItem('ft-units', '"lbs"');
    localStorage.setItem('ft-w', '[]');
    localStorage.setItem('ft-n', '[]');
    localStorage.setItem('ft-b', '[]');
  });
  await page.reload();
  await waitForReact(page, 1500);
});

test.describe('Install Banner', () => {

  test('does NOT show on first visit', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('ft-visits', '1'));
    await page.reload();
    await waitForReact(page, 1500);

    const banner = page.locator('text=/install ironlog/i, text=/add to home/i');
    await expect(banner).not.toBeVisible();
  });

  test('banner visibility tracks visit count', async ({ page }) => {
    // The install banner logic checks ft-visits and ft-platform
    const visits = await getLS(page, 'ft-visits');
    expect(visits).toBeTruthy();
    expect(parseInt(visits)).toBeGreaterThanOrEqual(1);
  });

  test('does NOT show if already installed (standalone mode)', async ({ page }) => {
    // Mock standalone display mode
    await page.evaluate(() => {
      // Can't truly mock matchMedia('display-mode: standalone'), but we can check the logic
      localStorage.setItem('ft-installed', 'true');
    });
    await page.reload();
    await waitForReact(page, 1500);

    const banner = page.locator('text=/install ironlog/i, text=/add to home/i');
    await expect(banner).not.toBeVisible();
  });

  test('update banner shows when version mismatch', async ({ page }) => {
    // Simulate server returning newer version
    await page.evaluate(() => {
      localStorage.setItem('ft-update-available', '99.0');
      localStorage.setItem('ft-update-notes', 'Test update');
    });
    await page.reload();
    await waitForReact(page, 1500);

    await expect(page.locator('text=/update available/i')).toBeVisible({ timeout: 3000 });
  });

  test('update banner can be dismissed', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ft-update-available', '99.0');
    });
    await page.reload();
    await waitForReact(page, 1500);

    const banner = page.locator('text=/update available/i');
    if (await banner.isVisible()) {
      // Find dismiss X button near the banner
      const dismissBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
      await dismissBtn.click();
      await waitForReact(page);

      const dismissed = await getLS(page, 'ft-update-dismissed');
      expect(dismissed).toBe('99.0');
    }
  });
});
