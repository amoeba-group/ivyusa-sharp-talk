import type { Locator, Page } from '@playwright/test';
import { test, expect, watchConsole, type Lang } from '../fixtures/widget';

/** Localized names TC-15-06 navigates by (apps/widget/src/i18n/locales/*.ts). */
const NAV: Record<Lang, { notifications: string; chat: string; settings: string }> = {
  en: { notifications: 'Notifications', chat: 'Chat', settings: 'Settings' },
  es: { notifications: 'Notificaciones', chat: 'Chat', settings: 'Configuración' },
  ko: { notifications: '알림', chat: '채팅', settings: '설정' },
  vi: { notifications: 'Thông báo', chat: 'Trò chuyện', settings: 'Cài đặt' },
  ja: { notifications: 'お知らせ', chat: 'チャット', settings: '設定' },
  zh: { notifications: '通知', chat: '聊天', settings: '设置' },
};

/**
 * The storefront as a shopper's phone loads it: a page with embed.js, which
 * decides the phone layout (`?compact=1`) and the frame size. Same host page as
 * TC-01-08.
 */
async function openOnStorefront(page: Page, lang: Lang): Promise<Locator> {
  const origin = new URL(process.env.E2E_RESOLVED_WIDGET_URL ?? 'http://localhost:5174/').origin;
  const hostUrl = `${origin}/__ivy-storefront.html`;
  await page.route(hostUrl, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>ivyusa.com (test host)</title></head>
<body style="margin:0;min-height:200vh;font-family:sans-serif;background:#fafafa"><h1 style="padding:16px">IVY storefront</h1>
<script>window.SHARPTALK_WIDGET_CONFIG = { shop: 'ivyusa.myshopify.com', locale: '${lang}', widgetUrl: '${origin}' };</script>
<script src="${origin}/embed.js"></script></body></html>`,
    }),
  );
  await page.addInitScript((l) => {
    try { localStorage.setItem('ivy_lang', l); } catch { /* storage blocked */ }
  }, lang);
  await page.goto(hostUrl);
  const frame = page.frameLocator('#ivy-talktalk-frame');
  await frame.locator('button.st-launcher').click();
  const panel = frame.locator('[role="dialog"].st-panel');
  await expect(panel).toBeVisible();
  return panel;
}

/**
 * Anything drawn past the panel's sides, or text cut by its own box (TC-15-06).
 * A horizontal scroller may hold wider content; nothing in the panel should be one.
 */
async function overflowing(panel: Locator): Promise<string[]> {
  return panel.evaluate((root) => {
    const found = new Set<string>();
    const edge = root.getBoundingClientRect();
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      if (!el.getClientRects().length) continue;
      const r = el.getBoundingClientRect();
      const label = `<${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 40)}"`;
      if (r.width > 0 && (r.left < edge.left - 1 || r.right > edge.right + 1)) found.add(`past the edge: ${label}`);
      const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
      const cs = getComputedStyle(el);
      if (ownText && el.scrollWidth > el.clientWidth + 1 && (cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis')) {
        found.add(`cut off: ${label}`);
      }
    }
    return [...found];
  });
}

