import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export interface KpiTrend {
  /** Already formatted, e.g. "+12%" or "−3". */
  label: string;
  direction: 'up' | 'down' | 'flat';
  /** Whether this direction is good news (drives green vs red). */
  good?: boolean;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  /** When set, the card becomes a link to this route. */
  to?: string;
  trend?: KpiTrend;
  /** Small inline visual under the number (sparkline / meter). */
  footer?: ReactNode;
  loading?: boolean;
}

/**
 * Stat tile (dataviz: a single headline number is a tile, not a chart). The
 * value carries the weight; label and hint stay in secondary ink, and a trend
 * is an arrow + text, never colour alone.
 */
export function KpiCard({ label, value, icon: Icon, hint, to, trend, footer, loading }: KpiCardProps) {
  const TrendIcon =
    trend?.direction === 'up' ? ArrowUpRight : trend?.direction === 'down' ? ArrowDownRight : Minus;
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded-md bg-gray-100" aria-hidden />
      ) : (
        <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-gray-900 tabular-nums">
          {value}
        </p>
      )}
      {(trend || hint) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium',
                trend.direction === 'flat' || trend.good === undefined
                  ? 'bg-gray-100 text-gray-600'
                  : trend.good
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700',
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" aria-hidden />
              {trend.label}
            </span>
          )}
          {hint && <span className="text-gray-400">{hint}</span>}
        </div>
      )}
      {footer && <div className="mt-3">{footer}</div>}
    </>
  );

  const base = 'group relative block rounded-xl border border-gray-200 bg-white p-5 shadow-card';
  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          base,
          'transition-all hover:-translate-y-px hover:border-primary-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        )}
      >
        {content}
        <ArrowRight
          className="absolute bottom-5 right-5 h-4 w-4 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </Link>
    );
  }
  return <div className={base}>{content}</div>;
}
