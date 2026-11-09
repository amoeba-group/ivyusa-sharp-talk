import { test, expect } from '../fixtures/widget';
import { ORDERS } from '../fixtures/ivy-data';

/** T04 — Order Detail (SCR-IVY-06, G-08). Addresses/phone are a PROPOSED API field (see TASKS T04). */
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
    await expect(p.getByText(/PORT WASHINGTON New York 11050-4605/)).toBeVisible();
    await expect(p.getByText('United States')).toBeVisible();
    await expect(p.getByText('123123123')).toBeVisible();
  });

  test('TC-04-04 Contact switches to Chat about this order @T04 @design', async ({ widget }) => {
    await widget.panel.getByRole('button', { name: /^Contact/ }).click();
    await expect(widget.tab('Chat')).toHaveAttribute('aria-selected', 'true');
    await expect(widget.panel.getByText(new RegExp(ORDERS.confirmed.orderNumber.replace('IVY-', '')))).toBeVisible();
  });

  test('TC-04-05 Back returns to the notification list @T04 @design', async ({ widget }) => {
    await widget.panel.getByRole('button', { name: 'Back' }).click();
    await expect(widget.notifItems.first()).toBeVisible();
  });
});
