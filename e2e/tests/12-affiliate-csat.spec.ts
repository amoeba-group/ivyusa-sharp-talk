import { test, expect } from '../fixtures/widget';

/** T12 — Affiliate scenario, End → CSAT → closed (SCR-IVY-14, G-19, G-20, BR-12, BR-13). */
test.use({ mockOptions: { scenarioFlows: true } });

test.describe('T12 · Affiliate & CSAT', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.scenarioButton(/Affiliate/).click();
  });

  test('TC-12-01 three steps with descriptions and four action chips @T12 @design', async ({ widget }) => {
    const p = widget.panel;
    await expect(p.getByText(/Submit (an )?application/i).last()).toBeVisible();
    await expect(p.getByText(/1.?3 business days/i).last()).toBeVisible();
    await expect(p.getByText(/10%/).last()).toBeVisible();
    for (const name of [/^Apply now$/, /^Learn more$/, /^Start over$/, /^End$/]) {
      await expect(p.getByRole('button', { name }).last()).toBeVisible();
    }
  });

  test('TC-12-02 End asks for a 4-level rating with Skip @T12 @design', async ({ widget }) => {
    await widget.panel.getByRole('button', { name: /^End$/ }).last().click();
    const csat = widget.panel.getByTestId('csat-card');
    await expect(csat).toBeVisible();
    for (const name of ['Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied', 'Skip']) {
      await expect(csat.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(csat.getByRole('button')).toHaveCount(5);
  });

  test('TC-12-03 rating sends CSAT, thanks the shopper, then shows the chat has ended @T12 @design', async ({ widget, mocks }) => {
    await widget.panel.getByRole('button', { name: /^End$/ }).last().click();
    await widget.panel.getByTestId('csat-card').getByRole('button', { name: 'Very satisfied', exact: true }).click();
    await expect.poll(() => mocks!.callsTo('POST', '/chat/csat').length).toBe(1);
    expect(mocks!.callsTo('POST', '/chat/csat')[0].body.rating).toBe(5);
    const thanks = widget.panel.getByText(/Thank you for your (valuable )?feedback/i);
    const ended = widget.panel.getByText(/chat has ended/i);
    await expect(thanks).toBeVisible();
    await expect(ended).toBeVisible();
    // "ended" comes AFTER the thank-you (G-20).
    expect((await ended.boundingBox())!.y).toBeGreaterThan((await thanks.boundingBox())!.y);
  });

  test('TC-12-04 Skip ends without sending a rating @T12 @design', async ({ widget, mocks }) => {
    await widget.panel.getByRole('button', { name: /^End$/ }).last().click();
    await widget.panel.getByTestId('csat-card').getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(widget.panel.getByText(/chat has ended/i)).toBeVisible();
    expect(mocks!.callsTo('POST', '/chat/csat')).toHaveLength(0);
  });
});
