import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { AI_FUNCTION } from '@sharptalk/types';
import { AiGatewayService } from '../../infrastructure/external/ai/ai-gateway.service';
import { KbFile } from './entity/kb-file.entity';
import { KbCategoryService } from './kb-category.service';
import { KbRevisionService } from './kb-revision.service';
import { BoardService } from '../board/board.service';
import { BoardAttachmentService } from '../board/board-attachment.service';
import { BOARD_DOC_STATUS } from '../board/entity/board-document.entity';
import { extractText } from './file-extract.util';
import { fetchYoutubeTranscript } from './youtube-transcript.util';
import {
  INGEST_PAGE_STATUS,
  IngestDraft,
  IngestEventType,
  IngestJob,
  IngestPage,
  KnowledgeIngestJobService,
} from './knowledge-ingest-job.service';
import { INGEST_AUDIT } from './ingest-history.service';
import { safeFetch, SiteFetchError, SiteFetcher } from './site/safe-fetch.util';
import { boilerplateLines, extractPageText } from './site/html-text.util';
import { discoverPolicyPages, normalizeUrl, PolicyCandidate, sameSite } from './site/policy-discover.util';
import { ALLOW_ALL, parseRobots } from './site/robots.util';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';

/** ~12K chars per LLM pass — small enough to segment attentively. */
const CHUNK_CHARS = 12_000;
/** P3-7: a runaway segmentation stops proposing, not the operator reviewing. */
const MAX_DRAFTS = 100;
/** PLN-261026: pages per website run — LLM cost and politeness to the shop. */
export const MAX_SITE_PAGES = 10;

type AnalyzeMode = 'generic' | 'policy';

export interface SiteDiscovery {
  site: string;
  platform: string | null;
  candidates: Array<Omit<PolicyCandidate, 'score'>>;
}

export interface ApproveArticle {
  title: string;
  category: string;
  content: string;
  /** Website ingest: the page the draft came from — attached as a link. */
  source_url?: string;
}
/**
 * AI file/video ingest (PLN-260829 3차): unstructured source → draft articles
 * → operator approval → knowledge documents.
 *
 * Routed as SUMMARY with feature 'knowledge_ingest' — the same precedent the
 * conflict judge set (CHAT + feature): a new AI capability rides an existing
 * function's routing instead of inventing one nothing routes yet, and usage
 * metering already breaks out by feature.
 *
 * Nothing is knowledge until a person approves it (D4-1): the LLM only ever
 * produces drafts held in the job store.
 */
@Injectable()
export class KnowledgeIngestService {
  private readonly logger = new Logger(KnowledgeIngestService.name);

  constructor(
    @InjectRepository(KbFile) private readonly fileRepo: Repository<KbFile>,
    private readonly ai: AiGatewayService,
    private readonly categories: KbCategoryService,
    private readonly revisions: KbRevisionService,
    private readonly board: BoardService,
    private readonly attachments: BoardAttachmentService,
    private readonly jobs: KnowledgeIngestJobService,
    private readonly config: ConfigService,
  ) {}

  /** Outbound fetcher — a property, not a provider, so tests swap it without Nest wiring. */
  fetcher: SiteFetcher = safeFetch;
  /** Pause between page fetches of one site (politeness; tests set 0). */
  pageDelayMs = 500;

  status(tenantId: number): IngestJob | null {
    return this.jobs.get(tenantId);
  }

  /** Upload path: store the original (D4-2), then analyze detached. */
  async startFile(
    tenantId: number,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    docGroup: string,
    actorUserId: number | null = null,
  ): Promise<IngestJob> {
    // Extension gate up front so an unsupported file fails the REQUEST, not the
    // job the operator would have to poll to see fail.
    if (!/\.(pdf|docx|xlsx|csv|md|markdown)$/i.test(file.originalname)) {
      throw new BusinessException(ERROR_CODE.INGEST_UNSUPPORTED_FILE, HttpStatus.BAD_REQUEST);
    }
    const stored = await this.storeOriginal(tenantId, file);

    return this.jobs.start(
      tenantId,
      {
        sourceLabel: file.originalname,
        sourceKind: 'file_upload',
        docGroup,
        fileId: Number(stored.id),
        sourceUrl: null,
        startedBy: actorUserId,
      },
      async (report) => {
        const extracted = await extractText(file.originalname, file.buffer);
        report.extracted(extracted.truncated);
        return this.analyze(tenantId, docGroup, file.originalname, extracted.text, report);
      },
      this.recordEvent,
    );
  }

