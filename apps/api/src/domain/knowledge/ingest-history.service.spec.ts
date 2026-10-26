import { IngestHistoryService, INGEST_AUDIT, INGEST_RUN_STATUS } from './ingest-history.service';
import { INGEST_STATUS, IngestJob, KnowledgeIngestJobService } from './knowledge-ingest-job.service';

/** Run history rebuilt from audit rows (PLN-261026-Site-Ingest-History). */
describe('IngestHistoryService', () => {
  let nextId = 1;
  const row = (action: string, metadata: Record<string, unknown>, actorId = 7, at = '2026-10-26T10:00:00Z') => ({
    id: nextId++,
    tenantId: 1,
    actorType: 'user',
    actorId,
    action,
    metadata,
    createdAt: new Date(at),
  });

  function build(rows: Array<ReturnType<typeof row>>, live: Partial<IngestJob> | null = null) {
    const auditRepo = {
      // The service asks newest first; fixtures are written oldest first.
      find: jest.fn(async () => [...rows].sort((a, b) => b.id - a.id)),
    };
    const userRepo = {
      find: jest.fn(async () => [
        { id: 7, name: '김운영', email: 'kim@shop.com' },
        { id: 8, name: null, email: 'dev@shop.com' },
      ]),
    };
    const jobs = { get: jest.fn(() => live) } as unknown as KnowledgeIngestJobService;
    const svc = new IngestHistoryService(auditRepo as never, userRepo as never, jobs);
    return { svc, auditRepo, userRepo };
  }

  const site = { sourceKind: 'website', sourceLabel: 'ivyusa.com', docGroup: 'counsel' };
  const pagesDone = [
    { url: 'https://ivyusa.com/a', title: 'A', status: 'done', drafts: 3, detail: null },
    { url: 'https://ivyusa.com/b', title: 'B', status: 'failed', drafts: 0, detail: 'HTTP 429' },
  ];

  beforeEach(() => {
    nextId = 1;
  });

  it('derives all six states from audit rows + the in-memory job', async () => {
    const rows = [
      // j1 published
      row(INGEST_AUDIT.started, { jobId: 'j1', ...site, pageUrls: ['https://ivyusa.com/a', 'https://ivyusa.com/b'] }),
      row(INGEST_AUDIT.finished, { jobId: 'j1', ...site, drafted: 3, pages: pagesDone }),
      row('knowledge.site_ingested', { jobId: 'j1', ...site, saved: 2, boardDocumentIds: ['12', '13'] }, 8),
      // j2 expired: finished, never published, not in memory
      row(INGEST_AUDIT.started, { jobId: 'j2', ...site }),
      row(INGEST_AUDIT.finished, { jobId: 'j2', ...site, drafted: 6, pages: [] }),
      // j3 failed
      row(INGEST_AUDIT.started, { jobId: 'j3', ...site }),
      row(INGEST_AUDIT.failed, { jobId: 'j3', ...site, error: 'E5113', pages: [] }),
      // j4 interrupted: started only, not in memory
      row(INGEST_AUDIT.started, { jobId: 'j4', ...site }),
      // j5 review: finished and still in memory as ready
      row(INGEST_AUDIT.started, { jobId: 'j5', ...site }),
      row(INGEST_AUDIT.finished, { jobId: 'j5', ...site, drafted: 4, pages: [] }),
    ];
    const live = {
      id: 'j5',
      status: INGEST_STATUS.READY,
      drafts: [{}, {}, {}, {}] as never,
      pages: [],
      finishedAt: '2026-10-26T10:00:00Z',
      error: null,
    };
    const { svc } = build(rows, live);
    const list = await svc.list(1, 'website', 10);
    const byId = Object.fromEntries(list.map((r) => [r.jobId, r]));

    expect(byId.j1).toMatchObject({
      status: INGEST_RUN_STATUS.PUBLISHED,
      pagesTotal: 2,
      pagesOk: 1,
      drafted: 3,
      saved: 2,
      startedBy: '김운영',
      publishedBy: 'dev@shop.com', // no name → email
    });
    expect(byId.j2.status).toBe(INGEST_RUN_STATUS.EXPIRED);
    expect(byId.j3).toMatchObject({ status: INGEST_RUN_STATUS.FAILED, error: 'E5113' });
    expect(byId.j4.status).toBe(INGEST_RUN_STATUS.INTERRUPTED);
    expect(byId.j5).toMatchObject({
      status: INGEST_RUN_STATUS.REVIEW,
      drafted: 4,
      expiresAt: '2026-10-26T11:00:00.000Z',
    });
    // Newest activity first.
    expect(list[0].jobId).toBe('j5');
  });

  it('a running job in memory is "running" even before any finish row', async () => {
    const { svc } = build([row(INGEST_AUDIT.started, { jobId: 'j9', ...site })], {
      id: 'j9',
      status: INGEST_STATUS.RUNNING,
      pages: [{ url: 'https://ivyusa.com/a', title: 'A', status: 'done', drafts: 2, detail: null }],
      drafts: [],
      finishedAt: null,
      error: null,
    });
    const [run] = await svc.list(1, undefined, 10);
    expect(run).toMatchObject({ status: INGEST_RUN_STATUS.RUNNING, pagesOk: 1, expiresAt: null });
  });

  it('a publish row without jobId (before history existed) is a legacy published run', async () => {
    const { svc } = build([row('knowledge.site_ingested', { ...site, saved: 1, boardDocumentIds: [10] })]);
    const [run] = await svc.list(1, 'website', 10);
    expect(run).toMatchObject({ jobId: null, legacy: true, status: INGEST_RUN_STATUS.PUBLISHED, saved: 1 });
  });

  it('kind filter keeps file/video runs out of the website list', async () => {
    const { svc } = build([
      row(INGEST_AUDIT.started, { jobId: 'f1', sourceKind: 'file_upload', sourceLabel: 'faq.csv' }),
      row(INGEST_AUDIT.started, { jobId: 'w1', ...site }),
    ]);
    expect((await svc.list(1, 'website', 10)).map((r) => r.jobId)).toEqual(['w1']);
    expect(await svc.list(1, undefined, 10)).toHaveLength(2);
  });

  it('reads only this tenant: audit and user lookups are tenant-scoped', async () => {
    const { svc, auditRepo, userRepo } = build([row(INGEST_AUDIT.started, { jobId: 'j1', ...site })]);
    await svc.list(1, undefined, 10);
    expect((auditRepo.find.mock.calls[0] as unknown[])[0]).toMatchObject({ where: { tenantId: 1 } });
    expect((userRepo.find.mock.calls[0] as unknown[])[0]).toMatchObject({ where: { tenantId: 1 } });
  });

  it('detail: timeline, recorded pages and published board documents; unknown jobId → 404', async () => {
    const { svc } = build([
      row(INGEST_AUDIT.started, { jobId: 'j1', ...site, ownerConfirmed: true }, 7, '2026-10-26T10:00:00Z'),
      row(INGEST_AUDIT.finished, { jobId: 'j1', ...site, drafted: 3, pages: pagesDone }, 7, '2026-10-26T10:01:00Z'),
      row('knowledge.site_ingested', { jobId: 'j1', ...site, saved: 2, boardDocumentIds: ['12', 13] }, 8, '2026-10-26T10:05:00Z'),
    ]);
    const d = await svc.detail(1, 'j1');
    expect(d.events.map((e) => [e.type, e.by])).toEqual([
      ['started', '김운영'],
      ['finished', '김운영'],
      ['published', 'dev@shop.com'],
    ]);
    expect(d.pages.map((p) => p.status)).toEqual(['done', 'failed']);
    expect(d.boardDocumentIds).toEqual(['12', '13']);
    expect(d.ownerConfirmed).toBe(true);
    await expect(svc.detail(1, 'nope')).rejects.toMatchObject({ errorCode: 'E5002' });
  });
});

