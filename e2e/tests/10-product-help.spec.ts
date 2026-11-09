import { test, expect } from '../fixtures/widget';
import { PRODUCT_CATEGORIES } from '../fixtures/ivy-data';

/** T10 — Product Help scenario (SCR-IVY-12, G-16, BR-17). */
test.describe('T10 · Chat scenario — Product Help', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.scenarioButton(/Product inquiry/).click();
  });

  test('TC-10-01 sub-menu: usage · ingredients · exchange/return · restock alert · start over @T10 @design', async ({ widget }) => {
    for (const name of [/Usage|How to use/, /Ingredients/, /Exchange.*Return/, /Restock alert/, /^Start over$/]) {
      await expect(widget.panel.getByRole('button', { name }).last()).toBeVisible();
    }
  });

  test('TC-10-02 shows the 11 product categories @T10 @design', async ({ widget }) => {
    for (const c of PRODUCT_CATEGORIES) {
      await expect(widget.panel.getByRole('button', { name: c, exact: true }).last()).toBeVisible();
    }
  });

  test('TC-10-03 a category leads to Popular products @T10 @design', async ({ widget, mocks }) => {
    await widget.panel.getByRole('button', { name: 'Nails', exact: true }).last().click();
    await widget.panel.getByRole('button', { name: /Popular products/ }).last().click();
    await expect(widget.panel.getByText('Gel Polish Starter Set')).toBeVisible();
    expect(mocks!.callsTo('GET', /^\/products(\/recommendations)?$/).length).toBeGreaterThan(0);
  });

  test('TC-10-04 Exchange / Return explains the 7-day unopened policy @T10 @design', async ({ widget }) => {
    await widget.panel.getByRole('button', { name: /Exchange.*Return/ }).last().click();
    await expect(widget.panel.getByText(/7 days/).last()).toBeVisible();
    await expect(widget.panel.getByText(/unopened/i).last()).toBeVisible();
  });
});

test.describe('T10 · AI typing indicator (real API)', () => {
  test.use({ mockOptions: false });
  test('TC-10-05 the typing indicator shows while the answer is written @T10 @integration', async ({ page, widget }) => {
    // Hold the real answer back so the indicator is observable.
    await page.route('**/chat/message', async (route) => {
      await new Promise((r) => setTimeout(r, 1_500));
      await route.continue();
    });
    await widget.goto();
    await widget.open();
    await widget.acceptConsentIfShown();
    await widget.composer.fill('Recommend your most popular product');
    await widget.sendButton.click();
    await expect(widget.panel.getByText('Writing a reply…')).toBeVisible();
  });
});
