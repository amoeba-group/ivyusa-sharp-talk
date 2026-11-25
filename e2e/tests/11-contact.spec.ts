import { test, expect } from '../fixtures/widget';
import { CUSTOMER } from '../fixtures/ivy-data';

/**
 * T11 — Contact Support + contact form (SCR-IVY-13, G-17, G-18, BR-14, BR-15,
 * Figma 1006:5650 → 1006:6529 → 1006:6597).
 *
 * The channels are the tenant's own settings (seeded for IVY: the support email
 * only, PLN-261112-IVY-T11 §8-2a/3a); `contact` in the mock options overrides them.
 */
test.describe('T11 · Contact Support & contact form', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.scenarioButton(/Contact Support/).click();
  });

  test('TC-11-01 email is the only channel, so Contact Support opens the form directly (PRD v1 C-01) @T11 @design', async ({ widget }) => {
    const p = widget.panel;
    await expect(p.getByTestId('contact-form')).toBeVisible();
    // No card to pick the one channel from.
    await expect(p.getByTestId('contact-support')).toHaveCount(0);
    // BUG-010: IVY's old values were hardcoded for every tenant.
    await expect(p.getByText('1588-0000')).toHaveCount(0);
    await expect(p.getByText('help@ivy.com')).toHaveCount(0);
  });

  test('TC-11-02 contact form has Name, Email (prefilled) and Message @T11 @design', async ({ widget }) => {
    await expect(widget.panel.getByText('Please enter your contact information and tell us how we can help.')).toBeVisible();
    const form = widget.panel.getByTestId('contact-form');
    await expect(form.getByLabel('Name')).toBeVisible();
    await expect(form.getByLabel('Email')).toHaveValue(CUSTOMER.email);
    await expect(form.getByLabel('Message')).toBeVisible();
    await expect(form.getByLabel('Message')).toHaveAttribute('placeholder', 'Please describe how we can help you');
  });

  test('TC-11-03 invalid input blocks sending @T11 @design', async ({ widget, mocks }) => {
    const form = widget.panel.getByTestId('contact-form');
    await form.getByLabel('Name').fill('');
    await form.getByLabel('Email').fill('not-an-email');
    await form.getByRole('button', { name: 'Send Message' }).click();
    await expect(form.getByText(/required|valid email/i).first()).toBeVisible();
    await expect(form.getByText('Enter a valid email address.')).toBeVisible();
    await expect(form.getByText('Message is required.')).toBeVisible();
    expect(mocks!.callsTo('POST', '/inquiries')).toHaveLength(0);
  });

  test('TC-11-04 sending creates an inquiry and confirms it in the thread @T11 @design', async ({ widget, mocks }) => {
    const form = widget.panel.getByTestId('contact-form');
    await form.getByLabel('Name').fill('test');
    await form.getByLabel('Message').fill('dfdfdf');
    await form.getByRole('button', { name: 'Send Message' }).click();
    await expect.poll(() => mocks!.callsTo('POST', '/inquiries').length).toBe(1);
    const body = mocks!.callsTo('POST', '/inquiries')[0].body;
    expect(body).toMatchObject({ name: 'test', email: CUSTOMER.email, message: 'dfdfdf' });
    const sent = widget.panel.getByTestId('inquiry-sent');
    // The card's title (CSS upper-cases it, as in the design). Exact: the
    // confirmation below also says "…review your inquiry…".
    await expect(sent.getByText(/^your inquiry$/i)).toBeVisible();
    await expect(sent).toContainText('test');
    await expect(sent).toContainText(CUSTOMER.email);
    await expect(sent).toContainText('dfdfdf');
    await expect(widget.panel.getByText('Your message has been sent successfully.')).toBeVisible();
    await expect(widget.panel.getByText('Please check your inbox for our response.')).toBeVisible();
    // The form gives way to the card.
    await expect(widget.panel.getByTestId('contact-form')).toHaveCount(0);
  });
});

