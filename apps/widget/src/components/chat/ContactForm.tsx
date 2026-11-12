import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
// Deep import: a value import from `@sharptalk/types` breaks the browser build (CJS `export *`).
import {
  INQUIRY_MESSAGE_MAX,
  INQUIRY_NAME_MAX,
  inquiryProblems,
  normalizeInquiry,
  type InquiryField,
  type InquiryInput,
  type InquiryProblem,
} from '../../../../../packages/types/src/common/inquiry';
import { sendInquiry } from '../../services/inquiryService';
import { showToast } from '../../lib/toast';
import { MessageBubble } from './MessageBubble';
import { ChatChip } from './ChatChip';
import { START_OVER_ID } from './reply-chips';

/**
 * The contact form in the thread (ivy-docs T11 D2, SCR-IVY-13, Figma 1006:6529
 * → 1006:6597).
 *
 * Name, Email (prefilled for a known shopper), Message. The rules are the API's
 * own (`inquiryProblems`), checked before anything is sent; a refused or failed
 * send says so in an error toast and keeps what was typed. Once sent, the form
 * gives way to the shopper's "Your inquiry" card and the bot's confirmation —
 * kept on the thread insert, so it survives re-renders.
 */

const now = () => new Date().toISOString();

/** API error code → what the shopper is told (backend messages are English by design). */
const SEND_ERRORS: Record<string, string> = {
  E3003: 'contact.form.errors.consent', // CONSENT_REQUIRED
  E5160: 'contact.form.errors.invalid', // INQUIRY_INVALID
  E5161: 'contact.form.errors.tooMany', // INQUIRY_LIMIT
  E5007: 'contact.form.errors.erased', // IDENTITY_ERASED
};

function problemText(t: (k: string, o?: Record<string, unknown>) => string, field: InquiryField, p: InquiryProblem): string {
  if (field === 'email') return t(p === 'required' ? 'contact.form.errors.emailRequired' : 'contact.form.errors.emailInvalid');
  if (field === 'name') return p === 'required' ? t('contact.form.errors.nameRequired') : t('contact.form.errors.tooLong', { max: INQUIRY_NAME_MAX });
  return p === 'required' ? t('contact.form.errors.messageRequired') : t('contact.form.errors.tooLong', { max: INQUIRY_MESSAGE_MAX });
}

const fieldClass = (bad: boolean) =>
  `w-full rounded-st-md border bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 ${
    bad ? 'border-error' : 'border-gray-200 focus:border-primary-400'
  }`;

