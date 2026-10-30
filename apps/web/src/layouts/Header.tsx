import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Globe, Menu, Search } from 'lucide-react';
import { AlarmBell } from '@/domain/alerts/AlarmBell';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store/ui-store';
import {
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/i18n/i18n';
import { useDismiss } from '@/lib/use-dismiss';
import { cn } from '@/lib/cn';
import { findNavEntry, SETTINGS_TABS } from './nav-config';
import { ThemeMenu } from './ThemeMenu';
import { UserMenu } from './UserMenu';
import { IS_MAC } from './CommandPalette';
import { useVisibleNav } from './use-shell';

/**
 * Locale picker. Exported for reuse on the public pages (landing / login),
 * which render outside AppLayout but still need it.
 *
 * A row of pills held three languages; six need a dropdown (PLN-260817 §2-2).
 * Languages whose translation is still awaiting native review carry a β so an
 * operator knows why a string might read oddly — unlike the widget, where the
 * shopper can do nothing with that information.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation('nav');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useDismiss(wrapRef, open, () => setOpen(false));

  const current = SUPPORTED_LANGUAGES.includes(i18n.language)
    ? (i18n.language as SupportedLanguage)
    : 'en';
  const active = LANGUAGE_OPTIONS.find((l) => l.code === current) ?? LANGUAGE_OPTIONS[0];
  const hasUnreviewed = LANGUAGE_OPTIONS.some((l) => !l.reviewed);

  const change = (code: SupportedLanguage) => {
    setOpen(false);
    if (code === current) return;
    i18n.changeLanguage(code);
    document.documentElement.lang = code;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    } catch {
      // ignore storage errors (e.g. private mode)
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language')}
        title={t('language')}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-lg text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900',
          compact ? 'px-2' : 'bg-gray-100 px-2.5',
        )}
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span className={cn(compact && 'hidden sm:inline')}>{compact ? active.shortLabel : active.nativeLabel}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-40 mt-1 min-w-[11rem] animate-st-pop-in overflow-hidden rounded-xl border border-gray-200 bg-surface-elevated p-1 shadow-pop"
        >
          {LANGUAGE_OPTIONS.map((lang) => (
            <li key={lang.code}>
              <button
                type="button"
                role="option"
                aria-selected={lang.code === current}
                onClick={() => change(lang.code as SupportedLanguage)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-gray-100',
                  lang.code === current ? 'font-semibold text-primary-600' : 'text-gray-700',
                )}
              >
                <span>{lang.nativeLabel}</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  {!lang.reviewed && <span aria-hidden="true">β</span>}
                  {lang.code === current && <span aria-hidden="true">✓</span>}
                </span>
              </button>
            </li>
          ))}
          {hasUnreviewed && (
            <li className="mt-1 border-t border-gray-100 px-2.5 pb-0.5 pt-1.5 text-[11px] text-gray-400">
              {t('languageBetaHint')}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Where am I: group › screen (› settings tab). */
function Breadcrumb() {
  const { t } = useTranslation('nav');
  const { pathname } = useLocation();
  const { isAdmin, groups } = useVisibleNav();

  const crumbs: Array<{ label: string; to?: string }> = [];
  const entry = findNavEntry(pathname, groups);
  if (entry) {
    crumbs.push({ label: t(`groups.${entry.group.key}`) });
    crumbs.push({ label: t(entry.item.labelKey), to: entry.item.to });
    const tab = SETTINGS_TABS.find((s) => pathname === s.to || pathname.startsWith(`${s.to}/`));
    if (tab) crumbs.push({ label: t(tab.labelKey) });
  } else if (pathname.endsWith('/my-page')) {
    crumbs.push({ label: t('myPage') });
  } else if (pathname.endsWith('/menu')) {
    crumbs.push({ label: t('allMenus') });
  } else if (isAdmin) {
    crumbs.push({ label: t('platformAdmin') });
  }

  return (
    <nav aria-label="breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" aria-hidden />}
            {c.to && !last ? (
              <Link to={c.to} className="truncate text-gray-500 hover:text-gray-900">
                {c.label}
              </Link>
            ) : (
              <span
                className={cn('truncate', last ? 'font-medium text-gray-900' : 'text-gray-500')}
                aria-current={last ? 'page' : undefined}
              >
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/**
 * Top bar: mobile menu + breadcrumb on the left; search (⌘K), alarms, theme,
 * language and the account menu on the right.
 */
export function Header() {
  const { t } = useTranslation('nav');
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/75 sm:px-6">
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        className="-ml-1 rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
        aria-label={t('sidebar.openMenu')}
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <Breadcrumb />

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label={t('search.button')}
          aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
          className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-sm text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600 md:w-64"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden flex-1 truncate text-left md:block">{t('search.trigger')}</span>
          <kbd className="hidden rounded border border-gray-200 bg-white px-1.5 py-px text-[11px] font-medium text-gray-400 md:block">
            {IS_MAC ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
        {/* Alarm center bell (PLN-261024) — renders nothing without Live Chat. */}
        <AlarmBell />
        <ThemeMenu />
        <LanguageSwitcher compact />
        <div className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" aria-hidden />
        <UserMenu />
      </div>
    </header>
  );
}
