import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Small line under the title (ids, timestamps). */
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

const widths = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/**
 * Right-hand slide-over for details (a transcript, a customer): the list stays
 * visible behind it, so moving from one row to the next is close → click,
 * not back → find your place → click.
 */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'lg' }: DrawerProps) {
  const { t } = useTranslation('common');
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement as HTMLElement | null;
    (closeRef.current ?? panelRef.current)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-st-fade-in bg-gray-950/40 backdrop-blur-[1px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex h-full w-full animate-st-slide-in-right flex-col border-l border-gray-200 bg-white shadow-pop focus:outline-none',
          widths[width],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="truncate text-base font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="-mr-1.5 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