test.describe('T11 · send failure', () => {
  test.use({ mockOptions: { failures: { 'POST /inquiries': 500 } } });
  test('TC-11-06 a failed send says so and keeps what was typed @T11 @design', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.scenarioButton(/Contact Support/).click();
    const form = widget.panel.getByTestId('contact-form');
    await form.getByLabel('Name').fill('test');
    await form.getByLabel('Message').fill('Where is my order?');
    await form.getByRole('button', { name: 'Send Message' }).click();
    await expect(widget.page.getByRole('alert')).toContainText("Your message couldn't be sent");
    await expect(form.getByLabel('Message')).toHaveValue('Where is my order?');
    await expect(widget.panel.getByTestId('inquiry-sent')).toHaveCount(0);
  });
});

test.describe('T11 · tenant channels', () => {
  test.describe('live chat on', () => {
    test.use({ mockOptions: { contact: { contactLiveChat: true } } });
    test('TC-11-05 a tenant can add the live chat card beside email @T11 @design', async ({ widget }) => {
      await widget.goto();
      await widget.open();
      await widget.openChat();
      await widget.scenarioButton(/Contact Support/).click();
      const answer = widget.panel.getByTestId('contact-support').last();
      await expect(answer.getByRole('button', { name: /Email inquiry/ })).toBeVisible();
      await expect(answer.getByRole('button', { name: /Chat with an agent/ })).toBeVisible();
    });
  });

  test.describe('nothing configured', () => {
    test.use({ mockOptions: { contact: { supportEmail: null, supportPhone: null, contactLiveChat: false } } });
    test('TC-11-07 a tenant with no channels gets the live chat card, never another shop\'s values @T11 @design', async ({ widget }) => {
      await widget.goto();
      await widget.open();
      await widget.openChat();
      await widget.scenarioButton(/Contact Support/).click();
      const answer = widget.panel.getByTestId('contact-support').last();
      await expect(answer.getByRole('button', { name: /Chat with an agent/ })).toBeVisible();
      await expect(answer.getByRole('button', { name: /Email inquiry/ })).toHaveCount(0);
      await expect(widget.panel.getByText(/1588-0000|help@ivy\.com|hello@ivyusa\.com/)).toHaveCount(0);
    });
  });
});

test.describe('T11 · contact form against the real API', () => {
  test.use({ mockOptions: false });
  test('TC-11-08 a guest sends the form and the API accepts it @T11 @integration', async ({ widget, page }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.acceptConsent();
    await widget.scenarioButton(/Contact Support/).click();
    const form = widget.panel.getByTestId('contact-form');
    // A guest: nothing to prefill.
    await expect(form.getByLabel('Email')).toHaveValue('');
    await form.getByLabel('Name').fill('E2E Guest');
    await form.getByLabel('Email').fill(`t11-e2e-${Date.now()}@example.com`);
    await form.getByLabel('Message').fill('Do you ship to Hawaii?');
    const sent = page.waitForResponse((r) => r.url().includes('/inquiries') && r.request().method() === 'POST');
    await form.getByRole('button', { name: 'Send Message' }).click();
    expect((await sent).status()).toBe(201);
    await expect(widget.panel.getByText('Your message has been sent successfully.')).toBeVisible();
  });
});

/**
 * PLN-261119 chat continuity: the Contact Support card is the widget's own, not
 * a stored message. A storefront page change reloads the widget, and the card
 * used to be gone while the messages around it came back.
 */
