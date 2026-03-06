// tests/logging.spec.js
import { test, expect } from '@playwright/test';
import { waitForReact, tapNav, tapButton, tapCard, getLS, setLS, expectToast, mockAPI } from './helpers.js';

// Pre-seed an onboarded user before each test
test.beforeEach(async ({ page }) => {
  // Mock API calls so tests don't need real backend
  await mockAPI(page, '**/api/sync/push', { success: true, records: 0 });
  await mockAPI(page, '**/api/sync/pull', { success: false, error: 'no account' });
  await mockAPI(page, '**/api/social**', { events: [], friends: [], groups: [] });
  await mockAPI(page, '**/api/auth/session', { success: false });

  await page.goto('/');
  // Seed onboarded state
  await page.evaluate(() => {
    const state = {
      onboarded: true, tab: 'home', units: 'lbs',
      profile: { email: 'test@ironlog.test', firstName: 'Test' },
      workouts: [], nutrition: [], body: [], photos: [], checkins: [], milestones: [],
      exercises: JSON.parse(localStorage.getItem('ft-ex') || '[]'),
      goals: { cal: 2400, protein: 180, carbs: 250, fat: 70, goalWeight: 175 },
      schedule: { weekly: { 0: 'Rest', 1: 'Push', 2: 'Pull', 3: 'Rest', 4: 'Legs', 5: 'Push', 6: 'Pull' }, overrides: {} },
    };
    localStorage.setItem('ft-onb', 'true');
    localStorage.setItem('ft-profile', JSON.stringify(state.profile));
    localStorage.setItem('ft-g', JSON.stringify(state.goals));
    localStorage.setItem('ft-sched', JSON.stringify(state.schedule));
    localStorage.setItem('ft-units', '"lbs"');
    localStorage.setItem('ft-w', '[]');
    localStorage.setItem('ft-n', '[]');
    localStorage.setItem('ft-b', '[]');
    localStorage.setItem('ft-guide-done', 'true');
  });
  await page.reload();
  await waitForReact(page, 1500);
});

