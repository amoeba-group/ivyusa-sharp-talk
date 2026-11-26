import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/widget';
import { PRODUCT_CATEGORIES } from '../fixtures/ivy-data';

/**
 * T10 — Product Help scenario (SCR-IVY-12, Figma 1006:5588, G-16, BR-17).
 *
 * Product inquiry answers in the thread (PLN-261112-T10 D1): the shopper's pick,
 * "What do you need help with?", and topic chips that stay on screen with the
 * picked one outlined. Popular products → the tenant's store categories (D2) →
 * a category's best sellers, read live from the store (D3).
 */
test.describe('T10 · Chat scenario — Product Help', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.scenarioButton(/Product inquiry/).click();
  });

  test('TC-10-01 sub-menu: usage · ingredients · exchange/return · restock alert · start over @T10 @design', async ({ widget }) => {
    const help = widget.panel.getByTestId('product-help');
    await expect(help.locator('.st-message-user')).toHaveText('Product inquiry');
    await expect(help.getByText('What do you need help with?')).toBeVisible();
    for (const name of [/Usage|How to use/, /Ingredients/, /Exchange.*Return/, /Restock alert/, /^Start over$/, /^Popular products$/]) {
      await expect(help.getByRole('button', { name })).toBeVisible();
    }
    // In the thread now: the opening menu stays where it was instead of turning into the submenu.
    await expect(widget.panel.getByTestId('quick-replies')).toBeVisible();
  });

  test('TC-10-02 shows the 11 product categories @T10 @design', async ({ widget }) => {
    await widget.panel.getByTestId('product-help').getByRole('button', { name: 'Popular products' }).click();
    const picker = widget.panel.getByTestId('product-categories');
    await expect(picker.locator('.st-message-user')).toHaveText('Popular products');
    for (const c of PRODUCT_CATEGORIES) {
      await expect(picker.getByRole('button', { name: c, exact: true })).toBeVisible();
    }
    await expect(picker.getByRole('button', { name: /^Start over$/ })).toBeVisible();
  });

  test('TC-10-03 a category leads to Popular products @T10 @design', async ({ widget, mocks }) => {
    await widget.panel.getByTestId('product-help').getByRole('button', { name: 'Popular products' }).click();
    await widget.panel.getByTestId('product-categories').getByRole('button', { name: 'Nails', exact: true }).click();
    const answer = widget.panel.getByTestId('popular-products');
    await expect(answer.getByText('Here are our most popular Nails products')).toBeVisible();
    await expect(answer.getByText('Gel Polish Starter Set')).toBeVisible();
    const card = answer.getByTestId('product-card').first();
    await expect(card).toHaveAttribute('href', 'https://ivyusa.com/products/gel-polish-set');
    await expect(card).toHaveAttribute('target', '_blank');
    await expect(answer.getByRole('link', { name: /See all Nails on ivyusa\.com/ })).toHaveAttribute(
      'href',
      'https://ivyusa.com/collections/nails?sort_by=best-selling',
    );
    await expect(answer.getByRole('button', { name: 'Other categories' })).toBeVisible();
    const calls = mocks!.callsTo('GET', '/products/popular');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].query.get('category')).toBe('nails');
  });

  test('TC-10-07 picked chips stay outlined; Other categories asks again below @T10 @design', async ({ widget }) => {
    const help = widget.panel.getByTestId('product-help');
    await help.getByRole('button', { name: 'Popular products' }).click();
    await expect(help.getByRole('button', { name: 'Popular products' })).toHaveAttribute('aria-pressed', 'true');
    await expect(help.getByRole('button', { name: 'Ingredients' })).toHaveAttribute('aria-pressed', 'false');

    await widget.panel.getByTestId('product-categories').getByRole('button', { name: 'Nails', exact: true }).click();
    await expect(
      widget.panel.getByTestId('product-categories').getByRole('button', { name: 'Nails', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');

    await widget.panel.getByTestId('popular-products').getByRole('button', { name: 'Other categories' }).click();
    // A second picker below the products, not the first one re-used.
    await expect(widget.panel.getByTestId('product-categories')).toHaveCount(2);
    await expect(widget.panel.getByTestId('product-categories').last().locator('.st-message-user')).toHaveText('Other categories');
  });
});

test.describe('T10 · Popular products when the store cannot answer', () => {
  test.use({ mockOptions: { popular: 'unavailable' } });

  test('TC-10-06 says so and offers the collection on the store @T10 @design', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.scenarioButton(/Product inquiry/).click();
    await widget.panel.getByTestId('product-help').getByRole('button', { name: 'Popular products' }).click();
    await widget.panel.getByTestId('product-categories').getByRole('button', { name: 'Lashes', exact: true }).click();
    const answer = widget.panel.getByTestId('popular-products');
    await expect(answer.getByText("I couldn't load the popular Lashes products right now.")).toBeVisible();
    await expect(answer.getByTestId('product-card')).toHaveCount(0);
    await expect(answer.getByRole('link', { name: /See all Lashes on ivyusa\.com/ })).toHaveAttribute(
      'href',
      'https://ivyusa.com/collections/lashes?sort_by=best-selling',
    );
  });
});

