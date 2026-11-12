import { test, expect } from '../fixtures/widget';
import { ORDERS } from '../fixtures/ivy-data';

/** T09 — "My Orders" scenario in chat (SCR-IVY-11, G-15, BR-12). */
test.use({ mockOptions: { scenarioFlows: true } });

test.describe('T09 · Chat scenario — My Orders', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.scenarioButton(/My Orders/).click();
  });

  test('TC-09-01 bot lists the recent orders as cards @T09 @design', async ({ widget }) => {
    // The shopper's tap is echoed as their turn (Figma 1006:5530).
    await expect(widget.panel.locator('.st-message-user', { hasText: 'My Orders' })).toBeVisible();
    await expect(widget.panel.getByText(/recent orders/i).last()).toBeVisible();
    await expect(widget.panel.getByText(ORDERS.confirmed.orderNumber).last()).toBeVisible();
  });

  test('TC-09-02 follow-up chips: Track delivery · Cancel order · Start over @T09 @design', async ({ widget }) => {
    for (const name of [/Track delivery/i, /Cancel order/i, /^Start over$/]) {
      await expect(widget.panel.getByRole('button', { name }).last()).toBeVisible();
    }
  });

  test('TC-09-03 tapping an order card opens Order Detail @T09 @design', async ({ widget }) => {
    await widget.panel.getByText(ORDERS.confirmed.orderNumber).last().click();
    await expect(widget.panel.getByRole('heading', { name: 'Order Detail' })).toBeVisible();
  });

  test('TC-09-04 Start over brings back the quick-reply menu @T09 @design', async ({ widget }) => {
    await widget.panel.getByRole('button', { name: /^Start over$/ }).last().click();
    await expect(widget.scenarioButton(/Payment check/)).toBeVisible();
  });
});

test.describe('T09 · My Orders — from the answer', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.scenarioButton(/My Orders/).click();
    await expect(widget.panel.getByRole('button', { name: /^Start over$/ }).last()).toBeVisible();
  });

  test('TC-09-06 Back from Order Detail returns to the same conversation @T09', async ({ widget }) => {
    await widget.panel.getByText(ORDERS.confirmed.orderNumber).last().click();
    await expect(widget.panel.getByRole('heading', { name: 'Order Detail' })).toBeVisible();
    await widget.panel.getByRole('button', { name: 'Back' }).click();
    await expect(widget.tab('Chat')).toHaveAttribute('aria-selected', 'true');
    await expect(widget.panel.getByText(/recent orders/i).last()).toBeVisible();
    await expect(widget.panel.getByRole('button', { name: /Track delivery/i }).last()).toBeVisible();
  });

  test('TC-09-07 Track delivery opens the Delivery chip with the real delivery cards @T09', async ({ widget }) => {
    await widget.panel.getByRole('button', { name: /Track delivery/i }).last().click();
    await expect(widget.tab('Notifications')).toHaveAttribute('aria-selected', 'true');
    await expect(widget.chip('Delivery')).toHaveAttribute('aria-pressed', 'true');
    await expect(widget.deliveryCards.first()).toBeVisible();
  });
});

test.describe('T09 · Start over on every scenario', () => {
  // Real consent, so the real API runs the script: with consent only patched
  // into the widget's view, the server still refuses and sends no chips.
  test.use({ mockOptions: { scenarioFlows: true, consent: 'pending' } });

  test('TC-09-05 a scripted reply offers Start over, which brings the menu back below it @T09', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.acceptConsent();
    // Exchange & Refund runs the cancel_refund script on the real API.
    await widget.scenarioButton(/Exchange & Refund/).click();
    const startOver = widget.panel.getByRole('button', { name: /^Start over$/ }).last();
    await expect(startOver).toBeVisible({ timeout: 15_000 });
    await startOver.click();
    await expect(widget.panel.getByText('What else can I help you with?')).toBeVisible();
    // Two menus now: the opening one and the one Start over added at the end.
    await expect(widget.panel.getByTestId('quick-replies')).toHaveCount(2);
    await expect(widget.scenarioButton(/Payment check/)).toBeVisible();
  });
});
