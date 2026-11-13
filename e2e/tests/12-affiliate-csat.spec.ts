import { test, expect } from '../fixtures/widget';

/**
 * T12 — Affiliate scenario, End → CSAT → closed (SCR-IVY-14, G-19, G-20, BR-12, BR-13).
 *
 * The affiliate answer is a script now (PLN-261113 D1), so it runs on the real
 * API with the tenant's own copy (IVY Beauty, 10%). That needs real consent —
 * consent patched into the widget alone is refused by the server (TC-09-05
 * lesson). End and the rating go to the real API as well, recorded by the mock.
 */
test.use({ mockOptions: { scenarioFlows: true, consent: 'pending' } });

const CHIPS = /^(Apply now|Learn more|Start over|End)$/;

test.describe('T12 · Affiliate & CSAT', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.acceptConsent();
    await widget.scenarioButton(/Affiliate/).click();
    await expect(widget.panel.getByTestId('script-steps').last()).toBeVisible();
  });

  test('TC-12-01 three steps with descriptions and four action chips @T12 @design', async ({ widget }) => {
    const p = widget.panel;
    const steps = p.getByTestId('script-steps').last();
    await expect(steps.getByRole('listitem')).toHaveCount(3);
    await expect(steps.getByText(/Submit (an )?application/i)).toBeVisible();
    await expect(steps.getByText(/1.?3 business days/i)).toBeVisible();
    await expect(steps.getByText(/10%/)).toBeVisible();
    await expect(p.getByText(/IVY Beauty affiliate partner/).last()).toBeVisible();
    // Design order: Start over sits before End.
    await expect(p.getByRole('button', { name: CHIPS })).toHaveText(['Apply now', 'Learn more', 'Start over', 'End']);
  });

  test('TC-12-02 End asks for a 4-level rating with Skip @T12 @design', async ({ widget }) => {
    await widget.panel.getByRole('button', { name: /^End$/ }).last().click();
    await expect(widget.panel.getByText(/How was your chat today\?/)).toBeVisible();
    const csat = widget.panel.getByTestId('csat-card');
    await expect(csat).toBeVisible();
    await expect(csat.getByText('Please rate your satisfaction')).toBeVisible();
    for (const name of ['Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied', 'Skip']) {
      await expect(csat.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(csat.getByRole('button')).toHaveCount(5);
    // The ended mark waits for the answer (BR-13).
    await expect(widget.panel.getByText(/chat has ended/i)).toBeHidden();
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
    await expect(widget.panel.getByTestId('csat-card')).toBeHidden();
    expect(mocks!.callsTo('POST', '/chat/csat')).toHaveLength(0);
  });

  test('TC-12-05 Apply now opens the contact form filled in for an application @T12 @design', async ({ widget, mocks }) => {
    const p = widget.panel;
    await p.getByRole('button', { name: /^Apply now$/ }).last().click();
    await expect(p.getByText(/email you about the affiliate program/i)).toBeVisible();
    const form = p.getByTestId('contact-form').last();
    await expect(form.getByLabel('Message')).toHaveValue(/join your affiliate program/i);
    await form.getByLabel('Name').fill('Mia Kim');
    await form.getByRole('button', { name: 'Send Message' }).click();
    await expect.poll(() => mocks!.callsTo('POST', '/inquiries').length).toBe(1);
    expect(mocks!.callsTo('POST', '/inquiries')[0].body.message).toMatch(/affiliate program/i);
    await expect(p.getByTestId('inquiry-sent').last()).toBeVisible();
  });

  test('TC-12-06 Learn more answers below the steps, then Apply now · Start over · End @T12 @design', async ({ widget }) => {
    const p = widget.panel;
    await p.getByRole('button', { name: /^Learn more$/ }).last().click();
    const details = p.getByText(/referral link/i).last();
    await expect(details).toBeVisible();
    // In the thread where it was asked (BUG-024): below the steps it follows.
    const steps = p.getByTestId('script-steps').last();
    expect((await details.boundingBox())!.y).toBeGreaterThan((await steps.boundingBox())!.y);
    await expect(p.getByRole('button', { name: CHIPS })).toHaveText(['Apply now', 'Start over', 'End']);
  });
});
