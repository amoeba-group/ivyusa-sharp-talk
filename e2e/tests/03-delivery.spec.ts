import { test, expect, type Widget } from '../fixtures/widget';
import type { Locator } from '@playwright/test';
import { DELIVERY_STEPS, ORDERS } from '../fixtures/ivy-data';

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
    const states = await c.getByTestId('delivery-step').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
    expect(states).toEqual(['done', 'done', 'current', 'todo']);
    await expect(c).toContainText('Your order is on the way!');
  });

  test('TC-03-04 delivered card: all steps done, "Your order is Delivered !" @T03 @design', async ({ widget }) => {
    const c = card(widget, ORDERS.delivered.orderNumber);
    await expect(widget.statusPill(c)).toHaveText('Delivered');
    const states = await c.getByTestId('delivery-step').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
    expect(states).toEqual(['done', 'done', 'done', 'done']);
    await expect(c).toContainText(/Your order is Delivered\s?!/);
  });

  test('TC-03-05 Track Order opens the carrier tracking page in a new tab @T03 @design', async ({ page, widget }) => {
    const c = card(widget, ORDERS.inTransit.orderNumber);
    const popup = page.waitForEvent('popup');
    await c.getByRole('button', { name: 'Track Order' }).or(c.getByRole('link', { name: 'Track Order' })).click();
    expect((await popup).url()).toContain('ups.com/track');
  });
});
