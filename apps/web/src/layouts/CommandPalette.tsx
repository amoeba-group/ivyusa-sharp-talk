import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CornerDownLeft,
  LayoutGrid,
  LogOut,
  Monitor,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';
import { useUiStore } from '@/store/ui-store';
import { useThemeStore } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { SETTINGS_TABS } from './nav-config';
import { useLogout, useVisibleNav } from './use-shell';

interface Entry {
  id: string;
  section: 'pages' | 'settings' | 'actions';
  label: string;
  hint?: string;
  icon: LucideIcon;
  /** Lower-cased text the query is matched against. */
  haystack: string;
  run: () => void;
}

/** True on Apple platforms, where the shortcut reads ⌘ rather than Ctrl. */
export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * ⌘K / Ctrl+K — jump to any menu, settings tab or action by typing
 * (REQ-261030). Sixteen menus and eight settings tabs are too many to scan;
 * typing three letters is faster than reading.
 */
export function CommandPalette() {
  const { t } = useTranslation('nav');
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const navigate = useNavigate();
  const logout = useLogout();
  const setTheme = useThemeStore((s) => s.setPreference);
  const { isAdmin, groups } = useVisibleNav();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const go = (to: string) => () => {
      setOpen(false);
      navigate(to);
    };
    const out: Entry[] = [];
    for (const g of groups) {
      for (const item of g.items) {
        const label = t(item.labelKey);
        out.push({
          id: item.to,
          section: 'pages',
          label,
          hint: t(`groups.${g.key}`),
          icon: item.icon,
          haystack: [label, item.to, ...(item.keywords ?? [])].join(' ').toLowerCase(),
          run: go(item.to),
        });
      }
    }
    const canSettings = !isAdmin && groups.some((g) => g.items.some((i) => i.to === '/settings'));
    if (canSettings) {
      for (const tab of SETTINGS_TABS) {
        const label = t(tab.labelKey);
        out.push({
          id: tab.to,
          section: 'settings',
          label,
          hint: t('settings'),
          icon: SlidersHorizontal,
          haystack: [label, t('settings'), tab.to, ...(tab.keywords ?? [])].join(' ').toLowerCase(),
          run: go(tab.to),
        });
      }
    }
    const action = (id: string, label: string, icon: LucideIcon, run: () => void, extra = ''): Entry => ({
      id,
      section: 'actions',
      label,
      icon,
      haystack: `${label} ${extra}`.toLowerCase(),
      run: () => {
        setOpen(false);
        run();
      },
    });
    out.push(
      action('my-page', t('myPage'), UserCircle, () => navigate(isAdmin ? '/admin/my-page' : '/my-page'), 'profile password mfa'),
      action('all-menus', t('allMenus'), LayoutGrid, () => navigate(isAdmin ? '/admin/menu' : '/menu'), 'menu'),
      action('theme-light', t('theme.actionLight'), Sun, () => setTheme('light'), 'theme light'),
      action('theme-dark', t('theme.actionDark'), Moon, () => setTheme('dark'), 'theme dark night'),
      action('theme-system', t('theme.actionSystem'), Monitor, () => setTheme('system'), 'theme system auto'),
      action('logout', t('logout'), LogOut, logout, 'sign out logout'),
    );
    return out;
  }, [groups, isAdmin, logout, navigate, setOpen, setTheme, t]);

  // Every term must match somewhere; rank label hits above keyword hits so
  // "widget" opens the Widget tab, not the Settings page whose keywords say so.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    const terms = q.split(/\s+/);
    const score = (e: Entry) => {
      const label = e.label.toLowerCase();
      if (label === q) return 4;
      if (label.startsWith(q)) return 3;
      if (terms.every((term) => label.includes(term))) return 2;
      return 1;
    };
    return entries
      .filter((e) => terms.every((term) => e.haystack.includes(term)))
      .map((e, i) => ({ e, i, s: score(e) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.e);
  }, [entries, query]);

  // Reset on open; keep the active row in range as the list narrows.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[active]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const titles: Record<Entry['section'], string> = {
    pages: t('search.pages'),
    settings: t('search.settings'),
    actions: t('search.actions'),
  };
  // Sections appear in the order of their best match, so the first row —
  // the one Enter opens — is always the best one.
  const sections = [...new Set(filtered.map((e) => e.section))].map((key) => ({ key, title: titles[key] }));
  let index = -1;
  const rows: ReactNode[] = [];
  for (const s of sections) {
    const items = filtered.filter((e) => e.section === s.key);
    if (!items.length) continue;
    rows.push(
      <li key={`h-${s.key}`} className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400" role="presentation">
        {s.title}
      </li>,
    );
    for (const e of items) {
      index += 1;
      const i = index;
      const Icon = e.icon;
      const isActive = i === active;
      rows.push(
        <li key={e.id} role="option" aria-selected={isActive} data-index={i}>
          <button
            type="button"
            onMouseMove={() => setActive(i)}
            onClick={e.run}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm',
              isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary-600' : 'text-gray-400')} aria-hidden />
            <span className="flex-1 truncate font-medium">{e.label}</span>
            {e.hint && <span className="truncate text-xs text-gray-400">{e.hint}</span>}
            {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />}
          </button>
        </li>,
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label={t('search.button')}>
      <div className="absolute inset-0 animate-st-fade-in bg-gray-950/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl animate-st-pop-in overflow-hidden rounded-2xl border border-gray-200 bg-surface-elevated shadow-pop" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-gray-100 px-4">
          <Search className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            aria-controls="st-command-list"
            className="h-14 w-full bg-transparent text-[15px] text-gray-900 outline-none placeholder:text-gray-400"
          />
          <kbd className="hidden rounded-md border border-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-400 sm:block">Esc</kbd>
        </div>
        <ul id="st-command-list" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {rows.length ? rows : <li className="px-3 py-10 text-center text-sm text-gray-400">{t('search.noResults')}</li>}
        </ul>
        <div className="flex items-center gap-4 border-t border-gray-100 px-4 py-2.5 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 px-1">↑</kbd>
            <kbd className="rounded border border-gray-200 px-1">↓</kbd>
            {t('search.hintNavigate')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 px-1">↵</kbd>
            {t('search.hintSelect')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 px-1">Esc</kbd>
            {t('search.hintClose')}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Global ⌘K / Ctrl+K and "/" (when not typing) to open the palette. */
export function useCommandPaletteShortcut() {
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUiStore.getState().paletteOpen);
        return;
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = e.target as HTMLElement | null;
        const typing =
          el &&
          (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
        if (!typing) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);
}
