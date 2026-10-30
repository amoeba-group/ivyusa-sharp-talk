import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { FormRow, Input, Select } from '@/components/Field';
import { Progress } from '@/components/Progress';
import { toast } from '@/store/toast-store';
import { useAuthStore } from '@/store/auth-store';
import { useStorefront } from '../settings/settings.hooks';
import {
  useApproveIngest,
  useDiscoverSite,
  useIngestSite,
  useIngestStatus,
} from './knowledge.hooks';
import type { IngestJob, IngestPage, SiteCandidate, SiteDiscovery } from './knowledge.service';
import { IngestHistoryList } from './IngestHistory';
import { IngestDraftReview, ReviewDraft, toApproveArticles, toReviewDrafts } from './IngestDraftReview';

/** Mirrors the API's MAX_SITE_PAGES — the request is refused past it. */
const MAX_PAGES = 10;
/** Codes this flow localizes (PLN-261026 E5110–E5113 + the shared "already running"). */
const SITE_ERROR_CODES = ['E5110', 'E5111', 'E5112', 'E5113'];

/** First candidate of each kind except FAQ, in ranked order. */
function onePerKind(list: SiteCandidate[]): string[] {
  const seen = new Set<string>();
  return list
    .filter((c) => c.kind !== 'faq' && !seen.has(c.kind) && seen.add(c.kind))
    .map((c) => c.url)
    .slice(0, MAX_PAGES);
}

const isWebsiteJob = (job: IngestJob | null | undefined): job is IngestJob => job?.sourceKind === 'website';

/**
 * "Quick start" above the Sources card (PLN-261026 D4 — unnumbered, so the
 * process guide's steps and anchors stay as they are). The address defaults
 * to the tenant's storefront (D5) and is not stored.
 */
export function SitePolicyCard() {
  const rank = useAuthStore((s) => s.principal?.rank);
  // The agent's routes require KNOWLEDGE_SOURCE_MANAGE (master/director) — a
  // card everyone else could only fail with 403 is not shown to them.
  if (rank !== 'master' && rank !== 'director') return null;
  return <SitePolicyCardBody />;
}

function SitePolicyCardBody() {
  const { t } = useTranslation('knowledge');
  const storefront = useStorefront();
  const status = useIngestStatus(true);
  const job = status.data ?? null;

  const [url, setUrl] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; url: string }>({ open: false, url: '' });
  const value = url ?? storefront.data?.storefrontUrl ?? '';

  const websiteRunning = isWebsiteJob(job) && job.status === 'running';

  return (
    <>
      <Card navLabel={t('site.title')} title={<span className="flex items-center gap-2">🌐 {t('site.title')}</span>}>
        <p className="mb-3 text-xs text-gray-500">{t('site.hint')}</p>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) setModal({ open: true, url: value.trim() });
          }}
        >
          <Input
            value={value}
            placeholder="https://shop.example.com"
            aria-label={t('site.urlLabel')}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!value.trim() || websiteRunning}>
            {t('site.analyze')}
          </Button>
        </form>
        {/* PLN-261026-Site-Ingest-History: every run, including the live one. */}
        <IngestHistoryList onResume={() => setModal({ open: true, url: '' })} />
      </Card>
      <SitePolicyModal
        open={modal.open}
        initialUrl={modal.url}
        onClose={() => setModal({ open: false, url: '' })}
      />
    </>
  );
}

type Step = 'discover' | 'progress';

