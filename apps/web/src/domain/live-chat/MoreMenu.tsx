import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface MoreMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  /** A switch, not an action: shows a tick and keeps the menu open. */
  checked?: boolean;
  /** Draws a rule above this item — it starts another kind of thing. */
  separated?: boolean;
  title?: string;
}

/**
 * The conversation's less-used actions behind one button (PLN-261119).
 *
 * The header used to lay every action out as its own button — ten of them,
 * all the same weight — and the two an agent needs every time (take the chat,
 * end it) were lost among them. Nothing is removed: it is one click further.
 */
export function MoreMenu({ label, items }: { label: string; items: MoreMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="livechat-more"
        className={cn(
          'inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 shadow-sm hover:bg-gray-50',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          open && 'bg-gray-50',
        )}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden /> {label}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const toggle = item.checked !== undefined;
            return (
              <button
                key={item.key}
                type="button"
                role={toggle ? 'menuitemcheckbox' : 'menuitem'}
                aria-checked={toggle ? item.checked : undefined}
                disabled={item.disabled}
                title={item.title}
                onClick={() => {
                  item.onSelect();
                  if (!toggle) setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
                  item.separated && 'mt-1 border-t border-gray-100 pt-2.5',
                )}
              >
                {toggle ? (
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      item.checked ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white',
                    )}
                    aria-hidden
                  >
                    {item.checked && <Check className="h-3 w-3" />}
                  </span>
                ) : (
                  Icon && <Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                )}
                <span className="min-w-0 flex-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
