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
