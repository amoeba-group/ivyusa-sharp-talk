import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/Field';
import { cn } from '@/lib/cn';

/**
 * The window every statistics screen is read through (PLN-260920b).
 *
 * Presets first, dates second: "last 30 days" is what an operator actually
 * asks, and making them type two dates for the common case is the reason the
 * existing filter got used at its default and nowhere else. Custom stays, for
 * the month-end question that presets cannot express.
 *
 * Shared rather than copied because the admin overview and the tenant console
 * must agree on what "last 7 days" means — two implementations would quietly
 * disagree on whether today counts.
 */
export type RangePreset = 'd7' | 'd30' | 'd90' | 'custom';

const ymd = (d: Date): string => d.toISOString().slice(0, 10);

/** Inclusive of today, so "7 days" is today plus the six before it. */
export function rangeFor(preset: Exclude<RangePreset, 'custom'>): { from: string; to: string } {
  const today = new Date();
  const days = preset === 'd7' ? 7 : preset === 'd30' ? 30 : 90;
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: ymd(from), to: ymd(today) };
}

export interface DateRange {
  from: string;
  to: string;
}

/**
 * Keeps the preset and the resolved dates together so a caller only has to
 * hold one piece of state.
 */
export function useDateRange(initial: Exclude<RangePreset, 'custom'> = 'd30') {
  const [preset, setPreset] = useState<RangePreset>(initial);
  const [custom, setCustom] = useState<DateRange>(() => rangeFor(initial));
  const range = useMemo<DateRange>(
    () => (preset === 'custom' ? custom : rangeFor(preset)),
    [preset, custom],
  );
  return { preset, setPreset, custom, setCustom, range };
}

interface Props extends ReturnType<typeof useDateRange> {
  className?: string;
}

export function DateRangePicker({ preset, setPreset, custom, setCustom, range, className }: Props) {
  const { t } = useTranslation('common');
  const presets: Exclude<RangePreset, 'custom'>[] = ['d7', 'd30', 'd90'];

  const options: RangePreset[] = [...presets, 'custom'];
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div role="radiogroup" aria-label={t('range.custom')} className="inline-flex rounded-lg bg-gray-100 p-0.5">
        {options.map((p) => {
          const active = preset === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (p === 'custom') {
                  // Seed the custom fields from whatever is on screen, so switching
                  // to "custom" never blanks the range the operator was just reading.
                  setCustom(range);
                }
                setPreset(p);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
              )}
            >
              {t(`range.${p}`)}
            </button>
          );
        })}
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label={t('range.from')}
            value={custom.from}
            max={custom.to}
            onChange={(e) => setCustom({ ...custom, from: e.target.value })}
            className="h-9 w-40 py-1"
          />
          <span className="text-gray-400">–</span>
          <Input
            type="date"
            aria-label={t('range.to')}
            value={custom.to}
            min={custom.from}
            onChange={(e) => setCustom({ ...custom, to: e.target.value })}
            className="h-9 w-40 py-1"
          />
        </div>
      )}
    </div>
  );
}