/** The queue emits lifecycle events; a failing listener never costs the run. */
describe('KnowledgeIngestJobService events', () => {
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('started → finished, with the job attached', async () => {
    const jobs = new KnowledgeIngestJobService();
    const seen: string[] = [];
    jobs.start(1, { sourceLabel: 's', sourceKind: 'website', docGroup: 'counsel', fileId: null, sourceUrl: null }, async () => [], (t, _tenant, job) => {
      seen.push(`${t}:${job.status}`);
    });
    await settle();
    await settle();
    expect(seen).toEqual(['started:running', 'finished:ready']);
  });

  it('failed is emitted on a failing run', async () => {
    const jobs = new KnowledgeIngestJobService();
    const seen: string[] = [];
    jobs.start(1, { sourceLabel: 's', sourceKind: 'website', docGroup: 'counsel', fileId: null, sourceUrl: null }, async () => {
      throw Object.assign(new Error('x'), { errorCode: 'E5113' });
    }, (t) => {
      seen.push(t);
    });
    await settle();
    await settle();
    expect(seen).toEqual(['started', 'failed']);
    expect(jobs.get(1)!.error).toBe('E5113');
  });

  it('a listener that throws or rejects does not break the run', async () => {
    const jobs = new KnowledgeIngestJobService();
    jobs.start(1, { sourceLabel: 's', sourceKind: 'website', docGroup: 'counsel', fileId: null, sourceUrl: null }, async () => [], (t) => {
      if (t === 'started') throw new Error('audit down');
      return Promise.reject(new Error('audit down'));
    });
    await settle();
    await settle();
    expect(jobs.get(1)!.status).toBe(INGEST_STATUS.READY);
  });
});
