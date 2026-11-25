import { cleanModelText, keepsFacts, onlyKnownNumbers, wordingFacts } from './ai-wording';

/** Fact guard for AI wording (IVY PRD v1 C-02, PLN-261125-Phase5 §1.1). */
describe('ai-wording — keepsFacts', () => {
  const RETURNS =
    'Returns are accepted within 10 days of delivery for items bought on ivyusa.com. To start a return, sign in at ' +
    '[your account](https://account.ivyusa.com/orders) and select "Request return". Return shipping is $6.95, ' +
    'deducted from your refund. Questions? Email hello@ivyusa.com.';

  it('accepts a rewrite that keeps every number, link and address', () => {
    const rewrite =
      'You can return items bought on ivyusa.com within 10 days of delivery. Just sign in to ' +
      '[your account](https://account.ivyusa.com/orders) and choose "Request return". The $6.95 return shipping ' +
      'comes out of your refund. Any questions, write to hello@ivyusa.com.';
    expect(keepsFacts(RETURNS, rewrite)).toEqual({ ok: true });
  });

  it.each([
    ['a changed number', RETURNS.replace('10 days', '14 days'), /numbers differ/],
    ['a dropped price', RETURNS.replace('Return shipping is $6.95, deducted from your refund. ', ''), /numbers differ/],
    ['an invented number', `${RETURNS} Refunds take 5 business days.`, /numbers differ/],
    ['a dropped email', RETURNS.replace('hello@ivyusa.com', 'our team'), /emails differ/],
    ['a changed link', RETURNS.replace('account.ivyusa.com/orders', 'ivyusa.com/account'), /urls differ/],
    ['a link turned into text', RETURNS.replace('[your account](https://account.ivyusa.com/orders)', 'https://account.ivyusa.com/orders'), /links differ/],
  ])('refuses %s', (_name, rewrite, reason) => {
    const r = keepsFacts(RETURNS, rewrite);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(reason);
  });

  const AFFILIATE =
    'Become an IVY Beauty affiliate partner! 💼\n\n1. **Submit an application** — Fill out a short form.\n' +
    '2. **Review (1–3 business days)** — Our team will review it and email you.\n' +
    '3. **Start earning** — Share your own link → earn 10% on every sale!\n\nIf you have any questions, just ask!';

  it('keeps step cards: same numbered lines and bold labels', () => {
    const ok =
      'Join IVY Beauty as an affiliate partner! 💼\n\n1. **Submit an application** — It only takes a short form.\n' +
      '2. **Review (1–3 business days)** — We check it and reply by email.\n' +
      '3. **Start earning** — Share your link and earn 10% on each sale!\n\nAsk us anything!';
    expect(keepsFacts(AFFILIATE, ok)).toEqual({ ok: true });
    const merged = ok.replace('\n2. ', ' ').replace('\n3. ', ' ');
    expect(keepsFacts(AFFILIATE, merged).reason).toMatch(/steps differ|numbers differ/);
    const unbold = ok.replace(/\*\*/g, '');
    expect(keepsFacts(AFFILIATE, unbold).reason).toBe('bold differs');
  });

  it('reads money the way prose says it, and separators of any language', () => {
    expect(keepsFacts('Your total is 42.00 USD.', 'You paid $42 in total.')).toEqual({ ok: true });
    expect(keepsFacts('Envío: 6.95 USD.', 'El envío cuesta 6,95 USD.')).toEqual({ ok: true });
    expect(keepsFacts('Your total is 42.50 USD.', 'You paid $42 in total.').ok).toBe(false);
  });

  it('refuses an empty, a far shorter or a far longer rewrite', () => {
    expect(keepsFacts(RETURNS, '  ').reason).toBe('empty');
    expect(keepsFacts(RETURNS, 'See ivyusa.com.').reason).toMatch(/length ratio/);
    expect(keepsFacts('Hi.', `${'Hello there, '.repeat(20)}`).reason).toMatch(/length ratio/);
  });

  it('does not count numbers inside URLs or addresses as prose', () => {
    expect(wordingFacts('See https://x.example/p/123 or a1@b2.com').numbers).toEqual([]);
  });
});

describe('ai-wording — onlyKnownNumbers / cleanModelText', () => {
  const facts = 'Order: IVY-1042\nItems: Gel Polish Set and 1 more item\nTotal: 42.00 USD\nPayment: paid';

  it('allows numbers from the facts and refuses new ones', () => {
    expect(onlyKnownNumbers('Your payment of $42 for IVY-1042 went through.', facts)).toEqual({ ok: true });
    const r = onlyKnownNumbers('It will arrive in 3 days.', facts);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/3/);
  });

  it('strips quotes and a leading label', () => {
    expect(cleanModelText('"Hello there."')).toBe('Hello there.');
    expect(cleanModelText('Rewritten message: Hello.')).toBe('Hello.');
  });
});
