import { useWidgetStore } from '../store/widgetStore';

/**
 * Which notifications sit in New for this opening of the panel (IVY PRD v1
 * slide 9 rule 3): every one that was unread when the shopper saw it during
 * this opening, including any that arrive while it is open. A row read now
 * keeps its place — only its highlight and dot go — and moves to Recent at the
 * next opening, so the list never shifts under the shopper's finger.
 *
 * Module state, not component state: switching tabs or chips unmounts the
 * list, and coming back within the same opening must find the rows where they
 * were. There is one widget per page, so one snapshot.
 */
let snapshot: { seq: number; ids: Set<string> } = { seq: -1, ids: new Set() };

export function useNewSnapshot(
  rows: ReadonlyArray<{ id: string; readAt?: string | null }> | undefined,
): (id: string) => boolean {
  const seq = useWidgetStore((s) => s.panelOpenSeq);
  if (snapshot.seq !== seq) snapshot = { seq, ids: new Set() };
  for (const r of rows ?? []) if (!r.readAt) snapshot.ids.add(r.id);
  const ids = snapshot.ids;
  return (id) => ids.has(id);
}
