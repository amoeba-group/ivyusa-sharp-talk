import { test, expect } from '../fixtures/widget';
import { CUSTOMER, SUPPORT_EMAIL } from '../fixtures/ivy-data';

/** T11 — Contact Support + contact form (SCR-IVY-13, G-17, G-18, BR-14, BR-15). */
test.describe('T11 · Contact Support & contact form', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.scenarioButton(/Contact Support/).click();
  });

  test('TC-11-01 shows the email channel only, with intake hours and reply time @T11 @design', async ({ widget }) => {
    const p = widget.panel;
    await expect(p.getByText(SUPPORT_EMAIL).last()).toBeVisible();
    await expect(p.getByText(/24.?(h|hour)/i).last()).toBeVisible();
    await expect(p.getByText(/1 business day/i).last()).toBeVisible();
    await expect(p.getByText('1588-0000')).toHaveCount(0);
  });

  test('TC-11-02 contact form has Name, Email (prefilled) and Message @T11 @design', async ({ widget }) => {
    await widget.panel.getByRole('button', { name: /Email inquiry/i }).last().click();
    const form = widget.panel.getByTestId('contact-form');
    await expect(form.getByLabel('Name')).toBeVisible();
    await expect(form.getByLabel('Email')).toHaveValue(CUSTOMER.email);
    await expect(form.getByLabel('Message')).toBeVisible();
  });

  test('TC-11-03 invalid input blocks sending @T11 @design', async ({ widget, mocks }) => {
    await widget.panel.getByRole('button', { name: /Email inquiry/i }).last().click();
    const form = widget.panel.getByTestId('contact-form');
    await form.getByLabel('Email').fill('not-an-email');
    await form.getByRole('button', { name: 'Send Message' }).click();
    await expect(form.getByText(/required|valid email/i).first()).toBeVisible();
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
    await expect(widget.panel.getByText(/YOUR INQUIRY/i)).toBeVisible();
    await expect(widget.panel.getByText('Your message has been sent successfully.')).toBeVisible();
  });
});
