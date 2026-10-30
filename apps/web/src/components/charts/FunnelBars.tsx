import { cn } from '@/lib/cn';

export interface FunnelStep {
  key: string;
  label: string;
  value: number;
}

interface FunnelBarsProps {
  steps: FunnelStep[];
  /** "{{pct}} of previous" — receives the formatted percentage. */
  conversionLabel: (pct: string) => string;
  formatValue?: (v: number) => string;
  className?: string;
}

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

/**
 * Nested stages as horizontal bars (dataviz: magnitude → one hue, length is the
 * encoding). Thin bars with rounded data ends, value in text ink beside the
 * bar, and the step-to-step conversion as text — never colour alone.
 */
export function FunnelBars({ steps, conversionLabel, formatValue = (v) => v.toLocaleString(), className }: FunnelBarsProps) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className={cn('space-y-4', className)}>
      {steps.map((s, i) => {
        const w = (s.value / max) * 100;
        return (
          <li key={s.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-sm text-gray-600">{s.label}</span>
              <span className="text-sm font-semibold tabular-nums text-gray-900">{formatValue(s.value)}</span>
            </div>
            <div
              className="h-2.5 w-full rounded-full bg-gray-100"
              role="meter"
              aria-label={s.label}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={s.value}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${s.value > 0 ? Math.max(w, 1.5) : 0}%`, background: 'rgb(var(--viz-1))' }}
              />
            </div>
            {i > 0 && (
              <p className="mt-1 text-xs text-gray-400">{conversionLabel(pct(s.value, steps[i - 1].value))}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
