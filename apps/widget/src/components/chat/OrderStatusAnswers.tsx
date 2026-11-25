import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrders, useTracking } from '../../hooks/useOrders';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { formatDate, formatMoney } from '../../lib/format';
import { displayOrderNumber } from '../../lib/address';
import {
  PAYMENT_TONE,
  deliveryOrder,
  deliveryStage,
  latestOrder,
  paymentState,
} from '../../lib/order-answers';
import type { OrderSummary } from '../../lib/types';
import { ShipmentCard } from '../notifications/ShipmentList';
import { MessageBubble } from './MessageBubble';
import { TypingBubble } from './TypingBubble';
import { ChatChip } from './ChatChip';
import { useCardNote } from '../../hooks/useCardNote';
import { START_OVER_ID } from './reply-chips';

/**
 * The Payment check and Delivery inquiry answers (IVY PRD v1 C-01, PLN-261125
 * §2.5): the shopper's tap, a data card for their latest order, a line of
 * guidance, then what they can do next. Thread inserts, like My Orders: they
 * stay where they were asked, and their chips only show while nothing came
 * after them.
 *
 * The guidance under the card is the AI's, written from the card's data
 * (C-02, PLN-261125-Phase5 §1.2); while it has nothing to say — no consent, no
 * AI engine, an error — the widget's own copy in the shopper's language stands.
 */

const now = () => new Date().toISOString();

/** The order a form or the Delivery chip is about. */
export interface OrderRef {
  id: string;
  number: string;
}

const refOf = (o: OrderSummary): OrderRef => ({ id: String(o.id), number: o.orderNumber });

function itemSummary(t: (k: string, o?: Record<string, unknown>) => string, o: OrderSummary): string {
  if (!o.firstItemTitle) return t('orders.itemCount', { count: o.itemCount });
  return o.itemCount > 1 ? t('orders.itemsMore', { title: o.firstItemTitle, count: o.itemCount - 1 }) : o.firstItemTitle;
}

interface Chip {
  id: string;
  label: string;
  run: () => void;
}

function Chips({ chips, picked, disabled }: { chips: Chip[]; picked?: string; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5 pl-1">
      {chips.map((c) => (
        <ChatChip
          key={c.id}
          label={c.label}
          disabled={disabled}
          selected={picked ? picked === c.id : undefined}
          onClick={c.run}
        />
      ))}
    </div>
  );
}

interface AnswerProps {
  insertKey: string;
  sessionToken: string | null;
  /** The quick-menu label the shopper tapped, echoed as their turn. */
  asked?: string | null;
  /** Nothing came after it yet: its chips are offered. */
  active: boolean;
  picked?: string;
  disabled?: boolean;
  /** Outline the chip that was tapped. */
  onPick: (id: string) => void;
  /** Contact Support with this order on the form (E-01). */
  onContact: (order: OrderRef | null) => void;
  onStartOver: () => void;
  /** The cards arrive after the answer mounts; the thread follows them down. */
  onSettled?: () => void;
}

