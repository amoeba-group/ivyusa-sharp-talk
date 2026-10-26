import { readFileSync } from 'fs';
import { join } from 'path';
import { boilerplateLines, decodeEntities, extractPageText } from './html-text.util';

const fixture = (name: string) => readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8');

/** PLN-261026 S1 — main-content extraction against real captured pages (REQ §4). */
describe('extractPageText', () => {
  it('Shopify policy page: policy body only, the 500KB mega-menu is gone', () => {
    const r = extractPageText(fixture('site-shopify-refund-policy.html'));
    expect(r.title).toBe('Refund policy – Ivy Beauty');
    expect(r.thin).toBe(false);
    // Numbers that decide answers survive verbatim.
    expect(r.text).toContain('Returns must be initiated within 10 days of delivery.');
    expect(r.text).toContain('$6.95');
    // Structure survives as markdown.
    expect(r.text).toMatch(/^## Return Policy/m);
    expect(r.text).toMatch(/^- Items must be purchased directly from ivyusa\.com\./m);
    // Menu labels from the header do not.
    expect(r.text).not.toContain('BESTSELLERS');
    expect(r.text).not.toContain('KISS NY Skincare');
  });

  it('SPA policy page (go2joy, body rendered in the browser) is thin once the site template is subtracted', () => {
    const home = boilerplateLines(fixture('site-go2joy-home.html'));
    const r = extractPageText(fixture('site-go2joy-policy-spa.html'), home);
    expect(r.thin).toBe(true);
    expect(r.text).not.toContain('Mã số thuế');
  });

  it('without the home page the same SPA shell is still mostly template — the boilerplate step is what decides', () => {
    const r = extractPageText(fixture('site-go2joy-policy-spa.html'));
    expect(r.text).toContain('Mã số thuế');
  });

  it('prefers <main> over body chrome and drops nav/header/footer inside it', () => {
    const body = 'Returns are accepted within 30 days of delivery when items are unused. '.repeat(8);
    const html = `<html><head><title>T</title></head><body>
      <header><a href="/">Home</a><a href="/shop">Shop</a></header>
      <main><nav>Breadcrumb</nav><h1>Returns</h1><p>${body}</p></main>
      <footer>© Shop Inc</footer></body></html>`;
    const r = extractPageText(html);
    expect(r.text.startsWith('# Returns')).toBe(true);
    expect(r.text).not.toContain('Breadcrumb');
    expect(r.text).not.toContain('© Shop Inc');
    expect(r.thin).toBe(false);
  });

  it('nested same-name elements are balanced (a <div> region does not end at the first </div>)', () => {
    const para = 'Refunds are issued to the original payment method within ten business days. ';
    const html = `<body><div id="contents"><div><p>${para.repeat(3)}</p></div><p>TAIL ${para.repeat(3)}</p></div><div>OUTSIDE</div></body>`;
    const r = extractPageText(html);
    expect(r.text).toContain('TAIL');
    expect(r.text).not.toContain('OUTSIDE');
  });

  it('tables become markdown tables', () => {
    const rows = Array.from({ length: 12 }, (_, i) => `<tr><td>Zone ${i}</td><td>$${i}.00 | flat</td></tr>`).join('');
    const html = `<main><h2>Shipping fees</h2><table><tr><th>Zone</th><th>Fee</th></tr>${rows}</table><p>${'Orders over $50 ship free within the contiguous United States. '.repeat(5)}</p></main>`;
    const r = extractPageText(html);
    expect(r.text).toContain('| Zone | Fee |');
    expect(r.text).toContain('| --- | --- |');
    expect(r.text).toContain('| Zone 3 | $3.00 \\| flat |');
  });

  it('a link-dense region is thin even when long', () => {
    const links = Array.from({ length: 80 }, (_, i) => `<li><a href="/c/${i}">Category number ${i}</a></li>`).join('');
    const r = extractPageText(`<main><ul>${links}</ul></main>`);
    expect(r.thin).toBe(true);
  });

  it('caps very long pages and says so', () => {
    const r = extractPageText(`<main><p>${'Term. '.repeat(20_000)}</p></main>`);
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBe(48_000);
  });
});

describe('decodeEntities', () => {
  it('named, decimal and hex entities', () => {
    expect(decodeEntities('A&amp;B &ndash; &#8217;s &#x2019; &nbsp;&unknown;')).toBe('A&B – ’s ’  &unknown;');
  });
});

describe('page heading', () => {
  it('first <h1> of the body wins over a site-wide <title>', () => {
    const body = 'Within 14 days of delivery you may return unused items for a full refund. '.repeat(8);
    const r = extractPageText(`<title>Brand - slogan</title><main><h1>Refund policy</h1><p>${body}</p></main>`);
    expect(r.title).toBe('Brand - slogan');
    expect(r.heading).toBe('Refund policy');
  });

  it('no <h1>: the first short line (go2joy bold paragraphs)', () => {
    const body = 'Khi phát sinh tranh chấp hoặc khiếu nại, Go2Joy khuyến khích giải pháp thương lượng. '.repeat(8);
    const r = extractPageText(`<main><p><b>CƠ CHẾ GIẢI QUYẾT TRANH CHẤP, KHIẾU NẠI</b></p><p>${body}</p></main>`);
    expect(r.heading).toBe('CƠ CHẾ GIẢI QUYẾT TRANH CHẤP, KHIẾU NẠI');
  });

  it('a first line that is a whole paragraph is not a heading', () => {
    const r = extractPageText(`<main><p>${'Long sentence without any heading at all here. '.repeat(10)}</p></main>`);
    expect(r.heading).toBe('');
  });
});