function SitePolicyModal({ open, initialUrl, onClose }: { open: boolean; initialUrl: string; onClose: () => void }) {
  const { t } = useTranslation('knowledge');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();

  const discover = useDiscoverSite();
  const ingestSite = useIngestSite();
  const approve = useApproveIngest();
  const status = useIngestStatus(open);
  const job = status.data ?? null;

  const [step, setStep] = useState<Step>('discover');
  const [found, setFound] = useState<SiteDiscovery | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<SiteCandidate[]>([]);
  const [manualUrl, setManualUrl] = useState('');
  const [group, setGroup] = useState('counsel');
  // D8: the operator vouches the site is theirs → robots.txt-blocked pages become selectable.
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);
  const [drafts, setDrafts] = useState<ReviewDraft[] | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const localized = (code: string | null | undefined, fallback?: string) => {
    if (code && SITE_ERROR_CODES.includes(code)) return t(`site.error.${code}`);
    if (code === 'E5069') return t('ingestError.E5069');
    return fallback ?? code ?? '';
  };

  const runDiscover = (siteUrl: string) => {
    setFound(null);
    setOwnerConfirmed(false);
    discover.mutate(siteUrl, {
      onSuccess: (r) => {
        setFound(r);
        setManual([]);
        // Default: the best readable page of each policy kind (the list is
        // already ranked) — ivyusa has a dozen per-brand privacy pages, and
        // analyzing all of them by default spends AI cost nobody asked for.
        setSelected(new Set(onePerKind(r.candidates.filter((c) => !c.robotsBlocked && !c.fileLink))));
        if (!r.candidates.length) toast.info(t('site.none'));
      },
      onError: (err: Error & { code?: string }) => toast.error(localized(err.code, err.message)),
    });
  };

  // Opening from the card with an address starts discovery; opening from the
  // "view progress / review" link resumes the website job instead.
  useEffect(() => {
    if (!open) return;
    setDone(null);
    setDrafts(null);
    setManualUrl('');
    if (initialUrl) {
      setStep('discover');
      runDiscover(initialUrl);
    } else {
      setStep('progress');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialUrl]);

  // Drafts become local, editable state exactly once per ready job.
  useEffect(() => {
    if (step === 'progress' && isWebsiteJob(job) && job.status === 'ready' && drafts === null) {
      setDrafts(toReviewDrafts(job.drafts));
    }
  }, [step, job, drafts]);

  const candidates = useMemo(() => [...(found?.candidates ?? []), ...manual], [found, manual]);

  const blockedPickable = candidates.filter((c) => c.robotsBlocked && !c.fileLink);

  const confirmOwner = (on: boolean) => {
    setOwnerConfirmed(on);
    // Confirming selects the policies robots.txt was hiding (Shopify /policies/*);
    // withdrawing it takes them out again — they cannot be read without it.
    setSelected((prev) => {
      if (!on) return new Set([...prev].filter((u) => !blockedPickable.some((c) => c.url === u)));
      // The standard policies go first; the page cap drops the tail of the
      // earlier picks rather than refusing the run.
      const added = blockedPickable.filter((c) => c.kind !== 'faq').map((c) => c.url);
      return new Set([...added, ...prev].slice(0, MAX_PAGES));
    });
  };

  const toggle = (url: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(url);
      else next.delete(url);
      return next;
    });

  const addManual = () => {
    let u: URL;
    try {
      u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(manualUrl.trim()) ? manualUrl.trim() : `https://${manualUrl.trim()}`);
    } catch {
      toast.error(t('site.error.E5110'));
      return;
    }
    const url = u.toString();
    if (!candidates.some((c) => c.url === url)) {
      setManual((m) => [
        ...m,
        { url, title: u.pathname, kind: 'other', source: 'link', robotsBlocked: false, fileLink: false },
      ]);
    }
    toggle(url, true);
    setManualUrl('');
  };

  const start = () => {
    ingestSite.mutate(
      { urls: [...selected], docGroup: group, ownerConfirmed },
      {
        onSuccess: () => {
          toast.success(t('site.started', { count: selected.size }));
          setDrafts(null);
          setStep('progress');
        },
        onError: (err: Error & { code?: string }) => toast.error(localized(err.code, err.message)),
      },
    );
  };

  const save = () => {
    approve.mutate(toApproveArticles(drafts ?? []), {
      onSuccess: (r) => {
        toast.success(t('ingestDoneBoard', { saved: r.saved }));
        setDrafts(null);
        setDone(r.saved);
      },
      onError: (err: Error) => toast.error(err.message),
    });
  };

  const patchDraft = (i: number, patch: Partial<ReviewDraft>) =>
    setDrafts((prev) => prev!.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const webJob = isWebsiteJob(job) ? job : null;
  const reviewing = step === 'progress' && webJob?.status === 'ready' && drafts !== null;
  const selectedDrafts = (drafts ?? []).filter((d) => d.selected).length;
  const overLimit = selected.size > MAX_PAGES;

  const footer =
    done !== null ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          {tc('close')}
        </Button>
        <Button
          onClick={() => {
            onClose();
            navigate('/knowledge/board');
          }}
        >
          {t('ingestViewBoard')}
        </Button>
      </>
    ) : reviewing ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          {tc('cancel')}
        </Button>
        <Button disabled={!selectedDrafts || approve.isPending} onClick={save}>
          {approve.isPending ? tc('loading') : t('site.publish', { count: selectedDrafts })}
        </Button>
      </>
    ) : step === 'discover' ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          {tc('cancel')}
        </Button>
        <Button disabled={!selected.size || overLimit || ingestSite.isPending || discover.isPending} onClick={start}>
          {ingestSite.isPending ? tc('loading') : t('site.start', { count: selected.size })}
        </Button>
      </>
    ) : (
      <Button variant="ghost" onClick={onClose}>
        {tc('close')}
      </Button>
    );

  return (
    <Modal open={open} onClose={onClose} title={t('site.title')} footer={footer}>
      <div className="space-y-3 text-sm">
        {done !== null && (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{t('ingestDoneBoard', { saved: done })}</div>
        )}

        {done === null && step === 'discover' && (
          <>
            {discover.isPending && <p className="text-xs text-gray-600">{t('site.discovering', { site: initialUrl })}</p>}
            {found && (
              <>
                <p className="text-xs text-gray-600">
                  {t('site.found', { site: found.site, count: found.candidates.length })}
                </p>
                <FormRow label={t('groupColumn')}>
                  <Select value={group} onChange={(e) => setGroup(e.target.value)}>
                    <option value="counsel">{t('group.counsel')} · {t('ingestGroupCounsel')}</option>
                    <option value="operation">{t('group.operation')} · {t('ingestGroupOperation')}</option>
                  </Select>
                </FormRow>
                {candidates.length ? (
                  <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
                    {candidates.map((c) => {
                      const disabled = c.fileLink || (c.robotsBlocked && !ownerConfirmed);
                      return (
                        <li key={c.url} className="flex items-start gap-2 px-3 py-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            disabled={disabled}
                            checked={!disabled && selected.has(c.url)}
                            aria-label={c.title}
                            onChange={(e) => toggle(c.url, e.target.checked)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={disabled ? 'text-gray-400' : 'text-gray-800'}>{c.title}</span>
                              <Badge tone="gray">{t(`site.kind.${c.kind}`)}</Badge>
                              {c.robotsBlocked && <Badge tone="warning">{t('site.robotsBlocked')}</Badge>}
                              {c.fileLink && <Badge tone="info">{t('site.fileLink')}</Badge>}
                            </div>
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-xs text-gray-500 hover:text-primary-600 hover:underline"
                            >
                              {c.url}
                            </a>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-500">{t('site.none')}</p>
                )}
                {blockedPickable.length > 0 && (
                  <label className="flex items-start gap-2 rounded-md bg-gray-50 p-3 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={ownerConfirmed}
                      onChange={(e) => confirmOwner(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium">{t('site.ownerConfirm')}</span>
                      <span className="mt-0.5 block text-gray-500">
                        {t('site.ownerConfirmHint', { count: blockedPickable.length })}
                      </span>
                    </span>
                  </label>
                )}
                {overLimit && <p className="text-xs text-error">{t('site.maxPages', { max: MAX_PAGES })}</p>}
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (manualUrl.trim()) addManual();
                  }}
                >
                  <Input
                    value={manualUrl}
                    placeholder={t('site.addUrlPlaceholder')}
                    aria-label={t('site.addUrl')}
                    onChange={(e) => setManualUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" variant="ghost" disabled={!manualUrl.trim()}>
                    {t('site.add')}
                  </Button>
                </form>
              </>
            )}
          </>
        )}

        {done === null && step === 'progress' && !reviewing && (
          <JobProgress job={webJob} localizeError={(c) => localized(c)} />
        )}

        {done === null && reviewing && (
          <>
            <JobPages pages={webJob.pages ?? []} />
            <p className="text-xs text-gray-500">{t('ingestReviewHint', { source: webJob.sourceLabel })}</p>
            {webJob.truncated && <p className="text-xs text-warning">{t('site.truncated')}</p>}
            <IngestDraftReview drafts={drafts} onPatch={patchDraft} />
          </>
        )}
      </div>
    </Modal>
  );
}

function JobProgress({ job, localizeError }: { job: IngestJob | null; localizeError: (code: string | null) => string }) {
  const { t } = useTranslation('knowledge');
  if (!job) return <p className="text-xs text-gray-500">{t('site.noJob')}</p>;
  const pages = job.pages ?? [];
  const finished = pages.filter((p) => p.status !== 'pending').length;
  return (
    <div className="space-y-3">
      {job.status === 'running' && <Progress label={t('site.progress')} done={finished} total={pages.length} />}
      {job.status === 'failed' && <p className="text-xs text-error">{localizeError(job.error)}</p>}
      <JobPages pages={pages} />
    </div>
  );
}

function JobPages({ pages }: { pages: IngestPage[] }) {
  const { t } = useTranslation('knowledge');
  if (!pages.length) return null;
  const tone = (s: IngestPage['status']) =>
    s === 'done' ? 'success' : s === 'pending' ? 'gray' : s === 'failed' ? 'error' : 'warning';
  return (
    <ul className="space-y-1">
      {pages.map((p) => (
        <li key={p.url} className="flex items-start gap-2 text-xs">
          <Badge tone={tone(p.status)}>{t(`site.pageStatus.${p.status}`, { count: p.drafts })}</Badge>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-gray-700" title={p.url}>
              {p.title}
            </span>
            {p.robotsOverridden && <span className="block text-gray-500">{t('site.robotsOverridden')}</span>}
            {p.status === 'thin' && <span className="text-gray-500">{t('site.thinHint')}</span>}
            {p.status === 'failed' && p.detail && <span className="text-gray-500">{p.detail}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
