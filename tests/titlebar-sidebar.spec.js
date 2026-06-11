// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:1420';

test.beforeEach(async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
});

// ── Title bar ────────────────────────────────────────────────────────────────

test('title bar no longer shows the app name', async ({ page }) => {
  await expect(page.locator('.tb-app')).toHaveCount(0);
  await expect(page.locator('.tb-title')).not.toContainText('Mark');
});

test('title bar uses the sans-serif UI font', async ({ page }) => {
  const fontFamily = await page.evaluate(() => {
    const el = document.querySelector('.tb-title');
    return el ? getComputedStyle(el).fontFamily : '';
  });
  expect(fontFamily).toContain('Hanken Grotesk');
  expect(fontFamily).not.toContain('Newsreader');
});

// ── Sidebar on launch setting ────────────────────────────────────────────────

test('sidebar is collapsed on launch by default', async ({ page }) => {
  await expect(page.locator('aside.sidebar')).toHaveClass(/collapsed/);
  await expect(page.locator('button.tb-toggle')).toHaveAttribute('aria-label', 'Show sidebar');
});

test('setting "Sidebar on launch" to Open shows the sidebar after reload', async ({ page }) => {
  // Default: collapsed
  await expect(page.locator('aside.sidebar')).toHaveClass(/collapsed/);

  // Flip the setting on
  await page.locator('button[aria-label="Settings"]').click();
  const modal = page.locator('[role="dialog"][aria-label="Settings"]');
  const row = modal.locator('.set-row', { hasText: 'Sidebar on launch' });
  await row.getByRole('button', { name: 'Open' }).click();
  await expect(row.locator('.seg.on')).toHaveText('Open');

  // Takes effect on next launch
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await expect(page.locator('aside.sidebar')).not.toHaveClass(/collapsed/);
  await expect(page.locator('button.tb-toggle')).toHaveAttribute('aria-label', 'Hide sidebar');
});

test('the "Sidebar on launch" choice persists across reloads', async ({ page }) => {
  await page.locator('button[aria-label="Settings"]').click();
  let row = page.locator('[role="dialog"][aria-label="Settings"] .set-row', { hasText: 'Sidebar on launch' });
  await row.getByRole('button', { name: 'Open' }).click();

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('button[aria-label="Settings"]').click();
  row = page.locator('[role="dialog"][aria-label="Settings"] .set-row', { hasText: 'Sidebar on launch' });
  await expect(row.locator('.seg.on')).toHaveText('Open');
});
