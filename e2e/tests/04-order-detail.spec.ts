import { test, expect } from '../fixtures/widget';
import { ORDERS } from '../fixtures/ivy-data';

/** T04 — Order Detail (SCR-IVY-06, G-08). Addresses come from GET /orders/:id/addresses, read live from Shopify (PLN-261112 D1). */
test.describe('T04 · Order Detail', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    await widget.notifItems.filter({ hasText: ORDERS.confirmed.orderNumber }).first().click();
    await expect(widget.panel.getByRole('heading', { name: 'Order Detail' })).toBeVisible();
  });

  test('TC-04-01 lists the line items with variant and price @T04 @design', async ({ widget }) => {
    const p = widget.panel;
    await expect(p.getByText(ORDERS.confirmed.orderNumber).first()).toBeVisible();
    await expect(p.getByText('Hydrating Face Mask (10pcs)')).toBeVisible();
    await expect(p.getByText('Burgundy / 6-8')).toHaveCount(2);
    await expect(p.getByText('$4.99', { exact: true })).toHaveCount(3);
  });

  test('TC-04-02 shows Discount, Subtotal · 3 items, Shipping Free and Total USD $55.00 @T04 @design', async ({ widget }) => {
    const p = widget.panel;
    await expect(p.getByText('Discount', { exact: true })).toBeVisible();
    await expect(p.getByText('-$4.99')).toBeVisible();
    await expect(p.getByText('Subtotal · 3 items')).toBeVisible();
    await expect(p.getByText('$55.00', { exact: true })).toBeVisible();
    await expect(p.getByText('Free', { exact: true })).toBeVisible();
    await expect(p.getByText('USD $55.00')).toBeVisible();
  });

  test('TC-04-03 shows Information, Billing address and Shipping address with phone @T04 @design', async ({ widget }) => {
    const p = widget.panel;
    await expect(p.getByText('Information', { exact: true })).toBeVisible();
    await expect(p.getByText('Hyein Kim').first()).toBeVisible();
    await expect(p.getByText('hykim4@ivyent.com')).toBeVisible();
    await expect(p.getByText('Billing address')).toBeVisible();
    await expect(p.getByText('Shipping address')).toBeVisible();
    await expect(p.getByText('25 HARBOR PARK DR')).toBeVisible();
    // Figma 1008:3254 / 1006:4282 put the ZIP on its own line.
    await expect(p.getByText('PORT WASHINGTON New York', { exact: true })).toBeVisible();
    await expect(p.getByText('11050-4605', { exact: true })).toBeVisible();
    // Exact: the AI disclosure in the (hidden, still mounted) Chat panel names
    // "the United States" too (BUG-020).
    await expect(p.getByText('United States', { exact: true })).toBeVisible();
    await expect(p.getByText('123123123')).toBeVisible();
  });

  test('TC-04-04 Contact switches to Chat about this order @T04 @design', async ({ widget }) => {
    await widget.panel.getByRole('button', { name: /^Contact/ }).click();
    await expect(widget.tab('Chat')).toHaveAttribute('aria-selected', 'true');
    // Inside the visible tab panel: the Order Detail stays mounted in the hidden
    // Notifications panel and carries the same number (PLN-261112 D6).
    const chat = widget.panel.getByRole('tabpanel');
    await expect(chat.getByText(new RegExp(ORDERS.confirmed.orderNumber.replace('IVY-', ''))).first()).toBeVisible();
  });

  test('TC-04-05 Back returns to the notification list @T04 @design', async ({ widget }) => {
    await widget.panel.getByRole('button', { name: 'Back' }).click();
    await expect(widget.notifItems.first()).toBeVisible();
  });

  test('TC-04-07 an order without a billing address shows "-" @T04 @design', async ({ widget, mocks }) => {
    const billing = widget.panel.getByText('Billing address', { exact: true }).locator('..');
    await expect(billing).toHaveText('Billing address-');
    expect(mocks!.callsTo('GET', /\/orders\/\w+\/addresses$/).length).toBeGreaterThan(0);
  });
});

test.describe('T04 · Order Detail — store refuses the addresses', () => {
  test.use({ mockOptions: { addresses: 'unavailable' } });

  test('TC-04-06 no address blocks, the rest of the screen unchanged @T04', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    await widget.notifItems.filter({ hasText: ORDERS.confirmed.orderNumber }).first().click();
    const p = widget.panel;
    await expect(p.getByRole('heading', { name: 'Order Detail' })).toBeVisible();
    await expect(p.getByText('Hyein Kim').first()).toBeVisible();
    await expect(p.getByText('USD $55.00')).toBeVisible();
    // "Could not read" is not "none": no "-" pretending the order has no address.
    await expect(p.getByText('Billing address')).toHaveCount(0);
    await expect(p.getByText('Shipping address')).toHaveCount(0);
    await expect(p.getByText('25 HARBOR PARK DR')).toHaveCount(0);
  });
});
