import { useState } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  Combine,
  Hand,
  Loader2,
  MessageCircle,
  PhoneCall,
  PhoneOff,
  PhoneOutgoing,
  Settings2,
  Split,
  Star,
  Undo2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/cn';
import { useConversationHandlers, useConversationHistory } from './live-chat.hooks';
import type { HandlerEvent } from './live-chat.service';

/** Card shows the latest few; the rest is one click away (PLN-261027 Thread-Events D5). */
const CARD_EVENTS = 6;

const ICON: Record<HandlerEvent['kind'], typeof Users> = {
  started: MessageCircle,
  handoff_request: Hand,
  assigned: UserCheck,
  transferred: ArrowRightLeft,
  returned_to_ai: Undo2,
  ended: CheckCircle2,
  callback_requested: PhoneOutgoing,
  callback_done: PhoneCall,
  callback_canceled: PhoneOff,
  feedback: Star,
  room_created: Combine,
  room_sessions_added: UserPlus,
  room_session_joined: UserPlus,
  room_session_removed: Split,
  room_auto_join: Settings2,
  room_dissolved: Split,
};

const TONE: Record<HandlerEvent['group'], string> = {
  handling: 'text-primary-600',
  callback: 'text-amber-600',
  feedback: 'text-yellow-500',
  room: 'text-sky-600',
};

/** One event as a sentence — shared by the card and the full-history modal. */
function useEventText(aiAgentName?: string | null) {
  const { t, i18n } = useTranslation('livechat');
  const who = (name: string | null) => name ?? t('agent');
  const sessions = (ids: string[] | null) => (ids ?? []).map((id) => t('sessionLabel', { id })).join(', ') || '—';
  const duration = (ms: number | null) => {
    if (ms == null) return '';
    const min = Math.max(0, Math.round(ms / 60_000));
    return min < 60 ? t('handlers.durMin', { n: min }) : t('handlers.durHour', { h: Math.floor(min / 60), m: min % 60 });
  };
  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const channel = (c: string | null) => (c ? t(`callback.channel_${c}`, { defaultValue: c }) : '');
  const text = (e: HandlerEvent): string => {
    switch (e.kind) {
      case 'started':
        return aiAgentName ? t('handlers.startedAi', { name: aiAgentName }) : t('handlers.started');
      case 'handoff_request':
        return t('handlers.requested', {
          reason: t(`handlers.reason.${e.reason ?? 'other'}`, { defaultValue: e.reason ?? '' }),
        });
      case 'assigned':
        return e.assignType === 'auto'
          ? t('handlers.assignedAuto', { name: who(e.agentName) })
          : t('handlers.assigned', { name: who(e.agentName) });
      case 'transferred':
        return t('handlers.transferred', { from: who(e.fromName), to: who(e.agentName) });
      case 'returned_to_ai':
        return t('handlers.returned', { name: who(e.agentName) });
      case 'ended':
        return e.agentName ? t('handlers.endedBy', { name: e.agentName }) : t('handlers.ended');
      case 'callback_requested':
        return t('handlers.callbackRequested', { channel: channel(e.reason) });
      case 'callback_done':
        return t('handlers.callbackDone', { name: who(e.agentName), duration: duration(e.durationMs) });
      case 'callback_canceled':
        return t('handlers.callbackCanceled', { name: who(e.agentName) });
      case 'feedback':
        return [
          t('handlers.feedback', { rating: e.rating ?? '—' }),
          e.resolved === true ? t('handlers.resolved') : e.resolved === false ? t('handlers.unresolved') : null,
        ]
          .filter(Boolean)
          .join(' · ');
      case 'room_created':
        return t('handlers.roomCreated', { sessions: sessions(e.conversationIds) });
      case 'room_sessions_added':
        return t('handlers.roomAdded', { sessions: sessions(e.conversationIds) });
      case 'room_session_joined':
        return t('handlers.roomJoined', { sessions: sessions(e.conversationIds) });
      case 'room_session_removed':
        return t('handlers.roomRemoved', { sessions: sessions(e.conversationIds) });
      case 'room_auto_join':
        return e.on ? t('handlers.roomAutoOn') : t('handlers.roomAutoOff');
      case 'room_dissolved':
        return t('handlers.roomDissolved');
    }
  };
  return { text, when };
}

function EventRow({ e, text, when, session }: { e: HandlerEvent; text: string; when: string; session?: string | null }) {
  const { t } = useTranslation('livechat');
  const Icon = ICON[e.kind];
  return (
    <li className="relative text-xs">
      <span className="absolute -left-[19px] top-0.5 rounded-full bg-white">
        <Icon className={cn('h-3.5 w-3.5', TONE[e.group])} />
      </span>
      <span className="text-gray-400">
        {when}
        {session && <span className="ml-1.5 rounded bg-gray-100 px-1 text-gray-500">{session}</span>}
      </span>
      <p className="text-gray-700">{text}</p>
      {e.byName && e.kind !== 'callback_done' && e.kind !== 'callback_canceled' && (
        // "assigned by" for an assignment; room edits read "by" whoever made them.
        <p className="text-gray-400">{t(e.group === 'room' ? 'handlers.actor' : 'handlers.by', { name: e.byName })}</p>
      )}
      {e.kind === 'feedback' && (e.reason || e.comment) && (
        <p className="text-gray-500">
          {e.reason && t(`csat.reasons.${e.reason}`, { ns: 'statistics', defaultValue: e.reason })}
          {e.reason && e.comment && ' · '}
          {e.comment && `"${e.comment}"`}
        </p>
      )}
    </li>
  );
}