/** Payment check: the latest order's payment status. */
export function PaymentStatusAnswer({
  insertKey,
  sessionToken,
  asked,
  active,
  picked,
  disabled,
  onPick,
  onContact,
  onStartOver,
  onSettled,
  onOpenOrder,
  onTrack,
}: AnswerProps & {
  onOpenOrder: (orderId: string) => void;
  /** The Delivery chip led by this order; absent where no tab shows deliveries. */
  onTrack?: (orderId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = useOrders(sessionToken);
  useEffect(() => {
    if (!isLoading) onSettled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, data?.length]);
  const order = latestOrder(data ?? []);
  const state = order ? paymentState(order) : null;
  const number = order ? displayOrderNumber(order.orderNumber) : '';
  const note = useCardNote(sessionToken, order && state ? { kind: 'payment', orderId: String(order.id) } : null);

  const chips: Chip[] = [
    ...(order && onTrack
      ? [{ id: 'track', label: t('chat.orderAnswer.trackDelivery'), run: () => (onPick('track'), onTrack(String(order.id))) }]
      : []),
    { id: 'contact', label: t('chat.contactSupport'), run: () => (onPick('contact'), onContact(order ? refOf(order) : null)) },
    { id: START_OVER_ID, label: t('chat.startOver'), run: () => (onPick(START_OVER_ID), onStartOver()) },
  ];

  return (
    <div className="space-y-2" data-testid="payment-answer">
      {asked && <MessageBubble message={{ id: `${insertKey}-asked`, senderType: 'user', body: asked, createdAt: now() }} />}
      {isLoading ? (
        <Spinner label={t('common.loading')} />
      ) : isError ? (
        <p className="text-sm text-gray-400">{t('common.error')}</p>
      ) : (
        <>
          <MessageBubble
            message={{ id: `${insertKey}-lead`, senderType: 'ai', body: order ? t('chat.payment.lead') : t('chat.payment.none'), createdAt: now() }}
          />
          {order && state && (
            <div className="pl-6">
              <button
                type="button"
                data-testid="payment-card"
                data-state={state}
                onClick={() => onOpenOrder(String(order.id))}
                className="block w-full rounded-st-lg border border-gray-200 bg-white px-3.5 py-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-gray-900">{number}</span>
                  <span className="text-xs text-gray-500">{formatDate(order.orderedAt ?? order.createdAt, i18n.language)}</span>
                </span>
                <span className="mt-1 block text-sm text-gray-700">{itemSummary(t, order)}</span>
                <span className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {t('chat.payment.total', { amount: formatMoney(order.total, order.currency) })}
                  </span>
                  <Badge tone={PAYMENT_TONE[state]}>{t(`chat.payment.state.${state}`)}</Badge>
                </span>
              </button>
            </div>
          )}
          {order && state &&
            (note.loading ? (
              <TypingBubble mode="ai" />
            ) : (
              <MessageBubble
                message={{
                  id: `${insertKey}-guide`,
                  senderType: 'ai',
                  body: note.text ?? t(`chat.payment.guide.${state}`, { orderNumber: number }),
                  createdAt: now(),
                }}
              />
            ))}
          {active && <Chips chips={chips} picked={picked} disabled={disabled} />}
        </>
      )}
    </div>
  );
}

/** Delivery inquiry: the 4-step tracker of the order on its way (or the latest one). */
export function DeliveryStatusAnswer({
  insertKey,
  sessionToken,
  asked,
  active,
  picked,
  disabled,
  onPick,
  onContact,
  onStartOver,
  onSettled,
  onOpenOrder,
  onPolicy,
}: AnswerProps & {
  onOpenOrder: (orderId: string) => void;
  /** The shipping policy script, on request. */
  onPolicy: (label: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useOrders(sessionToken);
  const order = deliveryOrder(data ?? []);
  const tracking = useTracking(order ? String(order.id) : null, sessionToken);
  const note = useCardNote(sessionToken, order ? { kind: 'delivery', orderId: String(order.id) } : null);
  useEffect(() => {
    if (!isLoading && !tracking.isLoading) onSettled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, tracking.isLoading, data?.length]);
  const number = order ? displayOrderNumber(order.orderNumber) : '';
  const policy = t('chat.delivery.policy');

  const chips: Chip[] = [
    { id: 'policy', label: policy, run: () => (onPick('policy'), onPolicy(policy)) },
    { id: 'contact', label: t('chat.contactSupport'), run: () => (onPick('contact'), onContact(order ? refOf(order) : null)) },
    { id: START_OVER_ID, label: t('chat.startOver'), run: () => (onPick(START_OVER_ID), onStartOver()) },
  ];

  return (
    <div className="space-y-2" data-testid="delivery-answer">
      {asked && <MessageBubble message={{ id: `${insertKey}-asked`, senderType: 'user', body: asked, createdAt: now() }} />}
      {isLoading ? (
        <Spinner label={t('common.loading')} />
      ) : isError ? (
        <p className="text-sm text-gray-400">{t('common.error')}</p>
      ) : (
        <>
          <MessageBubble
            message={{ id: `${insertKey}-lead`, senderType: 'ai', body: order ? t('chat.delivery.lead') : t('chat.delivery.none'), createdAt: now() }}
          />
          {order && (
            <div className="overflow-hidden rounded-st-lg border border-gray-200 bg-white">
              <ShipmentCard
                order={order}
                tracking={tracking.data}
                loading={tracking.isLoading}
                onOpen={() => onOpenOrder(String(order.id))}
              />
            </div>
          )}
          {order &&
            (note.loading ? (
              <TypingBubble mode="ai" />
            ) : (
              <MessageBubble
                message={{
                  id: `${insertKey}-guide`,
                  senderType: 'ai',
                  body: note.text ?? t(`chat.delivery.guide.${deliveryStage(order)}`, { orderNumber: number }),
                  createdAt: now(),
                }}
              />
            ))}
          {active && <Chips chips={chips} picked={picked} disabled={disabled} />}
        </>
      )}
    </div>
  );
}
