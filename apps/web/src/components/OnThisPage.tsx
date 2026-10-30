import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface Section {
  id: string;
  title: string;
}

/**
 * "On this page" bar for long screens (AI settings is six screens tall). It
 * lists every titled Card found inside `scopeRef` (or the page), sticks under
 * the header, highlights the section in view and jumps on click — so a setting
 * at the bottom is one click away instead of a long scroll and a search by eye.
 *
 * It reads the DOM (Card stamps `data-card-title`) rather than a hand-kept
 * list, so a card added later shows up without anyone remembering to add it.
 */
export function OnThisPage({ minSections = 4, className }: { minSections?: number; className?: string }) {
  const { t } = useTranslation('common');
  const ref = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState<string | null>(null);

  // Collect titled cards that follow this bar in the same page.
  useEffect(() => {
    const host = ref.current?.closest('main') ?? document.body;
    const collect = () => {
      const nodes = Array.from(host.querySelectorAll<HTMLElement>('[data-card-title]')).filter(
        // Cards inside dialogs or nested cards are not page sections.
        (el) => !el.closest('[role="dialog"]') && !el.parentElement?.closest('[data-card-title]'),
      );
      const next = nodes
        .filter((el) => el.id && el.dataset.cardTitle)
        .map((el) => ({ id: el.id, title: el.dataset.cardTitle as string }));
      setSections((prev) =>
        prev.length === next.length && prev.every((p, i) => p.id === next[i].id && p.title === next[i].title)
          ? prev
          : next,
      );
    };
    collect();
    const mo = new MutationObserver(() => collect());
    mo.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-card-title'] });
    return () => mo.disconnect();
  }, []);

  // Highlight the section nearest the top of the viewport.
  useEffect(() => {
    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [sections]);

  const show = sections.length >= minSections;
  return (
    // Stays mounted while hidden: it needs its place in the page to find the cards.
    <div ref={ref} className={cn(show ? 'sticky top-16 z-10 -mx-1 mb-5 py-2' : 'hidden', show && className)}>
      {show && (
        <nav
          aria-label={t('onThisPage')}
          className="flex items-center gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white/90 p-1 shadow-card backdrop-blur supports-[backdrop-filter]:bg-white/80"
        >
          <span className="hidden shrink-0 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 md:block">
            {t('onThisPage')}
          </span>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setActive(s.id);
              }}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                active === s.id ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              {s.title}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
