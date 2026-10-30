import { useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useThemeStore, type ThemePreference } from '@/lib/theme';
import { useDismiss } from '@/lib/use-dismiss';
import { cn } from '@/lib/cn';

export const THEME_OPTIONS: Array<{ value: ThemePreference; icon: typeof Sun; labelKey: string }> = [
  { value: 'light', icon: Sun, labelKey: 'theme.light' },
  { value: 'dark', icon: Moon, labelKey: 'theme.dark' },
  { value: 'system', icon: Monitor, labelKey: 'theme.system' },
];

/** Header button: shows the theme in effect, opens light / dark / system. */
export function ThemeMenu() {
  const { t } = useTranslation('nav');
  const preference = useThemeStore((s) => s.preference);
  const resolved = useThemeStore((s) => s.resolved);
  const setPreference = useThemeStore((s) => s.setPreference);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const Icon = resolved === 'dark' ? Moon : Sun;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('theme.label')}
        title={t('theme.label')}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-40 w-44 animate-st-pop-in rounded-xl border border-gray-200 bg-surface-elevated p-1 shadow-pop"
        >
          {THEME_OPTIONS.map((o) => {
            const OptIcon = o.icon;
            const active = preference === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setPreference(o.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-gray-100',
                  active ? 'font-medium text-gray-900' : 'text-gray-600',
                )}
              >
                <OptIcon className="h-4 w-4 text-gray-400" aria-hidden />
                <span className="flex-1">{t(o.labelKey)}</span>
                {active && <Check className="h-4 w-4 text-primary-600" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Three-way segmented control (user menu). */
export function ThemeSegmented() {
  const { t } = useTranslation('nav');
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1" role="radiogroup" aria-label={t('theme.label')}>
      {THEME_OPTIONS.map((o) => {
        const OptIcon = o.icon;
        const active = preference === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(o.value)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
            )}
          >
            <OptIcon className="h-3.5 w-3.5" aria-hidden />
            {t(o.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
