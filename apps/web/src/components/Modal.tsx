import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const { t } = useTranslation('common');
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Esc closes the dialog.
  useEffect(() => {
    if (!open || !onClose) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Focus the dialog on open and restore focus to the previously focused
  // element on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    (closeRef.current ?? dialogRef.current)?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-st-fade-in bg-gray-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : t('dialog')}
        tabIndex={-1}
        className={`relative w-full ${sizes[size]} animate-st-pop-in rounded-2xl border border-gray-200 bg-white shadow-pop focus:outline-none`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <h3 id={titleId} className="text-base font-semibold text-gray-900">
            {title}
          </h3>
          {onClose && (
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label={t('close')}
              className="-mr-1.5 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-3.5">{footer}</div>
        )}
      </div>
    </div>
  );
}
