import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Mail } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Select } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { Pagination } from '@/components/Pagination';
import { Table } from '@/components/Table';
import type { Column } from '@/components/Table';
import { toast } from '@/store/toast-store';
import { useInquiries, useSetInquiryStatus } from './inquiries.hooks';
import { inquiriesService } from './inquiries.service';
import type { Inquiry, InquiryDetail, InquiryListParams } from './inquiries.service';

const PAGE_SIZE = 20;
// "All" first and by default: answered forms stay in view, the Status column tells them apart.
const STATUSES = ['all', 'open', 'answered'] as const;

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** `mailto:` with the shopper's address, a subject and their message quoted (D4). */
export function replyHref(detail: Pick<InquiryDetail, 'contactEmail' | 'message' | 'contactName'>, subject: string, wrote: string): string | null {
  if (!detail.contactEmail) return null;
  const quoted = (detail.message ?? '')
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
  const body = `\n\n${wrote}\n${quoted}`;
  return `mailto:${encodeURIComponent(detail.contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * One inquiry in full (ivy-docs T11 D4). Opening it reads the address and the
 * whole message — audited server-side — and they live only in this dialog's
 * state, never in the query cache.
 */
function InquiryDialog({ item, onClose }: { item: Inquiry; onClose: () => void }) {
  const { t } = useTranslation('livechat');
  const [detail, setDetail] = useState<InquiryDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const set = useSetInquiryStatus();

  useEffect(() => {
    let cancelled = false;
    inquiriesService
      .detail(item.id)
      .then((d) => !cancelled && setDetail(d))
      .catch((e: Error) => {
        if (cancelled) return;
        setFailed(true);
        toast.error(e.message || t('inquiry.loadError'), { sticky: true });
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, t]);

  const status = set.data?.status ?? detail?.status ?? item.status;
  const reply = detail
    ? replyHref(detail, t('inquiry.replySubject'), t('inquiry.replyWrote', { name: detail.contactName ?? '' }))
    : null;

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t('inquiry.dialogTitle', { at: when(item.createdAt) })}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {reply && (
            <a
              href={reply}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <Mail className="h-4 w-4" />
              {t('inquiry.reply')}
            </a>
          )}
          {status === 'open' ? (
            <Button disabled={set.isPending || !detail} onClick={() => set.mutate({ id: item.id, status: 'answered' })}>
              {t('inquiry.markAnswered')}
            </Button>
          ) : (
            <Button variant="secondary" disabled={set.isPending || !detail} onClick={() => set.mutate({ id: item.id, status: 'open' })}>
              {t('inquiry.reopen')}
            </Button>
          )}
        </div>
      }
    >
      {!detail ? (
        failed ? (
          <p className="text-sm text-gray-500">{t('inquiry.loadError')}</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('inquiry.loading')}
          </p>
        )
      ) : (
        <div className="space-y-3" data-testid="inquiry-detail">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-gray-900">{detail.contactName ?? '—'}</span>
            <span className="text-gray-600">{detail.contactEmail ?? '—'}</span>
            {detail.language && <Badge tone="gray">{detail.language}</Badge>}
            <Badge tone={status === 'open' ? 'warning' : 'success'}>{t(`inquiry.status_${status}`, { defaultValue: status })}</Badge>
          </div>
          <p className="whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-sm text-gray-800">{detail.message ?? ''}</p>
          {detail.conversationId && (
            <Link to={`/live-chat?c=${detail.conversationId}`} className="text-xs text-primary-600 hover:underline">
              {t('inquiry.openConversation', { id: detail.conversationId })}
            </Link>
          )}
          <p className="text-xs text-gray-400">{t('inquiry.replyHint')}</p>
        </div>
      )}
    </Modal>
  );
}

/**
 * "Inquiries" tab of the alarm center (ivy-docs T11 D4): the contact forms
 * shoppers sent from the widget's Contact Support. The team answers by email.
 */
export function InquiriesTab() {
  const { t } = useTranslation('livechat');
  const [status, setStatus] = useState<NonNullable<InquiryListParams['status']>>('all');
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<Inquiry | null>(null);
  const { data, isLoading, error } = useInquiries({ status, page, size: PAGE_SIZE });

  const columns: Column<Inquiry>[] = [
    { key: 'at', header: t('inquiry.col.received'), render: (i) => <span className="whitespace-nowrap text-xs text-gray-600">{when(i.createdAt)}</span> },
    { key: 'name', header: t('inquiry.col.name'), render: (i) => <span className="text-sm text-gray-900">{i.contactName ?? '—'}</span> },
    { key: 'email', header: t('inquiry.col.email'), render: (i) => <span className="font-mono text-xs text-gray-700">{i.contactEmailMasked ?? '—'}</span> },
    {
      key: 'message',
      header: t('inquiry.col.message'),
      render: (i) => <span className="line-clamp-2 max-w-md text-xs text-gray-600">{i.messagePreview ?? '—'}</span>,
    },
    {
      key: 'status',
      header: t('inquiry.col.status'),
      render: (i) => <Badge tone={i.status === 'open' ? 'warning' : 'success'}>{t(`inquiry.status_${i.status}`, { defaultValue: i.status })}</Badge>,
    },
    {
      key: 'open',
      header: '',
      render: (i) => (
        <button type="button" className="whitespace-nowrap text-xs font-medium text-primary-600 hover:underline" onClick={() => setOpened(i)}>
          {t('inquiry.open')}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-3" data-testid="inquiries-tab">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-gray-500">{t('inquiry.hint')}</p>
        <div className="ml-auto w-40">
          <Select
            aria-label={t('inquiry.col.status')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`inquiry.status_${s}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Table
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        error={error ? (error as Error).message : undefined}
        emptyMessage={t('inquiry.empty')}
        rowKey={(i) => i.id}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
      {opened && <InquiryDialog item={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}
