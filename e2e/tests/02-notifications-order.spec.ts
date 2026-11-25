import { test, expect } from '../fixtures/widget';
import { ORDERS } from '../fixtures/ivy-data';

/**
 * T02 — notification centre: chips, grouping, row anatomy, read state (SCR-IVY-04, G-04..G-06, BR-01..BR-08).
 * Grouping and time wording follow IVY PRD v1 slide 9 (PLN-261125 §2.1): New / Recent, elapsed time.
 */

/** Parse "rgb(r, g, b)" / "rgba(...)". */
const rgb = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number) as [number, number, number];

test.describe('T02 · Notifications — Order', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
  });

  test('TC-02-01 chip bar is Order · Delivery · Promo · Review with Order selected @T02 @design', async ({ widget }) => {
    for (const name of ['Order', 'Delivery', 'Promo', 'Review']) {
      await expect(widget.chip(name)).toBeVisible();
    }
    for (const legacy of ['All', 'Payment', 'Event']) {
      await expect(widget.chip(legacy)).toHaveCount(0);
    }
    await expect(widget.chip('Order')).toHaveAttribute('aria-pressed', 'true');
    // Visual order left → right.
    const xs = await Promise.all(['Order', 'Delivery', 'Promo', 'Review'].map(async (n) => (await widget.chip(n).boundingBox())!.x));
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  test('TC-02-02 rows are grouped under New (unread) then Recent (read) @T02 @design', async ({ widget }) => {
    await expect(widget.notifGroups).toHaveText(['New', 'Recent']);
    const groups = await widget.panel.evaluate(() => {
      const out: Record<string, string[]> = {};
      let current = '';
      for (const el of document.querySelectorAll('[data-testid="notif-group"], [data-testid="notif-item"]')) {
        if (el.getAttribute('data-testid') === 'notif-group') current = el.getAttribute('data-group') ?? '';
        else (out[current] ??= []).push(el.getAttribute('data-unread') ?? '');
      }
      return out;
    });
    expect(groups.new.length).toBeGreaterThan(0);
    expect(groups.new.every((u) => u === 'true')).toBe(true);
    expect(groups.recent.every((u) => u === 'false')).toBe(true);
  });

  test('TC-02-03 a row shows order number, status pill, item summary and relative time @T02 @design', async ({ widget }) => {
    const row = widget.notifItems.filter({ hasText: ORDERS.confirmed.orderNumber }).first();
    await expect(row).toBeVisible();
    await expect(widget.statusPill(row)).toHaveText('Confirmed');
    await expect(widget.statusPill(row)).toHaveAttribute('data-status', 'confirmed');
    await expect(row).toContainText('Hydrating Face Mask (10pcs) + 2 items');
    await expect(row.getByTestId('notif-time')).toHaveText('Just now');
  });

  test('TC-02-04 relative times use the design wording @T02 @design', async ({ widget }) => {
    // allInnerTexts() does not wait: read once the rows are there (BUG-019).
    await expect(widget.panel.getByTestId('notif-time').first()).toBeVisible();
    const times = await widget.panel.getByTestId('notif-time').allInnerTexts();
    expect(times.length).toBeGreaterThan(0);
    for (const t of times) {
      // Elapsed time only — no "Yesterday", no dates (PRD v1 slide 9).
      expect(t).toMatch(/^(Just now|\d+ min ago|1 hour ago|\d+ hours ago|1 day ago|\d+ days ago)$/);
    }
  });

  test('TC-02-05 tapping an unread row marks it read and opens Order Detail @T02 @design', async ({ widget, mocks }) => {
    const row = widget.notifItems.filter({ hasText: ORDERS.confirmed.orderNumber }).first();
    await expect(row).toHaveAttribute('data-unread', 'true');
    await row.click();
    await expect.poll(() => mocks!.callsTo('POST', /\/notifications\/\w+\/read$/).length).toBeGreaterThan(0);
    await expect(widget.panel.getByRole('heading', { name: 'Order Detail' })).toBeVisible();
  });

  test('TC-02-06 status pill colours follow the status code @T02 @design', async ({ widget }) => {
    const pills = widget.statusPill();
    await expect(pills.first()).toBeVisible();
    const seen = await pills.evaluateAll((els) =>
      els.map((e) => ({ status: e.getAttribute('data-status'), bg: getComputedStyle(e).backgroundColor })),
    );
    expect(seen.length).toBeGreaterThan(0);
    for (const { status, bg } of seen) {
      const [r, g, b] = rgb(bg);
      if (status === 'confirmed') expect(g, `confirmed ${bg}`).toBeGreaterThan(Math.max(r, b));
      if (status === 'in_transit') expect(r, `in_transit ${bg}`).toBeGreaterThan(g);
      if (status === 'delivered') expect(Math.max(r, g, b) - Math.min(r, g, b), `delivered ${bg}`).toBeLessThan(24);
      if (status === 'review') expect(Math.min(r, b), `review ${bg}`).toBeGreaterThan(g);
    }
  });
});

