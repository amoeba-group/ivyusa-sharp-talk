import { cn } from '@/lib/cn';

interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/** Pill switch for 2–5 mutually exclusive choices (ranges, views). */
export function Segmented<T extends string>({ options, value, onChange, ariaLabel, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex rounded-lg bg-gray-100 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
