import { readFileSync } from 'fs';
import { join } from 'path';
import { KnowledgeIngestService } from './knowledge-ingest.service';
import { INGEST_PAGE_STATUS, INGEST_STATUS, KnowledgeIngestJobService } from './knowledge-ingest-job.service';
import { FetchedPage, SiteFetchError, SiteFetcher } from './site/safe-fetch.util';
import { BusinessException } from '../../global/exception/business.exception';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

/** Website policy agent — service flow (PLN-261026 S2). */
describe('KnowledgeIngestService — website', () => {
  const settle = async (jobs: KnowledgeIngestJobService, tenantId = 1) => {
    for (let i = 0; i < 50 && jobs.get(tenantId)?.status === INGEST_STATUS.RUNNING; i += 1) {
      await new Promise((r) => setTimeout(r, 5));
    }
    return jobs.get(tenantId)!;
  };

  function build(web: Record<string, string | SiteFetchError>, aiText = '') {
    const boardCreated: Array<Record<string, unknown>> = [];
    const audited: Array<{ action: string; meta: Record<string, unknown> }> = [];
    const ai = {
      complete: jest.fn(async () => ({ text: aiText, tokensIn: 0, tokensOut: 0, provider: 'stub', model: 'stub-1' })),
    };
    const board = {
      create: jest.fn(async (_t: number, body: Record<string, unknown>) => {
        const row = { id: boardCreated.length + 1, ...body };
        boardCreated.push(row);
        return row;
      }),
      titlesInGroup: jest.fn(async () => new Set(['Return window'])),
    };
    const attachments = { addLink: jest.fn(async () => ({})), attachSharedCopy: jest.fn() };
    const revisions = {
      recordAudit: jest.fn(async (_t: number, _d: number, action: string, _u: unknown, meta: Record<string, unknown>) => {
        audited.push({ action, meta });
      }),
    };
    const jobs = new KnowledgeIngestJobService();
    const svc = new KnowledgeIngestService(
      {} as never,
      ai as never,
      { list: jest.fn(async () => [{ name: 'Returns', hidden: false }]) } as never,
      revisions as never,
      board as never,
      attachments as never,
      jobs,
      { get: (_k: string, d: string) => d } as never,
    );
    const requested: string[] = [];
    const fetcher: SiteFetcher = async (url) => {
      requested.push(url);
      const hit = web[url];
      if (hit === undefined) throw new SiteFetchError('HTTP 404', 'http', 404);
      if (hit instanceof SiteFetchError) throw hit;
      return { url, status: 200, contentType: 'text/html', body: hit, truncated: false } as FetchedPage;
    };
    svc.fetcher = fetcher;
    svc.pageDelayMs = 0;
    return { svc, jobs, ai, board, attachments, boardCreated, audited, requested };
  }

  const ARTICLES = JSON.stringify({
    articles: [
      { title: 'Return window', category: 'Returns', content: 'Returns must be initiated within 10 days of delivery.' },
      { title: 'Return shipping fee', category: 'Returns', content: 'Return shipping is $6.95.' },
    ],
  });

  describe('input', () => {
    it('a bare domain means https; http, credentials and hostless input are E5110', async () => {
      const h = build({ 'https://shop.com/': '<a href="/pages/returns">Returns</a>' });
      await expect(h.svc.discoverSite('shop.com')).resolves.toMatchObject({ site: 'https://shop.com/' });
      for (const bad of ['http://shop.com', 'https://user:pw@shop.com', 'localhost', '']) {
        await expect(h.svc.discoverSite(bad)).rejects.toMatchObject({ errorCode: 'E5110' });
      }
    });

    it('an unreachable site is E5111; a private address is E5110', async () => {
      const h = build({ 'https://dead.com/': new SiteFetchError('timeout', 'unreachable') });
      await expect(h.svc.discoverSite('dead.com')).rejects.toMatchObject({ errorCode: 'E5111' });
      const p = build({ 'https://inside.com/': new SiteFetchError('URL resolves to a non-public address', 'blocked') });
      await expect(p.svc.discoverSite('inside.com')).rejects.toMatchObject({ errorCode: 'E5110' });
    });

    it('pages from two sites are E5112; more than 10 pages is rejected', () => {
      const h = build({});
      expect(() => h.svc.startSite(1, ['https://a.com/x', 'https://b.com/y'], 'counsel')).toThrow(BusinessException);
      try {
        h.svc.startSite(1, ['https://a.com/x', 'https://b.com/y'], 'counsel');
      } catch (e) {
        expect((e as BusinessException & { errorCode: string }).errorCode).toBe('E5112');
      }
      const eleven = Array.from({ length: 11 }, (_, i) => `https://a.com/p${i}`);
      expect(() => h.svc.startSite(1, eleven, 'counsel')).toThrow(BusinessException);
    });
  });

  it('reads each page, drafts with the policy prompt, tags drafts with their page and flags board duplicates', async () => {
    const h = build(
      {
        'https://ivyusa.com/robots.txt': 'User-agent: *\nDisallow: /policies/\n',
        'https://ivyusa.com/': '<html><body><nav>x</nav></body></html>',
        'https://ivyusa.com/pages/returns-refunds': fixture('site-shopify-refund-policy.html'),
      },
      ARTICLES,
    );
    h.svc.startSite(1, ['https://ivyusa.com/pages/returns-refunds', 'https://ivyusa.com/policies/refund-policy'], 'counsel');
    const job = await settle(h.jobs);

    expect(job.status).toBe(INGEST_STATUS.READY);
    expect(job.sourceKind).toBe('website');
    expect(job.pages.map((p) => p.status)).toEqual([INGEST_PAGE_STATUS.DONE, INGEST_PAGE_STATUS.ROBOTS]);
    // robots.txt is obeyed: the disallowed page is never requested.
    expect(h.requested).not.toContain('https://ivyusa.com/policies/refund-policy');
    expect(job.drafts.map((d) => [d.title, d.sourceUrl, d.duplicateOnBoard])).toEqual([
      ['Return window', 'https://ivyusa.com/pages/returns-refunds', true],
      ['Return shipping fee', 'https://ivyusa.com/pages/returns-refunds', false],
    ]);
    const call = (h.ai.complete as jest.Mock).mock.calls[0][0];
    expect(call.feature).toBe('knowledge_site_policy');
    expect(call.system).toContain('copy every number');
    expect(call.messages[0].content).toContain('$6.95');
    expect(call.messages[0].content).not.toContain('BESTSELLERS');
  });

  it('owner confirmation (D8): a robots-disallowed page is read, flagged, and the audit says so', async () => {
    const h = build(
      {
        'https://ivyusa.com/robots.txt': 'User-agent: *\nDisallow: /checkouts/\nDisallow: /policies/\n',
        'https://ivyusa.com/policies/refund-policy': fixture('site-shopify-refund-policy.html'),
      },
      ARTICLES,
    );
    h.svc.startSite(1, ['https://ivyusa.com/policies/refund-policy'], 'counsel', true);
    const job = await settle(h.jobs);
    expect(job.status).toBe(INGEST_STATUS.READY);
    expect(job.ownerConfirmed).toBe(true);
    expect(job.pages[0]).toMatchObject({ status: INGEST_PAGE_STATUS.DONE, robotsOverridden: true });
    expect(h.requested).toContain('https://ivyusa.com/policies/refund-policy');

    await h.svc.approve(
      1,
      [{ title: 'Return window', category: 'Returns', content: '10 days', source_url: 'https://ivyusa.com/policies/refund-policy' }],
      7,
    );
    expect(h.audited[0].meta).toMatchObject({
      ownerConfirmed: true,
      pages: [{ url: 'https://ivyusa.com/policies/refund-policy', status: 'done', robotsOverridden: true }],
    });
  });

  it('without owner confirmation the same page is skipped and never requested', async () => {
    const h = build({ 'https://ivyusa.com/robots.txt': 'User-agent: *\nDisallow: /policies/\n' });
    h.svc.startSite(1, ['https://ivyusa.com/policies/refund-policy'], 'counsel');
    const job = await settle(h.jobs);
    expect(job.pages[0].status).toBe(INGEST_PAGE_STATUS.ROBOTS);
    expect(h.requested).not.toContain('https://ivyusa.com/policies/refund-policy');
  });

  it('an SPA page is reported thin and skipped; if nothing is readable the job fails with E5113', async () => {
    const h = build({
      'https://go2joy.vn/': fixture('site-go2joy-home.html'),
      'https://go2joy.vn/vi-vn/policy': fixture('site-go2joy-policy-spa.html'),
      'https://go2joy.vn/vi-vn/gone': new SiteFetchError('HTTP 403', 'http', 403),
    });
    h.svc.startSite(4, ['https://go2joy.vn/vi-vn/policy', 'https://go2joy.vn/vi-vn/gone'], 'counsel');
    const job = await settle(h.jobs, 4);
    expect(job.status).toBe(INGEST_STATUS.FAILED);
    expect(job.error).toBe('E5113');
    expect(job.pages.map((p) => [p.status, p.detail?.startsWith('HTTP') || p.status === 'thin'])).toEqual([
      [INGEST_PAGE_STATUS.THIN, true],
      [INGEST_PAGE_STATUS.FAILED, true],
    ]);
    expect(h.ai.complete).not.toHaveBeenCalled();
  });

  it('keyless/stub engine: unparseable output still yields a whole-page draft carrying its source', async () => {
    const h = build({ 'https://ivyusa.com/pages/returns-refunds': fixture('site-shopify-refund-policy.html') }, 'stub reply');
    h.svc.startSite(1, ['https://ivyusa.com/pages/returns-refunds'], 'counsel');
    const job = await settle(h.jobs);
    expect(job.status).toBe(INGEST_STATUS.READY);
    expect(job.drafts[0]).toMatchObject({ fallback: true, sourceUrl: 'https://ivyusa.com/pages/returns-refunds' });
    // The page's own heading names the draft, not the site-wide <title>.
    expect(job.drafts[0].title).toBe('Return Policy — part 1/1');
  });

  it('approve: site-policy tag, each document links ITS page, foreign URLs are not attached, audit names the action', async () => {
    const h = build({ 'https://ivyusa.com/pages/returns-refunds': fixture('site-shopify-refund-policy.html') }, ARTICLES);
    h.svc.startSite(1, ['https://ivyusa.com/pages/returns-refunds'], 'counsel');
    await settle(h.jobs);

    const result = await h.svc.approve(
      1,
      [
        { title: 'Return window', category: 'Returns', content: '10 days', source_url: 'https://ivyusa.com/pages/returns-refunds' },
        { title: 'Injected', category: 'Returns', content: 'x', source_url: 'https://evil.example/phish' },
      ],
      7,
    );
    expect(h.boardCreated.map((d) => d.tags)).toEqual([
      ['ai-import', 'site-policy'],
      ['ai-import', 'site-policy'],
    ]);
    expect(h.attachments.addLink).toHaveBeenCalledTimes(1);
    expect((h.attachments.addLink as jest.Mock).mock.calls[0].slice(1, 3)).toEqual([1, 'https://ivyusa.com/pages/returns-refunds']);
    expect(result).toMatchObject({ saved: 2, sourceKind: 'website', attachedOriginals: 1 });
    expect(h.audited[0].action).toBe('knowledge.site_ingested');
    expect(h.audited[0].meta.pages).toEqual([{ url: 'https://ivyusa.com/pages/returns-refunds', status: 'done' }]);
  });
});
