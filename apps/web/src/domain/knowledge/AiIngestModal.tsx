import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormRow, Input, Select } from '@/components/Field';
import { Progress } from '@/components/Progress';
import { toast } from '@/store/toast-store';
import {
  useApproveIngest,
  useIngestFile,
  useIngestStatus,
  useIngestVideo,
} from './knowledge.hooks';
import { IngestDraftReview, ReviewDraft, toApproveArticles, toReviewDrafts } from './IngestDraftReview';

/** Codes the ingest pipeline can fail with — localized here (PLN-260829 P3-9). */
const INGEST_ERROR_CODES = ['E5066', 'E5067', 'E5068', 'E5069', 'E5070'];

/**
 * AI import (PLN-260829 3차): file or YouTube URL → draft articles → operator
 * review → knowledge documents. The review step is the point: nothing the
 * model produced is saved until a person selected it (D4-1).
 */
export function AiIngestModal({
  open,
  onClose,
  defaultGroup,
}: {
  open: boolean;
  onClose: () => void;
  defaultGroup: string;
}) {
  const { t } = useTranslation('knowledge');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();

  const [group, setGroup] = useState(defaultGroup || 'counsel');
  const [mode, setMode] = useState<'file' | 'video'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [drafts, setDrafts] = useState<ReviewDraft[] | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const ingestFile = useIngestFile();
  const ingestVideo = useIngestVideo();
  const approve = useApproveIngest();
  const status = useIngestStatus(open);
  const job = status.data ?? null;

  // The tab the modal was opened from is only the starting value.
  useEffect(() => {
    if (open) {
      setGroup(defaultGroup || 'counsel');
      setDone(null);
    }
  }, [open, defaultGroup]);

  // Drafts become local, editable state exactly once per ready job.
  useEffect(() => {
    if (job?.status === 'ready' && drafts === null) {
      setDrafts(toReviewDrafts(job.drafts));
    }
  }, [job, drafts]);

  const localizedError = (code: string | null) =>
    code && INGEST_ERROR_CODES.includes(code) ? t(`ingestError.${code}`) : code;

  const start = () => {
    const onError = (err: Error & { code?: string }) =>
      toast.error(localizedError(err.code ?? null) ?? err.message);
    const onSuccess = () => {
      setDrafts(null);
      void status.refetch();
    };
    if (mode === 'file' && file) ingestFile.mutate({ file, docGroup: group }, { onError, onSuccess });
    if (mode === 'video' && videoUrl.trim())
      ingestVideo.mutate({ url: videoUrl.trim(), docGroup: group }, { onError, onSuccess });
  };

  const save = () => {
    approve.mutate(
      toApproveArticles(drafts ?? []),
      {
        onSuccess: (r) => {
          // B2 P4-6: approval publishes onto the board — adoption is a
          // separate reviewed step. Keep the modal open on a done state so
          // the operator has a direct path to the board (B4 P6-5).
          toast.success(t('ingestDoneBoard', { saved: r.saved }));
          setDrafts(null);
          setDone(r.saved);
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  const patchDraft = (i: number, patch: Partial<ReviewDraft>) =>
    setDrafts((prev) => prev!.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const running = job?.status === 'running';
  const reviewing = job?.status === 'ready' && drafts !== null;
  const failedCode = job?.status === 'failed' ? job.error : null;
  const starting = ingestFile.isPending || ingestVideo.isPending;
  const selectedCount = (drafts ?? []).filter((d) => d.selected).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t('aiImport')} — ${t(`group.${group}`)}`}
      footer={
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
            <Button disabled={!selectedCount || approve.isPending} onClick={save}>
              {approve.isPending ? tc('loading') : t('ingestSave', { count: selectedCount })}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {tc('close')}
            </Button>
            <Button
              disabled={running || starting || (mode === 'file' ? !file : !videoUrl.trim())}
              onClick={start}
            >
              {running || starting ? tc('loading') : t('ingestStart')}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-3 text-sm">
        {done !== null && (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
            {t('ingestDoneBoard', { saved: done })}
          </div>
        )}
        {done === null && !reviewing && (
          <>
            <FormRow label={t('groupColumn')}>
              <Select value={group} onChange={(e) => setGroup(e.target.value)} disabled={running}>
                <option value="counsel">{t('group.counsel')} · {t('ingestGroupCounsel')}</option>
                <option value="product">{t('group.product')} · {t('ingestGroupProduct')}</option>
                <option value="operation">{t('group.operation')} · {t('ingestGroupOperation')}</option>
              </Select>
            </FormRow>

            <div className="flex gap-1 border-b border-gray-200">
              {(['file', 'video'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`-mb-px border-b-2 px-3 py-2 ${
                    mode === m
                      ? 'border-primary-600 font-medium text-primary-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t(m === 'file' ? 'ingestFileTab' : 'ingestVideoTab')}
                </button>
              ))}
            </div>

            {mode === 'file' ? (
              <>
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.csv,.md,.markdown"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-2 file:text-sm file:text-white"
                />
                <p className="text-xs text-gray-500">{t('ingestFileHint')}</p>
              </>
            ) : (
              <>
                <Input
                  value={videoUrl}
                  placeholder="https://www.youtube.com/watch?v=…"
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <p className="text-xs text-gray-500">{t('ingestVideoHint')}</p>
              </>
            )}

            {running && (
              <div className="space-y-2 rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">
                  {job.phase === 'extracting' ? t('ingestExtracting') : t('ingestAnalyzing')}
                  {' — '}
                  {job.sourceLabel}
                </p>
                {job.phase === 'analyzing' && (
                  <Progress label={t('ingestAnalyzing')} done={job.analyzed} total={job.analyzeTotal} />
                )}
              </div>
            )}
            {failedCode && (
              <p className="text-xs text-red-600">{localizedError(failedCode)}</p>
            )}
          </>
        )}

        {done === null && reviewing && (
          <>
            <p className="text-xs text-gray-500">
              {t('ingestReviewHint', { source: job.sourceLabel })}
            </p>
            {job.truncated && <p className="text-xs text-warning">{t('ingestTruncated')}</p>}
            <IngestDraftReview drafts={drafts} onPatch={patchDraft} />
          </>
        )}
      </div>
    </Modal>
  );
}