function ContactForm({
  sessionToken,
  conversationId,
  defaults,
  onSent,
}: {
  sessionToken: string | null;
  conversationId: string | null;
  defaults: { name: string; email: string };
  onSent: (form: InquiryInput) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [form, setForm] = useState<InquiryInput>({ name: defaults.name, email: defaults.email, message: '' });
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const problems = checked ? inquiryProblems(form) : {};

  const set = (field: InquiryField) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setChecked(true);
    if (Object.keys(inquiryProblems(form)).length) return;
    if (!sessionToken) {
      showToast({ tone: 'error', message: t('contact.form.errors.failed') });
      return;
    }
    const clean = normalizeInquiry(form);
    setSending(true);
    try {
      await sendInquiry(sessionToken, clean, conversationId);
      onSent(clean);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      showToast({ tone: 'error', message: t(SEND_ERRORS[code ?? ''] ?? 'contact.form.errors.failed') });
    } finally {
      setSending(false);
    }
  }

  const field = (name: InquiryField, label: string, control: (props: Record<string, unknown>) => React.ReactNode) => {
    const problem = problems[name];
    const errorId = `${id}-${name}-error`;
    return (
      <div>
        <label htmlFor={`${id}-${name}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </label>
        {control({
          id: `${id}-${name}`,
          'aria-invalid': problem ? true : undefined,
          'aria-describedby': problem ? errorId : undefined,
        })}
        {problem && (
          <p id={errorId} className="mt-1 text-xs text-error">
            {problemText(t, name, problem)}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      noValidate
      onSubmit={submit}
      data-testid="contact-form"
      className="space-y-3.5 rounded-st-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      {field('name', t('contact.form.name'), (p) => (
        <input
          {...p}
          type="text"
          autoComplete="name"
          maxLength={INQUIRY_NAME_MAX}
          value={form.name}
          onChange={set('name')}
          disabled={sending}
          placeholder={t('contact.form.namePlaceholder')}
          className={fieldClass(!!problems.name)}
        />
      ))}
      {field('email', t('contact.form.email'), (p) => (
        <input
          {...p}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={form.email}
          onChange={set('email')}
          disabled={sending}
          placeholder={t('contact.form.emailPlaceholder')}
          className={fieldClass(!!problems.email)}
        />
      ))}
      {field('message', t('contact.form.message'), (p) => (
        <textarea
          {...p}
          rows={4}
          maxLength={INQUIRY_MESSAGE_MAX}
          value={form.message}
          onChange={set('message')}
          disabled={sending}
          placeholder={t('contact.form.messagePlaceholder')}
          className={`${fieldClass(!!problems.message)} resize-none`}
        />
      ))}
      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-st-md bg-gray-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {sending ? t('contact.form.sending') : t('contact.form.send')}
      </button>
    </form>
  );
}

/** The shopper's side of a sent form (Figma 1006:6597). */
function SentCard({ form }: { form: InquiryInput }) {
  const { t } = useTranslation();
  const row = (label: string, value: string, multiline = false) => (
    <p className="text-sm">
      <span className="text-gray-400">{label} </span>
      <span className={`break-words text-white ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value}</span>
    </p>
  );
  return (
    <div className="flex justify-end">
      <div className="st-inquiry-card max-w-[85%] space-y-1.5 rounded-st-lg bg-gray-900 px-4 py-3.5" data-testid="inquiry-sent">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">{t('contact.sent.title')}</p>
        {row(t('contact.sent.name'), form.name)}
        {row(t('contact.sent.email'), form.email)}
        {row(t('contact.sent.message'), form.message, true)}
      </div>
    </div>
  );
}

function SentConfirmation() {
  const { t } = useTranslation();
  return (
    <div className="flex justify-start">
      <div className="st-message st-message-bot max-w-[85%] space-y-1.5 rounded-st-lg bg-gray-100 px-3.5 py-3 text-sm text-gray-800">
        <p className="font-semibold text-gray-900">{t('contact.sent.successTitle')}</p>
        <p className="text-gray-600">{t('contact.sent.successBody')}</p>
        <p className="text-xs text-gray-400">{t('contact.sent.successHint')}</p>
      </div>
    </div>
  );
}

export function ContactFormAnswer({
  insertKey,
  sessionToken,
  conversationId,
  defaults,
  sent,
  picked,
  disabled,
  onSent,
  onStartOver,
}: {
  insertKey: string;
  sessionToken: string | null;
  conversationId: string | null;
  defaults: { name: string; email: string };
  /** What was sent from this form; absent = the form is still open. */
  sent?: InquiryInput;
  picked?: string;
  disabled?: boolean;
  onSent: (form: InquiryInput) => void;
  onStartOver: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <MessageBubble message={{ id: `${insertKey}-lead`, senderType: 'ai', body: t('contact.form.lead'), createdAt: now() }} />
      {sent ? (
        <>
          <SentCard form={sent} />
          <SentConfirmation />
          <div className="flex flex-wrap gap-1.5 pl-1">
            <ChatChip
              label={t('chat.startOver')}
              disabled={disabled}
              selected={picked ? picked === START_OVER_ID : undefined}
              onClick={onStartOver}
            />
          </div>
        </>
      ) : (
        <ContactForm sessionToken={sessionToken} conversationId={conversationId} defaults={defaults} onSent={onSent} />
      )}
    </div>
  );
}