  /** Video path (R5 P1): public YouTube captions → the same analysis. */
  startVideo(tenantId: number, url: string, docGroup: string, actorUserId: number | null = null): IngestJob {
    return this.jobs.start(
      tenantId,
      {
        sourceLabel: url,
        sourceKind: 'youtube',
        docGroup,
        fileId: null,
        sourceUrl: url,
        startedBy: actorUserId,
      },
      async (report) => {
        const transcript = await fetchYoutubeTranscript(url);
        report.extracted(false, `${transcript.title} [${transcript.track}]`);
        return this.analyze(tenantId, docGroup, transcript.title, transcript.text, report);
      },
      this.recordEvent,
    );
  }

  // ---- website policy agent (PLN-261026) ----------------------------------

  /**
   * Find the policy pages of the operator's website. Synchronous: discovery is
   * a handful of bounded requests, and the operator picks from the result
   * before any LLM cost is spent (D2).
   */
  async discoverSite(rawUrl: string): Promise<SiteDiscovery> {
    const url = this.siteUrl(rawUrl);
    try {
      const r = await discoverPolicyPages(url, this.fetcher);
      return {
        site: r.site,
        platform: r.platform,
        candidates: r.candidates.map(({ score: _score, ...c }) => c),
      };
    } catch (e) {
      throw this.siteError(e, url);
    }
  }

