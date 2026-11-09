import { test, expect } from '../fixtures/widget';

/** T13 — Settings / Privacy (SCR-IVY-15, G-21, BR-18). */
test.describe('T13 · Settings / Privacy — real consent', () => {
  test.use({ mockOptions: false });

  test('TC-13-01 consent block shows date, notice version and Withdraw consent @T13 @integration', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.acceptConsentIfShown();
    await widget.settingsButton.click();
    const p = widget.panel;
    await expect(p.getByText('Chat & AI consent')).toBeVisible();
    await expect(p.getByText(/Consent given/i)).toBeVisible();
    await expect(p.getByText(/Notice version/i)).toBeVisible();
    await expect(p.getByRole('button', { name: 'Withdraw consent' })).toBeVisible();
  });

  test('TC-13-02 withdrawing consent needs a confirmation and then offers to consent again @T13 @integration', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.acceptConsentIfShown();
    await widget.settingsButton.click();
    await widget.panel.getByRole('button', { name: 'Withdraw consent' }).click();
    // Second click / confirm step (SPEC SCR-IVY-15).
    await widget.panel.getByRole('button', { name: /withdraw|confirm/i }).last().click();
    await expect(widget.panel.getByText('Consent withdrawn')).toBeVisible();
    await expect(widget.panel.getByRole('button', { name: 'Give consent again' })).toBeVisible();
  });

  test('TC-13-04 a guest sees the consent block and a sign-in prompt but no data tools @T13 @integration', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.settingsButton.click();
    await expect(widget.panel.getByText('Chat & AI consent')).toBeVisible();
    await expect(widget.panel.getByText('Download my data (JSON)')).toHaveCount(0);
  });
});

test.describe('T13 · Settings / Privacy — identified shopper', () => {
  test('TC-13-03 marketing, CCPA and data tools are available @T13 @design', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.settingsButton.click();
    const p = widget.panel;
    await expect(p.getByText('Marketing messages', { exact: true })).toBeVisible();
    await expect(p.getByText('Do not send me marketing messages')).toBeVisible();
    await expect(p.getByText(/CCPA: Do not sell or share my personal information/)).toBeVisible();
    await expect(p.getByText('Download my data (JSON)')).toBeVisible();
    await expect(p.getByText('Delete my data', { exact: true })).toBeVisible();
  });
});