/**
 * Who handled this conversation, in order (PLN-261027 S2): the AI start, the
 * requests for a person, each assignment and transfer, hand-backs, callbacks
 * and their outcome, the customer's feedback and the end. The card keeps the
 * latest few; [전체 히스토리 보기] opens the whole merged room (Thread-Events D5).
 */
export function HandlerHistoryCard({
  conversationId,
  version,
  aiAgentName,
}: {
  conversationId: string | null;
  /** Status + owner from the conversation poll; a change re-reads the history. */
  version: string;
  aiAgentName?: string | null;
}) {
  const { t } = useTranslation('livechat');
  const { data, isLoading } = useConversationHandlers(conversationId, version);
  const [open, setOpen] = useState(false);
  const { text, when } = useEventText(aiAgentName);
  if (!conversationId) return null;
  const recent = data ? data.events.slice(-CARD_EVENTS) : [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
        <Users className="h-4 w-4 text-primary-500" /> {t('handlers.title')}
      </div>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      {data && (
        <>
          {data.handlers.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {data.handlers.map((h) => (
                <Badge key={h.agentId} tone={h.current ? 'primary' : 'gray'}>
                  {h.name ?? t('agent')}
                  {h.current && ` · ${t('handlers.current')}`}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-xs text-gray-500">{t('handlers.aiOnly')}</p>
          )}
          {data.events.length > recent.length && (
            <p className="mb-1 text-[11px] text-gray-400">{t('handlers.earlierHidden', { count: data.events.length - recent.length })}</p>
          )}
          <ol className="space-y-2 border-l border-gray-200 pl-3">
            {recent.map((e, i) => (
              <EventRow key={`${e.kind}-${e.at}-${i}`} e={e} text={text(e)} when={when(e.at)} />
            ))}
          </ol>
          <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setOpen(true)}>
            {t('handlers.viewAll')}
          </Button>
        </>
      )}
      <HandlingHistoryModal
        conversationId={conversationId}
        open={open}
        onClose={() => setOpen(false)}
        aiAgentName={aiAgentName}
      />
    </div>
  );
}

const FILTERS = ['all', 'handling', 'callback', 'feedback', 'room'] as const;
type Filter = (typeof FILTERS)[number];

/**
 * The merged room's whole history (PLN-261027 Thread-Events D5/W3): every
 * conversation's handling, callbacks and feedback, plus the room's own
 * events — read when opened, never polled. A conversation outside a room
 * shows its own history and no room filter.
 */
function HandlingHistoryModal({
  conversationId,
  open,
  onClose,
  aiAgentName,
}: {
  conversationId: string;
  open: boolean;
  onClose: () => void;
  aiAgentName?: string | null;
}) {
  const { t } = useTranslation('livechat');
  const { data, isLoading, error } = useConversationHistory(conversationId, open);
  const [filter, setFilter] = useState<Filter>('all');
  // The AI agent name is per conversation; label only this one's start with it.
  const { text, when } = useEventText(null);
  const { text: textHere } = useEventText(aiAgentName);
  const inRoom = !!data?.roomId;
  const events = (data?.events ?? []).filter((e) => filter === 'all' || e.group === filter);
  const count = (f: Filter) => (data?.events ?? []).filter((e) => f === 'all' || e.group === f).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        inRoom
          ? t('handlers.modalTitleRoom', { count: data?.conversationIds?.length ?? 0 })
          : t('handlers.modalTitle')
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.filter((f) => f !== 'room' || inRoom).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs',
                filter === f
                  ? 'border-primary-500 bg-primary-500 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
              )}
            >
              {t(`handlers.filter.${f}`)} {data ? count(f) : ''}
            </button>
          ))}
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        {error && <p className="text-sm text-error">{(error as Error).message}</p>}
        {data && events.length === 0 && <p className="text-xs text-gray-400">{t('handlers.empty')}</p>}
        {data && events.length > 0 && (
          // The scroll box sits outside the rail so the icons hanging left of it are not clipped.
          <div className="max-h-[60vh] overflow-y-auto pl-2">
          <ol className="space-y-2 border-l border-gray-200 pl-3">
            {events.map((e, i) => (
              <EventRow
                key={`${e.kind}-${e.at}-${i}`}
                e={e}
                text={e.conversationId === conversationId ? textHere(e) : text(e)}
                when={when(e.at)}
                session={inRoom && e.conversationId ? t('sessionLabel', { id: e.conversationId }) : null}
              />
            ))}
          </ol>
          </div>
        )}
      </div>
    </Modal>
  );
}
