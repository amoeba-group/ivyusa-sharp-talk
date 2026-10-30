import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToastStore, type ToastTone } from '@/store/toast-store';
import { cn } from '@/lib/cn';

const icons: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors: Record<ToastTone, string> = {
  success: 'bg-emerald-50 text-emerald-600',
  error: 'bg-red-50 text-red-600',
  info: 'bg-sky-50 text-sky-600',
  warning: 'bg-amber-50 text-amber-600',
};

export function ToastViewport() {
  const { t: tr } = useTranslation('common');
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const Icon = icons[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-[22rem] max-w-[calc(100vw-2rem)] animate-st-pop-in items-start gap-3 rounded-xl border border-gray-200 bg-surface-elevated px-3.5 py-3 shadow-pop"
          >
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', colors[t.tone])}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            {/* pre-line: a sync failure arrives as title / reason / fix on
                separate lines (PLN-261019); single-line messages are unaffected. */}
            <p className="flex-1 self-center whitespace-pre-line text-sm text-gray-700">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label={tr('close')}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
