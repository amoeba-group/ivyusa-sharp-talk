import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { useIngestHistory, useIngestRun } from './knowledge.hooks';
import type { IngestRunStatus, IngestRunSummary } from './knowledge.service';

/** Codes the site agent localizes; anything else is shown as the server sent it. */
const KNOWN_ERRORS = ['E5110', 'E5111', 'E5112', 'E5113'];
const RECENT = 5;
const ALL = 50;

const TONE: Record<IngestRunStatus, 'info' | 'primary' | 'success' | 'warning' | 'error' | 'gray'> = {
  running: 'info',
  review: 'primary',
  published: 'success',
  expired: 'warning',
  failed: 'error',
  interrupted: 'gray',
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '');
const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

/** A run that can still be continued in the analysis modal. */
const resumable = (r: IngestRunSummary) => r.status === 'running' || r.status === 'review';

function useRunText() {
  const { t } = useTranslation('knowledge');
  const errorText = (code: string | null) =>
    code && KNOWN_ERRORS.includes(code) ? t(`site.error.${code}`) : code ?? '';

  return (r: IngestRunSummary): string => {
    switch (r.status) {
      case 'running':
        return t('siteHistory.line.running', { ok: r.pagesOk, total: r.pagesTotal });
      case 'review':
        return t('siteHistory.line.review', { count: r.drafted ?? 0, until: time(r.expiresAt) });
      case 'published':
        return r.legacy
          ? t('siteHistory.line.publishedLegacy', { saved: r.saved ?? 0 })
          : t('siteHistory.line.published', { saved: r.saved ?? 0, drafted: r.drafted ?? r.saved ?? 0 });
      case 'expired':
        return t('siteHistory.line.expired', { count: r.drafted ?? 0 });
      case 'failed':
        return errorText(r.error);
      default:
        return t('siteHistory.line.interrupted');
    }
  };
}

/**
 * "Recent analyses" under the website card (PLN-261026-Site-Ingest-History).
 * Running / review rows continue in the analysis modal; the rest open the
 * run's detail.
 */
