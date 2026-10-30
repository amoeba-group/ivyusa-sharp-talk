import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserRound, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { StatusBadge } from '@/components/StatusBadge';
import { Table } from '@/components/Table';
import type { Column } from '@/components/Table';
import { Pagination } from '@/components/Pagination';
import { Drawer } from '@/components/Drawer';
import {
  FilterBar,
  FilterDate,
  FilterSelect,
  FilterToggle,
  ResetFiltersButton,
  SearchField,
} from '@/components/Toolbar';
import { formatDateTime } from '@/lib/format';
import { useUsers } from '@/domain/users/users.hooks';
import { useConversations } from './history.hooks';
import { ConversationTranscript } from './ConversationTranscript';
import type { ConversationRow } from './history.service';

const PAGE_SIZE = 20;

type StatusFilter = '' | 'open' | 'resolved' | 'escalated' | 'ended';
type EscalatedFilter = 'all' | 'yes' | 'no';

export function HistoryPage() {
  const { t } = useTranslation('history');
  const { t: tc } = useTranslation('common');
  const { t: tl } = useTranslation('livechat');
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('');
  const [escalated, setEscalated] = useState<EscalatedFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [agentId, setAgentId] = useState('');
  const [includePreview, setIncludePreview] = useState(false);
  const [segment, setSegment] = useState<'' | 'b2b' | 'b2c'>('');
  // Draft vs applied: typing in the search box must not refire a query (and an
  // audit-free but still paginated one) on every keystroke.
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ConversationRow | null>(null);

  const users = useUsers();
  const agents = (users.data ?? []).filter(
    (u) => u.labelCodes?.includes('consult') && u.status !== 'inactive',
  );

  const { data, isLoading, error } = useConversations({
    page,
    pageSize: PAGE_SIZE,
    status: status || undefined,
    escalated: escalated === 'all' ? undefined : escalated === 'yes',
    from: from || undefined,
    to: to || undefined,
    agentId: agentId || undefined,
    q: search || undefined,
    includePreview,
    segment: segment || undefined,
  });

  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const selectedAgent = agents.find((a) => a.id === agentId);
  const filtered =
    !!status || escalated !== 'all' || !!from || !!to || !!agentId || includePreview || !!segment || !!search;
  const resetAll = () => {
    setStatus('');
    setEscalated('all');
    setFrom('');
    setTo('');
    setAgentId('');
    setIncludePreview(false);
    setSegment('');
    setSearchDraft('');
    setSearch('');
    setPage(1);
  };
  const applySearch = () => {
    setSearch(searchDraft.trim());
    setPage(1);
  };

  const columns: Column<ConversationRow>[] = [
    { key: 'id', header: t('id'), render: (r) => <span className="font-mono text-xs text-gray-500">{r.id.slice(0, 8)}</span> },
    {
      key: 'customer',
      header: t('customer'),
      render: (r) =>
        r.customerName ? (
          <span className="font-medium text-gray-900">{r.customerName}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    { key: 'agent', header: t('agent'), render: (r) => r.agentName ?? <span className="text-gray-400">—</span> },
    {
      key: 'status',
      header: t('status'),
      render: (r) => (
        <StatusBadge status={r.status} label={r.status ? tl(`status.${r.status}`, { defaultValue: r.status }) : undefined} />
      ),
    },
    {
      key: 'escalated',
      header: t('escalated'),
      render: (r) =>
        r.escalated ? <Badge tone="error">{tc('yes')}</Badge> : <Badge tone="gray">{tc('no')}</Badge>,
    },
    {
      key: 'channel',
      header: t('channel'),
      render: (r) =>
        r.channel === 'preview' ? <Badge tone="warning">{t('previewChannel')}</Badge> : (r.channel ?? '—'),
    },
    { key: 'messages', header: t('messages'), className: 'text-right tabular-nums', render: (r) => r.messageCount ?? 0 },
    { key: 'startedAt', header: t('started'), className: 'whitespace-nowrap text-gray-500', render: (r) => formatDateTime(r.startedAt) },
    { key: 'endedAt', header: t('ended'), className: 'whitespace-nowrap text-gray-500', render: (r) => formatDateTime(r.endedAt) },
  ];

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <FilterBar>
        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          onSubmit={applySearch}
          placeholder={t('searchPlaceholder')}
          className="basis-full sm:basis-auto"
        />
        <FilterDate label={t('from')} value={from} onChange={reset(setFrom)} />
        <FilterDate label={t('to')} value={to} onChange={reset(setTo)} />
        <FilterSelect
          label={t('status')}
          active={!!status}
          value={status}
          onChange={(e) => reset(setStatus)(e.target.value as StatusFilter)}
        >
          <option value="">{t('allStatuses')}</option>
          <option value="open">{t('open')}</option>
          <option value="resolved">{t('resolved')}</option>
          <option value="escalated">{t('escalated')}</option>
          <option value="ended">{t('ended_status')}</option>
        </FilterSelect>
        <FilterSelect
          label={t('escalated')}
          active={escalated !== 'all'}
          value={escalated}
          onChange={(e) => reset(setEscalated)(e.target.value as EscalatedFilter)}
        >
          <option value="all">{`${t('escalated')}: ${tc('all')}`}</option>
          <option value="yes">{`${t('escalated')}: ${tc('yes')}`}</option>
          <option value="no">{`${t('escalated')}: ${tc('no')}`}</option>
        </FilterSelect>
        <FilterSelect
          label={t('agent')}
          active={!!agentId}
          value={agentId}
          onChange={(e) => reset(setAgentId)(e.target.value)}
        >
          <option value="">{t('allAgents')}</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name || a.email}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label={t('segment')}
          active={!!segment}
          value={segment}
          onChange={(e) => reset(setSegment)(e.target.value as '' | 'b2b' | 'b2c')}
        >
          <option value="">{`${t('segment')}: ${tc('all')}`}</option>
          <option value="b2b">{t('segmentB2b')}</option>
          <option value="b2c">{t('segmentB2c')}</option>
        </FilterSelect>
        <FilterToggle checked={includePreview} onChange={reset(setIncludePreview)}>
          {t('includePreview')}
        </FilterToggle>
        <ResetFiltersButton visible={filtered} onClick={resetAll} />
      </FilterBar>

      {selectedAgent && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm">
          <UserRound className="h-4 w-4 text-primary-600" aria-hidden />
          <span className="flex-1 text-primary-800">
            <span className="font-semibold">{selectedAgent.name || selectedAgent.email}</span>
            {' · '}
            {t('agentTotal', { count: data?.total ?? 0 })}
          </span>
          <button
            type="button"
            onClick={() => reset(setAgentId)('')}
            aria-label={tc('clear')}
            className="rounded-md p-1 text-primary-600 hover:bg-primary-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <Table
        columns={columns}
        data={data?.items}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        emptyMessage={t('empty')}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSelected(r)}
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.customerName ?? t('detailTitle')}
        subtitle={
          selected
            ? [selected.id.slice(0, 8), formatDateTime(selected.startedAt), selected.agentName]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
      >
        {selected && (
          <ConversationTranscript
            conversationId={selected.id}
            onOpenSource={(documentId) => navigate(`/knowledge?doc=${documentId}`)}
          />
        )}
      </Drawer>
    </div>
  );
}
