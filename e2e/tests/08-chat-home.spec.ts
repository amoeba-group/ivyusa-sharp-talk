import { test, expect } from '../fixtures/widget';
import { IVY_QUICK_REPLIES } from '../fixtures/ivy-data';

/** T08 — Chat home: greeting, emoji quick replies, composer (SCR-IVY-10, G-12..G-14). */
test.describe('T08 · Chat home', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
  });

  test('TC-08-01 greeting bubble introduces IVY Beauty @T08 @design', async ({ widget }) => {
    await expect(widget.panel.getByText(/IVY Beauty/).first()).toBeVisible();
  });

  test('TC-08-02 seven quick replies with emoji, in design order @T08 @design', async ({ widget }) => {
    const buttons = widget.quickReplies.getByRole('button');
    await expect(buttons).toHaveCount(IVY_QUICK_REPLIES.length);
    const texts = (await buttons.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    IVY_QUICK_REPLIES.forEach((q, i) => {
      expect(texts[i]).toContain(q.emoji);
      expect(texts[i]).toContain(q.label);
    });
  });

  test('TC-08-03 quick replies are white outlined chips that wrap (not a 2-column grid) @T08 @design', async ({ widget }) => {
    const buttons = widget.quickReplies.getByRole('button');
    await expect(buttons.first()).toBeVisible();
    const style = await buttons.first().evaluate((e) => {
      const s = getComputedStyle(e);
      return { bg: s.backgroundColor, border: parseFloat(s.borderTopWidth) };
    });
    expect(style.bg).toBe('rgb(255, 255, 255)');
    expect(style.border).toBeGreaterThanOrEqual(1);
    const ys = await buttons.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    const perRow = Math.max(...Object.values(ys.reduce<Record<number, number>>((m, y) => ({ ...m, [y]: (m[y] ?? 0) + 1 }), {})));
    expect(perRow, 'at least three chips share a row').toBeGreaterThanOrEqual(3);
  });

  test('TC-08-04 composer says "Ask Anything" and Send is disabled while empty @T08 @design', async ({ widget }) => {
    await expect(widget.panel.getByPlaceholder('Ask Anything')).toBeVisible();
    await expect(widget.sendButton).toBeDisabled();
    await widget.panel.getByPlaceholder('Ask Anything').fill('Hello');
    await expect(widget.sendButton).toBeEnabled();
  });
});

test.describe('T08 · Chat round-trip (real API)', () => {
  test.use({ mockOptions: false });
  test('TC-08-05 a free-text question gets a bot reply @T08 @integration @smoke', async ({ page, widget }) => {
    await widget.goto();
    await widget.open();
    await widget.acceptConsentIfShown();
    const reply = page.waitForResponse((r) => r.url().endsWith('/chat/message') && r.request().method() === 'POST');
    await widget.composer.fill('What is your return policy?');
    await widget.sendButton.click();
    const res = await reply;
    expect(res.status()).toBeLessThan(300);
    await expect(widget.panel.getByText('What is your return policy?')).toBeVisible();
    const body = await res.json();
    if (body.data?.reply?.body) {
      await expect(widget.panel.getByText(body.data.reply.body.slice(0, 30), { exact: false })).toBeVisible();
    }
  });
});