  /**
   * Read the selected pages and draft board articles from them (async, 202 + polling).
   *
   * `ownerConfirmed` (PLN-261026 D8): robots.txt addresses crawlers, and
   * Shopify's default one disallows /policies/ for every bot — so a store's
   * own standard policies were unreadable. When the operator confirms the site
   * is theirs, this is the owner fetching their own pages on demand, and
   * robots.txt is not applied. Without the confirmation it still is.
   */
  startSite(
    tenantId: number,
    rawUrls: string[],
    docGroup: string,
    ownerConfirmed = false,
    actorUserId: number | null = null,
  ): IngestJob {
    const urls = [...new Set(rawUrls.map((u) => normalizeUrl(this.siteUrl(u))))];
    if (!urls.length || urls.length > MAX_SITE_PAGES) {
      throw new BusinessException(ERROR_CODE.VALIDATION_FAILED, HttpStatus.BAD_REQUEST);
    }
    if (urls.some((u) => !sameSite(u, urls[0]))) {
      this.logger.warn(`site ingest rejected (tenant ${tenantId}): pages span several sites`);
      throw new BusinessException(ERROR_CODE.SITE_URL_FOREIGN, HttpStatus.BAD_REQUEST);
    }
    const origin = new URL(urls[0]).origin;

    return this.jobs.start(
      tenantId,
      {
        sourceLabel: new URL(origin).hostname,
        sourceKind: 'website',
        docGroup,
        fileId: null,
        sourceUrl: origin,
        ownerConfirmed,
        startedBy: actorUserId,
        requestedUrls: urls,
      },
      async (report) => {
        const pages: IngestPage[] = urls.map((url) => ({
          url,
          title: url,
          status: INGEST_PAGE_STATUS.PENDING,
          drafts: 0,
          detail: null,
        }));
        pages.forEach((p) => report.page({ ...p }));

        // Best-effort context: robots.txt (obeyed) and the home page (its
        // lines are the site template to subtract from every page).
        const [robotsText, homeHtml] = await Promise.all([
          this.fetcher(`${origin}/robots.txt`, { accept: 'text', timeoutMs: 5000, maxBytes: 256 * 1024 })
            .then((r) => r.body)
            .catch(() => ''),
          this.fetcher(`${origin}/`, { accept: 'html' })
            .then((r) => r.body)
            .catch(() => ''),
        ]);
        const robots = robotsText ? parseRobots(robotsText) : ALLOW_ALL;
        const boilerplate = homeHtml ? boilerplateLines(homeHtml) : undefined;
        report.extracted(false);

        const existing = await this.steeringCategories(tenantId, docGroup);
        const drafts: IngestDraft[] = [];
        for (const [i, page] of pages.entries()) {
          report.analyzing(i, pages.length);
          if (drafts.length >= MAX_DRAFTS) break;
          const u = new URL(page.url);
          const robotsOverridden = !robots.isAllowed(`${u.pathname}${u.search}`);
          if (robotsOverridden && !ownerConfirmed) {
            report.page({ ...page, status: INGEST_PAGE_STATUS.ROBOTS, detail: 'robots.txt' });
            continue;
          }
          if (robotsOverridden) {
            this.logger.log(`site page read past robots.txt on owner confirmation (tenant ${tenantId}): ${page.url}`);
            page.robotsOverridden = true;
          }
          if (i > 0 && this.pageDelayMs) await new Promise((r) => setTimeout(r, this.pageDelayMs));
          try {
            const fetched = await this.fetcher(page.url, { accept: 'html' });
            const extracted = extractPageText(fetched.body, boilerplate);
            const title = extracted.heading || extracted.title || page.url;
            if (extracted.thin) {
              report.page({ ...page, title, status: INGEST_PAGE_STATUS.THIN, detail: `${extracted.text.length} chars` });
              continue;
            }
            if (extracted.truncated) report.extracted(true);
            const pageDrafts: IngestDraft[] = [];
            const chunks = this.split(extracted.text);
            for (const [ci, chunk] of chunks.entries()) {
              const out = await this.analyzeChunk(tenantId, docGroup, title, existing, chunk, ci, chunks.length, 'policy');
              pageDrafts.push(...out.map((d) => ({ ...d, sourceUrl: page.url })));
            }
            drafts.push(...pageDrafts);
            report.page({ ...page, title, status: INGEST_PAGE_STATUS.DONE, drafts: pageDrafts.length });
          } catch (e) {
            const detail =
              e instanceof SiteFetchError ? (e.status ? `HTTP ${e.status}` : e.kind) : (e as Error).message;
            this.logger.warn(`site page failed (tenant ${tenantId}) ${page.url}: ${detail}`);
            report.page({ ...page, status: INGEST_PAGE_STATUS.FAILED, detail: detail.slice(0, 120) });
          }
        }
        report.analyzing(pages.length, pages.length);

        if (!drafts.length) {
          throw new BusinessException(ERROR_CODE.SITE_NO_CONTENT, HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const onBoard = await this.board.titlesInGroup(tenantId, docGroup);
        return drafts.slice(0, MAX_DRAFTS).map((d) => ({ ...d, duplicateOnBoard: onBoard.has(d.title) }));
      },
      this.recordEvent,
    );
  }

  /**
   * Run history (PLN-261026-Site-Ingest-History D1): each lifecycle event is an
   * audit row keyed by jobId — the in-memory job vanishes an hour after it
   * ends (or on any restart), the audit row does not. Pages are summarized,
   * draft bodies are not stored (they are not knowledge until approved).
   */
  private readonly recordEvent = (type: IngestEventType, tenantId: number, job: IngestJob): Promise<void> => {
    const base = {
      jobId: job.id,
      sourceKind: job.sourceKind,
      sourceLabel: job.sourceLabel,
      sourceUrl: job.sourceUrl,
      docGroup: job.docGroup,
    };
    const pages = job.pages.map((p) => ({
      url: p.url,
      title: p.title,
      status: p.status,
      drafts: p.drafts,
      detail: p.detail,
      ...(p.robotsOverridden ? { robotsOverridden: true } : {}),
    }));
    const meta =
      type === 'started'
        ? { ...base, ownerConfirmed: job.ownerConfirmed ?? false, pageUrls: job.requestedUrls ?? [] }
        : type === 'finished'
          ? { ...base, drafted: job.drafts.length, truncated: job.truncated, pages }
          : { ...base, error: job.error, pages };
    return this.revisions.recordAudit(tenantId, 0, INGEST_AUDIT[type], job.startedBy ?? null, meta);
  };

  /** Operator input → absolute https URL. A bare "shop.com" means https://shop.com. */
  private siteUrl(raw: string): string {
    const trimmed = (raw ?? '').trim();
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let u: URL;
    try {
      u = new URL(withScheme);
    } catch {
      throw new BusinessException(ERROR_CODE.SITE_URL_REJECTED, HttpStatus.BAD_REQUEST);
    }
    // Credentials in the URL would ride along to the shop's server.
    if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) {
      throw new BusinessException(ERROR_CODE.SITE_URL_REJECTED, HttpStatus.BAD_REQUEST);
    }
    return u.toString();
  }

  private siteError(e: unknown, url: string): BusinessException {
    if (e instanceof BusinessException) return e;
    const blocked = e instanceof SiteFetchError && e.kind === 'blocked';
    const detail = e instanceof SiteFetchError ? `${e.kind}${e.status ? ` ${e.status}` : ''}` : (e as Error)?.message;
    // 4xx are not server-logged by default — say why the request was refused.
    this.logger.warn(`site discovery failed ${url}: ${detail}`);
    return blocked
      ? new BusinessException(ERROR_CODE.SITE_URL_REJECTED, HttpStatus.BAD_REQUEST)
      : new BusinessException(ERROR_CODE.SITE_UNREACHABLE, HttpStatus.UNPROCESSABLE_ENTITY);
  }

  private async attachPageLinks(
    tenantId: number,
    job: { pages: IngestPage[] },
    links: Array<{ id: number; url: string }>,
    actorUserId: number,
  ): Promise<number> {
    let attached = 0;
    for (const l of links) {
      try {
        const title = job.pages.find((p) => p.url === l.url)?.title;
        await this.attachments.addLink(tenantId, l.id, l.url, title?.slice(0, 200), actorUserId);
        attached += 1;
      } catch (e) {
        this.logger.warn(`site link attach failed (tenant ${tenantId}, doc ${l.id}): ${(e as Error).message}`);
      }
    }
    return attached;
  }

  /**
   * Publish the drafts the operator selected onto the Smart Knowledge Board
   * (B2 P4-6 — REQ C2: external material lands on the board first; adoption
   * into KB is the reviewer's separate call). Consumes the job: a second
   * approve of the same run would duplicate every article.
   */
  async approve(
    tenantId: number,
    articles: ApproveArticle[],
    actorUserId: number,
  ): Promise<Record<string, unknown>> {
    const job = this.jobs.ready(tenantId);
    if (!articles.length) {
      throw new BusinessException(ERROR_CODE.VALIDATION_FAILED, HttpStatus.BAD_REQUEST);
    }
    const website = job.sourceKind === 'website';
    // Only pages this job actually read may be attached — the client echoes
    // the URL back, it does not get to choose one.
    const jobPages = new Set(job.pages.map((p) => p.url));

    const boardDocumentIds: string[] = [];
    const pageLinks: Array<{ id: number; url: string }> = [];
    for (const a of articles) {
      const title = a.title.trim().slice(0, 255);
      const category = a.category.trim().slice(0, 64);
      const content = a.content.trim();
      if (!title || !category || !content) {
        throw new BusinessException(ERROR_CODE.VALIDATION_FAILED, HttpStatus.BAD_REQUEST);
      }
      const doc = await this.board.create(
        tenantId,
        {
          doc_group: job.docGroup,
          category1: category,
          title,
          content,
          // The tag is how a reviewer later tells machine-drafted entries from
          // hand-written ones; site-policy marks the website agent's output.
          tags: website ? ['ai-import', 'site-policy'] : ['ai-import'],
          status: BOARD_DOC_STATUS.PUBLISHED,
        },
        { userId: actorUserId, rank: 'staff' },
      );
      boardDocumentIds.push(String(doc.id));
      if (website && a.source_url && jobPages.has(a.source_url)) {
        pageLinks.push({ id: Number(doc.id), url: a.source_url });
      }
    }

    // B4 P6-6: link the source to every approved document so the reviewer can
    // open the original from the board. Attachment failure must not undo an
    // approval that already published the documents — warn and move on.
    const attachedOriginals = website
      ? await this.attachPageLinks(tenantId, job, pageLinks, actorUserId)
      : await this.attachOriginal(tenantId, job, boardDocumentIds, actorUserId);

    const result = {
      jobId: job.id,
      sourceLabel: job.sourceLabel,
      sourceKind: job.sourceKind,
      docGroup: job.docGroup,
      drafted: job.drafts.length,
      saved: boardDocumentIds.length,
      target: 'board',
      boardDocumentIds,
      attachedOriginals,
    };
    await this.revisions.recordAudit(
      tenantId,
      0,
      website ? 'knowledge.site_ingested' : 'knowledge.file_ingested',
      actorUserId,
      website
        ? {
            ...result,
            ownerConfirmed: job.ownerConfirmed ?? false,
            pages: job.pages.map((p) => ({
              url: p.url,
              status: p.status,
              ...(p.robotsOverridden ? { robotsOverridden: true } : {}),
            })),
          }
        : result,
    );
    this.jobs.markConsumed(tenantId, result);
    this.logger.log(
      `ingest approved (tenant ${tenantId}): "${job.sourceLabel}" → board docs=${boardDocumentIds.length}`,
    );
    return result;
  }

  // ---- internals ----------------------------------------------------------

  private async attachOriginal(
    tenantId: number,
    job: { sourceKind: string; sourceLabel: string; fileId: number | null; sourceUrl: string | null },
    boardDocumentIds: string[],
    actorUserId: number,
  ): Promise<number> {
    const ids = boardDocumentIds.map(Number);
    try {
      if (job.sourceKind === 'youtube' && job.sourceUrl) {
        for (const id of ids) {
          await this.attachments.addLink(tenantId, id, job.sourceUrl, job.sourceLabel, actorUserId);
        }
        return ids.length;
      }
      if (job.fileId) {
        const original = await this.fileRepo.findOne({ where: { id: job.fileId, tenantId } });
        if (!original?.storagePath) return 0;
        const root = resolve(this.config.get<string>('UPLOAD_DIR', './.uploads'));
        const buffer = await readFile(join(root, original.storagePath));
        // ONE stored copy under board/, shared by every approved document —
        // the kb_files original stays where it is, for audit (P6-7).
        return this.attachments.attachSharedCopy(
          tenantId,
          ids,
          { filename: original.filename, mime: original.mime, buffer },
          actorUserId,
        );
      }
      return 0;
    } catch (e) {
      this.logger.warn(`ingest original attach failed (tenant ${tenantId}): ${(e as Error).message}`);
      return 0;
    }
  }

  private async storeOriginal(
    tenantId: number,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ): Promise<KbFile> {
    // Same volume as chat attachments (S-10): anything outside UPLOAD_DIR does
    // not survive a redeploy.
    const root = resolve(this.config.get<string>('UPLOAD_DIR', './.uploads'));
    const rel = join('kb-ingest', String(tenantId));
    const ext = file.originalname.match(/\.[a-z0-9]+$/i)?.[0] ?? '';
    const name = `${randomUUID()}${ext.toLowerCase()}`;
    await mkdir(join(root, rel), { recursive: true });
    await writeFile(join(root, rel, name), file.buffer);
    return this.fileRepo.save(
      this.fileRepo.create({
        tenantId,
        // source_id is NOT NULL (built for board posts); 0 = "no source —
        // direct operator upload", chosen over a schema change (P3-6).
        sourceId: 0,
        postId: null,
        filename: file.originalname,
        mime: file.mimetype,
        storagePath: join(rel, name),
        size: file.size,
      }),
    );
  }

  private async analyze(
    tenantId: number,
    docGroup: string,
    sourceLabel: string,
    text: string,
    report: { analyzing: (done: number, total: number) => void },
  ): Promise<IngestDraft[]> {
    const chunks = this.split(text);
    const existing = await this.steeringCategories(tenantId, docGroup);

    const drafts: IngestDraft[] = [];
    for (const [i, chunk] of chunks.entries()) {
      report.analyzing(i, chunks.length);
      if (drafts.length >= MAX_DRAFTS) break;
      drafts.push(...(await this.analyzeChunk(tenantId, docGroup, sourceLabel, existing, chunk, i, chunks.length)));
    }
    report.analyzing(chunks.length, chunks.length);
    return drafts.slice(0, MAX_DRAFTS);
  }

  /**
   * Existing categories steer the mapping — reusing the tenant's taxonomy
   * beats inventing a parallel one (same reason the console suggests them).
   */
  private async steeringCategories(tenantId: number, docGroup: string): Promise<string[]> {
    return (await this.categories.list(tenantId, docGroup))
      .filter((c) => !c.hidden)
      .map((c) => c.name)
      .slice(0, 50);
  }

  private async analyzeChunk(
    tenantId: number,
    docGroup: string,
    sourceLabel: string,
    existingCategories: string[],
    chunk: string,
    index: number,
    total: number,
    mode: AnalyzeMode = 'generic',
  ): Promise<IngestDraft[]> {
    const res = await this.ai.complete({
      tenantId,
      function: AI_FUNCTION.SUMMARY,
      // D7: metered apart from file/video import on the usage screen.
      feature: mode === 'policy' ? 'knowledge_site_policy' : 'knowledge_ingest',
      maxTokens: 8000,
      system: mode === 'policy' ? policyPrompt(existingCategories) : genericPrompt(existingCategories),
      messages: [
        {
          role: 'user',
          content: `Source: ${sourceLabel} (part ${index + 1}/${total}, group: ${docGroup})\n\n${chunk}`,
        },
      ],
    });

    const parsed = this.parseArticles(res.text);
    if (parsed) return parsed.map((a) => ({ ...a, fallback: false }));
    // P3-4: a chunk whose output cannot be read becomes ONE whole-chunk draft.
    // Review catches the quality; nothing silently disappears. This is also
    // what makes the keyless/stub environment usable end to end.
    return [
      {
        title: `${sourceLabel} — part ${index + 1}/${total}`,
        category: existingCategories[0] ?? 'general',
        content: chunk,
        fallback: true,
      },
    ];
  }

  private parseArticles(
    raw: string,
  ): Array<{ title: string; category: string; content: string }> | null {
    // Models fence JSON or preface it; slice from the outermost braces.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        articles?: Array<{ title?: unknown; category?: unknown; content?: unknown }>;
      };
      if (!Array.isArray(parsed.articles) || !parsed.articles.length) return null;
      const items = parsed.articles
        .filter(
          (a) =>
            typeof a.title === 'string' &&
            typeof a.category === 'string' &&
            typeof a.content === 'string' &&
            (a.content as string).trim() !== '',
        )
        .map((a) => ({
          title: (a.title as string).trim().slice(0, 255),
          category: (a.category as string).trim().slice(0, 64),
          content: (a.content as string).trim(),
        }));
      return items.length ? items : null;
    } catch {
      return null;
    }
  }

  /** Split on paragraph boundaries near the chunk size — mid-sentence cuts cost accuracy. */
  private split(text: string): string[] {
    const chunks: string[] = [];
    let rest = text;
    while (rest.length > CHUNK_CHARS) {
      const window = rest.slice(0, CHUNK_CHARS);
      const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), CHUNK_CHARS / 2);
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut);
    }
    if (rest.trim()) chunks.push(rest.trim());
    return chunks;
  }
}

