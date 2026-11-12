import type { Page } from '@playwright/test';
import { test, expect, type Widget } from '../fixtures/widget';
import { ORDERS, reviewItems } from '../fixtures/ivy-data';

/**
 * Serve the Review chip a line with NO product link, so "Write Review" opens
 * the in-widget form instead of the store page (T06 D5). Registered after the
 * fixture's catch-all, so it wins.
 */
async function reviewLineWithoutLink(page: Page) {
  await page.route('**/api/v1/orders/review-items', (route) =>
    route.fulfill({
      json: { success: true, data: reviewItems().map((i) => ({ ...i, productUrl: null })), timestamp: new Date().toISOString() },
    }),
  );
}

/** Answer POST /reviews with the given statuses in turn (the last one repeats). */
async function reviewAnswers(page: Page, answers: Array<{ status: number; code?: string }>) {
  let n = 0;
  await page.route('**/api/v1/reviews', (route) => {
    const a = answers[Math.min(n++, answers.length - 1)];
    return route.fulfill({
      status: a.status,
      json:
        a.status < 300
          ? { success: true, data: { id: '1' }, timestamp: new Date().toISOString() }
          : { success: false, data: null, error: { code: a.code ?? 'E9001', message: 'Mocked failure' }, timestamp: new Date().toISOString() },
    });
  });
}

async function fillAndSubmit(widget: Widget) {
  await widget.panel.getByRole('button', { name: 'Write Review' }).first().click();
  await widget.panel.getByRole('button', { name: /5 star/i }).first().click();
  await widget.panel.getByRole('textbox').last().fill('Love it');
  await widget.panel.getByRole('button', { name: /Submit/ }).click();
}

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
    // Stub the store page; read the tab's URL only once it has navigated (BUG-017).
    await page.context().route('https://ivyusa.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>IVY (stub)</title>' }),
    );
    const popup = page.waitForEvent('popup', { timeout: 3_000 }).catch(() => null);
    await widget.panel.getByRole('button', { name: 'Write Review' }).or(widget.panel.getByRole('link', { name: 'Write Review' })).first().click();
    const p = await popup;
    if (p) {
      await p.waitForURL(/ivyusa\.com/, { waitUntil: 'commit' });
      expect(p.url()).toContain('ivyusa.com');
    } else await expect(widget.panel.getByRole('button', { name: /Submit/ })).toBeVisible();
  });

  test.describe('save failure', () => {
    test.use({ mockOptions: { failures: { 'POST /reviews': 500 } } });
    test('TC-06-03 a failed review save shows an error to the shopper @T06 @design', async ({ page, widget }) => {
      // A line without a product link, so the in-widget form is what opens (T06 D5).
      await reviewLineWithoutLink(page);
      await openReview(widget);
      await fillAndSubmit(widget);
      await expect(widget.panel.getByRole('alert').or(page.getByRole('alert'))).toContainText(/could not|couldn't|failed|try again/i);
      // The form keeps what the shopper wrote, ready to send again.
      await expect(widget.panel.getByRole('textbox').last()).toHaveValue('Love it');
      await expect(widget.panel.getByRole('button', { name: /Submit/ })).toBeEnabled();
    });
  });

  test('TC-06-04 after a failure, sending again saves the review @T06', async ({ page, widget }) => {
    await reviewLineWithoutLink(page);
    await reviewAnswers(page, [{ status: 500 }, { status: 201 }]);
    await openReview(widget);
    await fillAndSubmit(widget);
    await expect(page.getByRole('alert')).toContainText("Couldn't save your review");
    await widget.panel.getByRole('button', { name: /Submit/ }).click();
    await expect(widget.panel.getByText('Thanks for your review!')).toBeVisible();
  });

  test('TC-06-05 a review the moderation gate refuses says what to change @T06', async ({ page, widget }) => {
    await reviewLineWithoutLink(page);
    await reviewAnswers(page, [{ status: 422, code: 'E4002' }]);
    await openReview(widget);
    await fillAndSubmit(widget);
    await expect(page.getByRole('alert')).toContainText('Remove contact details or offensive words');
  });
});
