import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { FilterBar, SearchField } from '@/components/Toolbar';
import { toast } from '@/store/toast-store';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Table } from '@/components/Table';
import type { Column } from '@/components/Table';
import { Pagination } from '@/components/Pagination';
import { formatDate } from '@/lib/format';
import { useLookupOrder, useOrders } from './orders.hooks';
import { ORDER_NUMBER_PATTERN } from './orders.service';
import type { OrderRow } from './orders.service';

const PAGE_SIZE = 20;

function fmtMoney(value?: number | null, currency?: string | null): string {
  if (typeof value !== 'number') return '—';
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
    } catch {
      return `${value.toLocaleString()} ${currency}`;
    }
  }
  return value.toLocaleString();
}

export function OrdersPage() {
  const { t } = useTranslation('orders');
  const [page, setPage] = useState(1);
  // The search lives in the URL (?q=), so a reload or a shared link keeps it.
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const [search, setSearch] = useState(q);
  const lookup = useLookupOrder();

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const next = search.trim();
    if (next === q) return;
    const timer = setTimeout(() => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next) p.set('q', next);
          else p.delete('q');
          return p;
        },
        { replace: true },
      );
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, q, setParams]);

  const { data, isLoading, isFetching, error } = useOrders({ page, pageSize: PAGE_SIZE, q: q || undefined });

  // Only recent orders are cached (PLN-261117 B3): a search that finds nothing
  // can ask the store for exactly that order.
  const noMatch = !!q && !isLoading && !isFetching && !error && (data?.total ?? 0) === 0;
  const canLookup = ORDER_NUMBER_PATTERN.test(q);
  const onLookup = () =>
    lookup.mutate(q, {
      onSuccess: (res) => {
        if (res.found > 0) toast.success(t('lookupFound'));
        else toast.info(t('lookupNotFound', { q }));
      },
      onError: () => toast.error(t('lookupFailed')),
    });

  const columns: Column<OrderRow>[] = [
    {
      key: 'orderNumber',
      header: t('orderNumber'),
      render: (o) => <span className="font-medium text-gray-900">#{o.orderNumber}</span>,
    },
    {
      key: 'status',
      header: t('status'),
      render: (o) => <StatusBadge status={o.statusUi ?? o.statusInternal ?? undefined} />,
    },
    { key: 'amount', header: t('amount'), className: 'text-right tabular-nums', render: (o) => fmtMoney(o.total, o.currency) },
    { key: 'items', header: t('items'), className: 'text-right tabular-nums', render: (o) => o.itemCount ?? 0 },
    { key: 'createdAt', header: t('date'), className: 'whitespace-nowrap text-gray-500', 
      // The day the order was placed — not the day it was copied here, which is
      // the same for every row of one sync.
      render: (o) => formatDate(o.orderedAt ?? o.createdAt) },
  ];

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <FilterBar>
        <SearchField
          value={search}
          placeholder={t('searchPlaceholder')}
          onChange={setSearch}
          className="max-w-sm"
        />
      </FilterBar>

      <Table
        columns={columns}
        data={data?.items}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        emptyMessage={q ? t('emptySearch', { q }) : t('empty')}
        rowKey={(o) => String(o.id)}
      />

      {noMatch && canLookup && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600 shadow-card">
          <span>{t('lookupHint')}</span>
          <Button variant="secondary" onClick={onLookup} disabled={lookup.isPending}>
            {lookup.isPending ? t('lookingUp') : t('lookupOnStore')}
          </Button>
        </div>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
