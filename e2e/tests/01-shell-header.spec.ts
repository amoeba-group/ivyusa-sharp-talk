import { test, expect } from '../fixtures/widget';
import type { Page } from '@playwright/test';

/** T01 — panel shell, header, two tabs, badges (SPEC SCR-IVY-01..03, G-01..G-03). */
test.describe('T01 · Panel shell, header & tabs', () => {
  test.describe('tenant configuration (real tabs/theme)', () => {
    test.use({ mockOptions: { patchTabs: false } });

    test('TC-01-01 panel shows exactly two tabs: Notifications and Chat @T01 @design', async ({ widget }) => {
      await widget.goto();
      await widget.open();
      await expect(widget.tabs).toHaveCount(2);
      await expect(widget.tab('Notifications')).toBeVisible();
      await expect(widget.tab('Chat')).toBeVisible();
      await expect(widget.tab('Orders')).toHaveCount(0);
    });

    test('TC-01-06 panel is 380px wide on desktop @T01 @design', async ({ widget }) => {
      await widget.goto();
      await widget.open();
      const box = await widget.panel.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(378);
      expect(box?.width).toBeLessThanOrEqual(382);
    });
  });

  test('TC-01-02 header greets the identified shopper by first name @T01 @design', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await expect(widget.headerTitle).toHaveText('Hi, Kiho');
  });

  test('TC-01-03 Notifications tab badge shows the unread count @T01 @design', async ({ widget, mocks }) => {
    await widget.goto();
    await widget.open();
    const unread = mocks!.state.notifications.filter((n) => !n.read).length;
    await expect(widget.tabBadge(widget.tab('Notifications'), unread)).toBeVisible();
  });

  test.describe('empty feed', () => {
    test.use({ mockOptions: { emptyFeed: true } });
    test('TC-01-04 badge is hidden when nothing is unread @T01 @design', async ({ widget }) => {
      await widget.goto();
      await widget.open();
      await expect(widget.tab('Notifications').getByLabel(/unread/)).toHaveCount(0);
    });
  });

  test('TC-01-05 Close and Esc close the panel; reopening keeps the last tab @T01 @design', async ({ page, widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    await widget.closeButton.click();
    await expect(widget.panel).toBeHidden();
    await widget.open();
    await expect(widget.tab('Notifications')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(widget.panel).toBeHidden();
  });

  test('TC-01-07 Settings opens the privacy screen and Back returns to the tabs @T01 @design', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.settingsButton.click();
    await expect(widget.panel.getByText('Chat & AI consent')).toBeVisible();
    await widget.panel.getByRole('button', { name: 'Back' }).click();
    await expect(widget.tab('Chat')).toBeVisible();
  });
});

/**
 * TC-01-08 — the shell through the REAL loader (embed.js on a storefront page),
 * because the loader decides the frame size and, below 640px, the phone
 * bottom-sheet (`?compact=1`). Opening the widget URL directly would test a
 * layout no shopper sees. Expected geometry (embed.js recomputeOpen + the
 * .ivy-panel-desktop clamps): frame = min(panel+40, 100vw) × min(680, 100vh);
 * desktop/tablet panel = 380 × min(600, frame − 20); phone panel = the frame.
 */
const DEVICES = [
  { name: 'desktop 1920x1080', width: 1920, height: 1080, mobile: false },
  { name: 'laptop 1366x768', width: 1366, height: 768, mobile: false },
  { name: 'short laptop window 1280x650', width: 1280, height: 650, mobile: false },
  { name: 'tablet portrait 768x1024 (iPad)', width: 768, height: 1024, mobile: true },
  { name: 'tablet landscape 1024x768 (iPad)', width: 1024, height: 768, mobile: true },
  { name: 'tablet 1024x1366 (iPad Pro)', width: 1024, height: 1366, mobile: true },
  { name: 'phone 320x568 (small)', width: 320, height: 568, mobile: true },
  { name: 'phone 375x667 (iPhone SE)', width: 375, height: 667, mobile: true },
  { name: 'phone 390x844 (iPhone 15)', width: 390, height: 844, mobile: true },
  { name: 'phone 412x915 (Pixel 7)', width: 412, height: 915, mobile: true },
  { name: 'phone landscape 844x390', width: 844, height: 390, mobile: true },
] as const;

