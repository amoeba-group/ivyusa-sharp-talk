import { ArrowRightLeft, Bot, CheckCircle2, Hand, Loader2, MessageCircle, Undo2, UserCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/Badge';
import { cn } from '@/lib/cn';
import { useConversationHandlers } from './live-chat.hooks';
import type { HandlerEvent } from './live-chat.service';

const ICON: Record<HandlerEvent['kind'], typeof Bot> = {
  started: MessageCircle,
  handoff_request: Hand,
  assigned: UserCheck,
  transferred: ArrowRightLeft,
  returned_to_ai: Undo2,
  ended: CheckCircle2,
};

const TONE: Record<HandlerEvent['kind'], string> = {
  started: 'text-emerald-600',
  handoff_request: 'text-amber-600',
  assigned: 'text-primary-600',
  transferred: 'text-primary-600',
  returned_to_ai: 'text-emerald-600',
  ended: 'text-gray-500',
};

/**
 * Who handled this conversation, in order (PLN-261027 S2): the AI start, the
 * requests for a person, each assignment and transfer, hand-backs to the AI
 * and the end — plus the agents involved, the current one marked.
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
  const { t, i18n } = useTranslation('livechat');
  const { data, isLoading } = useConversationHandlers(conversationId, version);
  if (!conversationId) return null;

  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const who = (name: string | null) => name ?? t('agent');
  const line = (e: HandlerEvent) => {
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
    }
  };

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
                  {who(h.name)}
                  {h.current && ` · ${t('handlers.current')}`}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-xs text-gray-500">{t('handlers.aiOnly')}</p>
          )}
          <ol className="space-y-2 border-l border-gray-200 pl-3">
            {data.events.map((e, i) => {
              const Icon = ICON[e.kind];
              return (
                <li key={`${e.kind}-${e.at}-${i}`} className="relative text-xs">
                  <span className="absolute -left-[19px] top-0.5 rounded-full bg-white">
                    <Icon className={cn('h-3.5 w-3.5', TONE[e.kind])} />
                  </span>
                  <span className="text-gray-400">{when(e.at)}</span>
                  <p className="text-gray-700">{line(e)}</p>
                  {e.byName && (e.kind === 'assigned' || e.kind === 'transferred') && (
                    <p className="text-gray-400">{t('handlers.by', { name: e.byName })}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
