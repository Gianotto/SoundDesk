import { test, expect } from '@playwright/test';
import { SELECTORS } from '../../src/preload/selectors';

const SC_USERNAME = process.env['SC_TEST_USERNAME'];
const SC_PASSWORD = process.env['SC_TEST_PASSWORD'];
const TRACK_URL = process.env['SC_TEST_TRACK_URL'] ?? 'https://soundcloud.com/discover';

test.describe('SoundCloud DOM contract', () => {
  test.skip(!SC_USERNAME || !SC_PASSWORD, 'SC test credentials not configured (set SC_TEST_USERNAME and SC_TEST_PASSWORD)');

  test('every selector in the table resolves on a real session', async ({ page }) => {
    await page.goto('https://soundcloud.com/signin', { waitUntil: 'domcontentloaded' });

    // Fill login form — SC may change this markup; update only here if broken.
    await page.fill('input[type="email"]', SC_USERNAME!);
    await page.click('button[type="submit"]');
    await page.fill('input[type="password"]', SC_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await page.goto(TRACK_URL, { waitUntil: 'networkidle' });
    await page.locator('.sc-button-play, .playButton').first().click();
    await page.waitForTimeout(3000);

    const results: Record<string, boolean> = {};
    for (const [name, spec] of Object.entries(SELECTORS)) {
      const candidates = [spec.primary, ...(spec.fallbacks ?? [])];
      let found = false;
      for (const sel of candidates) {
        if (await page.locator(sel).count() > 0) { found = true; break; }
      }
      results[name] = found;
    }

    for (const [name, ok] of Object.entries(results)) {
      expect(ok, `selector "${name}" failed to resolve on live page`).toBe(true);
    }
  });
});
