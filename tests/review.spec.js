// @ts-check
// E2E coverage for issues surfaced by the whole-codebase review.
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:1420';

test.beforeEach(async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.click('body');
});

/** Load markdown content into the viewer via the dev test hook. */
async function load(page, content) {
  await page.evaluate((c) => window.__markTest.loadContent(c), content);
  await page.waitForTimeout(350);
}

// ── Link interception (#3) ────────────────────────────────────────────────────

test('external links do not navigate the webview away', async ({ page }) => {
  await load(page, 'Visit [example](https://example.com/should-not-navigate) now.');
  await page.locator('.markdown-body a', { hasText: 'example' }).click();
  await page.waitForTimeout(200);
  // preventDefault keeps us on the app; the webview must not have navigated.
  expect(page.url()).toContain('localhost:1420');
  await expect(page.locator('.markdown-body')).toContainText('Visit');
});

test('relative .md links route through the host (no navigation)', async ({ page }) => {
  await load(page, 'See [other](./other.md).');
  await page.locator('.markdown-body a', { hasText: 'other' }).click();
  await page.waitForTimeout(200);
  expect(page.url()).toContain('localhost:1420');
  // The host tried to open /test/other.md; the read fails in-browser and the
  // error toast surfaces — proving the relative link was intercepted/routed.
  await expect(page.locator('.open-error')).toBeVisible();
});

test('in-page anchor links scroll without navigating', async ({ page }) => {
  await load(page, '# Top\n\n[jump](#section-two)\n\n' + 'filler\n\n'.repeat(40) + '## Section Two\n\nend');
  const before = page.url();
  await page.locator('.markdown-body a', { hasText: 'jump' }).click();
  await page.waitForTimeout(200);
  expect(page.url()).toBe(before); // no router navigation / reload
});

// ── Inline math currency heuristic (#12) ──────────────────────────────────────

test('dollar amounts are not rendered as math, real math is', async ({ page }) => {
  await load(page, 'It costs $5 and $10 total. Euler: $e^{i\\pi}+1=0$.');
  // Currency stays literal text…
  await expect(page.locator('.markdown-body')).toContainText('$5 and $10');
  // …while genuine inline math renders via KaTeX.
  await expect(page.locator('.markdown-body .katex').first()).toBeVisible();
});

// ── Frontmatter leading thematic break (#7) ───────────────────────────────────

test('a leading thematic break is not swallowed as frontmatter', async ({ page }) => {
  await load(page, '---\n\n# Real Title\n\nBody paragraph.\n\n---\n\nMore.');
  // The H1 must render (it was previously discarded as "frontmatter").
  await expect(page.locator('.markdown-body h1', { hasText: 'Real Title' })).toBeVisible();
});

// ── Search highlights survive a document swap (#10) ───────────────────────────

test('highlights re-apply after switching to a doc with the same match count', async ({ page }) => {
  await load(page, 'alpha alpha alpha');
  await page.locator('.tb-search input').fill('alpha');
  await page.waitForTimeout(250);
  await expect(page.locator('.markdown-body mark.search-hl')).toHaveCount(3);

  // Swap to another doc that also has exactly 3 matches for the same query.
  await load(page, 'alpha beta alpha gamma alpha');
  await page.waitForTimeout(250);
  await expect(page.locator('.markdown-body mark.search-hl')).toHaveCount(3);
});

// ── Cmd+A does not hijack text inputs (#11) ───────────────────────────────────

test('Cmd+A selects the focused input, not the document', async ({ page }) => {
  await load(page, 'Some document body text here.');
  const input = page.locator('.tb-search input');
  await input.fill('hello');
  await input.focus();
  await page.keyboard.press('Meta+a');
  // Native select-all should select the whole input value.
  const fullySelected = await input.evaluate(
    (el) => el.selectionStart === 0 && el.selectionEnd === el.value.length && el.value.length > 0,
  );
  expect(fullySelected).toBe(true);
});
