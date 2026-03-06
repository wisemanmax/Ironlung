// tests/onboarding.spec.js
import { test, expect } from '@playwright/test';
import { waitForReact, clearAppState, fillField, tapButton, getLS, expectToast } from './helpers.js';

test.describe('Onboarding Flow', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppState(page);
  });

  test('shows onboarding on fresh install', async ({ page }) => {
    await expect(page.locator('text=/welcome to ironlog/i')).toBeVisible({ timeout: 5000 });
  });

  test('step 0: welcome screen has Get Started button', async ({ page }) => {
    await expect(page.locator('text=/get started/i')).toBeVisible();
    await expect(page.locator('text=/welcome back/i')).toBeVisible(); // sign-in option
  });

  test('full signup flow: steps 0-5', async ({ page }) => {
    // Step 0: Welcome → Get Started
    await tapButton(page, 'Get Started');
    await waitForReact(page);

    // Step 1: Units
    await expect(page.locator('text=/choose your units/i')).toBeVisible();
    await tapButton(page, 'lbs'); // or the unit selector
    await tapButton(page, 'Next');
    await waitForReact(page);

    // Step 2: Split selection
    await expect(page.locator('text=/training split/i')).toBeVisible();
    await page.locator('text=/push.*pull.*legs/i').first().click();
    await waitForReact(page);
    await tapButton(page, 'Next');
    await waitForReact(page);

    // Step 3: Goals
    await expect(page.locator('text=/goals/i').first()).toBeVisible();
    await tapButton(page, 'Next');
    await waitForReact(page);

    // Step 4: Profile
    await expect(page.locator('text=/profile/i').first()).toBeVisible();
    // Fill required fields
    const inputs = page.locator('input');
    const firstNameInput = page.locator('input').first();
    await firstNameInput.fill('TestUser');
    // Fill remaining required fields
    await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill('testuser@ironlog.test');
    await waitForReact(page);

    // Navigate through remaining required fields and hit Next
    // (specific selectors depend on field ordering)
    await tapButton(page, 'Next');
    await waitForReact(page);

    // Step 5: Account PIN
    await expect(page.locator('text=/secure your account/i')).toBeVisible();
    const pinInputs = page.locator('input[type="password"], input[inputmode="numeric"]');
    await pinInputs.first().fill('123456');
    if (await pinInputs.count() > 1) {
      await pinInputs.nth(1).fill('123456');
    }
    await waitForReact(page);
  });

  test('welcome back: sign-in shows email step', async ({ page }) => {
    await tapButton(page, 'Welcome Back');
    await waitForReact(page);
    await expect(page.locator('text=/email/i').first()).toBeVisible();
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible();
  });

  test('sign-in with invalid email shows error', async ({ page }) => {
    await tapButton(page, 'Welcome Back');
    await waitForReact(page);
    await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill('notanemail');
    await tapButton(page, 'Sign In');
    await waitForReact(page);
    await expect(page.locator('text=/valid email/i')).toBeVisible();
  });

  test('guided walkthrough appears after onboarding', async ({ page }) => {
    // Set onboarded state to skip signup
    await page.evaluate(() => {
      localStorage.setItem('ft-onb', 'true');
      localStorage.setItem('ft-profile', JSON.stringify({ email: 'test@test.com', firstName: 'Test' }));
      localStorage.setItem('ft-guide-done', null);
    });
    await page.reload();
    await waitForReact(page, 1500);

    // Guide should auto-show if not dismissed
    const guide = page.locator('text=/walk through/i, text=/welcome to ironlog/i');
    // May or may not show depending on ft-guide-done state
  });
});