async function openOnStorefront(page: Page) {
  const widgetBase = process.env.E2E_RESOLVED_WIDGET_URL ?? 'http://localhost:5174/';
  const origin = new URL(widgetBase).origin;
  const hostUrl = `${origin}/__ivy-storefront.html`;
  await page.route(hostUrl, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>ivyusa.com (test host)</title></head>
<body style="margin:0;min-height:200vh;font-family:sans-serif;background:#fafafa"><h1 style="padding:16px">IVY storefront</h1>
<script>window.SHARPTALK_WIDGET_CONFIG = { shop: 'ivyusa.myshopify.com', locale: 'en', widgetUrl: '${origin}' };</script>
<script src="${origin}/embed.js"></script></body></html>`,
    }),
  );
  await page.addInitScript(() => {
    try { localStorage.setItem('ivy_lang', 'en'); } catch { /* storage blocked */ }
  });
  await page.goto(hostUrl);
  const frame = page.frameLocator('#ivy-talktalk-frame');
  await frame.locator('button.st-launcher').click();
  const panel = frame.locator('[role="dialog"].st-panel');
  await expect(panel).toBeVisible();
  return { frame, panel };
}

test.describe('T01 · Panel shell on every screen size (through embed.js)', () => {
  for (const d of DEVICES) {
    test.describe(d.name, () => {
      test.use({
        viewport: { width: d.width, height: d.height },
        isMobile: d.mobile,
        hasTouch: d.mobile,
      });

      test(`TC-01-08 [${d.name}] panel fits the screen with header, both tabs and close visible @T01 @devices`, async ({ page, mocks: _mocks }, testInfo) => {
        const { panel } = await openOnStorefront(page);
        // The open frame animates to its size; measure once it has settled.
        await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0), { timeout: 5_000 })
          .toBeGreaterThan(0);
        await page.waitForTimeout(400);
        const box = (await panel.boundingBox())!;
        testInfo.annotations.push({
          type: 'panel',
          description: `${Math.round(box.width)}x${Math.round(box.height)} at (${Math.round(box.x)},${Math.round(box.y)}) on ${d.width}x${d.height}`,
        });

        // 1) Never outside the screen — nothing cut off on any side.
        expect(box.x, 'left edge').toBeGreaterThanOrEqual(-1);
        expect(box.y, 'top edge').toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width, 'right edge').toBeLessThanOrEqual(d.width + 1);
        expect(box.y + box.height, 'bottom edge').toBeLessThanOrEqual(d.height + 1);

        // 2) The size the design and the loader agree on.
        const frameH = Math.min(680, d.height);
        if (d.width < 640) {
          expect(Math.abs(box.width - d.width), 'phone: full width').toBeLessThanOrEqual(1);
          expect(Math.abs(box.height - frameH), 'phone: bottom sheet height').toBeLessThanOrEqual(2);
          expect(Math.abs(box.y + box.height - d.height), 'phone: anchored to the bottom').toBeLessThanOrEqual(1);
        } else {
          expect(Math.abs(box.width - 380), 'panel width 380').toBeLessThanOrEqual(2);
          expect(Math.abs(box.height - Math.min(600, frameH - 20)), 'panel height').toBeLessThanOrEqual(2);
        }

        // 3) Header, both tabs and the close button are on screen and inside the panel.
        await expect(panel.locator('.st-header-title')).toHaveText('Hi, Kiho');
        await expect(panel.getByRole('tab')).toHaveCount(2);
        for (const el of [
          panel.locator('.st-header-title'),
          panel.getByRole('tab', { name: /Notifications/ }),
          panel.getByRole('tab', { name: /Chat/ }),
          panel.getByRole('button', { name: 'Close' }),
        ]) {
          await expect(el).toBeVisible();
          const b = (await el.boundingBox())!;
          expect(b.x).toBeGreaterThanOrEqual(box.x - 1);
          expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
          expect(b.y).toBeGreaterThanOrEqual(-1);
        }

        await testInfo.attach(`${d.name}.png`, { body: await page.screenshot(), contentType: 'image/png' });
      });
    });
  }
});
