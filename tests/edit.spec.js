// @ts-check
// E2E coverage for the Read ↔ Edit toggle (Part A).
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

test('the Read/Edit toggle appears once a document is open', async ({ page }) => {
  // No toggle on the empty state.
  await expect(page.locator('.tb-modes')).toHaveCount(0);
  await load(page, '# Title\n\nBody text.');
  await expect(page.locator('.tb-modes')).toBeVisible();
  await expect(page.locator('.tb-mode', { hasText: 'Read' })).toHaveClass(/on/);
});

test('Edit with the Source preference shows raw markdown', async ({ page }) => {
  await load(page, '# Title\n\nBody text.');
  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'source'));
  await page.locator('.tb-mode', { hasText: 'Edit' }).click();
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('# Title');
  // The rendered viewer is swapped out while editing.
  await expect(page.locator('.markdown-viewer')).toHaveCount(0);
});

test('the Read / Edit titlebar toggle switches modes', async ({ page }) => {
  await load(page, '# Title\n\nBody text.');
  const modes = page.locator('.tb-modes');
  await expect(modes.locator('.tb-mode', { hasText: 'Read' })).toHaveClass(/on/);

  await modes.locator('.tb-mode', { hasText: 'Edit' }).click();
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(modes.locator('.tb-mode', { hasText: 'Edit' })).toHaveClass(/on/);

  await modes.locator('.tb-mode', { hasText: 'Read' }).click();
  await expect(page.locator('.markdown-viewer')).toBeVisible();
  await expect(modes.locator('.tb-mode', { hasText: 'Read' })).toHaveClass(/on/);
});

test('the "Open documents in" preference opens new docs in Edit', async ({ page }) => {
  await load(page, '# A\n\nbody');
  await expect(page.locator('.markdown-viewer')).toBeVisible(); // default is Reading
  await page.evaluate(() => window.__markTest.setSetting('defaultMode', 'edit'));
  await load(page, '# B\n\nbody');
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(page.locator('.tb-mode', { hasText: 'Edit' })).toHaveClass(/on/);
});

test('editing the buffer and returning to Read re-renders with the edits', async ({ page }) => {
  await load(page, '# Title\n\nBody.');
  await page.evaluate(() => window.__markTest.enterEdit());
  await page.evaluate(() => window.__markTest.setBuffer('# Changed Heading\n\nNew body.'));
  // The unsaved-changes dot shows.
  await expect(page.locator('.tb-unsaved')).toBeVisible();
  await page.evaluate(() => window.__markTest.exitEdit());
  await expect(page.locator('.markdown-body h1')).toHaveText('Changed Heading');
  await expect(page.locator('.markdown-body')).toContainText('New body.');
});

test('frontmatter is preserved through an edit round-trip', async ({ page }) => {
  await load(page, '---\ntitle: Keep Me\n---\n# Doc\n\nbody');
  const buffer = await page.evaluate(() => window.__markTest.editorState().buffer);
  // (read mode buffer is empty; enter edit to seed it)
  await page.evaluate(() => window.__markTest.enterEdit());
  const seeded = await page.evaluate(() => window.__markTest.editorState().buffer);
  expect(seeded).toContain('title: Keep Me'); // raw buffer still has frontmatter
  expect(buffer).toBe(''); // sanity: read-mode buffer was empty before entering edit
});

test('Live mode renders markdown in place and hides syntax markers', async ({ page }) => {
  // Heading + inline marks live on lines 3 and 5; the cursor lands on line 1,
  // so those lines are inactive and their markers should be hidden.
  await load(page, 'Intro paragraph.\n\n# Heading Two\n\nBody with **bold** and *italic* and `code` text.');
  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'live'));
  await page.evaluate(() => window.__markTest.enterEdit());
  await page.waitForTimeout(400);

  // Content is styled in place…
  await expect(page.locator('.cm-lp-h1')).toHaveText('Heading Two');
  await expect(page.locator('.cm-lp-strong')).toHaveText('bold');
  await expect(page.locator('.cm-lp-em')).toHaveText('italic');
  await expect(page.locator('.cm-lp-code')).toHaveText('code');
  // …and the raw markers on inactive lines are gone from the DOM.
  await expect(page.locator('.cm-content')).not.toContainText('**');
  await expect(page.locator('.cm-content')).not.toContainText('# Heading');

  // Reveal-on-active-line: clicking the heading line brings its '#' back.
  await page.locator('.cm-lp-h1').click();
  await expect(page.locator('.cm-content')).toContainText('# Heading Two');
});

test('Live preview heading size matches Read mode (no font-size compounding)', async ({ page }) => {
  // The heading sits on line 3 so the cursor (line 1) leaves it rendered.
  await load(page, 'Intro.\n\n# Heading One\n\nBody.');
  const readSize = await page
    .locator('.markdown-body h1')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'live'));
  await page.evaluate(() => window.__markTest.enterEdit());
  await page.waitForSelector('.cm-lp-h1');

  // Heading size comes from the syntax-token span inside the line (the line
  // itself sets no font-size). Take the largest font-size present.
  const liveSize = await page.locator('.cm-lp-h1').evaluate((line) => {
    let max = parseFloat(getComputedStyle(line).fontSize);
    for (const el of line.querySelectorAll('*')) {
      max = Math.max(max, parseFloat(getComputedStyle(el).fontSize));
    }
    return max;
  });

  // Must equal Read — and crucially NOT ~2x bigger (the old line×token bug).
  expect(liveSize).toBeCloseTo(readSize, 0);
  expect(liveSize).toBeLessThan(readSize * 1.5);
});

