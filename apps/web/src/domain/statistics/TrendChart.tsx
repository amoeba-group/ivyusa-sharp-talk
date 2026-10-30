import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart } from '@/components/charts/LineChart';

/**
 * Question volume over the selected range — the shared LineChart (crosshair
 * tooltip, keyboard stepping, theme-aware colour), one series so the title
 * names it and no legend is drawn.
 */
export function TrendChart({ data }: { data: Array<{ date: string; asked: number }> }) {
  const { t, i18n } = useTranslation('statistics');
  const fmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    [i18n.language],
  );
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">{t('noTrend')}</p>;
  }
  const day = (v: string) => {
    const d = new Date(`${v.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? v : fmt.format(d);
  };
  return (
    <LineChart
      x={data.map((d) => d.date)}
      xLabel={t('dayColumn', { ns: 'dashboard' })}
      formatX={day}
      formatXLong={day}
      height={200}
      ariaLabel={t('trendAria', { count: data.length })}
      series={[{ key: 'asked', label: t('asked'), slot: 1, values: data.map((d) => d.asked) }]}
    />
  );
}