export function IngestHistoryList({ onResume }: { onResume: () => void }) {
  const { t } = useTranslation('knowledge');
  const history = useIngestHistory('website', RECENT);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);

  const runs = history.data ?? [];

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-700">{t('siteHistory.title')}</h4>
        {runs.length > 0 && (
          <button type="button" className="text-xs text-primary-600 hover:underline" onClick={() => setAllOpen(true)}>
            {t('siteHistory.viewAll')}
          </button>
        )}
      </div>
      {history.isError ? (
        <p className="text-xs text-error">{t('siteHistory.loadError')}</p>
      ) : !runs.length && !history.isLoading ? (
        <p className="text-xs text-gray-500">{t('siteHistory.empty')}</p>
      ) : (
        <RunRows runs={runs} onResume={onResume} onOpen={setOpenRun} />
      )}

      <IngestRunDetailModal
        jobId={openRun}
        onClose={() => setOpenRun(null)}
        onResume={() => {
          setOpenRun(null);
          onResume();
        }}
      />
      <Modal open={allOpen} onClose={() => setAllOpen(false)} title={t('siteHistory.allTitle', { count: ALL })}>
        {allOpen && (
          <AllRuns
            onResume={() => {
              setAllOpen(false);
              onResume();
            }}
            onOpen={(id) => {
              setAllOpen(false);
              setOpenRun(id);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function AllRuns({ onResume, onOpen }: { onResume: () => void; onOpen: (jobId: string) => void }) {
  const { t } = useTranslation('knowledge');
  const history = useIngestHistory('website', ALL);
  if (history.isLoading) return null;
  const runs = history.data ?? [];
  return (
    <div className="space-y-2">
      {runs.length ? <RunRows runs={runs} onResume={onResume} onOpen={onOpen} /> : <p className="text-xs text-gray-500">{t('siteHistory.empty')}</p>}
      <p className="text-xs text-gray-400">{t('siteHistory.legacyNote')}</p>
    </div>
  );
}

function RunRows({
  runs,
  onResume,
  onOpen,
}: {
  runs: IngestRunSummary[];
  onResume: () => void;
  onOpen: (jobId: string) => void;
}) {
  const { t } = useTranslation('knowledge');
  const line = useRunText();
  return (
    <ul className="divide-y divide-gray-100">
      {runs.map((r, i) => (
        <li key={r.jobId ?? `legacy-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs sm:flex-nowrap">
          <Badge tone={TONE[r.status]}>{t(`siteHistory.status.${r.status}`)}</Badge>
          <span className="max-w-[10rem] truncate font-medium text-gray-800" title={r.sourceLabel ?? ''}>
            {r.sourceLabel}
          </span>
          <span className="min-w-0 flex-1 truncate text-gray-600" title={line(r)}>
            {line(r)}
          </span>
          <span className="shrink-0 whitespace-nowrap text-gray-400">
            {[r.startedBy ?? r.publishedBy, when(r.startedAt ?? r.publishedAt)].filter(Boolean).join(' · ')}
          </span>
          {resumable(r) ? (
            <button type="button" className="shrink-0 text-primary-600 hover:underline" onClick={onResume}>
              {r.status === 'running' ? t('site.viewProgress') : t('site.review')}
            </button>
          ) : r.jobId ? (
            <button type="button" className="shrink-0 text-primary-600 hover:underline" onClick={() => onOpen(r.jobId!)}>
              {t('siteHistory.detail')}
            </button>
          ) : (
            <span className="w-8 shrink-0" />
          )}
        </li>
      ))}
    </ul>
  );
}

const PAGE_TONE: Record<string, 'success' | 'gray' | 'warning' | 'error'> = {
  done: 'success',
  pending: 'gray',
  thin: 'warning',
  robots: 'warning',
  failed: 'error',
};

function IngestRunDetailModal({
  jobId,
  onClose,
  onResume,
}: {
  jobId: string | null;
  onClose: () => void;
  onResume: () => void;
}) {
  const { t } = useTranslation('knowledge');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const run = useIngestRun(jobId);
  const r = run.data;
  const line = useRunText();

  return (
    <Modal
      open={!!jobId}
      onClose={onClose}
      title={t('siteHistory.detailTitle', { site: r?.sourceLabel ?? '' })}
      footer={
        <>
          {r && resumable(r) && (
            <Button variant="secondary" onClick={onResume}>
              {r.status === 'running' ? t('site.viewProgress') : t('site.review')}
            </Button>
          )}
          {r && r.boardDocumentIds.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
                navigate('/knowledge/board');
              }}
            >
              {t('ingestViewBoard')}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {tc('close')}
          </Button>
        </>
      }
    >
      {run.isError && <p className="text-xs text-error">{t('siteHistory.loadError')}</p>}
      {r && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <Badge tone={TONE[r.status]}>{t(`siteHistory.status.${r.status}`)}</Badge>
            <span>{line(r)}</span>
            {r.docGroup && <span>· {t(`group.${r.docGroup}`)}</span>}
            {r.ownerConfirmed && <span>· {t('siteHistory.ownerConfirmed')}</span>}
          </div>

          <ol className="space-y-1 text-xs">
            {r.events.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-36 shrink-0 tabular-nums text-gray-400">{when(e.at)}</span>
                <span className="w-20 shrink-0 font-medium text-gray-700">{t(`siteHistory.event.${e.type}`)}</span>
                <span className="text-gray-600">
                  {[
                    e.by,
                    e.type === 'started' && r.pagesTotal ? t('siteHistory.pagesCount', { count: r.pagesTotal }) : null,
                    e.type === 'finished'
                      ? t('siteHistory.finishedNote', { drafted: r.drafted ?? 0, ok: r.pagesOk, total: r.pagesTotal })
                      : null,
                    e.type === 'published' ? t('siteHistory.publishedNote', { saved: r.saved ?? 0 }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ol>

          {r.pages.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-gray-700">{t('siteHistory.pages')}</h4>
              <ul className="space-y-1">
                {r.pages.map((p) => (
                  <li key={p.url} className="flex items-start gap-2 text-xs">
                    <Badge tone={PAGE_TONE[p.status] ?? 'gray'}>{t(`site.pageStatus.${p.status}`, { count: p.drafts })}</Badge>
                    <div className="min-w-0 flex-1">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-gray-700 hover:text-primary-600 hover:underline"
                        title={p.url}
                      >
                        {p.title || p.url}
                      </a>
                      {p.robotsOverridden && <span className="block text-gray-500">{t('site.robotsOverridden')}</span>}
                      {p.detail && p.status !== 'done' && <span className="text-gray-500">{p.detail}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.boardDocumentIds.length > 0 && (
            <p className="text-xs text-gray-600">
              {t('siteHistory.boardDocs')}{' '}
              {r.boardDocumentIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="mr-2 tabular-nums text-primary-600 hover:underline"
                  onClick={() => {
                    onClose();
                    navigate(`/knowledge/board/${id}`);
                  }}
                >
                  #{id}
                </button>
              ))}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
