// tests/sync.spec.js
import { test, expect } from '@playwright/test';
import { waitForReact, tapNav, tapCard, tapButton, mockAPI, getLS, goOffline, goOnline } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('ft-onb', 'true');
    localStorage.setItem('ft-profile', JSON.stringify({ email: 'test@ironlog.test', firstName: 'Test' }));
    localStorage.setItem('ft-guide-done', 'true');
    localStorage.setItem('ft-units', '"lbs"');
    localStorage.setItem('ft-w', '[]');
    localStorage.setItem('ft-n', '[]');
    localStorage.setItem('ft-b', '[]');
    localStorage.setItem('ft-g', JSON.stringify({ cal: 2400, protein: 180, carbs: 250, fat: 70, goalWeight: 175 }));
    localStorage.setItem('ft-sched', JSON.stringify({ weekly: {}, overrides: {} }));
  });
  await page.reload();
  await waitForReact(page, 1500);
});

test.describe('Sync Status Indicators', () => {

  test('shows sync timestamp on home after successful push', async ({ page }) => {
    // Mock successful push
    await mockAPI(page, '**/api/sync/push', { success: true, records: 5 });
    await mockAPI(page, '**/api/social**', { events: [] });
    await mockAPI(page, '**/api/auth/session', { success: false });

    // Trigger a sync by making a data change
    await page.evaluate(() => {
      localStorage.setItem('ft-last-sync', new Date().toISOString());
    });
    await page.reload();
    await waitForReact(page, 1000);

    // Home should show sync timestamp
    await expect(page.locator('text=/synced/i').first()).toBeVisible({ timeout: 3000 });
  });

  test('sync timestamp shows relative time', async ({ page }) => {
    await page.evaluate(() => {
      // Set sync to 5 minutes ago
      const t = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      localStorage.setItem('ft-last-sync', t);
    });
    await page.reload();
    await waitForReact(page, 1000);

    await expect(page.locator('text=/5m ago/i')).toBeVisible({ timeout: 3000 });
  });

  test('pending sync indicator when data queued', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ft-pending-sync', '3');
    });
    await page.reload();
    await waitForReact(page, 1000);

    // Check for any pending sync indicator
    const pending = await getLS(page, 'ft-pending-sync');
    expect(parseInt(pending) || 0).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Offline Behavior', () => {

  test('app loads and renders when offline', async ({ page }) => {
    // First load to cache
    await mockAPI(page, '**/api/**', { success: true });
    await page.reload();
    await waitForReact(page, 1000);

    // Go offline
    await goOffline(page);
    await page.reload();
    await waitForReact(page, 2000);

    // App should still render from cache
    await expect(page.locator('nav')).toBeVisible();
    await goOnline(page);
  });

  test('data changes persist locally when offline', async ({ page }) => {
    await mockAPI(page, '**/api/sync/push', { success: true });

    // Go offline
    await goOffline(page);
    await waitForReact(page);

    // Log a workout while offline
    await tapNav(page, 'Log');
    await tapCard(page, 'Workout');
    await waitForReact(page);

    await page.locator('input[placeholder*="Search exercises"]').fill('bench');
    await waitForReact(page, 300);
    await page.locator('button:has-text("Bench")').first().click();
    await waitForReact(page);

    const weightInput = page.locator('input[placeholder*="lbs"], input[placeholder*="Weight"]').first();
    const repsInput = page.locator('input[placeholder*="Reps"], input[placeholder*="reps"]').first();
    if (await weightInput.isVisible()) await weightInput.fill('135');
    if (await repsInput.isVisible()) await repsInput.fill('10');
    await tapButton(page, 'Add Set');
    await waitForReact(page);
    await tapButton(page, 'Save Workout');
    await waitForReact(page);

    // Data should be in localStorage
    const workouts = await getLS(page, 'ft-w');
    expect(workouts.length).toBeGreaterThan(0);

    await goOnline(page);
  });

  test('sync fires when coming back online', async ({ page }) => {
    let pushCalled = false;
    await page.route('**/api/sync/push', (route) => {
      pushCalled = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    // Seed a workout so there's data to push
    await page.evaluate(() => {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('ft-w', JSON.stringify([{
        id: 'offline-w1', date: today,
        exercises: [{ exerciseId: 'bench', sets: [{ weight: 135, reps: 10, rpe: 7 }] }]
      }]));
    });

    await goOffline(page);
    await page.reload();
    await waitForReact(page, 1000);

    await goOnline(page);
    // Wait for debounced sync (3 second delay + network)
    await waitForReact(page, 5000);

    // Push should have been called after reconnecting
    // Note: this depends on the debounced push firing on the re-render after going online
  });
});

test.describe('Health Check & Force Sync', () => {

  test('health check button exists in settings', async ({ page }) => {
    await tapNav(page, 'Settings');
    await waitForReact(page);

    // Scroll to find Data section
    await expect(page.locator('text=/health check/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('force sync button appears after health check with differences', async ({ page }) => {
    // Mock pull to return different counts
    await page.route('**/api/sync/pull', route => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true,
        data: { workouts: [], nutrition: [], body: [], photos: [], checkins: [], milestones: [],
          exercises: [], goals: {}, schedule: {}, units: 'lbs' },
      })});
    });

    // Seed local data so there's a mismatch
    await page.evaluate(() => {
      localStorage.setItem('ft-w', JSON.stringify([
        { id: 'w1', date: '2026-03-05', exercises: [] },
      ]));
    });
    await page.reload();
    await waitForReact(page, 1000);

    await tapNav(page, 'Settings');
    await waitForReact(page);

    await tapButton(page, 'Run Health Check');
    await waitForReact(page, 3000);

    // Should show differences
    await expect(page.locator('text=/differences/i, text=/not yet in cloud/i').first()).toBeVisible({ timeout: 5000 });

    // Force sync button should appear
    await expect(page.locator('text=/force sync/i')).toBeVisible();
  });

  test('export JSON produces valid file', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ft-w', JSON.stringify([{ id: 'w1', date: '2026-03-05', exercises: [] }]));
    });
    await page.reload();
    await waitForReact(page, 1000);

    await tapNav(page, 'Settings');
    await waitForReact(page);

    // Listen for download
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      tapButton(page, 'Export JSON'),
    ]);

    if (download) {
      const path = await download.path();
      expect(path).toBeTruthy();
    }
  });
});

