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

  test('TC-13-05 Withdraw consent is a red-outlined button with the design wording @T13 @design', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.settingsButton.click();
    const p = widget.panel;
    const withdraw = p.getByRole('button', { name: 'Withdraw consent' });
    await expect(withdraw).toBeVisible();
    // Outline and text share the error red (Figma 1004:1367), not the old grey outline.
    const look = await withdraw.evaluate((e) => {
      const s = getComputedStyle(e);
      return { border: s.borderTopColor, color: s.color, width: parseFloat(s.borderTopWidth) };
    });
    expect(look.width).toBeGreaterThanOrEqual(1);
    expect(look.border).toBe(look.color);
    expect(look.border).not.toBe('rgb(229, 231, 235)');
    await expect(p.getByText('If you withdraw, chat and AI processing stops immediately.')).toBeVisible();
    // The header keeps the greeting and its buttons on this screen, as designed.
    await expect(widget.headerTitle).toHaveText(/Hi, Kiho/);
    await expect(widget.settingsButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('TC-13-06 marketing and CCPA switches are named, 44×24, and saving says so @T13 @a11y', async ({ widget, mocks }) => {
    await widget.goto();
    await widget.open();
    await widget.settingsButton.click();
    const p = widget.panel;
    const marketing = p.getByRole('switch', { name: 'Do not send me marketing messages' });
    const ccpa = p.getByRole('switch', { name: 'CCPA: Do not sell or share my personal information' });
    await expect(marketing).toHaveAttribute('aria-checked', 'false');
    await expect(ccpa).toHaveAttribute('aria-checked', 'false');
    const box = await marketing.boundingBox();
    expect(Math.round(box!.width)).toBe(44);
    expect(Math.round(box!.height)).toBe(24);
    await marketing.click();
    await expect(p.getByText('Preference saved.')).toBeVisible();
    const put = mocks!.callsTo('PUT', '/notifications/marketing-opt-out');
    expect(put).toHaveLength(1);
    expect(put[0].body.opt_out).toBe(true);
  });
});
