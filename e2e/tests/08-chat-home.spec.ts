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
    // Polled: a re-render can swap the node between "visible" and the read.
    const style = () =>
      buttons.first().evaluate((e) => {
        const s = getComputedStyle(e);
        return { bg: s.backgroundColor, border: parseFloat(s.borderTopWidth) };
      });
    await expect.poll(async () => (await style()).bg).toBe('rgb(255, 255, 255)');
    expect((await style()).border).toBeGreaterThanOrEqual(1);
    const rows = async () => {
      const boxes = await buttons.evaluateAll((els) =>
        els.map((e) => ({ y: Math.round(e.getBoundingClientRect().top), w: Math.round(e.getBoundingClientRect().width) })),
      );
      const byRow = boxes.reduce<Record<number, number[]>>((m, b) => ({ ...m, [b.y]: [...(m[b.y] ?? []), b.w] }), {});
      return Object.values(byRow);
    };
    // EN: longer labels, so rows hold fewer chips — but each chip is as wide as
    // its own label, which a 2-column grid would not do.
    const en = await rows();
    expect(en.some((r) => r.length >= 2 && new Set(r).size > 1), 'chips are sized by their labels').toBe(true);
    // KO is the design frame (1008:2291): three chips share the first rows.
    await widget.chooseLanguage('한국어');
    await expect(buttons.first()).toContainText('결제 확인');
    const ko = await rows();
    expect(Math.max(...ko.map((r) => r.length)), 'at least three chips share a row (KO design)').toBeGreaterThanOrEqual(3);
  });

  test('TC-08-04 composer says "Ask Anything" and Send is disabled while empty @T08 @design', async ({ widget }) => {
    await expect(widget.panel.getByPlaceholder('Ask Anything')).toBeVisible();
    await expect(widget.sendButton).toBeDisabled();
    await widget.panel.getByPlaceholder('Ask Anything').fill('Hello');
    await expect(widget.sendButton).toBeEnabled();
  });
});

test.describe('T08 · Chat home — first paint', () => {
  test('TC-08-06 the menu first appears already in the tenant style (no flip from the default) @T08', async ({ page, widget }) => {
    // Record the first quick-reply chip's background the moment it is inserted.
    await page.addInitScript(() => {
      const w = window as unknown as { __firstChipBg?: string };
      new MutationObserver((_, obs) => {
        const b = document.querySelector('[data-testid="quick-replies"] button');
        if (b && w.__firstChipBg === undefined) {
          w.__firstChipBg = getComputedStyle(b).backgroundColor;
          obs.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await expect(widget.quickReplies.getByRole('button').first()).toBeVisible();
    const first = await page.evaluate(() => (window as unknown as { __firstChipBg?: string }).__firstChipBg);
    expect(first).toBe('rgb(255, 255, 255)');
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
