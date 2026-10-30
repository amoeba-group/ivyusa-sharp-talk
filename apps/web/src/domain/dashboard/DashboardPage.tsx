import { useMemo, useState } from 'react';
import {
  MessagesSquare,
  Bell,
  Bot,
  AlertTriangle,
  MessageCircle,
  ShoppingCart,
  BarChart3,
  BookOpen,
  PlugZap,
  Table2,
  LineChart as LineChartIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { Segmented } from '@/components/Segmented';
import { Table, type Column } from '@/components/Table';
import { LineChart } from '@/components/charts/LineChart';
import { FunnelBars } from '@/components/charts/FunnelBars';
import { useMenuAccess } from '@/lib/use-menu-access';
import {
  useDashboard,
  useDashboardActivity,
  useIntegrationStatus,
  useRecentOrders,
} from './dashboard.hooks';
import type { RecentOrder } from './dashboard.service';

function pct(value: number | undefined) {
  if (value == null) return '–';
  const n = value <= 1 ? value * 100 : value;
  return `${Math.round(n)}%`;
}

function ratio(value: number | undefined) {
  if (value == null) return 0;
  return Math.max(0, Math.min(1, value <= 1 ? value : value / 100));
}

function money(value?: number, currency?: string) {
  if (typeof value !== 'number') return '—';
  return `${value.toLocaleString()} ${currency ?? ''}`.trim();
}

function fmtDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

type Range = 'd7' | 'd14' | 'd30';
const RANGE_DAYS: Record<Range, number> = { d7: 7, d14: 14, d30: 30 };
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Every day in [from, to] — days without activity are zero, not gaps. */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end && out.length < 400) {
    out.push(ymd(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** AI-resolution share as a thin meter under the tile's number. */
function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="h-1.5 w-full rounded-full bg-gray-100"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <div className="h-full rounded-full" style={{ width: `${value * 100}%`, background: 'rgb(var(--viz-1))' }} />
    </div>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation('dashboard');
  const { t: tc } = useTranslation('common');
  const { t: ts } = useTranslation('statistics');
  const { canSeeMenu } = useMenuAccess();
  const { data, isLoading } = useDashboard();
  const { data: integrations, isLoading: intLoading } = useIntegrationStatus();
  const { data: recentOrders, isLoading: ordLoading, isError: ordError } = useRecentOrders();

  const [range, setRange] = useState<Range>('d14');
  const [asTable, setAsTable] = useState(false);
  const { from, to } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (RANGE_DAYS[range] - 1));
    return { from: ymd(start), to: ymd(end) };
  }, [range]);
  const { access, journey } = useDashboardActivity(from, to);

  const days = useMemo(() => daysBetween(from, to), [from, to]);
  const byDay = useMemo(() => new Map((access.data?.daily ?? []).map((d) => [d.day.slice(0, 10), d])), [access.data]);
  const opens = days.map((d) => byDay.get(d)?.openedSessions ?? 0);
  const convs = days.map((d) => byDay.get(d)?.conversations ?? 0);
  const hasActivity = opens.some((v) => v > 0) || convs.some((v) => v > 0);
  const activityDenied = access.isError && journey.isError;

  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: 'numeric', day: 'numeric', timeZone: 'UTC' }),
    [i18n.language],
  );
  const dayFmtLong = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }),
    [i18n.language],
  );
  const shortDay = (v: string) => dayFmt.format(new Date(`${v}T00:00:00Z`));
  const longDay = (v: string) => dayFmtLong.format(new Date(`${v}T00:00:00Z`));

  const j = journey.data;
  const share = (part?: number) =>
    j && j.conversations > 0 ? `${Math.round(((part ?? 0) / j.conversations) * 100)}%` : '—';

  const v = (n: number | undefined) => (n ?? 0).toLocaleString();

  const orderColumns: Column<RecentOrder>[] = [
    { key: 'order', header: t('orderNumber'), render: (o) => <span className="font-medium text-gray-900">#{o.orderNumber}</span> },
    { key: 'status', header: t('status'), render: (o) => <StatusBadge status={o.statusUi ?? o.statusInternal} /> },
    { key: 'amount', header: t('amount'), className: 'tabular-nums', render: (o) => money(o.total, o.currency) },
    { key: 'date', header: t('date'), className: 'text-gray-500', render: (o) => fmtDate(o.createdAt) },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <>
            {canSeeMenu('knowledge', 'knowledge') && (
              <Link
                to="/knowledge"
                className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                {t('quickKnowledge')}
              </Link>
            )}
            {canSeeMenu('live_chat', 'live_chat') && (
              <Link
                to="/live-chat"
                className="inline-flex min-h-[36px] items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700"
              >
                <MessagesSquare className="h-4 w-4" aria-hidden />
                {t('quickLiveChat')}
              </Link>
            )}
          </>
        }
      />

      {/* Right-now figures (not range-bound). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label={t('activeChats')}
          value={v(data?.activeChats)}
          loading={isLoading}
          icon={MessagesSquare}
          to="/live-chat"
        />
        <KpiCard
          label={t('unresolvedTopN')}
          value={v(data?.unresolvedTopN)}
          loading={isLoading}
          icon={AlertTriangle}
          to="/live-chat"
        />
        <KpiCard
          label={t('aiResolutionRate')}
          value={pct(data?.aiResolutionRate)}
          loading={isLoading}
          // The definition is on the card because it changed: it used to count
          // any ended, un-escalated conversation — including one the customer
          // walked away from — and it now matches the journey report exactly.
          hint={t('aiResolutionRateHint')}
          icon={Bot}
          to="/history"
          footer={<Meter value={ratio(data?.aiResolutionRate)} label={t('aiResolutionRate')} />}
        />
        <KpiCard
          label={t('totalConversations')}
          value={v(data?.totalConversations)}
          loading={isLoading}
          icon={MessageCircle}
          to="/history"
        />
        <KpiCard
          label={t('todayNotifications')}
          value={v(data?.todayNotifications)}
          loading={isLoading}
          icon={Bell}
          to="/campaigns"
        />
        <KpiCard
          label={t('totalOrders')}
          value={v(data?.totalOrders)}
          loading={isLoading}
          icon={ShoppingCart}
          to="/orders"
        />
      </div>

      {/* Activity: one range control scopes both charts below it. */}
      <section aria-labelledby="dash-activity" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="dash-activity" className="text-base font-semibold text-gray-900">
              {t('activity')}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">{t('activitySubtitle')}</p>
          </div>
          {!activityDenied && (
            <Segmented
              ariaLabel={t('activity')}
              value={range}
              onChange={setRange}
              options={(['d7', 'd14', 'd30'] as Range[]).map((r) => ({ value: r, label: t(`range.${r}`) }))}
            />
          )}
        </div>

        {activityDenied ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <BarChart3 className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-sm text-gray-500">{t('activityUnavailable')}</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card
              className="lg:col-span-2"
              title={t('trendTitle')}
              action={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAsTable((x) => !x)}
                    aria-pressed={asTable}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  >
                    {asTable ? <LineChartIcon className="h-3.5 w-3.5" aria-hidden /> : <Table2 className="h-3.5 w-3.5" aria-hidden />}
                    {asTable ? t('viewChart') : t('viewTable')}
                  </button>
                  {canSeeMenu('statistics', 'statistics') && (
                    <Link to="/statistics" className="text-xs font-medium text-primary-600 hover:underline">
                      {t('openStatistics')}
                    </Link>
                  )}
                </div>
              }
            >
              <div className={access.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                {access.isLoading ? (
                  <div className="h-[244px] animate-pulse rounded-lg bg-gray-50" aria-hidden />
                ) : !hasActivity && !asTable ? (
                  <div className="flex h-[244px] flex-col items-center justify-center gap-2 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                      <LineChartIcon className="h-5 w-5" aria-hidden />
                    </span>
                    <p className="text-sm text-gray-400">{t('noActivity')}</p>
                  </div>
                ) : (
                  <LineChart
                    x={days}
                    xLabel={t('dayColumn')}
                    formatX={shortDay}
                    formatXLong={longDay}
                    showTable={asTable}
                    ariaLabel={t('trendAria', { from: longDay(from), to: longDay(to) })}
                    series={[
                      { key: 'opens', label: t('seriesOpens'), slot: 1, values: opens },
                      { key: 'convs', label: t('seriesConversations'), slot: 2, values: convs },
                    ]}
                  />
                )}
              </div>
            </Card>

            <Card title={t('funnelTitle')}>
              <div className={journey.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                {journey.isLoading ? (
                  <div className="space-y-4" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-50" />
                    ))}
                  </div>
                ) : (
                  <>
                    <FunnelBars
                      conversionLabel={(p) => t('conversionOf', { pct: p })}
                      steps={[
                        { key: 'impressions', label: ts('journey.impressions'), value: j?.impressions ?? 0 },
                        { key: 'access', label: ts('journey.access'), value: j?.openedSessions ?? 0 },
                        { key: 'conversations', label: ts('journey.conversations'), value: j?.conversations ?? 0 },
                      ]}
                    />
                    <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                      <div>
                        <dt className="text-xs text-gray-500">{t('aiShare')}</dt>
                        <dd className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{share(j?.aiHandled)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">{t('escalatedShare')}</dt>
                        <dd className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{share(j?.escalated)}</dd>
                      </div>
                    </dl>
                  </>
                )}
              </div>
            </Card>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={t('popularQuestions')} className="lg:col-span-2">
          {isLoading && (
            <div className="space-y-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-5 animate-pulse rounded bg-gray-50" />
              ))}
            </div>
          )}
          {!isLoading && (!data?.popularQuestions || data.popularQuestions.length === 0) && (
            <p className="py-6 text-center text-sm text-gray-400">{tc('noData')}</p>
          )}
          <ol className="divide-y divide-gray-100">
            {data?.popularQuestions?.map((q, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold tabular-nums text-gray-500">
                  {i + 1}
                </span>
                <span className="truncate text-gray-700" title={q}>
                  {q}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title={t('integrationStatus')}>
          {intLoading && (
            <div className="space-y-3" aria-hidden>
              {[0, 1].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded bg-gray-50" />
              ))}
            </div>
          )}
          {!intLoading && (!integrations || integrations.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <PlugZap className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-sm text-gray-400">{t('noIntegrations')}</p>
            </div>
          )}
          <ul className="divide-y divide-gray-100">
            {integrations?.map((it) => {
              // The per-tenant endpoint names the row `provider`; reading
              // `name` here printed "integration.undefined" for every row.
              const key = it.provider ?? it.name ?? '';
              const when = it.lastTestedAt ?? it.lastSyncAt;
              return (
                <li key={key} className="py-2.5 text-sm first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800">
                      {t(`integration.${key}`, { defaultValue: key })}
                    </span>
                    <StatusBadge
                      status={it.status}
                      label={t(`integrationState.${it.status}`, { defaultValue: it.status })}
                    />
                  </div>
                  {/* What the state means and when it was last true — an
                      "error" badge alone gave nothing to act on. */}
                  {(it.detail || when) && (
                    <p className="mt-0.5 truncate text-xs text-gray-400" title={it.detail ?? undefined}>
                      {it.detail}
                      {it.detail && when ? ' · ' : ''}
                      {when ? new Date(when).toLocaleString() : ''}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <section aria-labelledby="dash-orders" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="dash-orders" className="text-base font-semibold text-gray-900">
            {t('recentOrders')}
          </h2>
          <Link to="/orders" className="text-sm font-medium text-primary-600 hover:underline">
            {t('viewOrders')}
          </Link>
        </div>
        <Table
          columns={orderColumns}
          data={ordError ? [] : recentOrders}
          loading={ordLoading}
          emptyMessage={t('noOrders')}
          rowKey={(o) => o.id}
        />
      </section>
    </div>
  );
}
