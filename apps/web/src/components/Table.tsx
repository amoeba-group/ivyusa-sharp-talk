import type { ReactNode } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInCard } from './Card';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

/** Placeholder rows while data loads — the layout doesn't jump when it arrives. */
function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {[0, 1, 2, 3].map((r) => (
        <tr key={r} aria-hidden>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3.5">
              <div
                className="h-3.5 animate-pulse rounded bg-gray-100"
                style={{ width: `${45 + ((r * 7 + c * 13) % 45)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function Table<T>({
  columns,
  data,
  loading,
  error,
  emptyMessage,
  rowKey,
  onRowClick,
}: TableProps<T>) {
  const { t } = useTranslation('common');
  const inCard = useInCard();
  const empty = emptyMessage ?? t('empty');
  return (
    // Scrolls rather than clips: a table wider than its container used to lose
    // its rightmost columns outright, with no way to reach them (the products
    // catalogue lost its Knowledge column at 1568px).
    <div
      className={
        inCard
          ? 'overflow-x-auto rounded-lg border border-gray-100'
          : 'overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-card'
      }
    >
      <table className="w-full text-left" aria-busy={loading || undefined}>
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 ${c.className ?? ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && <SkeletonRows cols={columns.length} />}
          {loading && (
            <tr className="sr-only">
              <td colSpan={columns.length}>{t('loading')}</td>
            </tr>
          )}
          {!loading && error && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-red-600">
                <AlertCircle className="mx-auto mb-2 h-5 w-5" aria-hidden />
                {error}
              </td>
            </tr>
          )}
          {!loading && !error && (!data || data.length === 0) && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-14 text-center text-sm text-gray-400">
                <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <Inbox className="h-5 w-5 text-gray-400" aria-hidden />
                </span>
                {empty}
              </td>
            </tr>
          )}
          {!loading &&
            !error &&
            data?.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition-colors hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 text-sm text-gray-700 ${c.className ?? ''}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
