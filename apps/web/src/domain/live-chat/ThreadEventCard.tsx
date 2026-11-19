import { PhoneCall } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/Badge';
import { cn } from '@/lib/cn';
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

/** The widget's faces, by the 1–5 value each one stores (widget CsatCard). */
const FACES = ['😞', '😕', '😐', '😊', '😍'];
/** The one-question card offers four of them — 1 · 3 · 4 · 5 (ivy-docs SPEC Q-12). */
const FOUR = [1, 3, 4, 5];
const FIVE = [1, 2, 3, 4, 5];

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

  // The customer's rating, shown as what they tapped (PLN-261119): the same row
  // of faces the widget offered, the chosen one lit. Stars made staff convert —
  // the faces store 1 · 3 · 4 · 5, so "3 stars" was really the neutral face.
  const f = event.item;
  const rating = Math.max(1, Math.min(5, Math.round(f.rating)));
  // The survey card offers all five; the one-question card never stores a 2.
  const scale = f.resolved != null || rating === 2 ? FIVE : FOUR;
  const level = t(`csatLevel.${rating}`);
  return (
    <div
      className="mx-auto my-3 w-fit max-w-[85%] rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-700 shadow-sm"
      data-testid="thread-feedback"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-medium text-gray-900">{t('threadEvent.rated')}</span>
        <span className="text-gray-400">{time(f.ratedAt)}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span role="img" aria-label={t('threadEvent.ratedAs', { level })} className="flex items-center gap-1">
          {scale.map((value) => (
            <span
              key={value}
              aria-hidden
              data-chosen={value === rating || undefined}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none',
                value === rating ? 'bg-primary-50 ring-2 ring-primary-500' : 'opacity-25 grayscale',
              )}
            >
              {FACES[value - 1]}
            </span>
          ))}
        </span>
        <span className="text-sm font-semibold text-gray-900">{level}</span>
        {f.resolved != null && (
          <Badge tone={f.resolved ? 'success' : 'warning'}>{f.resolved ? t('handlers.resolved') : t('handlers.unresolved')}</Badge>
        )}
      </div>
      {(f.reason || f.comment) && (
        <p className="mt-2 text-gray-600">
          {f.reason && t(`csat.reasons.${f.reason}`, { ns: 'statistics', defaultValue: f.reason })}
          {f.reason && f.comment && ' · '}
          {f.comment && `"${f.comment}"`}
        </p>
      )}
    </div>
  );
}
