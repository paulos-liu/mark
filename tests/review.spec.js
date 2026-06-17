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

// ── Titlebar count and highlights share one source (rendered DOM) ─────────────

test('titlebar count equals the highlight count, not the raw-markdown count', async ({ page }) => {
  // "alpha" is visible 3 times (heading, plain text, bold) but ALSO appears in a
  // link URL that renders no visible text. The raw markdown contains it 4 times;
  // the rendered DOM only 3. The count and the highlights must both be 3.
  await load(page, '# alpha\n\nalpha and **alpha**, see [link](https://alpha.example.com).');
  await page.locator('.tb-search input').fill('alpha');
  await page.waitForTimeout(250);
  await expect(page.locator('.markdown-body mark.search-hl')).toHaveCount(3);
  await expect(page.locator('.tb-count')).toHaveText('1/3');
});

test('a term that exists only in markdown syntax is counted as zero', async ({ page }) => {
  // "example" is in the URL but not the visible link text. The rendered view has
  // no match, so the count and the highlights are both zero (the raw source
  // would have wrongly counted 1).
  await load(page, 'See [the link](https://example.com/page).');
  await page.locator('.tb-search input').fill('example');
  await page.waitForTimeout(250);
  await expect(page.locator('.markdown-body mark.search-hl')).toHaveCount(0);
  await expect(page.locator('.tb-count')).toHaveText('0/0');
});

// ── Mermaid diagrams re-theme on a theme switch (don't get stuck) ─────────────

test('a mermaid diagram re-themes on Nord -> Light (not stuck dark)', async ({ page }) => {
  await load(page, '# Diagram\n\n```mermaid\ngraph TD\n  A[Component A] --> B[Component B]\n```\n');
  await page.waitForSelector('.mermaid-diagram svg', { timeout: 5000 });

  const nodeFill = () =>
    page
      .locator('.mermaid-diagram svg .node rect, .mermaid-diagram svg rect')
      .first()
      .evaluate((el) => getComputedStyle(el).fill);
  const brightness = (rgb) => (rgb.match(/\d+/g) ?? ['0']).reduce((a, n) => a + +n, 0);

  await page.locator('button[aria-label="Settings"]').click();
  const sel = page.locator('[role="dialog"][aria-label="Settings"] select[aria-label="Editor theme"]');

  await sel.selectOption('preset:Nord'); // a dark VS Code theme
  await page.waitForTimeout(500);
  const darkFill = await nodeFill();

  await sel.selectOption('light');
  await page.waitForTimeout(500);
  const lightFill = await nodeFill();

  // The node fill must follow the theme — the bug left it frozen on the dark
  // palette because the re-theme effect couldn't see the diagram any more.
  expect(lightFill).not.toBe(darkFill);
  expect(brightness(lightFill)).toBeGreaterThan(brightness(darkFill));
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

// ── Read-view headings follow the "Reading font" setting ──────────────────────

test('Read headings use the reading font (serif), not the UI sans font', async ({ page }) => {
  await load(page, '# Heading\n\nBody paragraph.');
  // Switch to sans then serif to prove headings track the setting, not a fixed font.
  await page.evaluate(() => window.__markTest.setSetting('readFont', 'sans'));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__markTest.setSetting('readFont', 'serif'));
  await page.waitForTimeout(100);

  const fonts = await page.evaluate(() => ({
    h1: getComputedStyle(/** @type {Element} */ (document.querySelector('.markdown-body h1'))).fontFamily,
    p: getComputedStyle(/** @type {Element} */ (document.querySelector('.markdown-body p'))).fontFamily,
  }));
  // The heading uses the serif reading font and matches the body (previously it
  // was pinned to the UI sans font regardless of the setting).
  expect(fonts.h1).toContain('Newsreader');
  expect(fonts.h1).toBe(fonts.p);
});
