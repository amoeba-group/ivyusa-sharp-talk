import { test, expect } from '../fixtures/widget';
import { ORDERS } from '../fixtures/ivy-data';

/** T02 — notification centre: chips, grouping, row anatomy, read state (SCR-IVY-04, G-04..G-06, BR-01..BR-08). */

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

  test("TC-02-02 rows are grouped under Today's and Yesterday's @T02 @design", async ({ widget }) => {
    await expect(widget.notifGroups.first()).toHaveText(/Today/);
    await expect(widget.notifGroups.filter({ hasText: /Yesterday/ })).toHaveCount(1);
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
    const times = await widget.panel.getByTestId('notif-time').allInnerTexts();
    expect(times.length).toBeGreaterThan(0);
    for (const t of times) {
      expect(t).toMatch(/^(Just now|\d+mins? ago|\d+h ago|Yesterday|\d+ ?days? ago|[A-Z][a-z]{2} \d{1,2})$/);
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
