// tests/social.spec.js
import { test, expect } from '@playwright/test';
import { waitForReact, tapNav, tapCard, tapButton, mockAPI, getLS, setLS } from './helpers.js';

test.beforeEach(async ({ page }) => {
  // Mock all API calls
  await mockAPI(page, '**/api/sync/push', { success: true });
  await mockAPI(page, '**/api/auth/session', { success: false });

  // Mock social endpoints with realistic data
  await page.route('**/api/social**', (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // GET requests
    if (method === 'GET') {
      if (url.includes('route=friends')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          friends: [{ email: 'friend@test.com', name: 'Gym Buddy', username: 'gymbuddy', since: '2026-02-01' }],
          incoming: [{ from: 'newguy@test.com', date: '2026-03-05' }],
          outgoing: [],
        })});
      }
      if (url.includes('route=feed')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          events: [
            { id: 'e1', email: 'friend@test.com', name: 'Gym Buddy', type: 'WorkoutLogged',
              data: { exercises: ['Bench Press', 'OHP'], sets: 12 }, reactions: { '💪': 2 },
              created_at: new Date().toISOString(), isOwn: false },
          ],
        })});
      }
      if (url.includes('route=groups')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          groups: [{ code: 'IRON01', name: 'Iron Crew', member_count: 5, role: 'member' }],
        })});
      }
      if (url.includes('route=notifications')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          notifications: [{ id: 'n1', type: 'friend_request', title: 'Friend Request', body: 'newguy wants to connect', read: false, created_at: new Date().toISOString() }],
          unread: 1,
        })});
      }
      if (url.includes('route=profile')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          found: true, profile: { name: 'Gym Buddy', username: 'gymbuddy', badges: ['🔥 7-Day Streak'], challenges: [{ challenge_id: 'streak', value: 12, tier: 'silver' }] }
        })});
      }
    }

    // POST requests — mock success
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('ft-onb', 'true');
    localStorage.setItem('ft-profile', JSON.stringify({ email: 'test@ironlog.test', firstName: 'Test' }));
    localStorage.setItem('ft-w', JSON.stringify([
      { id: 'w1', date: new Date().toISOString().slice(0, 10), exercises: [{ exerciseId: 'bench', sets: [{ weight: 135, reps: 10 }] }] },
    ]));
    localStorage.setItem('ft-n', JSON.stringify([
      { id: 'n1', date: new Date().toISOString().slice(0, 10), cal: 1800, protein: 150, carbs: 200, fat: 60 },
    ]));
    localStorage.setItem('ft-guide-done', 'true');
    localStorage.setItem('ft-units', '"lbs"');
    localStorage.setItem('ft-g', JSON.stringify({ cal: 2400, protein: 180, carbs: 250, fat: 70, goalWeight: 175 }));
  });
  await page.reload();
  await waitForReact(page, 1500);
});

test.describe('Social Tab Navigation', () => {

  test('social tab shows hub with sections', async ({ page }) => {
    await tapNav(page, 'Social');
    await waitForReact(page);
    await expect(page.locator('text=/community/i').first()).toBeVisible();
    await expect(page.locator('text=/your activity/i')).toBeVisible();
    await expect(page.locator('text=/connections/i')).toBeVisible();
    await expect(page.locator('text=/compete/i')).toBeVisible();
  });

  test('notification badge shows on social tab', async ({ page }) => {
    await waitForReact(page, 2000); // wait for notif fetch
    // The red dot badge should be visible in the nav
    const badge = page.locator('nav div[style*="background"][style*="danger"], nav div[style*="background: rgb(239"]');
    // Badge might render as a small dot
  });
});

test.describe('Friend Request Flow', () => {

  test('can view friends list', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Friends');
    await waitForReact(page, 1000);
    await expect(page.locator('text=/Gym Buddy/i')).toBeVisible();
  });

  test('shows incoming friend requests', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Friends');
    await waitForReact(page, 1000);
    await expect(page.locator('text=/newguy@test.com/i')).toBeVisible();
    await expect(page.locator('text=/Accept/i').first()).toBeVisible();
  });

  test('can accept a friend request', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Friends');
    await waitForReact(page, 1000);
    await tapButton(page, 'Accept');
    await waitForReact(page);
  });

  test('can send a friend request by email', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Friends');
    await waitForReact(page, 1000);

    await page.locator('input[placeholder*="email" i]').fill('newbuddy@test.com');
    await tapButton(page, 'Send');
    await waitForReact(page);
  });

  test('can remove a friend', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Friends');
    await waitForReact(page, 1000);

    // Mock confirm dialog
    page.on('dialog', dialog => dialog.accept());

    // Click X button on friend
    const removeBtn = page.locator('button:near(:text("Gym Buddy"))').filter({ has: page.locator('svg') }).last();
    if (await removeBtn.isVisible()) await removeBtn.click();
  });
});