test.describe('T11 · the card survives a page change', () => {
  test('TC-11-07 Contact Support is still in the thread after the page reloads @T11', async ({ page, widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.scenarioButton(/Contact Support/).click();
    await expect(widget.panel.getByTestId('contact-form').last()).toBeVisible();

    await page.reload();
    await widget.open();
    await widget.openChat();
    await expect(widget.panel.getByTestId('contact-form').last()).toBeVisible();
    // Brought back once, not once per render.
    await expect(widget.panel.getByTestId('contact-form')).toHaveCount(1);
  });
});

/** IVY PRD v1 C-01 / E-01 (PLN-261125 §2.5–2.6): Payment check, Delivery inquiry, Feedback, the order on the form. */
test.describe('T11 · PRD v1 quick menu cards', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
  });

  test('TC-11-09 Payment check shows the latest order with its payment status, then Contact Support carries the order @T11', async ({ widget, mocks }) => {
    await widget.scenarioButton(/Payment check/).click();
    const answer = widget.panel.getByTestId('payment-answer');
    const card = answer.getByTestId('payment-card');
    await expect(card).toContainText('IVY-39891');
    await expect(card).toHaveAttribute('data-state', 'paid');
    await expect(card).toContainText('Paid');
    await expect(answer.getByText(/Your payment for IVY-39891 went through/)).toBeVisible();

    await answer.getByRole('button', { name: 'Contact Support', exact: true }).click();
    const form = widget.panel.getByTestId('contact-form').last();
    await expect(form.getByTestId('contact-form-order')).toHaveText('Order IVY-39891');
    await form.getByLabel('Name').fill('Kiho');
    await form.getByLabel('Message').fill('I was charged twice.');
    await form.getByRole('button', { name: 'Send Message' }).click();
    await expect.poll(() => mocks!.callsTo('POST', '/inquiries').length).toBe(1);
    expect(mocks!.callsTo('POST', '/inquiries')[0].body).toMatchObject({ order_id: '39891', message: 'I was charged twice.' });
  });

  test('TC-11-10 Delivery inquiry shows the tracker of the order on its way @T11', async ({ widget }) => {
    await widget.scenarioButton(/Delivery inquiry/).click();
    const answer = widget.panel.getByTestId('delivery-answer');
    await expect(answer.getByTestId('delivery-card')).toContainText('IVY-39641');
    await expect(answer.getByText('IVY-39641 is on its way.')).toBeVisible();
    for (const chip of ['Shipping policy', 'Contact Support', 'Start over']) {
      await expect(answer.getByRole('button', { name: chip, exact: true })).toBeVisible();
    }
  });

  test('TC-11-11 Feedback takes a message only and files it as feedback @T11', async ({ widget, mocks }) => {
    await widget.scenarioButton(/Feedback/).click();
    const answer = widget.panel.getByTestId('feedback-answer');
    await answer.getByRole('button', { name: 'Send feedback' }).click();
    await expect(answer.getByText('Write a few words first.')).toBeVisible();
    expect(mocks!.callsTo('POST', '/inquiries')).toHaveLength(0);
    await answer.getByRole('textbox').fill('Love the new serum!');
    await answer.getByRole('button', { name: 'Send feedback' }).click();
    await expect.poll(() => mocks!.callsTo('POST', '/inquiries').length).toBe(1);
    expect(mocks!.callsTo('POST', '/inquiries')[0].body).toMatchObject({ kind: 'feedback', message: 'Love the new serum!' });
    await expect(answer.getByTestId('feedback-sent')).toContainText('Love the new serum!');
    await expect(answer.getByText('Thank you — your feedback reached our team.')).toBeVisible();
    await expect(answer.getByTestId('feedback-form')).toHaveCount(0);
  });

  test('TC-11-12 "Email us about this order" in Order Detail opens the form with that order @T11', async ({ widget }) => {
    await widget.openNotifications();
    await widget.notifItems.filter({ hasText: 'IVY-39891' }).first().click();
    await widget.panel.getByRole('button', { name: 'Email us about this order' }).click();
    await expect(widget.tab('Chat')).toHaveAttribute('aria-selected', 'true');
    const form = widget.panel.getByRole('tabpanel').getByTestId('contact-form').last();
    await expect(form.getByTestId('contact-form-order')).toHaveText('Order IVY-39891');
  });
});
