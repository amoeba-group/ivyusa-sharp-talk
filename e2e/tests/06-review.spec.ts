import { test, expect, type Widget } from '../fixtures/widget';
import { ORDERS } from '../fixtures/ivy-data';

/** T06 — Review requests (SCR-IVY-08, G-10, BUG-009). */
async function openReview(widget: Widget) {
  await widget.goto();
  await widget.open();
  await widget.openNotifications();
  await widget.chip('Review').click();
}

test.describe('T06 · Notifications — Review', () => {
  test('TC-06-01 a delivered item shows the Review pill, title · price and Write Review @T06 @design', async ({ widget }) => {
    await openReview(widget);
    await expect(widget.panel.getByText(ORDERS.reviewable.orderNumber)).toBeVisible();
    await expect(widget.statusPill(widget.panel).filter({ hasText: 'Review' }).first()).toBeVisible();
    await expect(widget.panel.getByText('Rose Hip Facial Oil 30ml · $55.00')).toBeVisible();
    await expect(widget.panel.getByRole('button', { name: 'Write Review' }).or(widget.panel.getByRole('link', { name: 'Write Review' }))).toBeVisible();
  });

  test('TC-06-02 Write Review opens the product review page or the in-widget form @T06 @design', async ({ page, widget }) => {
    await openReview(widget);
    const popup = page.waitForEvent('popup', { timeout: 3_000 }).catch(() => null);
    await widget.panel.getByRole('button', { name: 'Write Review' }).or(widget.panel.getByRole('link', { name: 'Write Review' })).first().click();
    const p = await popup;
    if (p) expect(p.url()).toContain('ivyusa.com');
    else await expect(widget.panel.getByRole('button', { name: /Submit/ })).toBeVisible();
  });

  test.describe('save failure', () => {
    test.use({ mockOptions: { failures: { 'POST /reviews': 500 } } });
    test('TC-06-03 a failed review save shows an error to the shopper @T06 @design', async ({ page, widget }) => {
      await openReview(widget);
      const popup = page.waitForEvent('popup', { timeout: 2_000 }).catch(() => null);
      await widget.panel.getByRole('button', { name: 'Write Review' }).or(widget.panel.getByRole('link', { name: 'Write Review' })).first().click();
      test.skip(!!(await popup), 'Tenant uses the store review page — no in-widget form to fail.');
      await widget.panel.getByRole('radio', { name: /5/ }).or(widget.panel.getByRole('button', { name: /5 star/i })).first().click();
      await widget.panel.getByRole('textbox').last().fill('Love it');
      await widget.panel.getByRole('button', { name: /Submit/ }).click();
      await expect(widget.panel.getByRole('alert').or(page.getByRole('alert'))).toContainText(/could not|failed|try again/i);
    });
  });
});
