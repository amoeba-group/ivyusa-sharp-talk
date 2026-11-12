import { test, expect, type Widget } from '../fixtures/widget';
import type { Locator } from '@playwright/test';
import { DELIVERY_STEPS, ORDERS } from '../fixtures/ivy-data';

/** data-state of each step on a card, in order. Not auto-waiting: poll it. */
const stepStates = (c: Locator) =>
  c.getByTestId('delivery-step').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));

/** T03 — delivery tracking cards with the 4-step stepper (SCR-IVY-05, G-07, BR-06). */
test.describe('T03 · Notifications — Delivery', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    await widget.chip('Delivery').click();
  });

  const card = (widget: Widget, orderNumber: string): Locator => widget.deliveryCards.filter({ hasText: orderNumber }).first();

  test('TC-03-01 Delivery shows a card per in-transit / delivered order @T03 @design', async ({ widget }) => {
    await expect(card(widget, ORDERS.inTransit.orderNumber)).toBeVisible();
    await expect(card(widget, ORDERS.delivered.orderNumber)).toBeVisible();
  });

  test('TC-03-02 stepper labels are Preparing · Processing · In Transit · Delivered @T03 @design', async ({ widget }) => {
    const steps = card(widget, ORDERS.inTransit.orderNumber).getByTestId('delivery-step');
    await expect(steps).toHaveCount(4);
    await expect(steps).toHaveText(DELIVERY_STEPS);
  });

  test('TC-03-03 in-transit card: 3rd step current, orange pill, "Your order is on the way!" @T03 @design', async ({ widget }) => {
    const c = card(widget, ORDERS.inTransit.orderNumber);
    await expect(widget.statusPill(c)).toHaveText('In Transit');
    // Polled: the pill can show from the order before tracking arrives (BUG-019).
    await expect.poll(() => stepStates(c)).toEqual(['done', 'done', 'current', 'todo']);
    await expect(c).toContainText('Your order is on the way!');
  });

  test('TC-03-04 delivered card: all steps done, "Your order is Delivered !" @T03 @design', async ({ widget }) => {
    const c = card(widget, ORDERS.delivered.orderNumber);
    await expect(widget.statusPill(c)).toHaveText('Delivered');
    // Polled: the pill can show from the order before tracking arrives (BUG-019).
    await expect.poll(() => stepStates(c)).toEqual(['done', 'done', 'done', 'done']);
    await expect(c).toContainText(/Your order is Delivered\s?!/);
  });

  test('TC-03-05 Track Order opens the carrier tracking page in a new tab @T03 @design', async ({ page, widget }) => {
    // The carrier page is stubbed so the test never depends on ups.com being up
    // or reachable from CI. A new tab starts on an empty URL and only then
    // navigates, so wait for that navigation instead of reading the URL at once
    // (BUG-017).
    await page.context().route('https://www.ups.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>UPS tracking (stub)</title>' }),
    );
    const c = card(widget, ORDERS.inTransit.orderNumber);
    const popup = page.waitForEvent('popup');
    await c.getByRole('button', { name: 'Track Order' }).or(c.getByRole('link', { name: 'Track Order' })).click();
    const tab = await popup;
    await tab.waitForURL(/ups\.com\/track/, { waitUntil: 'commit' });
    expect(tab.url()).toContain('tracknum=1Z999AA10123456784');
  });
});