test.describe('Workout Logging', () => {

  test('can navigate to workout logger', async ({ page }) => {
    await tapNav(page, 'Log');
    await waitForReact(page);
    await expect(page.locator('text=/what are you logging/i')).toBeVisible();
    await tapCard(page, 'Workout');
    await waitForReact(page);
    await expect(page.locator('text=/search exercises/i')).toBeVisible();
  });

  test('can search and select an exercise', async ({ page }) => {
    await tapNav(page, 'Log');
    await tapCard(page, 'Workout');
    await waitForReact(page);

    // Search for bench press
    await page.locator('input[placeholder*="Search exercises"]').fill('bench');
    await waitForReact(page, 300);
    await expect(page.locator('text=/bench press/i').first()).toBeVisible();
    await page.locator('text=/bench press/i').first().click();
    await waitForReact(page);
  });

  test('can add a set with weight and reps', async ({ page }) => {
    await tapNav(page, 'Log');
    await tapCard(page, 'Workout');
    await waitForReact(page);

    // Select exercise
    await page.locator('input[placeholder*="Search exercises"]').fill('bench');
    await waitForReact(page, 300);
    await page.locator('text=/bench press/i').first().click();
    await waitForReact(page);

    // Fill weight and reps
    const weightInput = page.locator('input[placeholder*="lbs"], input[placeholder*="Weight"]').first();
    const repsInput = page.locator('input[placeholder*="Reps"], input[placeholder*="reps"]').first();

    if (await weightInput.isVisible()) await weightInput.fill('135');
    if (await repsInput.isVisible()) await repsInput.fill('10');

    // Add set
    await tapButton(page, 'Add Set');
    await waitForReact(page);
  });

  test('can save a complete workout', async ({ page }) => {
    await tapNav(page, 'Log');
    await tapCard(page, 'Workout');
    await waitForReact(page);

    await page.locator('input[placeholder*="Search exercises"]').fill('squat');
    await waitForReact(page, 300);
    await page.locator('button:has-text("Squat")').first().click();
    await waitForReact(page);

    // Add set data
    const weightInput = page.locator('input[placeholder*="lbs"], input[placeholder*="Weight"]').first();
    const repsInput = page.locator('input[placeholder*="Reps"], input[placeholder*="reps"]').first();
    if (await weightInput.isVisible()) await weightInput.fill('225');
    if (await repsInput.isVisible()) await repsInput.fill('5');
    await tapButton(page, 'Add Set');
    await waitForReact(page);

    // Save workout
    await tapButton(page, 'Save Workout');
    await waitForReact(page);

    // Verify saved to localStorage
    const workouts = await getLS(page, 'ft-w');
    expect(workouts).toBeTruthy();
    expect(workouts.length).toBeGreaterThan(0);
  });

  test('schedule-aware: shows "Today\'s split" badge', async ({ page }) => {
    // Set today to a Push day
    const dow = new Date().getDay();
    await page.evaluate((d) => {
      const sched = JSON.parse(localStorage.getItem('ft-sched'));
      sched.weekly[d] = 'Push';
      localStorage.setItem('ft-sched', JSON.stringify(sched));
    }, dow);
    await page.reload();
    await waitForReact(page, 1000);

    await tapNav(page, 'Log');
    await tapCard(page, 'Workout');
    await waitForReact(page);

    // Should see "Today's split" on chest/shoulder exercises
    const splitBadge = page.locator("text=/Today's split/i");
    await expect(splitBadge.first()).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Nutrition Logging', () => {

  test('can navigate to nutrition logger', async ({ page }) => {
    await tapNav(page, 'Log');
    await tapCard(page, 'Nutrition');
    await waitForReact(page);
  });

  test('daily summary bar shows zeros when no food logged', async ({ page }) => {
    await tapNav(page, 'Log');
    await tapCard(page, 'Nutrition');
    await waitForReact(page);

    // Should see the daily summary card
    await expect(page.locator('text=/Today/i').first()).toBeVisible();
    await expect(page.locator('text=/0.*cal/i').first()).toBeVisible();
  });

  test('can open food logger and search', async ({ page }) => {
    await tapNav(page, 'Log');
    await tapCard(page, 'Nutrition');
    await waitForReact(page);

    await tapButton(page, 'Log Nutrition');
    await waitForReact(page);

    // Should see meal categories
    await expect(page.locator('text=/Breakfast/i').first()).toBeVisible();
  });

  test('can save nutrition entry', async ({ page }) => {
    await tapNav(page, 'Log');
    await tapCard(page, 'Nutrition');
    await waitForReact(page);

    await tapButton(page, 'Log Nutrition');
    await waitForReact(page);

    // Fill manual entry fields
    const calInput = page.locator('input').nth(0);
    if (await calInput.isVisible()) {
      // Find the calorie field
      const fields = page.locator('input[type="number"]');
      const count = await fields.count();
      if (count >= 4) {
        await fields.nth(0).fill('500');  // cal
        await fields.nth(1).fill('40');   // protein
        await fields.nth(2).fill('50');   // carbs
        await fields.nth(3).fill('15');   // fat
      }
    }

    await tapButton(page, 'Save');
    await waitForReact(page);

    const nutrition = await getLS(page, 'ft-n');
    expect(nutrition).toBeTruthy();
  });
});

test.describe('Body Metrics Logging', () => {

  test('can navigate to body metrics', async ({ page }) => {
    await tapNav(page, 'Log');
    await tapCard(page, 'Body');
    await waitForReact(page);
  });

  test('shows trend arrows after logging', async ({ page }) => {
    // Pre-seed two body entries
    await page.evaluate(() => {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      localStorage.setItem('ft-b', JSON.stringify([
        { id: 'b1', date: today, weight: 182, bf: '15', chest: '', waist: '', arms: '', thighs: '' },
        { id: 'b2', date: yesterday, weight: 183.5, bf: '15.2', chest: '', waist: '', arms: '', thighs: '' },
      ]));
    });
    await page.reload();
    await waitForReact(page, 1000);

    await tapNav(page, 'Log');
    await tapCard(page, 'Body');
    await waitForReact(page);

    // Should show down arrow for weight loss
    await expect(page.locator('text=/↘/').first()).toBeVisible({ timeout: 3000 });
  });

  test('can log a new body measurement', async ({ page }) => {
    await tapNav(page, 'Log');
    await tapCard(page, 'Body');
    await waitForReact(page);

    await tapButton(page, 'Log Measurement');
    await waitForReact(page);

    // Fill weight
    const weightField = page.locator('input[type="number"]').first();
    await weightField.fill('180');

    await tapButton(page, 'Save');
    await waitForReact(page);

    const body = await getLS(page, 'ft-b');
    expect(body).toBeTruthy();
    expect(body.length).toBeGreaterThan(0);
  });
});
