import { readFileSync } from 'fs';
import { join } from 'path';
import {
  classify,
  discoverPolicyPages,
  extractLinks,
  normalizeUrl,
  parseSitemap,
  POLICY_KIND,
  PolicyCandidate,
  rankCandidates,
  sameSite,
} from './policy-discover.util';
import { FetchedPage, SiteFetchError, SiteFetcher } from './safe-fetch.util';

const fixture = (name: string) => readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8');

/** A fake web: url → body, or an error kind. Records what was requested. */
function fakeWeb(pages: Record<string, string | SiteFetchError>) {
  const requested: string[] = [];
  const fetcher: SiteFetcher = async (url) => {
    requested.push(url);
    const hit = pages[url];
    if (hit === undefined) throw new SiteFetchError('HTTP 404', 'http', 404);
    if (hit instanceof SiteFetchError) throw hit;
    return { url, status: 200, contentType: 'text/html', body: hit, truncated: false } as FetchedPage;
  };
  return { fetcher, requested };
}

describe('classify', () => {
  it.each([
    ['https://s.com/pages/returns-refunds', '', POLICY_KIND.REFUND],
    ['https://s.com/policies/shipping-policy', '', POLICY_KIND.SHIPPING],
    ['https://s.com/member/privacy.html', '개인정보처리방침', POLICY_KIND.PRIVACY],
    ['https://s.com/x', '이용약관', POLICY_KIND.TERMS],
    ['https://go2joy.vn/vi-vn/complaint-handling-policy', 'Cơ chế giải quyết tranh chấp, khiếu nại', POLICY_KIND.TERMS],
    ['https://s.jp/legal', '返品について', POLICY_KIND.REFUND],
    ['https://s.es/envios', 'Política de envío', POLICY_KIND.SHIPPING],
    ['https://go2joy.vn/vi-vn/policy', 'Về chúng tôi', POLICY_KIND.OTHER],
  ])('%s "%s" → %s', (url, text, kind) => {
    expect(classify(url, text)?.kind).toBe(kind);
  });

  it('blog, product and asset paths are never policies', () => {
    expect(classify('https://s.com/blogs/news/shipping-update', 'Shipping update')).toBeNull();
    expect(classify('https://s.com/products/return-gift', 'Return gift')).toBeNull();
    expect(classify('https://s.com/assets/privacy.css', '')).toBeNull();
    expect(classify('https://s.com/about', 'About us')).toBeNull();
  });
});

describe('url helpers', () => {
  it('sameSite ignores www but not other subdomains', () => {
    expect(sameSite('https://www.shop.com/a', 'https://shop.com/b')).toBe(true);
    expect(sameSite('https://help.shop.com/a', 'https://shop.com/b')).toBe(false);
    expect(sameSite('https://shop.com.evil.io/a', 'https://shop.com')).toBe(false);
  });

  it('normalizeUrl drops hash, tracking params, trailing slash and a bare ?', () => {
    expect(normalizeUrl('https://s.com/policy/?utm_source=x#top')).toBe('https://s.com/policy');
    expect(normalizeUrl('https://go2joy.vn/vi-vn/policy?')).toBe('https://go2joy.vn/vi-vn/policy');
    expect(normalizeUrl('https://s.com/p?lang=vi')).toBe('https://s.com/p?lang=vi');
  });

  it('extractLinks resolves relative hrefs and skips mailto/javascript/#', () => {
    const links = extractLinks(
      '<a href="/vi-vn/policy">Chính&nbsp;sách</a><a href="mailto:a@b">m</a><a href="#x">x</a><a href=\'javascript:void(0)\'>j</a>',
      'https://go2joy.vn/vi-vn',
    );
    expect(links).toEqual([{ url: 'https://go2joy.vn/vi-vn/policy', text: 'Chính sách' }]);
  });

  it('parseSitemap reads urlset and sitemapindex', () => {
    expect(parseSitemap('<urlset><url><loc> https://s.com/a </loc></url></urlset>').urls).toEqual(['https://s.com/a']);
    expect(
      parseSitemap('<sitemapindex><sitemap><loc>https://s.com/sitemap_pages_1.xml</loc></sitemap></sitemapindex>').childMaps,
    ).toEqual(['https://s.com/sitemap_pages_1.xml']);
  });
});