test('Live mode styles blockquotes and replaces list bullets', async ({ page }) => {
  // Quote (line 3) and list (lines 5-6) are inactive; the cursor lands on line 1.
  await load(page, 'Intro.\n\n> A quoted line.\n\n- first\n- second');
  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'live'));
  await page.evaluate(() => window.__markTest.enterEdit());
  await page.waitForTimeout(400);

  // Blockquote line styled, '> ' marker hidden.
  await expect(page.locator('.cm-lp-quote').first()).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('A quoted line.');
  await expect(page.locator('.cm-content')).not.toContainText('> A');

  // Unordered markers replaced with '•' bullets.
  await expect(page.locator('.cm-lp-bullet')).toHaveCount(2);
  await expect(page.locator('.cm-content')).not.toContainText('- first');
});

test('Live mode renders a horizontal rule as a block widget', async ({ page }) => {
  // The --- is on line 3; the cursor lands on line 1, so it renders as a widget.
  await load(page, 'Intro.\n\n---\n\nAfter.');
  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'live'));
  await page.evaluate(() => window.__markTest.enterEdit());
  await page.waitForTimeout(400);

  await expect(page.locator('.cm-lp-hr')).toBeVisible();
  await expect(page.locator('.cm-content')).not.toContainText('---');

  // Clicking the rule reverts it to editable source.
  await page.locator('.cm-lp-hr').click();
  await expect(page.locator('.cm-content')).toContainText('---');
});

test('Live mode renders a fenced code block as a widget', async ({ page }) => {
  await load(page, 'Intro.\n\n```js\nconst x = 1;\n```\n\nAfter.');
  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'live'));
  await page.evaluate(() => window.__markTest.enterEdit());
  await page.waitForTimeout(400);

  await expect(page.locator('.cm-lp-rendered pre')).toBeVisible();
  await expect(page.locator('.cm-lp-rendered pre')).toContainText('const x = 1;');
  await expect(page.locator('.cm-content')).not.toContainText('```');

  // Clicking the rendered block reverts it to editable source.
  await page.locator('.cm-lp-rendered pre').click();
  await expect(page.locator('.cm-content')).toContainText('```');
});

test('Live mode renders a GFM table as a widget', async ({ page }) => {
  await load(page, 'Intro.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nAfter.');
  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'live'));
  await page.evaluate(() => window.__markTest.enterEdit());
  await page.waitForTimeout(400);

  await expect(page.locator('.cm-lp-rendered table')).toBeVisible();
  await expect(page.locator('.cm-lp-rendered th').first()).toHaveText('A');
  await expect(page.locator('.cm-lp-rendered td').first()).toHaveText('1');
  await expect(page.locator('.cm-content')).not.toContainText('| A |');

  // Clicking the rendered table reverts it to editable source.
  await page.locator('.cm-lp-rendered table').click();
  await expect(page.locator('.cm-content')).toContainText('| A |');
});

test('Live mode renders an inline image in place', async ({ page }) => {
  // 1x1 gif data-URI loads deterministically in the browser.
  const img = '![dot](data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==)';
  await load(page, `Intro.\n\n${img}\n\nAfter.`);
  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'live'));
  await page.evaluate(() => window.__markTest.enterEdit());
  await page.waitForTimeout(400);

  await expect(page.locator('img.cm-lp-img')).toBeVisible();
  await expect(page.locator('.cm-content')).not.toContainText('![dot]');
});

test('Live mode renders a block math formula with KaTeX', async ({ page }) => {
  await load(page, 'Intro.\n\n$$\nE = mc^2\n$$\n\nAfter.');
  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'live'));
  await page.evaluate(() => window.__markTest.enterEdit());
  await page.waitForTimeout(400);

  await expect(page.locator('.cm-lp-rendered .katex').first()).toBeVisible();
  await expect(page.locator('.cm-content')).not.toContainText('$$');

  // Clicking the formula reverts it to editable source.
  await page.locator('.cm-lp-rendered').first().click();
  await expect(page.locator('.cm-content')).toContainText('$$');
});

test('Live mode renders inline math but leaves currency alone', async ({ page }) => {
  await load(page, 'Intro.\n\nThe formula $a^2+b^2=c^2$ holds.\n\nIt costs $5 and $10 total.\n\nEnd.');
  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'live'));
  await page.evaluate(() => window.__markTest.enterEdit());
  await page.waitForTimeout(400);

  await expect(page.locator('.cm-lp-math .katex').first()).toBeVisible();
  await expect(page.locator('.cm-content')).not.toContainText('$a^2');
  // Currency stays as plain text (not treated as math).
  await expect(page.locator('.cm-content')).toContainText('$5 and $10');
});

test('Live mode renders a mermaid diagram as SVG', async ({ page }) => {
  await load(page, 'Intro.\n\n```mermaid\ngraph TD\nA --> B\n```\n\nAfter.');
  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'live'));
  await page.evaluate(() => window.__markTest.enterEdit());

  // Mermaid is lazy-loaded and renders asynchronously.
  await expect(page.locator('.cm-lp-mermaid svg')).toBeVisible({ timeout: 12000 });
  await expect(page.locator('.cm-content')).not.toContainText('```');
});

test('⌘E toggles between Read and Edit', async ({ page }) => {
  await load(page, '# Title\n\nbody');
  await page.keyboard.press('Meta+e');
  await expect(page.locator('.cm-editor')).toBeVisible();
  await page.keyboard.press('Meta+e');
  await expect(page.locator('.markdown-viewer')).toBeVisible();
});