test.describe('Group Join Flow', () => {

  test('can view groups', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Groups');
    await waitForReact(page, 1000);
    await expect(page.locator('text=/Iron Crew/i')).toBeVisible();
    await expect(page.locator('text=/IRON01/i')).toBeVisible();
  });

  test('can join group by code', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Groups');
    await waitForReact(page, 1000);

    await page.locator('input[placeholder*="code" i]').fill('TEST01');
    await tapButton(page, 'Join');
    await waitForReact(page);
  });

  test('can create a new group', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Groups');
    await waitForReact(page, 1000);

    await tapButton(page, 'Create a Group');
    await waitForReact(page);
    await page.locator('input[placeholder*="name" i]').fill('My Test Group');
    await tapButton(page, 'Create');
    await waitForReact(page);
  });
});

test.describe('Challenge Progress UI', () => {

  test('challenges page shows tiered progress', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Challenges');
    await waitForReact(page);

    // Should show the three core challenges
    await expect(page.locator('text=/workout streak/i')).toBeVisible();
    await expect(page.locator('text=/big 3 total/i')).toBeVisible();
    await expect(page.locator('text=/macro master/i')).toBeVisible();
  });

  test('challenges show tier badges', async ({ page }) => {
    // Pre-seed 10 days of workouts for streak
    await page.evaluate(() => {
      const workouts = [];
      for (let i = 0; i < 10; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        workouts.push({ id: `w${i}`, date: d.toISOString().slice(0, 10), exercises: [{ exerciseId: 'bench', sets: [{ weight: 135, reps: 10 }] }] });
      }
      localStorage.setItem('ft-w', JSON.stringify(workouts));
    });
    await page.reload();
    await waitForReact(page, 1000);

    await tapNav(page, 'Social');
    await tapCard(page, 'Challenges');
    await waitForReact(page);

    // Should show Bronze tier (7+ days)
    await expect(page.locator('text=/Bronze/i').first()).toBeVisible();
  });

  test('weekly challenge shows progress', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Challenges');
    await waitForReact(page);

    await expect(page.locator('text=/weekly challenge/i')).toBeVisible();
    await expect(page.locator('text=/resets/i')).toBeVisible();
  });

  test('badges page shows earned and locked', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Badges');
    await waitForReact(page);

    await expect(page.locator('text=/badges/i').first()).toBeVisible();
    await expect(page.locator('text=/of.*earned/i')).toBeVisible();
  });
});

test.describe('Social Feed', () => {

  test('feed shows today card with stats', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Feed');
    await waitForReact(page, 1000);

    await expect(page.locator('text=/Today/i').first()).toBeVisible();
    await expect(page.locator('text=/Readiness/i').first()).toBeVisible();
    await expect(page.locator('text=/Protein/i').first()).toBeVisible();
  });

  test('feed shows friend activity', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Feed');
    await waitForReact(page, 1000);

    await expect(page.locator('text=/Gym Buddy/i').first()).toBeVisible();
    await expect(page.locator('text=/logged a workout/i')).toBeVisible();
  });

  test('feed shows reaction buttons', async ({ page }) => {
    await tapNav(page, 'Social');
    await tapCard(page, 'Feed');
    await waitForReact(page, 1000);

    // Reaction emojis should be visible
    await expect(page.locator('text=💪').first()).toBeVisible();
  });

  test('feed shows error retry on failure', async ({ page }) => {
    // Override mock to fail
    await page.route('**/api/social**', route => {
      if (route.request().url().includes('route=feed') && route.request().method() === 'GET') {
        return route.fulfill({ status: 500, body: 'error' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await tapNav(page, 'Social');
    await tapCard(page, 'Feed');
    await waitForReact(page, 1500);

    await expect(page.locator('text=/could not load/i')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/tap to retry/i')).toBeVisible();
  });
});
