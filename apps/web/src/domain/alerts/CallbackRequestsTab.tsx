import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/Badge';
import { Select } from '@/components/Field';
import { Pagination } from '@/components/Pagination';
import { Table } from '@/components/Table';
import type { Column } from '@/components/Table';
import { useCallbackRequests } from './callbacks.hooks';
import type { CallbackListParams, CallbackRequest } from './callbacks.service';
import { CallbackActions, CallbackContact } from './CallbackParts';

const PAGE_SIZE = 20;
const STATUSES = ['requested', 'done', 'canceled', 'all'] as const;

const statusTone = (s: string) => (s === 'requested' ? 'warning' : s === 'done' ? 'success' : 'gray');

/**
 * "콜백 요청" tab of the alarm center (PLN-261026 D6): customers who asked an
 * agent to contact them after the queue timed out or out of hours.
 */
export function CallbackRequestsTab() {
  const { t } = useTranslation('livechat');
  const [status, setStatus] = useState<NonNullable<CallbackListParams['status']>>('requested');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useCallbackRequests({ status, page, size: PAGE_SIZE });

  const when = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const columns: Column<CallbackRequest>[] = [
    { key: 'at', header: t('alarmCenter.col.at'), render: (c) => <span className="whitespace-nowrap text-xs text-gray-600">{when(c.createdAt)}</span> },
    { key: 'customer', header: t('alarmCenter.col.customer'), render: (c) => <span className="text-xs text-gray-700">{c.hotel ?? '—'}</span> },
    {
      key: 'contact',
      header: t('callback.col.contact'),
      render: (c) => (
        <span className="flex flex-col gap-0.5">
          <CallbackContact item={c} />
          <span className="text-[11px] text-gray-400">{t(`callback.source_${c.contactSource}`, { defaultValue: c.contactSource })}</span>
        </span>
      ),
    },
    {
      key: 'conv',
      header: t('alarmCenter.col.conversation'),
      render: (c) => (
        <Link to={`/live-chat?c=${c.conversationId}`} className="whitespace-nowrap text-xs text-primary-600 hover:underline">
          #{c.conversationId} ›
        </Link>
      ),
    },
    {
      key: 'status',
      header: t('alarmCenter.col.status'),
      render: (c) => (
        <span className="flex flex-col gap-0.5">
          <span>
            <Badge tone={statusTone(c.status)}>{t(`callback.status_${c.status}`, { defaultValue: c.status })}</Badge>
          </span>
          {c.status !== 'requested' && c.handledBy && (
            <span className="text-[11px] text-gray-400">{t('callback.handled', { name: c.handledBy.name, at: when(c.handledAt) })}</span>
          )}
        </span>
      ),
    },
    { key: 'actions', header: '', render: (c) => <CallbackActions item={c} /> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-gray-500">{t('callback.hint')}</p>
        <div className="ml-auto w-40">
          <Select
            aria-label={t('alarmCenter.col.status')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`callback.status_${s}`)}
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
        emptyMessage={t('callback.empty')}
        rowKey={(c) => c.id}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
