import type { ReactNode, SelectHTMLAttributes } from 'react';
import { RotateCcw, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

/**
 * One-line filter bar above a list (REQ-261030). Lists used to put every filter
 * in a three-column form with a label over each control, which pushed the
 * results half a screen down; the options already say what they filter
 * ("All statuses", "All agents"), so the labels move to aria-label and the bar
 * becomes a row that wraps on narrow screens.
 */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-card',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Pushes the following items to the right end of a FilterBar. */
export function FilterSpacer() {
  return <div className="flex-1" aria-hidden />;
}

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter (outside IME composition). Omit for live filtering. */
  onSubmit?: () => void;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchField({ value, onChange, onSubmit, placeholder, className, autoFocus }: SearchFieldProps) {
  const { t } = useTranslation('common');
  return (
    <div className={cn('relative min-w-[220px] flex-1', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit && !e.nativeEvent.isComposing) onSubmit();
        }}
        className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-8 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label={t('clearSearch')}
          onClick={() => {
            onChange('');
            onSubmit?.();
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Compact select for a FilterBar; `label` is announced, not shown. */
export function FilterSelect({
  label,
  className,
  children,
  active,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; active?: boolean }) {
  return (
    <select
      aria-label={label}
      title={label}
      className={cn(
        'h-9 max-w-[220px] rounded-lg border bg-white pl-3 pr-8 text-sm outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
        active ? 'border-primary-300 bg-primary-50 font-medium text-primary-700' : 'border-gray-300 text-gray-700',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/** Labelled date input that fits the bar ("From 2026-10-01"). */
export function FilterDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className={cn(
        'flex h-9 items-center gap-2 rounded-lg border bg-white pl-3 pr-2 text-sm transition-colors focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20',
        value ? 'border-primary-300' : 'border-gray-300',
      )}
    >
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm text-gray-800 outline-none"
      />
    </label>
  );
}

export function ResetFiltersButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  const { t } = useTranslation('common');
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      {t('resetFilters')}
    </button>
  );
}

/** Checkbox styled as a pill toggle for boolean filters. */
export function FilterToggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        'inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
        checked ? 'border-primary-300 bg-primary-50 font-medium text-primary-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-primary-600"
      />
      {children}
    </label>
  );
}
