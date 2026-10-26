import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditLog } from '../audit/entity/audit-log.entity';
import { User } from '../user/entity/user.entity';
import { INGEST_STATUS, IngestJob, ingestExpiresAt, KnowledgeIngestJobService } from './knowledge-ingest-job.service';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';

/** Audit actions of an ingest run's lifecycle (PLN-261026-Site-Ingest-History §1). */
export const INGEST_AUDIT = {
  started: 'knowledge.ingest_started',
  finished: 'knowledge.ingest_finished',
  failed: 'knowledge.ingest_failed',
} as const;
/** Publish actions — written by approve() since PLN-260829 / PLN-261026. */
const PUBLISH_ACTIONS = ['knowledge.site_ingested', 'knowledge.file_ingested'];
const ALL_ACTIONS = [...Object.values(INGEST_AUDIT), ...PUBLISH_ACTIONS];

export const INGEST_RUN_STATUS = {
  RUNNING: 'running',
  REVIEW: 'review',
  PUBLISHED: 'published',
  /** Drafts were ready but nobody published them before they left memory. */
  EXPIRED: 'expired',
  FAILED: 'failed',
  /** Started, never finished, and no longer in memory — a restart or deploy. */
  INTERRUPTED: 'interrupted',
} as const;
export type IngestRunStatus = (typeof INGEST_RUN_STATUS)[keyof typeof INGEST_RUN_STATUS];

export interface IngestRunPage {
  url: string;
  title: string | null;
  status: string;
  drafts: number;
  detail: string | null;
  robotsOverridden?: boolean;
}

export interface IngestRunSummary {
  /** null for a publish recorded before history existed (legacy row). */
  jobId: string | null;
  status: IngestRunStatus;
  sourceKind: string | null;
  sourceLabel: string | null;
  docGroup: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  publishedAt: string | null;
  startedBy: string | null;
  publishedBy: string | null;
  pagesTotal: number;
  pagesOk: number;
  drafted: number | null;
  saved: number | null;
  error: string | null;
  /** Review deadline while drafts are still in memory. */
  expiresAt: string | null;
  ownerConfirmed: boolean;
  /** True when only the publish row exists (run predates the history feature). */
  legacy: boolean;
}

export interface IngestRunDetail extends IngestRunSummary {
  pages: IngestRunPage[];
  boardDocumentIds: string[];
  events: Array<{ type: 'started' | 'finished' | 'failed' | 'published'; at: string; by: string | null }>;
}

/** Audit rows scanned per request — runs are manual, this covers months. */
const SCAN_LIMIT = 500;
export const HISTORY_MAX = 50;

type Meta = Record<string, unknown>;
interface RunRows {
  key: string;
  started?: AuditLog;
  finished?: AuditLog;
  failed?: AuditLog;
  published?: AuditLog;
}

/**
 * Ingest run history (PLN-261026-Site-Ingest-History). Rebuilt from audit rows
 * grouped by jobId — the same "audit log is already the run store" pattern as
 * the source conversion history (#429), so no table. The in-memory job is
 * consulted only to tell "still running / waiting for review" from
 * "interrupted / expired".
 */
@Injectable()
export class IngestHistoryService {
  constructor(
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jobs: KnowledgeIngestJobService,
  ) {}

  async list(tenantId: number, kind: string | undefined, limit: number): Promise<IngestRunSummary[]> {
    const runs = await this.runs(tenantId);
    const live = this.jobs.get(tenantId);
    const names = await this.names(tenantId, runs);
    return runs
      .map((r) => this.summarize(r, live, names))
      .filter((s) => !kind || s.sourceKind === kind)
      .slice(0, Math.min(Math.max(limit, 1), HISTORY_MAX));
  }

  async detail(tenantId: number, jobId: string): Promise<IngestRunDetail> {
    const run = (await this.runs(tenantId)).find((r) => r.key === jobId);
    if (!run) throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    const live = this.jobs.get(tenantId);
    const names = await this.names(tenantId, [run]);
    const summary = this.summarize(run, live, names);

    const liveJob = live?.id === jobId ? live : null;
    const recorded = (meta(run.finished) ?? meta(run.failed))?.pages as IngestRunPage[] | undefined;
    const requested = (meta(run.started)?.pageUrls as string[] | undefined) ?? [];
    const pages: IngestRunPage[] = liveJob?.pages.length
      ? liveJob.pages.map((p) => ({ ...p }))
      : recorded ?? requested.map((url) => ({ url, title: null, status: 'pending', drafts: 0, detail: null }));

    const events: IngestRunDetail['events'] = [];
    const push = (type: IngestRunDetail['events'][number]['type'], row?: AuditLog) => {
      if (row) events.push({ type, at: iso(row.createdAt), by: names.get(Number(row.actorId)) ?? null });
    };
    push('started', run.started);
    push('finished', run.finished);
    push('failed', run.failed);
    push('published', run.published);

    return {
      ...summary,
      pages,
      boardDocumentIds: ((meta(run.published)?.boardDocumentIds as unknown[]) ?? []).map(String),
      events,
    };
  }

