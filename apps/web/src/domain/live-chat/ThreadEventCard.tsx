import { PhoneCall, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/Badge';
import type { ThreadCallback, ThreadFeedback } from './live-chat.service';

export type ThreadEvent =
  | { type: 'callback'; at: string; key: string; item: ThreadCallback }
  | { type: 'feedback'; at: string; key: string; item: ThreadFeedback };

/** Callbacks and feedback of the transcript's conversations, as timed thread events. */
export function threadEventsOf(callbacks?: ThreadCallback[], feedback?: ThreadFeedback[]): ThreadEvent[] {
  return [
    ...(callbacks ?? []).map((c): ThreadEvent => ({ type: 'callback', at: c.createdAt, key: `cb-${c.id}`, item: c })),
    ...(feedback ?? []).map((f): ThreadEvent => ({ type: 'feedback', at: f.ratedAt, key: `fb-${f.conversationId}`, item: f })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/**
 * A callback request or the customer's feedback, centred in the thread at the
 * time it happened (PLN-261027 Thread-Events D2) — not a message, so it sits
 * apart from both sides. Contacts arrive masked.
 */
export function ThreadEventCard({ event }: { event: ThreadEvent }) {
  const { t, i18n } = useTranslation('livechat');
  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(i18n.language, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  if (event.type === 'callback') {
    const c = event.item;
    const minutes = c.handledAt ? Math.max(0, Math.round((Date.parse(c.handledAt) - Date.parse(c.createdAt)) / 60_000)) : null;
    return (
      <div className="mx-auto my-2 w-fit max-w-[85%] rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-gray-700">
        <div className="flex flex-wrap items-center gap-1.5">
          <PhoneCall className="h-3.5 w-3.5 text-amber-600" aria-hidden />
          <span className="font-medium">{t('threadEvent.callback')}</span>
          <span className="text-gray-400">{time(c.createdAt)}</span>
          <span>· {t(`callback.channel_${c.channel}`, { defaultValue: c.channel })}</span>
          <span className="font-mono">{c.contactMasked}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone={c.status === 'done' ? 'success' : c.status === 'canceled' ? 'gray' : 'warning'}>
            {t(`callback.status_${c.status}`, { defaultValue: c.status })}
          </Badge>
          {c.handledAt && (
            <span className="text-gray-500">
              {c.handledByName ?? t('agent')} · {time(c.handledAt)}
              {c.status === 'done' && minutes != null && ` (${t('handlers.durMin', { n: minutes })})`}
            </span>
          )}
        </div>
      </div>
    );
  }

  const f = event.item;
  return (
    <div className="mx-auto my-2 w-fit max-w-[85%] rounded-lg border border-yellow-200 bg-yellow-50/70 px-3 py-2 text-xs text-gray-700">
      <div className="flex flex-wrap items-center gap-1.5">
        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-500" aria-hidden />
        <span className="font-medium">{t('threadEvent.feedback')}</span>
        <span className="text-gray-400">{time(f.ratedAt)}</span>
        <span aria-label={t('threadEvent.stars', { n: f.rating })} className="tracking-tight text-yellow-500">
          {'★'.repeat(Math.max(0, Math.min(5, f.rating)))}
          <span className="text-gray-300">{'★'.repeat(Math.max(0, 5 - f.rating))}</span>
        </span>
        <span>{f.rating}</span>
        {f.resolved != null && (
          <Badge tone={f.resolved ? 'success' : 'warning'}>{f.resolved ? t('handlers.resolved') : t('handlers.unresolved')}</Badge>
        )}
      </div>
      {(f.reason || f.comment) && (
        <p className="mt-1 text-gray-600">
          {f.reason && t(`csat.reasons.${f.reason}`, { ns: 'statistics', defaultValue: f.reason })}
          {f.reason && f.comment && ' · '}
          {f.comment && `"${f.comment}"`}
        </p>
      )}
    </div>
  );
}
