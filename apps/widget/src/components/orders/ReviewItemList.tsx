import { useState } from 'react';
import { CheckCircle2, Package, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWidgetStore } from '../../store/widgetStore';
import { useReviewItems } from '../../hooks/useOrders';
import { useMarkRead } from '../../hooks/useNotifications';
import { formatMoney } from '../../lib/format';
import { noticeTimeText } from '../../lib/notice-time-text';
import { reviewLinkFor } from '../../../../../packages/types/src/common/widget-theme';
import { StatusPill } from '../ui/StatusPill';
import { Spinner } from '../ui/Spinner';
import type { ReviewItem } from '../../lib/types';

/**
 * One purchased line (SPEC SCR-IVY-08, ivy-docs T06 D1): order number with the
 * purple Review pill, "title · price", then ⭐ Write Review and the BR-05 time.
 */
function Row({
  item,
  href,
  onWrite,
  isNew,
  onOpen,
}: {
  item: ReviewItem;
  /** The store's review page for this product; null → the in-widget form. */
  href: string | null;
  onWrite: (orderItemId: string) => void;
  /** An unread review request names this line (IVY PRD v1 N-05). */
  isNew: boolean;
  /** Write Review was opened — reads the request. */
  onOpen: () => void;
}) {
  const { t, i18n } = useTranslation();
  const meta = [item.title, item.price != null ? formatMoney(item.price, item.currency) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      data-testid="review-row"
      data-new={isNew ? 'true' : 'false'}
      // Same unread look as a notification row (PRD v1 slide 8: highlighted card or red dot).
      className={`flex items-start gap-3 border-b border-gray-100 px-4 py-3.5 ${isNew ? 'bg-highlight' : ''}`}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
        {item.imageUrl ? (
          // Decorative: the title beside it already names the product.
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Package className="h-4 w-4 text-gray-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{item.orderNumber}</span>
          <StatusPill status="review" />
        </div>
        <p className="mt-0.5 truncate text-sm text-gray-800">{meta}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          {item.reviewed ? (
            <span className="inline-flex items-center gap-1 text-sm text-gray-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('orders.reviewItems.reviewed')}
            </span>
          ) : href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onOpen}
              className="inline-flex items-center gap-1 text-sm font-semibold text-warning-ink hover:underline"
            >
              <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden />
              {t('orders.writeReview')}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                onOpen();
                onWrite(item.orderItemId);
              }}
              className="inline-flex items-center gap-1 text-sm font-semibold text-warning-ink hover:underline"
            >
              <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden />
              {t('orders.writeReview')}
            </button>
          )}
          <span className="flex-shrink-0 text-xs text-gray-400">
            {noticeTimeText(t, item.orderedAt, i18n.language)}
          </span>
        </div>
      </div>
      {isNew && (
        <span className="mt-1.5 flex-shrink-0" aria-label={t('notifications.unread')}>
          <span className="block h-2 w-2 rounded-full bg-error" />
        </span>
      )}
    </div>
  );
}

/**
 * The Review chip (PLN-260923 P3): what the shopper bought and received, each
 * with a way to review it. A line whose order carried a product URL links to
 * the store's own review page (through the tenant's template); one without
 * opens the widget's review form, so every line stays reviewable.
 */
export function ReviewItemList({
  sessionToken,
  onWrite,
}: {
  sessionToken: string | null;
  onWrite: (orderItemId: string) => void;
}) {
  const { t } = useTranslation();
  const template = useWidgetStore((s) => s.widgetTheme?.design?.reviewLinkTemplate ?? null);
  const { data, isLoading, isError } = useReviewItems(sessionToken);
  const markRead = useMarkRead(sessionToken);
  // Requests opened on this visit: the highlight goes at once, the row stays
  // where it is until the next open (PRD v1 slide 9 rule 3).
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const open = (requestId: string | null | undefined) => {
    if (!requestId || opened.has(requestId)) return;
    setOpened((prev) => new Set(prev).add(requestId));
    markRead.mutate(requestId);
  };

  // Loading and error are said as such — an empty list while the request is in
  // flight would read as "nothing to review".
  if (isLoading) return <Spinner label={t('common.loading')} />;
  if (isError) return <p className="py-8 text-center text-sm text-gray-400">{t('common.error')}</p>;
  if (!data?.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
        <Star className="h-6 w-6" />
        <span className="text-sm">{t('orders.reviewItems.empty')}</span>
      </div>
    );
  }
  return (
    <div>
      {data.map((item) => (
        <Row
          key={item.orderItemId}
          item={item}
          href={reviewLinkFor(template, item.productUrl)}
          onWrite={onWrite}
          isNew={!!item.requestId && !opened.has(item.requestId)}
          onOpen={() => open(item.requestId)}
        />
      ))}
    </div>
  );
}
