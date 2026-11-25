import { CardNoteService } from './card-note.service';

/** AI line next to a data card (IVY PRD v1 C-02, PLN-261125-Phase5 §1.2). */
describe('CardNoteService', () => {
  const SESSION = { id: 5, tenantId: 7, customerId: 500, language: 'EN', channel: 'widget' };
  const ORDER = { id: 42, tenantId: 7, customerId: 500, orderNumber: 'IVY-1042', statusInternal: 'preparing', statusUi: 'Confirmed', total: 42, currency: 'USD' };

  function build(opts: {
    consent?: string;
    provider?: string;
    text?: string;
    order?: Record<string, unknown> | null;
    blocked?: boolean;
    products?: Array<Record<string, unknown>>;
    fulfillment?: Record<string, unknown> | null;
    popular?: Record<string, unknown> | null;
  }) {
    const sessionService = {
      findByToken: jest.fn(async () => ({ ...SESSION })),
      effectiveConsentFor: jest.fn(async () => opts.consent ?? 'granted'),
    };
    const orderRepo = { findOne: jest.fn(async () => (opts.order === undefined ? { ...ORDER } : opts.order)) };
    const itemRepo = { find: jest.fn(async () => [{ id: 1, title: 'Gel Polish Set' }, { id: 2, title: 'Top Coat' }]) };
    const fulfillRepo = { findOne: jest.fn(async () => opts.fulfillment ?? null) };
    const moderation = {
      moderate: jest.fn(async (i: { text: string }) => ({ decision: opts.blocked ? 'blocked' : 'delivered', text: i.text })),
    };
    const products = { stockSearch: jest.fn(async () => ({ available: true, products: opts.products ?? [] })) };
    const ai = {
      resolveRouting: jest.fn(async () => ({ engine: { provider: opts.provider ?? 'bedrock' } })),
      complete: jest.fn(async () => ({ text: opts.text ?? 'Your payment of $42 for IVY-1042 went through. We are preparing your order.', provider: opts.provider ?? 'bedrock', tokensIn: 1, tokensOut: 1, model: 'haiku' })),
    };
    const redis = { get: jest.fn(async () => null), set: jest.fn(async () => undefined) };
    const popular = { popularForSession: jest.fn(async () => opts.popular ?? { available: false, products: [], collectionUrl: null }) };
    const svc = new CardNoteService(
      orderRepo as never,
      itemRepo as never,
      fulfillRepo as never,
      sessionService as never,
      moderation as never,
      products as never,
      ai as never,
      redis as never,
      popular as never,
    );
    return { svc, ai, moderation, orderRepo, products, redis, popular };
  }

  const req = (extra: Record<string, unknown>) => ({ session_token: 't', ...extra }) as never;

  it('writes the payment line from our own order data', async () => {
    const h = build({});
    const r = await h.svc.note(req({ kind: 'payment', order_id: '42' }));
    expect(r.text).toBe('Your payment of $42 for IVY-1042 went through. We are preparing your order.');
    const facts = (h.ai.complete.mock.calls[0][0] as unknown as { messages: Array<{ content: string }> }).messages[0].content;
    expect(facts).toContain('Order: IVY-1042');
    expect(facts).toContain('Items: Gel Polish Set and 1 more item');
    expect(facts).toContain('Total: 42.00 USD');
    expect(facts).toContain('Payment: paid');
    expect(facts).toContain('Delivery: being prepared');
    // Tenant-scoped order read.
    expect(h.orderRepo.findOne).toHaveBeenCalledWith({ where: { id: 42, tenantId: 7 } });
  });

  it('no note without chat & AI consent, and nothing is sent to the model', async () => {
    const h = build({ consent: 'withdrawn' });
    expect(await h.svc.note(req({ kind: 'payment', order_id: '42' }))).toEqual({ text: null });
    expect(h.ai.complete).not.toHaveBeenCalled();
  });

  it('no note while the chat function is on the Stub', async () => {
    const h = build({ provider: 'stub' });
    expect(await h.svc.note(req({ kind: 'payment', order_id: '42' }))).toEqual({ text: null });
    expect(h.ai.complete).not.toHaveBeenCalled();
  });

  it('no note for an order that is not the session customer’s', async () => {
    const h = build({ order: { ...ORDER, customerId: 999 } });
    expect(await h.svc.note(req({ kind: 'delivery', order_id: '42' }))).toEqual({ text: null });
    expect(h.ai.complete).not.toHaveBeenCalled();
  });

  it('refuses a line with a number the card does not have, and a blocked line', async () => {
    expect(await build({ text: 'It will arrive in 3 days.' }).svc.note(req({ kind: 'payment', order_id: '42' }))).toEqual({ text: null });
    expect(await build({ blocked: true }).svc.note(req({ kind: 'payment', order_id: '42' }))).toEqual({ text: null });
  });

  it('delivery facts say the stage, the carrier and whether tracking is on the card', async () => {
    const h = build({
      order: { ...ORDER, statusInternal: 'shipping', statusUi: 'In Transit' },
      fulfillment: { carrier: 'UPS', trackingNumber: '1Z999' },
      text: 'Your order IVY-1042 is on its way with UPS — follow it from the card.',
    });
    const r = await h.svc.note(req({ kind: 'delivery', order_id: '42' }));
    expect(r.text).toMatch(/UPS/);
    const facts = (h.ai.complete.mock.calls[0][0] as unknown as { messages: Array<{ content: string }> }).messages[0].content;
    expect(facts).toContain('Delivery: on the way');
    expect(facts).toContain('Carrier: UPS');
    expect(facts).toContain('Tracking link: available on the card');
  });

  it('popular: introduces the same (at most three) products the cards show', async () => {
    const h = build({
      popular: {
        available: true,
        mode: 'admin',
        collectionUrl: null,
        products: [
          { handle: 'a', title: 'imPRESS Press-On Nails', vendor: 'KISS', price: 9.99, currency: 'USD' },
          { handle: 'b', title: 'Gel Fantasy Nails', vendor: 'KISS', price: 12.5, currency: 'USD' },
          { handle: 'c', title: 'Gel Pro Top Coat', vendor: null, price: null, currency: null },
          { handle: 'd', title: 'Fourth', vendor: null, price: 1, currency: 'USD' },
        ],
      },
      text: 'Our team picked these nail favorites for you — easy to apply and long-lasting.',
    });
    const r = await h.svc.note(req({ kind: 'popular', category: 'nails' }));
    expect(r.text).toMatch(/nail favorites/);
    expect(h.popular.popularForSession).toHaveBeenCalledWith('t', 'nails');
    const call = h.ai.complete.mock.calls[0][0] as unknown as { system: string; messages: Array<{ content: string }> };
    const facts = call.messages[0].content;
    expect(facts).toContain('Picked: chosen by the store');
    expect(facts).toContain('1. imPRESS Press-On Nails (KISS) — 9.99 USD');
    expect(facts).toContain('3. Gel Pro Top Coat');
    expect(facts).not.toContain('Fourth');
    expect(call.system).toMatch(/without repeating their prices/);
    // Nothing on screen, nothing to say.
    expect(await build({}).svc.note(req({ kind: 'popular', category: 'nails' }))).toEqual({ text: null });
  });

  it('stock facts come from the same search the widget ran', async () => {
    const h = build({
      products: [{ handle: 'gel-set', title: 'Gel Polish Starter Set', vendor: 'KISS', price: 24.99, currency: 'USD', available: false }],
      text: 'The Gel Polish Starter Set is out of stock right now.',
    });
    const r = await h.svc.note(req({ kind: 'stock', product_handle: 'gel-set', q: 'gel' }));
    expect(r.text).toMatch(/out of stock/);
    expect(h.products.stockSearch).toHaveBeenCalledWith(7, 'gel');
    const facts = (h.ai.complete.mock.calls[0][0] as unknown as { messages: Array<{ content: string }> }).messages[0].content;
    expect(facts).toContain('Stock: out of stock');
    expect(facts).toContain('Price: 24.99 USD');
    // A product that is not in the shopper's results gets no note.
    expect(await build({ products: [] }).svc.note(req({ kind: 'stock', product_handle: 'gel-set', q: 'gel' }))).toEqual({ text: null });
  });
});
