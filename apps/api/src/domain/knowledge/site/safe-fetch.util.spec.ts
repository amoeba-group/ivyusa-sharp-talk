import { decodeBody, safeFetch, SITE_USER_AGENT } from './safe-fetch.util';

/**
 * SSRF and transport guards (PLN-261026 S1). Literal public IPs keep DNS out
 * of the test; `fetch` is replaced so nothing leaves the machine.
 */
describe('safeFetch', () => {
  const realFetch = global.fetch;
  let calls: Array<{ url: string; init: RequestInit }>;

  function respond(...responses: Response[]) {
    calls = [];
    global.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      const next = responses.shift();
      if (!next) throw new Error('no more responses');
      return next;
    }) as typeof fetch;
  }

  afterEach(() => {
    global.fetch = realFetch;
  });

  const html = (body: string, status = 200, headers: Record<string, string> = {}) =>
    new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });

  it('rejects http, private and metadata addresses before any request', async () => {
    respond();
    await expect(safeFetch('http://93.184.216.34/')).rejects.toMatchObject({ kind: 'blocked' });
    await expect(safeFetch('https://127.0.0.1/')).rejects.toMatchObject({ kind: 'blocked' });
    await expect(safeFetch('https://169.254.169.254/latest/meta-data')).rejects.toMatchObject({ kind: 'blocked' });
    await expect(safeFetch('https://[::1]/')).rejects.toMatchObject({ kind: 'blocked' });
    expect(calls).toHaveLength(0);
  });

  it('re-checks every redirect hop — a public page cannot bounce the request inside', async () => {
    respond(new Response(null, { status: 302, headers: { location: 'https://10.0.0.5/admin' } }));
    await expect(safeFetch('https://93.184.216.34/policy')).rejects.toMatchObject({ kind: 'blocked' });
    expect(calls).toHaveLength(1);
    expect(calls[0].init.redirect).toBe('manual');
  });

  it('follows a public redirect and reports the final URL; sends the bot UA', async () => {
    respond(new Response(null, { status: 301, headers: { location: '/vi-vn' } }), html('<p>ok</p>'));
    const r = await safeFetch('https://93.184.216.34');
    expect(r.url).toBe('https://93.184.216.34/vi-vn');
    expect(r.body).toBe('<p>ok</p>');
    expect((calls[0].init.headers as Record<string, string>)['User-Agent']).toBe(SITE_USER_AGENT);
  });

  it('stops after 3 redirects', async () => {
    const hop = () => new Response(null, { status: 302, headers: { location: 'https://93.184.216.34/again' } });
    respond(hop(), hop(), hop(), hop());
    await expect(safeFetch('https://93.184.216.34/')).rejects.toMatchObject({ kind: 'http' });
  });

  it('429 is retried once honoring a short Retry-After, then given up', async () => {
    respond(html('slow down', 429, { 'retry-after': '0' }), html('<p>ok</p>'));
    expect((await safeFetch('https://93.184.216.34/')).body).toBe('<p>ok</p>');

    respond(html('slow', 429, { 'retry-after': '0' }), html('slow', 429, { 'retry-after': '0' }));
    await expect(safeFetch('https://93.184.216.34/')).rejects.toMatchObject({ kind: 'http', status: 429 });
  });

  it('non-HTML is refused; an oversized body is cut, not buffered whole', async () => {
    respond(new Response('%PDF', { status: 200, headers: { 'content-type': 'application/pdf' } }));
    await expect(safeFetch('https://93.184.216.34/terms.pdf')).rejects.toMatchObject({ kind: 'not_html' });

    respond(html('x'.repeat(5000)));
    const r = await safeFetch('https://93.184.216.34/', { maxBytes: 1000 });
    expect(r.truncated).toBe(true);
    expect(r.body.length).toBe(1000);
  });
});

describe('decodeBody', () => {
  it('EUC-KR from <meta charset> (Cafe24 shops) decodes to Korean, not mojibake', () => {
    // "반품" in EUC-KR
    const bytes = new Uint8Array([
      ...Buffer.from('<meta charset="euc-kr"><p>'),
      0xb9, 0xdd, 0xc7, 0xb0,
      ...Buffer.from('</p>'),
    ]);
    expect(decodeBody(bytes, 'text/html')).toContain('<p>반품</p>');
  });

  it('header charset wins; unknown charset falls back to utf-8', () => {
    expect(decodeBody(Buffer.from('<p>café</p>'), 'text/html; charset=utf-8')).toBe('<p>café</p>');
    expect(decodeBody(Buffer.from('<p>café</p>'), 'text/html; charset=x-nonsense')).toBe('<p>café</p>');
  });
});
