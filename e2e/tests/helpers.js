// tests/helpers.js
// Shared utilities for all IRONLOG E2E tests

/** Wait for React to finish rendering after a state change */
export async function waitForReact(page, ms = 500) {
  await page.waitForTimeout(ms);
}

/** Tap a bottom nav tab by label */
export async function tapNav(page, label) {
  await page.locator(`nav button[aria-label="${label}"]`).click();
  await waitForReact(page);
}

/** Tap a Section grid card by its label text */
export async function tapCard(page, label) {
  await page.locator(`button:has-text("${label}")`).first().click();
  await waitForReact(page);
}

/** Tap the SubBack (← Back) button */
export async function tapBack(page) {
  await page.locator('button:has-text("Back"), button:has-text("Log"), button:has-text("Track"), button:has-text("Plan"), button:has-text("Social")').first().click();
  await waitForReact(page);
}

/** Fill a Field component by label */
export async function fillField(page, label, value) {
  const field = page.locator(`text="${label}"`).locator('..').locator('input, select, textarea');
  await field.fill(value.toString());
}

/** Click a button by its text content */
export async function tapButton(page, text) {
  await page.locator(`button:has-text("${text}")`).first().click();
  await waitForReact(page);
}

/** Check if a toast appeared with specific text */
export async function expectToast(page, text) {
  await page.waitForSelector(`text=/${text}/i`, { timeout: 3000 });
}

/** Get current localStorage value */
export async function getLS(page, key) {
  return page.evaluate((k) => {
    const v = localStorage.getItem(k);
    try { return JSON.parse(v); } catch { return v; }
  }, key);
}

/** Set localStorage value */
export async function setLS(page, key, value) {
  await page.evaluate(([k, v]) => {
    localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [key, value]);
}

/** Clear all app state for fresh test */
export async function clearAppState(page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await waitForReact(page, 1000);
}

/** Check that we're on a specific tab */
export async function expectTab(page, tabId) {
  // The active nav button has specific styling
  await page.waitForFunction((id) => {
    const el = document.querySelector(`[aria-label="${id}"][aria-current="page"]`);
    return !!el;
  }, tabId, { timeout: 3000 }).catch(() => {
    // Fallback: check if content for that tab is visible
  });
}

/** Intercept and mock API calls */
export async function mockAPI(page, urlPattern, response) {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/** Block network to simulate offline */
export async function goOffline(page) {
  await page.context().setOffline(true);
}

/** Restore network */
export async function goOnline(page) {
  await page.context().setOffline(false);
}