describe('rankCandidates', () => {
  const c = (url: string, kind: PolicyCandidate['kind'], score: number, robotsBlocked = false): PolicyCandidate => ({
    url,
    title: url,
    kind,
    source: 'sitemap',
    robotsBlocked,
    fileLink: false,
    score,
  });

  it('one kind cannot crowd out the others (ivyusa: a dozen brand privacy pages vs one returns page)', () => {
    const privacy = Array.from({ length: 30 }, (_, i) => c(`https://s.com/pages/brand${i}-privacy-policy`, 'privacy', 4));
    const ranked = rankCandidates([...privacy, c('https://s.com/pages/returns-refunds', 'refund', 2)]);
    expect(ranked.slice(0, 2).map((x) => x.kind)).toEqual(['privacy', 'refund']);
    expect(ranked).toHaveLength(20);
  });

  it('blocked candidates go last and are capped', () => {
    const ranked = rankCandidates([
      ...Array.from({ length: 8 }, (_, i) => c(`https://s.com/policies/p${i}`, 'terms', 9, true)),
      c('https://s.com/pages/faq', 'faq', 1),
    ]);
    expect(ranked[0].url).toBe('https://s.com/pages/faq');
    expect(ranked.filter((x) => x.robotsBlocked)).toHaveLength(5);
  });
});

describe('discoverPolicyPages', () => {
  it('go2joy home: policy links from the footer, same site only', async () => {
    const web = fakeWeb({ 'https://go2joy.vn': fixture('site-go2joy-home.html') });
    const r = await discoverPolicyPages('https://go2joy.vn', web.fetcher);
    const urls = r.candidates.map((x) => x.url);
    expect(urls).toContain('https://go2joy.vn/vi-vn/policy');
    expect(urls).toContain('https://go2joy.vn/vi-vn/complaint-handling-policy');
    expect(urls.every((u) => sameSite(u, 'https://go2joy.vn'))).toBe(true);
    expect(r.candidates.every((x) => !x.robotsBlocked)).toBe(true);
  });

  it('home refused (ivyusa `/` 429): sitemap still yields candidates; Shopify is recognized from robots.txt and /policies/ is listed as blocked without being fetched', async () => {
    const web = fakeWeb({
      'https://shop.com': new SiteFetchError('HTTP 429', 'http', 429),
      'https://shop.com/robots.txt': 'User-agent: *\nDisallow: /checkouts/\nDisallow: /policies/\n',
      'https://shop.com/sitemap.xml':
        '<sitemapindex><sitemap><loc>https://shop.com/sitemap_products_1.xml</loc></sitemap><sitemap><loc>https://shop.com/sitemap_pages_1.xml</loc></sitemap></sitemapindex>',
      'https://shop.com/sitemap_pages_1.xml':
        '<urlset><url><loc>https://shop.com/pages/returns-refunds</loc></url><url><loc>https://shop.com/pages/about-us</loc></url></urlset>',
      'https://shop.com/sitemap_products_1.xml': '<urlset><url><loc>https://shop.com/products/x</loc></url></urlset>',
    });
    const r = await discoverPolicyPages('https://shop.com', web.fetcher);
    expect(r.platform).toBe('shopify');
    expect(r.candidates[0]).toMatchObject({ url: 'https://shop.com/pages/returns-refunds', kind: 'refund', robotsBlocked: false });
    const blocked = r.candidates.filter((x) => x.robotsBlocked).map((x) => x.url);
    expect(blocked).toContain('https://shop.com/policies/refund-policy');
    expect(web.requested.some((u) => u.includes('/policies/'))).toBe(false);
    // Product maps are never fetched — wasted requests against a rate-limited shop.
    expect(web.requested).not.toContain('https://shop.com/sitemap_products_1.xml');
  });

  it('nothing reachable and nothing found → the home-page error surfaces', async () => {
    const web = fakeWeb({ 'https://dead.com': new SiteFetchError('timeout', 'unreachable') });
    await expect(discoverPolicyPages('https://dead.com', web.fetcher)).rejects.toMatchObject({ kind: 'unreachable' });
  });

  it('a known path that redirects home is not a candidate', async () => {
    const fetcher: SiteFetcher = async (url) => {
      if (url === 'https://s.com') return { url: 'https://s.com/', status: 200, contentType: 'text/html', body: '<p>cdn.shopify.com</p>', truncated: false };
      if (url.includes('/policies/')) return { url: 'https://s.com/', status: 200, contentType: 'text/html', body: '', truncated: false };
      throw new SiteFetchError('HTTP 404', 'http', 404);
    };
    const r = await discoverPolicyPages('https://s.com', fetcher);
    expect(r.candidates).toEqual([]);
  });
});