/** T15 — responsive layout & accessibility (NFR-02..NFR-04, G-23, G-24). */
test.describe('T15 · Responsive & a11y', () => {
  test('TC-15-01 on a phone the open panel fills the screen width @T15 @responsive @mobile-only', async ({ page, widget }) => {
    await widget.goto();
    await widget.open();
    const vw = page.viewportSize()!.width;
    const box = (await widget.panel.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(vw * 0.95);
    expect(box.x).toBeLessThanOrEqual(vw * 0.03);
  });

  test('TC-15-02 no console errors while visiting every tab and chip @T15 @a11y @smoke', async ({ page, widget }) => {
    const errors = watchConsole(page);
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    for (const chip of ['Order', 'Delivery', 'Promo', 'Review']) {
      const c = widget.chip(chip);
      if (await c.count()) await c.click();
    }
    await widget.openChat();
    await widget.settingsButton.click();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('TC-15-03 focus moves into the panel and Esc closes it @T15 @a11y', async ({ page, widget }) => {
    await widget.goto();
    await widget.open();
    await page.keyboard.press('Tab');
    expect(await widget.panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(widget.panel).toBeHidden();
  });

  test('TC-15-04 tabs expose aria-selected and filter chips expose aria-pressed @T15 @a11y', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    await expect(widget.tab('Notifications')).toHaveAttribute('aria-selected', 'true');
    await expect(widget.tab('Chat')).toHaveAttribute('aria-selected', 'false');
    await widget.chip('Delivery').click();
    await expect(widget.chip('Delivery')).toHaveAttribute('aria-pressed', 'true');
    await expect(widget.chip('Order')).toHaveAttribute('aria-pressed', 'false');
  });

  test('TC-15-05 Tab and Shift+Tab never leave the open panel @T15 @a11y', async ({ page, widget }) => {
    await widget.goto();
    await widget.open();
    // Let the session settle: until it does, the consent banner can still come
    // and go under the focus (covered on its own below).
    await page.waitForLoadState('networkidle');
    await expect(widget.quickReplies).toBeVisible();
    const inside = () => widget.panel.evaluate((el) => el.contains(document.activeElement));
    // Before T15 the 15th Tab left for the page behind (the store's own links).
    for (let i = 1; i <= 40; i++) {
      await page.keyboard.press('Tab');
      expect(await inside(), `Tab ×${i}`).toBe(true);
    }
    // It wraps: back to the first control, the language button.
    await widget.languageButton.focus();
    await page.keyboard.press('Shift+Tab');
    expect(await inside(), 'Shift+Tab from the first control').toBe(true);
    await page.keyboard.press('Tab');
    await expect(widget.languageButton).toBeFocused();
  });
});

test.describe('T15 · Focus when the consent banner goes', () => {
  test.use({ mockOptions: { consent: 'pending' } });

  test('TC-15-05 accepting consent from the keyboard keeps the focus in the panel @T15 @a11y', async ({ page, widget }) => {
    await widget.goto();
    await widget.open();
    await page.waitForLoadState('networkidle');
    const accept = widget.panel.getByRole('button', { name: 'Accept', exact: true });
    await accept.focus();
    await page.keyboard.press('Enter');
    await expect(accept).toBeHidden();
    // The focused button is gone. Before T15 the focus fell to <body>, behind the panel.
    const inside = () => widget.panel.evaluate((el) => el.contains(document.activeElement));
    await expect.poll(inside).toBe(true);
    await page.keyboard.press('Tab');
    expect(await inside()).toBe(true);
  });
});

test.describe('T15 · Phone 390×844 through embed.js', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const lang of Object.keys(NAV) as Lang[]) {
    test(`TC-15-06 [${lang}] the panel is the whole screen and nothing spills over or is cut off @T15 @devices`, async ({ page, mocks: _mocks }) => {
      const panel = await openOnStorefront(page, lang);
      // Owner's 2a (T15 D1): the whole screen, not a 680px sheet.
      await expect.poll(async () => Math.round((await panel.boundingBox())?.height ?? 0), { timeout: 5_000 }).toBe(844);
      const box = (await panel.boundingBox())!;
      expect(Math.round(box.width)).toBe(390);
      expect(Math.round(box.y)).toBe(0);

      const nav = NAV[lang];
      await panel.getByRole('tab', { name: new RegExp(`^${nav.notifications}`) }).click();
      const chips = panel.getByRole('tabpanel').locator('div.flex-wrap').first().getByRole('button');
      const count = await chips.count();
      expect(count).toBeGreaterThanOrEqual(4);
      for (let i = 0; i < count; i++) {
        await chips.nth(i).click();
        await expect(chips.nth(i)).toHaveAttribute('aria-pressed', 'true');
        // Measure the chip's content, not its spinner.
        await page.waitForLoadState('networkidle');
        expect(await overflowing(panel), `chip ${i + 1}`).toEqual([]);
      }
      await panel.getByRole('tab', { name: new RegExp(`^${nav.chat}`) }).click();
      expect(await overflowing(panel), 'chat').toEqual([]);
      await panel.getByRole('button', { name: nav.settings, exact: true }).click();
      expect(await overflowing(panel), 'settings').toEqual([]);
    });
  }
});
