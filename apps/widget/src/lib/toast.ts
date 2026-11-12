import { createStore } from 'zustand/vanilla';

/**
 * Widget toasts (ivy-docs T07 D3; CLAUDE.md §2 "UX feedback"). One queue for
 * the whole widget so a result can outlive the screen that produced it — a
 * review form that closes on success, a list that leaves selection mode.
 *
 * - success: `role="status"`, closes itself after SUCCESS_TOAST_MS;
 * - error: `role="alert"`, stays until the shopper closes it.
 *
 * Plain store, no React: `ToastHost` subscribes with `useStore`, and the unit
 * test drives it directly.
 */
export type ToastTone = 'success' | 'error';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

export const SUCCESS_TOAST_MS = 3000;
/** More than this and the oldest goes: a stack of toasts covers the list. */
export const MAX_TOASTS = 3;

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;

export const toastStore = createStore<ToastState>()((set, get) => ({
  toasts: [],
  show: ({ tone, message }) => {
    const id = nextId++;
    // A repeat of the same message replaces the old one instead of stacking.
    const kept = get().toasts.filter((t) => !(t.tone === tone && t.message === message));
    set({ toasts: [...kept, { id, tone, message }].slice(-MAX_TOASTS) });
    if (tone === 'success') {
      setTimeout(() => get().dismiss(id), SUCCESS_TOAST_MS);
    }
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  clear: () => set({ toasts: [] }),
}));

export function showToast(toast: Omit<Toast, 'id'>): number {
  return toastStore.getState().show(toast);
}
