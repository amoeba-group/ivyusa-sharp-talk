import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/widget';

/**
 * T17 · Header bell (PLN-261118-IVY-Bell-Panel-Follow-Header, SPEC SCR-IVY-01).
 *
 * The design opens the panel from a bell in the storefront header, not from a
 * floating launcher. The host page below is shaped like ivyusa.com: two bars
 * above the header at the top of the page (80px), a 91px header that sticks to
 * the window on scroll — and, on a phone, hides when the shopper scrolls down.
 * The panel has to stay under that header wherever it is.
 */
const BARS = 80;
const HEADER = 91;
const GAP = 8;

type Host = { hideOnScroll?: boolean; bareBell?: boolean };

async function openStorefront(page: Page, host: Host = {}) {
  const origin = new URL(process.env.E2E_RESOLVED_WIDGET_URL ?? 'http://localhost:5174/').origin;
  const hostUrl = `${origin}/__ivy-bell-storefront.html`;
  const bell = `<button id="st-bell" type="button" aria-label="Notifications" style="width:24px;height:24px">🔔<span data-sharptalk-badge style="display:none"></span></button>`;
  await page.route(hostUrl, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>ivyusa.com (bell test host)</title>
<style>
  body{margin:0;font-family:sans-serif;background:#fafafa}
  .bars{height:${BARS}px;background:#e9f7d4}
  header{height:${HEADER}px;box-sizing:border-box;position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#fff;border-bottom:1px solid #ddd;transition:transform .1s}
  header.away{transform:translateY(-100%)}
  main{height:3000px;padding:16px}
</style></head>
<body><div class="bars"></div>
${host.bareBell ? `<div style="height:${HEADER}px;padding:0 16px">${bell}</div>` : `<header><strong>IVY beauty</strong>${bell}</header>`}
<main><p id="outside">Page content</p></main>
<script>
  window.SHARPTALK_WIDGET_CONFIG = { shop: 'ivyusa.myshopify.com', locale: 'en', widgetUrl: '${origin}', trigger: '#st-bell' };
  ${host.hideOnScroll ? `addEventListener('scroll', function () { var h = document.querySelector('header'); if (h) h.classList.toggle('away', scrollY > 200); }, { passive: true });` : ''}
</script>
<script src="${origin}/embed.js"></script></body></html>`,
    }),
  );
  await page.addInitScript(() => {
    try { localStorage.setItem('ivy_lang', 'en'); } catch { /* storage blocked */ }
  });
  await page.goto(hostUrl);
  const frameEl = page.locator('#ivy-talktalk-frame');
  const frame = page.frameLocator('#ivy-talktalk-frame');
  const panel = frame.locator('[role="dialog"].st-panel');
  const open = async () => {
    await page.locator('#st-bell').click();
    await expect(panel).toBeVisible();
  };
  /** The frame's box once it stops moving (it animates its size; the header may be mid-transition). */
  const settled = async () => {
    let last = '';
    await expect
      .poll(async () => {
        const b = await frameEl.boundingBox();
        const now = b ? [b.x, b.y, b.width, b.height].map(Math.round).join(',') : '';
        const same = now !== '' && now === last;
        last = now;
        return same;
      }, { timeout: 5_000, intervals: [250] })
      .toBe(true);
    const b = (await frameEl.boundingBox())!;
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  return { frameEl, frame, panel, open, settled };
}

test.describe('T17 · Header bell — desktop 1280x900', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('TC-17-01 the bell opens the panel under the header; no floating launcher @T17', async ({ page, mocks: _mocks }) => {
    const { frameEl, open, settled } = await openStorefront(page);
    // Closed: the frame takes no room, so nothing floats over the page. (The
    // test tenant's theme still says "floating", so the launcher exists inside
    // the hidden frame; what the shopper can see is what is asserted here.)
    await expect(frameEl).toBeHidden();
    expect((await frameEl.evaluate((f) => [f.offsetWidth, f.offsetHeight])).join('x')).toBe('0x0');

    await open();
    const box = await settled();
    expect(box.y, 'starts 8px under the header').toBe(BARS + HEADER + GAP);
    expect(box.x + box.w, 'docked to the right edge').toBeGreaterThanOrEqual(1280 - 20);
    expect(box.y + box.h, 'fits the window').toBeLessThanOrEqual(900);
  });

  test('TC-17-02 the panel follows the header when it sticks on scroll, and back @T17', async ({ page, mocks: _mocks }) => {
    const { open, settled } = await openStorefront(page);
    await open();
    expect((await settled()).y).toBe(BARS + HEADER + GAP);

    await page.evaluate(() => window.scrollTo(0, 900));
    expect((await settled()).y, 'header stuck at the top').toBe(HEADER + GAP);

    await page.evaluate(() => window.scrollTo(0, 0));
    expect((await settled()).y, 'back at the top of the page').toBe(BARS + HEADER + GAP);
  });

  test('TC-17-03 the header keeps language, settings and close; X, the bell and an outside click all close @T17', async ({ page, mocks: _mocks }) => {
    const { frame, panel, frameEl, open } = await openStorefront(page);
    await open();
    await expect(frame.getByRole('button', { name: 'Language' })).toBeVisible();
    await expect(frame.getByRole('button', { name: 'Settings' })).toBeVisible();
    const close = frame.getByRole('button', { name: 'Close' });
    await expect(close).toBeVisible();

    await close.click();
    await expect(frameEl).toBeHidden();

    await open();
    await page.waitForTimeout(350); // the loader ignores the opening click for 300ms
    await page.locator('#st-bell').click();
    await expect(frameEl).toBeHidden();

    await open();
    await page.waitForTimeout(350);
    await page.locator('#outside').click();
    await expect(frameEl).toBeHidden();
    await expect(panel).toBeHidden();
  });

  test('TC-17-04 a bell outside any header falls back to the fixed offset @T17', async ({ page, mocks: _mocks }) => {
    const { open, settled } = await openStorefront(page, { bareBell: true });
    await open();
    // The test tenant keeps the floating launcher, so its offset is 0.
    expect((await settled()).y).toBe(0);
  });
});

test.describe('T17 · Header bell — tablet 768x1024', () => {
  test.use({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true });

  test('TC-17-05 the panel does not cover the header, and has its X @T17', async ({ page, mocks: _mocks }) => {
    const { frame, open, settled } = await openStorefront(page);
    await open();
    expect((await settled()).y).toBe(BARS + HEADER + GAP);
    await expect(frame.getByRole('button', { name: 'Close' })).toBeVisible();
  });
});

test.describe('T17 · Header bell — phone 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('TC-17-06 flush under the header; the whole screen once the header scrolls away @T17 @responsive', async ({ page, mocks: _mocks }) => {
    const { frame, open, settled } = await openStorefront(page, { hideOnScroll: true });
    await open();
    let box = await settled();
    expect(box.y, 'no gap on a phone').toBe(BARS + HEADER);
    expect(box.w).toBe(390);
    expect(box.y + box.h, 'down to the bottom of the screen').toBe(844);

    await page.evaluate(() => window.scrollTo(0, 900));
    box = await settled();
    expect(box.y, 'header gone → from the top').toBe(0);
    expect(box.h).toBe(844);
    await expect(frame.getByRole('button', { name: 'Close' })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 0));
    expect((await settled()).y, 'header back → under it again').toBe(BARS + HEADER);
  });
});

test.describe('T17 · Header bell — phone on its side 734x343', () => {
  test.use({ viewport: { width: 734, height: 343 }, isMobile: true, hasTouch: true });

  test('TC-17-07 too little room under the header: the panel takes the full height, X in reach @T17', async ({ page, mocks: _mocks }) => {
    const { frame, open, settled } = await openStorefront(page);
    await open();
    const box = await settled();
    expect(box.y).toBe(0);
    expect(box.h).toBe(343);
    const close = frame.getByRole('button', { name: 'Close' });
    await expect(close).toBeVisible();
    await close.click();
    await expect(page.locator('#ivy-talktalk-frame')).toBeHidden();
  });
});
