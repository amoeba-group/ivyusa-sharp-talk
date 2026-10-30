import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Lets content know it already sits on a card surface — a Table inside a Card
 * drops its own border and shadow instead of drawing a box inside a box.
 */
const InCardContext = createContext(false);
export const useInCard = () => useContext(InCardContext);

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  /** One line under the title: what this card is for. */
  description?: ReactNode;
  /** Anchor for in-page navigation (e.g. the knowledge process guide). */
  id?: string;
  /** Body padding off — for full-bleed tables and lists. */
  flush?: boolean;
  /** Plain-text name for the "on this page" bar when `title` is not a string. */
  navLabel?: string;
}

export function Card({ children, className, title, action, description, id, flush, navLabel }: CardProps) {
  const autoId = useId();
  const label = navLabel ?? (typeof title === 'string' ? title : undefined);
  return (
    <div
      id={id ?? (label ? `card${autoId.replace(/:/g, '')}` : undefined)}
      // Long pages list their cards in an "on this page" bar (OnThisPage).
      data-card-title={label}
      className={cn('scroll-mt-32 rounded-xl border border-gray-200 bg-white shadow-card', className)}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <InCardContext.Provider value>
        <div className={cn(!flush && 'p-5')}>{children}</div>
      </InCardContext.Provider>
    </div>
  );
}
