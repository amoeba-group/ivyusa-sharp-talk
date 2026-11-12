import { useStore } from 'zustand';
import { AlertCircle, CircleCheck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toastStore } from '../../lib/toast';

/**
 * Draws the widget's toasts (lib/toast.ts) over the bottom of its parent,
 * which must be `relative`. Mount it where a screen's bottom actions are, so a
 * toast sits just above them instead of over them (ivy-docs T07 wireframe c).
 *
 * - success: a dark pill, `role="status"`, gone after ~3 s;
 * - error: a white card, `role="alert"`, with a close button — an error the
 *   shopper did not get to read is the silent failure CLAUDE.md §2 bans.
 */
export function ToastHost() {
  const { t } = useTranslation();
  const toasts = useStore(toastStore, (s) => s.toasts);
  const dismiss = useStore(toastStore, (s) => s.dismiss);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) =>
        toast.tone === 'success' ? (
          <div
            key={toast.id}
            role="status"
            data-testid="toast"
            data-tone="success"
            className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-gray-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg"
          >
            <CircleCheck className="h-4 w-4 flex-shrink-0 text-success" aria-hidden />
            <span className="min-w-0">{toast.message}</span>
          </div>
        ) : (
          <div
            key={toast.id}
            role="alert"
            data-testid="toast"
            data-tone="error"
            className="pointer-events-auto flex w-full items-start gap-2 rounded-st-md border border-error/40 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-lg"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-error" aria-hidden />
            <span className="min-w-0 flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t('common.close')}
              className="-m-1 flex-shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ),
      )}
    </div>
  );
}