function genericPrompt(existingCategories: string[]): string {
  return (
    'JSON_MODE:kb_ingest. You convert a source document into self-contained knowledge-base ' +
    'articles for a customer-support RAG system. Segment the given text into articles, one ' +
    'per task/topic. Rules: keep the source language; never invent facts not in the text; ' +
    'each article must be understandable on its own; title ≤ 100 chars; prefer one of the ' +
    `existing categories [${existingCategories.join(', ')}] and only propose a new short ` +
    'category name when none fits. Return ONLY JSON: ' +
    '{"articles":[{"title":string,"category":string,"content":string}]}'
  );
}

/**
 * PLN-261026: a policy page is answered from in fragments ("how many days to
 * return?", "who pays return shipping?"), so it is cut along the questions a
 * customer asks, and the numbers that decide those answers are copied, never
 * paraphrased — "about two weeks" for "14 days" is a wrong answer.
 */
function policyPrompt(existingCategories: string[]): string {
  return (
    'JSON_MODE:kb_ingest. You convert one page of a store\'s website policy (returns, refunds, ' +
    'exchanges, shipping, privacy, terms, payment or FAQ) into self-contained knowledge-base ' +
    'articles for a customer-support RAG system. Write one article per question a customer ' +
    'would ask (e.g. return window, who pays return shipping, refund timing, shipping fee and ' +
    'free-shipping threshold, delivery time, data deletion request). Rules: keep the page\'s ' +
    'language; copy every number, period, fee, condition, exception and contact detail exactly; ' +
    'never invent, generalize or add facts that are not in the text; leave out navigation, ' +
    'cookie banners and marketing copy; each article must be understandable on its own; ' +
    'title ≤ 100 chars naming the topic; markdown lists and tables are allowed in content; ' +
    `prefer one of the existing categories [${existingCategories.join(', ')}] and only propose ` +
    'a new short category name (e.g. Returns, Shipping, Privacy, Terms) when none fits. ' +
    'Return ONLY JSON: {"articles":[{"title":string,"category":string,"content":string}]}'
  );
}
