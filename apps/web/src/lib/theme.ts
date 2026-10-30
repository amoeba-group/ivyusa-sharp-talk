import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Console theme (REQ-261030): light / dark / follow the OS.
 *
 * The first paint is handled by the inline script in index.html, which reads
 * the same storage key — keep the two in sync. This module owns everything
 * after that: the user's choice, OS changes while "system" is selected, and the
 * attributes the CSS keys off (`data-theme` for our tokens, `data-color-mode`
 * for @uiw/react-md-editor).
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'st_theme';

const media = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // storage blocked (private mode): fall through to the default
  }
  return 'system';
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return media()?.matches ? 'dark' : 'light';
  return pref;
}

function apply(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-color-mode', theme);
}

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
  /** Light ↔ dark from whatever is showing now (keyboard shortcut / palette). */
  toggle: () => void;
  /** Re-resolve after an OS change; no-op unless following the system. */
  syncSystem: () => void;
}

const initial = readPreference();

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: initial,
  resolved: resolve(initial),
  setPreference: (preference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // ignore storage errors — the choice still applies for this tab
    }
    const resolved = resolve(preference);
    apply(resolved);
    set({ preference, resolved });
  },
  toggle: () => get().setPreference(get().resolved === 'dark' ? 'light' : 'dark'),
  syncSystem: () => {
    if (get().preference !== 'system') return;
    const resolved = resolve('system');
    apply(resolved);
    set({ resolved });
  },
}));

/** Mount once (App root): keeps the DOM attribute and OS changes in sync. */
export function useThemeSync() {
  const resolved = useThemeStore((s) => s.resolved);
  const syncSystem = useThemeStore((s) => s.syncSystem);

  useEffect(() => {
    apply(resolved);
  }, [resolved]);

  useEffect(() => {
    const mq = media();
    if (!mq) return;
    const onChange = () => syncSystem();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [syncSystem]);
}
