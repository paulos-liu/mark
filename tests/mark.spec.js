// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:1420';

test.beforeEach(async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  // Focus the page so keyboard events are received
  await page.click('body');
});

// ── Empty state ──────────────────────────────────────────────────────────────

test('empty state renders correctly', async ({ page }) => {
  // Clay M logo
  const logo = page.locator('.empty-logo');
  await expect(logo).toBeVisible();
  await expect(logo).toContainText('M');

  // Heading + tagline
  await expect(page.locator('.empty-title')).toContainText('Mark');
  await expect(page.locator('.empty-desc')).toContainText('Open a file or a folder');

  // Open File and Open Folder buttons present
  await expect(page.getByRole('button', { name: 'Open File' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Folder' })).toBeVisible();

  // Hint text
  await expect(page.locator('.empty-hint')).toBeVisible();
});

// ── Titlebar layout ───────────────────────────────────────────────────────────

test('titlebar has sidebar toggle, title, search, settings', async ({ page }) => {
  const titlebar = page.locator('.titlebar');
  await expect(titlebar).toBeVisible();

  // Traffic lights spacer exists in DOM (it's a structural spacer, not user-visible content)
  await expect(page.locator('.traffic-spacer')).toHaveCount(1);

  // Sidebar toggle button (aria-label changes based on state)
  const sidebarToggle = page.locator('button[aria-label*="sidebar"]');
  await expect(sidebarToggle).toBeVisible();

  // Title "Mark" visible
  await expect(page.locator('.tb-title')).toContainText('Mark');

  // Inline search input
  const searchInput = page.locator('.tb-search input');
  await expect(searchInput).toBeVisible();
  await expect(searchInput).toHaveAttribute('placeholder', /find/i);

  // Settings button
  const settingsBtn = page.locator('button[aria-label="Settings"]');
  await expect(settingsBtn).toBeVisible();
});

test('titlebar search input is focused by Cmd+F', async ({ page }) => {
  const searchInput = page.locator('.tb-search input');
  await page.keyboard.press('Meta+f');
  await expect(searchInput).toBeFocused();
});

// ── Sidebar toggle ────────────────────────────────────────────────────────────

test('sidebar toggle button collapses and expands sidebar', async ({ page }) => {
  const sidebar = page.locator('.sidebar');
  const toggleBtn = page.locator('button[aria-label*="sidebar"]');

  // Sidebar starts collapsed (showTOC = false) — rendered width ~0 (border only)
  const initialWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
  expect(initialWidth).toBeLessThanOrEqual(1);

  // Click toggle to expand
  await toggleBtn.click();
  await page.waitForTimeout(400);
  const expandedWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
  expect(expandedWidth).toBeGreaterThan(100);

  // Click again to collapse
  await toggleBtn.click();
  await page.waitForTimeout(400);
  const collapsedWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
  expect(collapsedWidth).toBeLessThanOrEqual(1);
});

test('Cmd+Backslash toggles sidebar', async ({ page }) => {
  const sidebar = page.locator('.sidebar');

  // Sidebar starts collapsed — press once to expand
  await page.keyboard.press('Meta+Backslash');
  await page.waitForTimeout(400);
  const expandedWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
  expect(expandedWidth).toBeGreaterThan(100);

  // Press again to collapse
  await page.keyboard.press('Meta+Backslash');
  await page.waitForTimeout(400);
  const collapsedWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
  expect(collapsedWidth).toBeLessThanOrEqual(1);
});

// ── Settings modal ────────────────────────────────────────────────────────────

test('settings modal opens and closes', async ({ page }) => {
  const settingsBtn = page.locator('button[aria-label="Settings"]');
  await settingsBtn.click();

  const modal = page.locator('[role="dialog"][aria-label="Settings"]');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Editor theme');
  await expect(modal).toContainText('Reading font');
  await expect(modal).toContainText('Font size');
  await expect(modal).toContainText('Content width');

  // Close via X button
  await page.locator('[aria-label="Close settings"]').click();
  await expect(modal).not.toBeVisible();
});

test('settings modal closes on Escape', async ({ page }) => {
  await page.locator('button[aria-label="Settings"]').click();
  const modal = page.locator('[role="dialog"][aria-label="Settings"]');
  await expect(modal).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
});

test('settings modal closes on backdrop click', async ({ page }) => {
  await page.locator('button[aria-label="Settings"]').click();
  const modal = page.locator('[role="dialog"][aria-label="Settings"]');
  await expect(modal).toBeVisible();

  // Click overlay background (outside modal, near top-left corner)
  await page.locator('.overlay').first().click({ position: { x: 5, y: 5 } });
  await expect(modal).not.toBeVisible();
});

test('editor theme dropdown switches the built-in palette', async ({ page }) => {
  await page.locator('button[aria-label="Settings"]').click();
  const modal = page.locator('[role="dialog"][aria-label="Settings"]');
  const select = modal.locator('select[aria-label="Editor theme"]');

  await select.selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await select.selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('System theme follows the OS color scheme', async ({ page }) => {
  await page.locator('button[aria-label="Settings"]').click();
  const modal = page.locator('[role="dialog"][aria-label="Settings"]');
  await modal.locator('select[aria-label="Editor theme"]').selectOption('system');
  await modal.locator('[aria-label="Close settings"]').click();

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('settings reading font segmented control works', async ({ page }) => {
  await page.locator('button[aria-label="Settings"]').click();
  const modal = page.locator('[role="dialog"][aria-label="Settings"]');

  await modal.getByRole('button', { name: 'Sans' }).click();
  await expect(modal.getByRole('button', { name: 'Sans' })).toHaveClass(/on/);
});

test('settings content width segmented control works', async ({ page }) => {
  await page.locator('button[aria-label="Settings"]').click();
  const modal = page.locator('[role="dialog"][aria-label="Settings"]');

  await modal.getByRole('button', { name: 'Wide' }).click();
  await expect(modal.getByRole('button', { name: 'Wide' })).toHaveClass(/on/);
});

// ── Quick open ────────────────────────────────────────────────────────────────

test('Cmd+P opens quick open modal', async ({ page }) => {
  await page.keyboard.press('Meta+p');
  const modal = page.locator('[role="dialog"][aria-label="Quick Open"]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('input')).toBeFocused();
});

test('quick open closes on Escape', async ({ page }) => {
  await page.keyboard.press('Meta+p');
  const modal = page.locator('[role="dialog"][aria-label="Quick Open"]');
  await expect(modal).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
});

test('quick open closes on backdrop click', async ({ page }) => {
  await page.keyboard.press('Meta+p');
  const modal = page.locator('[role="dialog"][aria-label="Quick Open"]');
  await expect(modal).toBeVisible();

  await page.locator('.overlay').first().click({ position: { x: 5, y: 5 } });
  await expect(modal).not.toBeVisible();
});

test('quick open shows file list or empty state', async ({ page }) => {
  await page.keyboard.press('Meta+p');
  const modal = page.locator('[role="dialog"][aria-label="Quick Open"]');
  await expect(modal).toBeVisible();
  // Either file list or empty message — the list container is always rendered
  await expect(modal.locator('.qo-list')).toBeVisible();
});

// ── Design tokens (visual) ────────────────────────────────────────────────────

test('warm design tokens are applied', async ({ page }) => {
  const paperColor = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
  );
  expect(paperColor).toBeTruthy();
  expect(paperColor).not.toBe('');
});

test('accent color is clay #c2683f', async ({ page }) => {
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  );
  expect(accent).toMatch(/#c2683f/i);
});

test('fonts are loaded: Hanken Grotesk in UI', async ({ page }) => {
  const uiFont = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ui').trim()
  );
  expect(uiFont).toMatch(/Hanken Grotesk/i);
});

// ── Dark mode ────────────────────────────────────────────────────────────────

test('dark mode applies dark paper token', async ({ page }) => {
  await page.locator('button[aria-label="Settings"]').click();
  const modal = page.locator('[role="dialog"][aria-label="Settings"]');
  await modal.locator('select[aria-label="Editor theme"]').selectOption('dark');
  await modal.locator('[aria-label="Close settings"]').click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const bgColor = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor
  );
  // Dark paper should not be the light paper color
  expect(bgColor).not.toBe('rgb(251, 250, 247)');
});

// ── Keyboard shortcuts ───────────────────────────────────────────────────────

test('Cmd+, opens settings', async ({ page }) => {
  await page.keyboard.press('Meta+,');
  const modal = page.locator('[role="dialog"][aria-label="Settings"]');
  await expect(modal).toBeVisible();
});