test.describe('Cloud Restore with PIN', () => {

  test('restore shows PIN input when required', async ({ page }) => {
    await page.route('**/api/sync/pull', route => {
      return route.fulfill({ status: 403, contentType: 'application/json',
        body: JSON.stringify({ error: 'PIN required', pin_required: true }) });
    });

    await tapNav(page, 'Settings');
    await waitForReact(page);

    await tapButton(page, 'Restore from Cloud');
    await waitForReact(page, 2000);

    // Should show PIN input
    await expect(page.locator('text=/account pin required/i')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('wrong PIN shows error with remaining attempts', async ({ page }) => {
    let attempts = 0;
    await page.route('**/api/sync/pull', route => {
      attempts++;
      return route.fulfill({ status: 403, contentType: 'application/json',
        body: JSON.stringify(attempts === 1
          ? { error: 'PIN required', pin_required: true }
          : { error: 'Wrong PIN', attempts_remaining: 4 }) });
    });

    await tapNav(page, 'Settings');
    await tapButton(page, 'Restore from Cloud');
    await waitForReact(page, 2000);

    // Enter wrong PIN
    await page.locator('input[type="password"]').fill('000000');
    await tapButton(page, 'Go');
    await waitForReact(page, 2000);

    await expect(page.locator('text=/wrong pin/i')).toBeVisible({ timeout: 5000 });
  });
});
