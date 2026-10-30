import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
  /** Small count chip after the label. */
  count?: number;
}

/** Shared look for underline tabs (local state and route tabs alike). */
export function tabClass(active: boolean) {
  return cn(
    '-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
    active
      ? 'border-primary-500 text-primary-700'
      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800',
  );
}

/** Underline tabs; scrolls sideways instead of wrapping on narrow screens. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  tabs: Array<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 overflow-x-auto border-b border-gray-200', className)}>
      <div role="tablist" aria-label={ariaLabel} className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const active = tab.value === value;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={tabClass(active)}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden />}
              {tab.label}
              {tab.count != null && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums',
                    active ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
