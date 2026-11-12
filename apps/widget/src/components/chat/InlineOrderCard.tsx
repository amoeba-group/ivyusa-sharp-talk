import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '../ui/StatusPill';
import { Spinner } from '../ui/Spinner';
import { formatMoney } from '../../lib/format';
import { useOrders } from '../../hooks/useOrders';
import { INLINE_ORDER_DAYS } from '../../services/orderService';
import type { OrderSummary } from '../../lib/types';
import { MessageBubble } from './MessageBubble';
import { ChatChip } from './ChatChip';
import { orderAnswerChips } from './reply-chips';

/** How many orders the in-thread answer shows before pointing elsewhere. */
const INLINE_MAX = 3;

/**
 * An order rendered inside the chat thread (SCR-IVY-11, Figma 1006:5530):
 * number, status pill, what was bought. Tapping it opens Order Detail over the
 * chat (ivy-docs T09 D1) — the thread stays where it was underneath.
 */
export function InlineOrderCard({
  order,
  onOpen,
}: {
  order: OrderSummary;
  onOpen?: (orderId: string) => void;
}) {
  const { t } = useTranslation();
  const summary = order.firstItemTitle
    ? order.itemCount > 1
      ? t('orders.itemsMore', { title: order.firstItemTitle, count: order.itemCount - 1 })
      : `${order.firstItemTitle}${order.total != null ? ` · ${formatMoney(order.total, order.currency)}` : ''}`
    : t('orders.itemCount', { count: order.itemCount });

  const body = (
    <>
      <span className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-900">{order.orderNumber}</span>
        {/* By status code, translated (BUG-011) — the same pill as everywhere else. */}
        <StatusPill badge={order.statusUi} />
      </span>
      <span className="mt-1 block text-sm text-gray-700">{summary}</span>
    </>
  );
  const box = 'block w-full rounded-st-lg border border-gray-200 bg-white px-3.5 py-3 text-left';
  return onOpen ? (
    <button
      type="button"
      onClick={() => onOpen(String(order.id))}
      className={`${box} transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
    >
      {body}
    </button>
  ) : (
    <div className={box}>{body}</div>
  );
}

/**
 * The whole "My Orders" answer (SCR-IVY-11): what the shopper asked, the bot's
 * lead-in, up to three order cards, then "Do you need anything else?" with
 * Track delivery · Cancel order · Start over.
 *
 * It sits in the thread where it was asked (ChatTab anchors it), so a later
 * reply lands below it rather than above. The chips only show while it is the
 * latest thing in the thread, like the chips under a scripted reply.
 */
export function InlineOrdersAnswer({
  sessionToken,
  asked,
  active,
  onOpenOrder,
  onChip,
  onSettled,
}: {
  sessionToken: string | null;
  /** The button or chip label the shopper tapped, echoed as their turn. */
  asked?: string | null;
  /** Whether nothing came after it yet — its chips are only offered then. */
  active: boolean;
  onOpenOrder: (orderId: string) => void;
  onChip: (id: string, label: string) => void;
  /** Called once the orders have loaded (or failed), so the thread can scroll to them. */
  onSettled?: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useOrders(sessionToken);
  useEffect(() => {
    if (!isLoading) onSettled?.();
    // Once per settle, not per render of the parent's callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, data?.length]);
  const orders = (data ?? []).slice(0, INLINE_MAX);
  const chips = orderAnswerChips(orders.length > 0, {
    track: t('chat.orderAnswer.trackDelivery'),
    cancel: t('chat.orderAnswer.cancelOrder'),
    startOver: t('chat.startOver'),
  });
  const now = new Date().toISOString();

  return (
    <div className="space-y-2">
      {asked && <MessageBubble message={{ id: 'orders-asked', senderType: 'user', body: asked, createdAt: now }} />}
      {isLoading ? (
        <Spinner label={t('common.loading')} />
      ) : isError ? (
        <p className="text-sm text-gray-400">{t('common.error')}</p>
      ) : (
        <>
          <MessageBubble
            message={{
              id: 'orders-lead',
              senderType: 'ai',
              body: orders.length ? t('orders.inlineLead') : t('orders.emptyRecent', { days: INLINE_ORDER_DAYS }),
              createdAt: now,
            }}
          />
          {orders.length > 0 && (
            <div className="space-y-2 pl-6">
              {orders.map((o) => (
                <InlineOrderCard key={o.id} order={o} onOpen={onOpenOrder} />
              ))}
            </div>
          )}
          {orders.length > 0 && (
            <MessageBubble
              message={{ id: 'orders-more', senderType: 'ai', body: t('chat.orderAnswer.followUp'), createdAt: now }}
            />
          )}
          {active && (
            <div className="flex flex-wrap gap-1.5 pl-1">
              {chips.map((c) => (
                <ChatChip key={c.id} label={c.label} onClick={() => onChip(c.id, c.label)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
