// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tools/verify-investor-enquiry.mjs
// Optional INVESTOR_ORIGIN verifies the published site; otherwise uses the loopback fixture.
import assert from 'node:assert/strict';
import { startPreview } from './preview-desk.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const preview = process.env.INVESTOR_ORIGIN ? null : await startPreview(0);
const origin = process.env.INVESTOR_ORIGIN || preview.origin;
const browser = await chromium.launch({ headless: true });
try {
  for (const lang of ['ja', 'en']) for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    try {
      const page = await context.newPage();
      const errors = [], writes = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
      await page.goto(`${origin}/investors/?lang=${lang}`, { waitUntil: 'networkidle' });
      await page.locator('#enquiry-composer').waitFor({ state: 'visible' });
      assert.match(await page.locator('#enquiry-draft').inputValue(), lang === 'ja' ? /確認したい情報/ : /Information requested/);
      const draft = 'A&B + 50% #検討\nNeeds <scope> and a timeline.';
      await page.locator('#enquiry-draft').fill(draft);
      assert.equal(new URL(await page.locator('#enquiry-open').getAttribute('href')).searchParams.get('body'), draft);
      // Editing in the middle must not reset the caret to the end.
      await page.locator('#enquiry-draft').evaluate(el => el.setSelectionRange(2, 2));
      await page.keyboard.type('X');
      assert.equal(await page.locator('#enquiry-draft').evaluate(el => el.selectionStart), 3);
      const edited = await page.locator('#enquiry-draft').inputValue();
      await page.locator('#enquiry-copy').click();
      await page.waitForFunction(() => /コピーしました|Copied\./.test(document.querySelector('#enquiry-status').textContent));
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      assert(copied.includes('mail@yukihamada.jp')); assert(copied.endsWith(edited));
      await page.locator('#enquiry-development').click();
      assert.equal(await page.locator('#enquiry-kind').inputValue(), 'development');
      assert.match(await page.locator('#enquiry-draft').inputValue(), lang === 'ja' ? /現在の業務/ : /Current workflow/);
      await page.locator('#enquiry-draft').fill('開発 draft retained');
      await page.locator('#language').click();
      assert.equal(await page.locator('#enquiry-draft').inputValue(), '開発 draft retained');
      await page.locator('#enquiry-kind').selectOption('investment');
      assert.equal(await page.locator('#enquiry-draft').inputValue(), edited);
      // Denied clipboard access must offer selectable text without claiming success.
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } }));
      await page.locator('#enquiry-copy').click();
      await page.locator('#enquiry-manual').waitFor({ state: 'visible' });
      assert((await page.locator('#enquiry-copy-text').inputValue()).endsWith(edited));
      assert.equal(await page.locator('#enquiry-copy-text').evaluate(el => el.selectionEnd - el.selectionStart), (await page.locator('#enquiry-copy-text').inputValue()).length);
      await page.locator('#enquiry-draft').fill('検討'.repeat(1500));
      assert.equal(await page.locator('#enquiry-open').isVisible(), false);
      await page.locator('#enquiry-copy').click();
      assert((await page.locator('#enquiry-copy-text').inputValue()).endsWith('検討'.repeat(1500)));
      await page.locator('.review-checklist summary').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.review-checklist').getAttribute('open'), '');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(writes, []); assert.deepEqual(errors, []);
      await page.reload();
      assert.notEqual(await page.locator('#enquiry-draft').inputValue(), edited);
      console.log(`PASS ${lang}/${width}: draft, caret, clipboard, denied fallback, separate drafts, language, long text, keyboard, layout, no submission`);
    } finally { await context.close(); }
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage(); await page.goto(`${origin}/investors/`);
    assert.equal(await page.locator('#enquiry-composer').isVisible(), false);
    assert.equal(await page.locator('#contact-mail').isVisible(), true);
    assert.match(await page.locator('[data-mail="development"]').getAttribute('href'), /^mailto:/);
    console.log('PASS no-JavaScript direct contact fallback');
  } finally { await context.close(); }
} finally { await browser.close(); await preview?.close(); }
