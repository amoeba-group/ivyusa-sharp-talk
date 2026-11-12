import { useTranslation } from 'react-i18next';
// Deep import: a value import from `@sharptalk/types` breaks the browser build (CJS `export *`).
import { telHref, type ContactChannel } from '../../../../../packages/types/src/common/inquiry';
import { MessageBubble } from './MessageBubble';
import { ChatChip } from './ChatChip';
import { START_OVER_ID } from './reply-chips';

/**
 * The "how would you like to reach us" answer (ivy-docs T11, SCR-IVY-13, Figma
 * 1006:5650), as a thread insert: the shopper's tap as their bubble, the bot's
 * question, one card per channel the tenant configured, and Start over.
 *
 * Every channel is the tenant's own (`widgetCopy.supportEmail` / `supportPhone`
 * / `contactLiveChat`, see `contactChannels()`). The design's `help@ivy.com` and
 * the old `1588-0000` were IVY's values hardcoded in the translation files and
 * shown to every tenant (BUG-010) — nothing here may bring them back.
 */

const now = () => new Date().toISOString();

function Card({
  emoji,
  title,
  hint,
  detail,
  selected,
}: {
  emoji: string;
  title: string;
  hint: string;
  detail?: string;
  selected?: boolean;
}) {
  return (
    <>
      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <span aria-hidden="true">{emoji}</span>
        {title}
      </span>
      <span className="mt-1 block text-xs text-gray-500">{hint}</span>
      {detail && (
        <span className={`mt-1 block break-all text-sm font-medium ${selected ? 'text-primary-700' : 'text-primary-600'}`}>
          {detail}
        </span>
      )}
    </>
  );
}

const cardClass = (selected: boolean) =>
  `block w-full rounded-st-lg border bg-white px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40 ${
    selected ? 'border-primary-400' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
  }`;

export function ContactAnswer({
  insertKey,
  asked,
  channels,
  picked,
  disabled,
  onEmail,
  onChatAgent,
  onStartOver,
}: {
  insertKey: string;
  asked?: string | null;
  channels: ContactChannel[];
  /** The card or chip already picked here: 'email' | 'phone' | 'chat' | START_OVER_ID. */
  picked?: string;
  disabled?: boolean;
  onEmail: () => void;
  onChatAgent: () => void;
  onStartOver: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2" data-testid="contact-support">
      {asked && <MessageBubble message={{ id: `${insertKey}-asked`, senderType: 'user', body: asked, createdAt: now() }} />}
      <MessageBubble message={{ id: `${insertKey}-lead`, senderType: 'ai', body: t('contact.title'), createdAt: now() }} />
      <div className="max-w-[85%] space-y-2">
        {channels.map((c) =>
          c.kind === 'email' ? (
            <button
              key="email"
              type="button"
              disabled={disabled}
              aria-pressed={picked ? picked === 'email' : undefined}
              onClick={onEmail}
              className={cardClass(picked === 'email')}
            >
              <Card emoji="📧" title={t('contact.methods.email')} hint={t('contact.emailHours')} detail={c.address} selected={picked === 'email'} />
            </button>
          ) : c.kind === 'phone' ? (
            <a key="phone" href={telHref(c.number)} className={cardClass(false)}>
              <Card emoji="📞" title={t('contact.methods.phone')} hint={t('contact.phoneHint')} detail={c.number} />
            </a>
          ) : (
            <button
              key="chat"
              type="button"
              disabled={disabled}
              aria-pressed={picked ? picked === 'chat' : undefined}
              onClick={onChatAgent}
              className={cardClass(picked === 'chat')}
            >
              <Card emoji="💬" title={t('contact.methods.chat')} hint={t('contact.chatHint')} />
            </button>
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 pl-1">
        <ChatChip
          label={t('chat.startOver')}
          disabled={disabled}
          selected={picked ? picked === START_OVER_ID : undefined}
          onClick={onStartOver}
        />
      </div>
    </div>
  );
}
