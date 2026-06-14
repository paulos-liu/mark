// @ts-check
// Performance smoke test on a large document. Measures render/toggle/typing
// latency and asserts generous ceilings to catch catastrophic regressions.
// (Live Preview decorates only the visible viewport, so it should stay snappy
// regardless of document length.)
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:1420';

/** Build a large, realistic markdown document (~5k lines). */
function bigDoc(sections = 350) {
  const out = ['# Stress Test', ''];
  for (let i = 1; i <= sections; i++) {
    out.push(`## Section ${i}`, '');
    out.push(`Paragraph with **bold ${i}**, *italic*, and \`code\` spread across a`);
    out.push(`few lines of prose to exercise inline decoration in section ${i}.`, '');
    out.push(`### ${i}.1 Detail`, '');
    out.push('- first item', '- second item', '- third item', '');
    out.push(`> A quoted remark for section ${i}.`, '');
  }
  return out.join('\n');
}

test('large document stays responsive across Read / Live / typing', async ({ page }) => {
  test.setTimeout(45000);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const doc = bigDoc();
  const lines = doc.split('\n').length;

  // Read render
  const t0 = Date.now();
  await page.evaluate((c) => window.__markTest.loadContent(c), doc);
  await expect(page.locator('.markdown-body')).toBeVisible();
  await expect(page.locator('.markdown-body h2').first()).toBeVisible();
  const readMs = Date.now() - t0;

  // Enter Live (rendered-in-place)
  const t1 = Date.now();
  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'live'));
  await page.evaluate(() => window.__markTest.enterEdit());
  await expect(page.locator('.cm-lp-h2').first()).toBeVisible();
  const liveMs = Date.now() - t1;

  // Typing latency in Live: type into the editor and time it.
  await page.locator('.cm-content').click();
  const t2 = Date.now();
  await page.keyboard.type('performance probe ', { delay: 0 });
  const typeMs = Date.now() - t2;

  // Toggle Live -> Source (now a preference; the editor reconfigures in place).
  const t3 = Date.now();
  await page.evaluate(() => window.__markTest.setSetting('editorMode', 'source'));
  await expect(page.locator('.cm-content')).toContainText('# Stress Test');
  const sourceMs = Date.now() - t3;

  console.log(
    `[perf] lines=${lines} readRender=${readMs}ms enterLive=${liveMs}ms ` +
      `type18ch=${typeMs}ms liveToSource=${sourceMs}ms`,
  );

  // Generous ceilings — these catch hangs/O(n) blowups, not micro-regressions.
  expect(readMs).toBeLessThan(12000);
  expect(liveMs).toBeLessThan(6000);
  expect(typeMs).toBeLessThan(4000);
  expect(sourceMs).toBeLessThan(4000);
});