test.describe('T10 · Exchange / Return (real script)', () => {
  // Real consent, so the real API runs the script (TC-09-05 lesson): with
  // consent only patched into the widget's view, the server refuses it.
  test.use({ mockOptions: { consent: 'pending' } });

  test('TC-10-04 Exchange / Return explains the return policy with the design chips @T10 @design', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.acceptConsent();
    await widget.scenarioButton(/Product inquiry/).click();
    await widget.panel.getByTestId('product-help').getByRole('button', { name: /Exchange.*Return/ }).click();
    // The shopper's bubble is the chip, as in the design.
    await expect(widget.panel.locator('.st-message-user').last()).toHaveText('Exchange / Return');
    // IVY's copy (seeded tenant override, ivyusa.com refund policy — T10 §8-3a).
    await expect(widget.panel.getByText(/10 days/).last()).toBeVisible({ timeout: 15_000 });
    await expect(widget.panel.getByText(/unopened/i).last()).toBeVisible();
    for (const name of ['Track delivery', 'Cancel order', 'Start over']) {
      await expect(widget.panel.getByRole('button', { name, exact: true }).last()).toBeVisible();
    }
  });
});

/**
 * PLN-261126 (IVY PRD v1 slide 14, 17, A-04) — a typed product question: the
 * answer is written from the store's live stock and price, and the products it
 * is about show once, as cards. `/chat/message` and `/chat/conversation` are
 * mocked: under test is what the widget shows for a reply that carries
 * products, not what the model writes.
 */
test.describe('T10 · Typed product question — product cards', () => {
  const ok = (data: unknown) => ({ success: true, data, timestamp: new Date().toISOString() });
  const QUESTION = 'Is KISS Gel Fantasy Nails in stock?';
  const ANSWER = 'Yes, KISS Gel Fantasy Nails is in stock at $9.99. The imPRESS Press-on Manicure is sold out right now.';
  const PRODUCTS = [
    {
      handle: 'kiss-gel-fantasy',
      title: 'KISS Gel Fantasy Nails',
      imageUrl: null,
      price: 9.99,
      currency: 'USD',
      productUrl: 'https://ivyusa.com/products/kiss-gel-fantasy',
      inStock: true,
    },
    {
      handle: 'impress-press-on',
      title: 'imPRESS Press-on Manicure',
      imageUrl: null,
      price: 9.99,
      currency: 'USD',
      productUrl: 'https://ivyusa.com/products/impress-press-on',
      inStock: false,
    },
  ];

  /** The send answers with the cards; the thread serves the stored turn with them. */
  async function mockChat(page: Page, opts: { alreadyAnswered?: boolean } = {}) {
    const state = { sent: !!opts.alreadyAnswered, pollsAfterSend: 0 };
    await page.route('**/api/v1/chat/message', (route) => {
      state.sent = true;
      return route.fulfill({
        json: ok({
          conversationId: '8801',
          reply: { senderType: 'ai', body: ANSWER, citations: [], products: PRODUCTS, messageId: '8803' },
          escalate: false,
          needsAuth: false,
        }),
      });
    });
    await page.route('**/api/v1/chat/conversation**', (route) => {
      const after = new URL(route.request().url()).searchParams.get('after_id');
      if (state.sent) state.pollsAfterSend++;
      const at = new Date(Date.now() - 60_000).toISOString();
      const rows = state.sent
        ? [
            { id: '8802', senderType: 'user', senderName: null, body: QUESTION, createdAt: at, attachments: [] },
            { id: '8803', senderType: 'ai', senderName: null, body: ANSWER, createdAt: at, attachments: [], products: PRODUCTS },
          ].filter((m) => after == null || Number(m.id) > Number(after))
        : [];
      return route.fulfill({
        json: ok({ conversationId: state.sent ? '8801' : null, status: 'ai_active', csatRating: null, canRate: false, messages: rows }),
      });
    });
    return state;
  }

  test('TC-10-08 the answer shows the products it is about as cards: stock, price, link @T10', async ({ widget, page }) => {
    const state = await mockChat(page);
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await widget.composer.fill(QUESTION);
    await widget.sendButton.click();

    await expect(widget.panel.getByText(ANSWER)).toBeVisible();
    const cards = widget.panel.getByTestId('answer-product');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toHaveAttribute('href', 'https://ivyusa.com/products/kiss-gel-fantasy');
    await expect(cards.nth(0)).toHaveAttribute('target', '_blank');
    await expect(cards.nth(0)).toHaveAttribute('data-in-stock', 'true');
    await expect(cards.nth(0)).toContainText('KISS Gel Fantasy Nails');
    await expect(cards.nth(0)).toContainText('In stock');
    await expect(cards.nth(0)).toContainText('$9.99');
    // A sold-out product the shopper asked about keeps its card (PLN D2).
    await expect(cards.nth(1)).toHaveAttribute('data-in-stock', 'false');
    await expect(cards.nth(1)).toContainText('Out of stock');

    // The next poll swaps the stored turn in for the local bubble: the cards stay.
    await expect.poll(() => state.pollsAfterSend, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(cards).toHaveCount(2);
  });

  test('TC-10-09 the cards come back with the thread after a reload @T10', async ({ widget, page }) => {
    await mockChat(page, { alreadyAnswered: true });
    await widget.goto();
    await widget.open();
    await widget.openChat();
    await expect(widget.panel.getByText(ANSWER)).toBeVisible();
    await expect(widget.panel.getByTestId('answer-product')).toHaveCount(2);
    await expect(widget.panel.getByTestId('answer-product').first()).toHaveAttribute('data-in-stock', 'true');
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
