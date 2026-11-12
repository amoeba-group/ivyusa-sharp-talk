import { test, expect } from '../fixtures/widget';
import { CUSTOMER, SUPPORT_EMAIL } from '../fixtures/ivy-data';

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

  test('TC-11-01 shows the email channel only, with intake hours and reply time @T11 @design', async ({ widget }) => {
    const p = widget.panel;
    const answer = p.getByTestId('contact-support').last();
    await expect(answer.getByText("Please choose how you'd like to reach us.")).toBeVisible();
    await expect(p.getByText(SUPPORT_EMAIL).last()).toBeVisible();
    await expect(p.getByText(/24.?(h|hour)/i).last()).toBeVisible();
    await expect(p.getByText(/1 business day/i).last()).toBeVisible();
    // BUG-010: IVY's old values were hardcoded for every tenant.
    await expect(p.getByText('1588-0000')).toHaveCount(0);
    await expect(p.getByText('help@ivy.com')).toHaveCount(0);
    // The design has one card (§8-3a): no phone, no live chat.
    await expect(answer.getByRole('button', { name: /Chat with an agent/ })).toHaveCount(0);
    await expect(answer.getByRole('button', { name: 'Start over', exact: true })).toBeVisible();
  });

  test('TC-11-02 contact form has Name, Email (prefilled) and Message @T11 @design', async ({ widget }) => {
    await widget.panel.getByRole('button', { name: /Email inquiry/i }).last().click();
    await expect(widget.panel.getByText('Please enter your contact information and tell us how we can help.')).toBeVisible();
    const form = widget.panel.getByTestId('contact-form');
    await expect(form.getByLabel('Name')).toBeVisible();
    await expect(form.getByLabel('Email')).toHaveValue(CUSTOMER.email);
    await expect(form.getByLabel('Message')).toBeVisible();
    await expect(form.getByLabel('Message')).toHaveAttribute('placeholder', 'Please describe how we can help you');
  });

  test('TC-11-03 invalid input blocks sending @T11 @design', async ({ widget, mocks }) => {
    await widget.panel.getByRole('button', { name: /Email inquiry/i }).last().click();
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
    await widget.panel.getByRole('button', { name: /Email inquiry/i }).last().click();
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
    await widget.panel.getByRole('button', { name: /Email inquiry/i }).last().click();
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
    await expect(widget.panel.getByText(SUPPORT_EMAIL).last()).toBeVisible();
    await widget.panel.getByRole('button', { name: /Email inquiry/i }).last().click();
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