/** IVY PRD v1 slide 8–9 (PLN-261125 §2.1–2.2): when a read row moves, and the row menu. */
test.describe('T02 · Notifications — New / Recent and the row menu', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
  });

  test('TC-02-07 a tapped row stays in New until the widget is opened again @T02', async ({ widget }) => {
    const row = () => widget.notifItems.filter({ hasText: ORDERS.confirmed.orderNumber }).first();
    await expect(row()).toHaveAttribute('data-unread', 'true');
    await row().click();
    await widget.panel.getByRole('button', { name: 'Back' }).click();
    // Read now — dot and wash gone — but still under New while the panel is open.
    await expect(row()).toHaveAttribute('data-unread', 'false');
    await expect(widget.notifGroups.first()).toHaveText('New');
    await expect(widget.notifGroups).toHaveCount(2);
    await widget.closeButton.click();
    await widget.open();
    await widget.openNotifications();
    // Next opening: nothing unread is left, so New is gone and the row is Recent.
    await expect(widget.notifGroups).toHaveText(['Recent']);
    await expect(row()).toBeVisible();
  });

  test('TC-02-08 right-click opens the row menu and Delete removes that row @T02', async ({ widget, mocks }) => {
    const row = widget.notifItems.filter({ hasText: ORDERS.inTransit.orderNumber }).first();
    await row.click({ button: 'right' });
    const menu = widget.panel.page().getByTestId('notif-row-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
    await menu.getByRole('menuitem', { name: 'Delete' }).click();
    await expect.poll(() => mocks!.callsTo('DELETE', /\/notifications$/).length).toBe(1);
    const body = mocks!.callsTo('DELETE', /\/notifications$/)[0].body as { ids?: Array<number | string>; all?: boolean };
    expect((body.ids ?? []).map(String)).toEqual(['502']);
    expect(body.all).toBeFalsy();
    // Every mounted tab has a toast host; the one on screen is the Notifications tab's.
    await expect(widget.panel.getByText('1 notification deleted').filter({ visible: true })).toBeVisible();
    await expect(widget.notifItems.filter({ hasText: ORDERS.inTransit.orderNumber })).toHaveCount(0);
  });

  test('TC-02-09 Esc closes the row menu and leaves the widget open @T02', async ({ widget, page }) => {
    await widget.notifItems.first().click({ button: 'right' });
    await expect(page.getByTestId('notif-row-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('notif-row-menu')).toHaveCount(0);
    await expect(widget.panel).toBeVisible();
  });
});

test('TC-02-10 press and hold opens the row menu on a phone; the lifted finger opens nothing @T02 @mobile-only', async ({ widget, page }) => {
  await widget.goto();
  await widget.open();
  await widget.openNotifications();
  const row = widget.notifItems.filter({ hasText: ORDERS.confirmed.orderNumber }).first();
  const box = (await row.boundingBox())!;
  const at = { x: box.x + 40, y: box.y + 20 };
  await row.evaluate((el, p) => {
    const t = new Touch({ identifier: 1, target: el, clientX: p.x, clientY: p.y });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
  }, at);
  await expect(page.getByTestId('notif-row-menu')).toBeVisible();
  await row.evaluate((el) => el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true })));
  // The click a lifted finger produces must not open the order under the menu.
  await row.locator('button').first().dispatchEvent('click');
  await expect(widget.panel.getByRole('heading', { name: 'Order Detail' })).toHaveCount(0);
  await expect(page.getByTestId('notif-row-menu').getByRole('menuitem', { name: 'Delete' })).toBeVisible();
});