  // ---- internals -----------------------------------------------------------

  /** Newest first; one entry per jobId (legacy publish rows stand alone). */
  private async runs(tenantId: number): Promise<RunRows[]> {
    const rows = await this.auditRepo.find({
      where: { tenantId, action: In(ALL_ACTIONS) },
      order: { id: 'DESC' },
      take: SCAN_LIMIT,
    });
    const byKey = new Map<string, RunRows>();
    for (const row of rows) {
      const jobId = meta(row)?.jobId;
      const key = typeof jobId === 'string' && jobId ? jobId : `legacy:${row.id}`;
      const run = byKey.get(key) ?? { key };
      // Rows come newest first; keep the newest of each kind.
      if (row.action === INGEST_AUDIT.started) run.started ??= row;
      else if (row.action === INGEST_AUDIT.finished) run.finished ??= row;
      else if (row.action === INGEST_AUDIT.failed) run.failed ??= row;
      else run.published ??= row;
      byKey.set(key, run);
    }
    // Map insertion order = first (newest) row seen per run = newest activity first.
    return [...byKey.values()];
  }

  private summarize(run: RunRows, live: IngestJob | null, names: Map<number, string>): IngestRunSummary {
    const started = meta(run.started);
    const done = meta(run.finished) ?? meta(run.failed);
    const published = meta(run.published);
    const any = started ?? done ?? published ?? {};
    const liveJob = live && live.id === run.key ? live : null;

    const pages = (liveJob?.pages.length ? liveJob.pages : (done?.pages as IngestRunPage[] | undefined)) ?? [];
    const requested = (started?.pageUrls as string[] | undefined) ?? [];

    return {
      jobId: run.key.startsWith('legacy:') ? null : run.key,
      status: this.status(run, liveJob),
      sourceKind: str(any.sourceKind),
      sourceLabel: str(liveJob?.sourceLabel) ?? str(done?.sourceLabel) ?? str(any.sourceLabel),
      docGroup: str(any.docGroup),
      startedAt: run.started ? iso(run.started.createdAt) : null,
      finishedAt: run.finished || run.failed ? iso((run.finished ?? run.failed)!.createdAt) : null,
      publishedAt: run.published ? iso(run.published.createdAt) : null,
      startedBy: run.started ? names.get(Number(run.started.actorId)) ?? null : null,
      publishedBy: run.published ? names.get(Number(run.published.actorId)) ?? null : null,
      pagesTotal: Math.max(pages.length, requested.length),
      pagesOk: pages.filter((p) => p.status === 'done').length,
      drafted: liveJob?.status === INGEST_STATUS.READY ? liveJob.drafts.length : num(meta(run.finished)?.drafted) ?? num(published?.drafted),
      saved: num(published?.saved),
      error: liveJob?.error ?? str(meta(run.failed)?.error),
      expiresAt: liveJob?.status === INGEST_STATUS.READY ? ingestExpiresAt(liveJob) : null,
      ownerConfirmed: Boolean(started?.ownerConfirmed ?? published?.ownerConfirmed),
      legacy: !run.started && !run.finished && !run.failed,
    };
  }

  private status(run: RunRows, liveJob: IngestJob | null): IngestRunStatus {
    if (run.published) return INGEST_RUN_STATUS.PUBLISHED;
    if (liveJob?.status === INGEST_STATUS.RUNNING) return INGEST_RUN_STATUS.RUNNING;
    if (liveJob?.status === INGEST_STATUS.READY) return INGEST_RUN_STATUS.REVIEW;
    if (run.failed || liveJob?.status === INGEST_STATUS.FAILED) return INGEST_RUN_STATUS.FAILED;
    if (run.finished) return INGEST_RUN_STATUS.EXPIRED;
    return INGEST_RUN_STATUS.INTERRUPTED;
  }

  /** Display names of the run actors — name, else email; tenant-scoped. */
  private async names(tenantId: number, runs: RunRows[]): Promise<Map<number, string>> {
    const ids = new Set<number>();
    for (const r of runs) {
      for (const row of [r.started, r.finished, r.failed, r.published]) {
        const id = row ? Number(row.actorId) : 0;
        if (id > 0) ids.add(id);
      }
    }
    if (!ids.size) return new Map();
    const users = await this.userRepo.find({
      where: { tenantId, id: In([...ids]) as never },
      select: { id: true, name: true, email: true },
    });
    return new Map(users.map((u) => [Number(u.id), u.name?.trim() || u.email]));
  }
}

function meta(row?: AuditLog): Meta | undefined {
  const m = row?.metadata as unknown;
  if (!m) return undefined;
  if (typeof m === 'string') {
    try {
      return JSON.parse(m) as Meta;
    } catch {
      return undefined;
    }
  }
  return m as Meta;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function iso(d: Date | string): string {
  return new Date(d).toISOString();
}
