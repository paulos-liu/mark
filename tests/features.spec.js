// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:1420';

const SAMPLE_FILES = [
  '/Users/me/search-notes/vector-search.md',
  '/Users/me/search-notes/reranking.md',
  '/Users/me/search-notes/evaluation.md',
  '/Users/me/search-notes/drafts/hybrid-search.md',
  '/Users/me/search-notes/drafts/quantization-deep.md',
  '/Users/me/search-notes/meeting-notes/2026-06-01.md',
  '/Users/me/search-notes/README.md',
  '/Users/me/search-notes/TODO.md',
];

test.beforeEach(async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
});

// ── File tree ──────────────────────────────────────────────────────────────

test('Files tree renders nested folders from a directory listing', async ({ page }) => {
  await page.evaluate((files) => window.__markTest.loadDirectory(files), SAMPLE_FILES);
  await page.waitForTimeout(400);

  // Section header is the root folder name, uppercased via CSS
  await expect(page.locator('.sb-head')).toHaveText('search-notes');

  // Files tab is active, tree present
  await expect(page.locator('.tree[role="tree"]')).toBeVisible();

  // Folder rows (those with a disclosure caret) for the root and its subfolders
  const folderNames = await page.locator('.tree-row:has(.caret) .label').allInnerTexts();
  expect(folderNames).toContain('search-notes');
  expect(folderNames).toContain('drafts');
  expect(folderNames).toContain('meeting-notes');

  // Files are visible
  await expect(page.getByText('vector-search.md')).toBeVisible();
  await expect(page.getByText('hybrid-search.md')).toBeVisible();
});

test('folder rows collapse and expand on click', async ({ page }) => {
  await page.evaluate((files) => window.__markTest.loadDirectory(files), SAMPLE_FILES);
  await page.waitForTimeout(400);

  const drafts = page.locator('.tree-row:has(.caret)', { hasText: 'drafts' });
  await expect(page.getByText('hybrid-search.md')).toBeVisible();

  await drafts.click();
  await expect(page.getByText('hybrid-search.md')).toHaveCount(0);

  await drafts.click();
  await expect(page.getByText('hybrid-search.md')).toBeVisible();
});

test('empty state offers both Open File and Open Folder', async ({ page }) => {
  const actions = page.locator('.empty-actions');
  await expect(actions.getByRole('button', { name: 'Open File' })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Open Folder' })).toBeVisible();
  await expect(page.locator('.empty-hint')).toContainText('folder');
});

test('opening a folder with no markdown files shows an empty message', async ({ page }) => {
  await page.evaluate(() => window.__markTest.loadDirectory([]));
  await page.waitForTimeout(300);
  await expect(page.locator('.browser .empty')).toContainText('No markdown files');
});

// ── VS Code theme import ─────────────────────────────────────────────────────

test('selecting a VS Code theme from the dropdown recolors the app', async ({ page }) => {
  await page.locator('button[aria-label="Settings"]').click();
  const modal = page.locator('[role="dialog"][aria-label="Settings"]');
  await expect(modal).toContainText('Editor theme');
  const select = modal.locator('select[aria-label="Editor theme"]');

  // Select Dracula
  await select.selectOption('preset:Dracula');

  // --paper reflects Dracula's editor.background; theme drives light/dark
  let paper = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
  );
  expect(paper.toLowerCase()).toBe('#282a36');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Selecting a built-in palette restores the default look
  await select.selectOption('light');
  paper = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
  );
  expect(paper.toLowerCase()).not.toBe('#282a36');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('imported/selected theme persists across reload', async ({ page }) => {
  await page.locator('button[aria-label="Settings"]').click();
  const modal = page.locator('[role="dialog"][aria-label="Settings"]');
  await modal.locator('select[aria-label="Editor theme"]').selectOption('preset:Solarized Light');

  await page.reload({ waitUntil: 'networkidle' });
  const paper = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
  );
  expect(paper.toLowerCase()).toBe('#fdf6e3');
});
