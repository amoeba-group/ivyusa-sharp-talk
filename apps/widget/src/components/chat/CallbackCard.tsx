import { useEffect, useState } from 'react';
import { ExternalLink, Eye, EyeOff, Mail, Phone, PhoneCall } from 'lucide-react';
import { useTranslation } from 'react-i18next';
// Deep import: a value import from `@sharptalk/types` breaks the browser build (CJS `export *`).
import { CALLBACK_CHANNEL, normalizePhone } from '../../../../../packages/types/src/common/chat-close';
import {
  getCallbackOptions,
  requestCallback,
  type CallbackChannelValue,
  type CallbackOptions,
} from '../../services/chatService';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Server error code → message key (backend messages are English by design). */
const ERROR_KEYS: Record<string, string> = {
  E5152: 'chat.callback.errors.disabled',
  E5153: 'chat.callback.errors.invalid',
  E5154: 'chat.callback.errors.memberMissing',
  E3003: 'chat.callback.errors.consent',
  E5007: 'chat.callback.errors.erased',
};

/**
 * "Request a callback" (PLN-261026 B4–B6, D9/D10). Opened from the
 * `callback_request` chip under a queue-delay or off-hours notice.
 *
 * ① A verified member with contacts on file sees them masked and can ask to be
 *   called back there — the server reads the plain value itself, so it never
 *   reaches the widget.
 * ② Everyone else (or "use another contact") types one. The field is masked
 *   like a password by default with an eye toggle, and the browser must not
 *   offer to save it: Chrome ignores `autocomplete="off"` on a password field,
 *   hence `one-time-code` plus the password-manager opt-outs.
 *
 * On success the card closes; the confirmation line with the masked contact
 * arrives through the poll, so the plain contact is never shown again.
 * Inline like ContactEmailCard — the widget iframe has no `allow-modals`.
 */
export function CallbackCard({
  sessionToken,
  conversationId,
  privacyPolicyUrl,
  onClose,
}: {
  sessionToken: string | null;
  conversationId: string | null;
  privacyPolicyUrl?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<CallbackOptions | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [screen, setScreen] = useState<'member' | 'entry'>('entry');
  const [memberChannel, setMemberChannel] = useState<CallbackChannelValue | null>(null);
  const [channel, setChannel] = useState<CallbackChannelValue>(CALLBACK_CHANNEL.EMAIL);
  const [contact, setContact] = useState('');
  const [reveal, setReveal] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    let alive = true;
    getCallbackOptions(sessionToken)
      .then((o) => {
        if (!alive) return;
        setOptions(o);
        if (o.channels.length) setChannel(o.channels[0]);
        if (o.member.length) {
          setScreen('member');
          setMemberChannel(o.member[0].channel);
        }
      })
      .catch(() => alive && setLoadFailed(true));
    return () => {
      alive = false;
    };
  }, [sessionToken]);

  const hasMember = !!options?.member.length;
  const valid =
    channel === CALLBACK_CHANNEL.PHONE ? normalizePhone(contact) != null : EMAIL_PATTERN.test(contact.trim());

  function fail(err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'E5154') setScreen('entry'); // profile changed meanwhile — let them type one
    setError(t(code && ERROR_KEYS[code] ? ERROR_KEYS[code] : 'chat.callback.errors.failed'));
  }

  async function submitMember() {
    if (!sessionToken || !conversationId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await requestCallback(sessionToken, conversationId, {
        source: 'member',
        ...(memberChannel ? { channel: memberChannel } : {}),
      });
      onClose();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }

  async function submitEntered() {
    setTouched(true);
    if (!sessionToken || !conversationId || saving || !valid) return;
    setSaving(true);
    setError(null);
    try {
      await requestCallback(sessionToken, conversationId, {
        source: 'entered',
        channel,
        contact: contact.trim(),
      });
      // Drop the plain value before the card goes away.
      setContact('');
      setReveal(false);
      onClose();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }

  const channelIcon = (c: CallbackChannelValue) =>
    c === CALLBACK_CHANNEL.PHONE ? (
      <Phone className="h-3.5 w-3.5 shrink-0 text-gray-500" />
    ) : (
      <Mail className="h-3.5 w-3.5 shrink-0 text-gray-500" />
    );

  const header = (
    <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
      <PhoneCall className="h-4 w-4 shrink-0 text-primary-500" />
      {t('chat.callback.title')}
    </div>
  );

  const secondaryBtn =
    'shrink-0 rounded-st-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50';
  const primaryBtn =
    'shrink-0 rounded-st-md bg-primary-500 px-3 py-2 text-sm font-medium text-on-primary hover:bg-primary-600 disabled:opacity-50';

  if (!options) {
    return (
      <div className="rounded-st-md border border-gray-200 bg-gray-50 p-3">
        {header}
        {loadFailed ? (
          <>
            <p className="mb-2 text-xs text-error">{t('chat.callback.errors.failed')}</p>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className={secondaryBtn}>
                {t('chat.callback.cancel')}
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-500">{t('common.loading')}</p>
        )}
      </div>
    );
  }

  if (!options.enabled || !options.channels.length) {
    return (
      <div className="rounded-st-md border border-gray-200 bg-gray-50 p-3">
        {header}
        <p className="mb-2 text-xs text-gray-600">{t('chat.callback.errors.disabled')}</p>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={secondaryBtn}>
            {t('chat.callback.cancel')}
          </button>
        </div>
      </div>
    );
  }

  // ① Member contacts on file (D9).
  if (screen === 'member' && hasMember) {
    const many = options.member.length > 1;
    return (
      <div className="rounded-st-md border border-gray-200 bg-gray-50 p-3">
        {header}
        <p className="mb-2 text-xs text-gray-600">{t('chat.callback.memberIntro')}</p>
        <div className="mb-2 space-y-1.5 pl-1" role={many ? 'radiogroup' : undefined}>
          {options.member.map((m) =>
            many ? (
              <label key={m.channel} className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                <input
                  type="radio"
                  name="callback-member"
                  value={m.channel}
                  checked={memberChannel === m.channel}
                  onChange={() => setMemberChannel(m.channel)}
                  disabled={saving}
                  className="h-4 w-4 accent-primary-500"
                />
                {channelIcon(m.channel)}
                <span className="sr-only">{t(`chat.callback.channel.${m.channel}`)}</span>
                <span>{m.masked}</span>
              </label>
            ) : (
              <div key={m.channel} className="flex items-center gap-2 text-sm text-gray-800">
                {channelIcon(m.channel)}
                <span className="sr-only">{t(`chat.callback.channel.${m.channel}`)}</span>
                <span>{m.masked}</span>
              </div>
            ),
          )}
        </div>
        <p className="mb-2 text-xs text-gray-600">{t('chat.callback.memberOther')}</p>
        {error && <p className="mb-2 text-xs text-error">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setScreen('entry');
            }}
            disabled={saving}
            className={secondaryBtn}
          >
            {t('chat.callback.useOther')}
          </button>
          <button type="button" onClick={submitMember} disabled={saving || !conversationId} className={primaryBtn}>
            {saving ? t('common.loading') : t('chat.callback.useMember')}
          </button>
        </div>
      </div>
    );
  }

  // ② Entered contact (D10).
  const phone = channel === CALLBACK_CHANNEL.PHONE;
  return (
    <div className="rounded-st-md border border-gray-200 bg-gray-50 p-3">
      {header}
      <p className="mb-1.5 text-xs text-gray-600">{t('chat.callback.howToReach')}</p>
      {options.channels.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 pl-1" role="radiogroup" aria-label={t('chat.callback.howToReach')}>
          {options.channels.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-800">
              <input
                type="radio"
                name="callback-channel"
                value={c}
                checked={channel === c}
                onChange={() => {
                  setChannel(c);
                  setContact('');
                  setTouched(false);
                  setError(null);
                }}
                disabled={saving}
                className="h-4 w-4 accent-primary-500"
              />
              {t(`chat.callback.channel.${c}`)}
            </label>
          ))}
        </div>
      )}
      <div className="relative mb-1">
        <input
          type={reveal ? 'text' : 'password'}
          inputMode={phone ? 'tel' : 'email'}
          name={`st-callback-${channel}`}
          // Chrome ignores `off` on a password field and offers to save it.
          autoComplete="one-time-code"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore=""
          data-form-type="other"
          value={contact}
          onChange={(e) => {
            setContact(e.target.value);
            setError(null);
          }}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => e.key === 'Enter' && void submitEntered()}
          placeholder={t(phone ? 'chat.callback.phonePlaceholder' : 'chat.callback.emailPlaceholder')}
          aria-label={t(`chat.callback.channel.${channel}`)}
          aria-invalid={touched && !valid}
          maxLength={255}
          disabled={saving}
          className="w-full rounded-st-md border border-gray-200 bg-white py-2 pl-3 pr-10 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          aria-label={t(reveal ? 'chat.callback.hide' : 'chat.callback.show')}
          aria-pressed={reveal}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-gray-400 hover:text-gray-600"
        >
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {touched && contact.trim() !== '' && !valid && (
        <p className="mb-1 text-xs text-error">
          {t(phone ? 'chat.callback.errors.phoneFormat' : 'chat.callback.errors.emailFormat')}
        </p>
      )}
      {error && <p className="mb-1 text-xs text-error">{error}</p>}
      <p className="mb-2 text-[11px] text-gray-500">
        {t('chat.callback.consent')}
        {privacyPolicyUrl && (
          <>
            {' '}
            <a
              href={privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-primary-600 underline hover:text-primary-500"
            >
              {t('chat.consent.policyLink')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </>
        )}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setContact('');
            setReveal(false);
            setError(null);
            if (hasMember) setScreen('member');
            else onClose();
          }}
          disabled={saving}
          className={secondaryBtn}
        >
          {hasMember ? t('chat.callback.back') : t('chat.callback.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void submitEntered()}
          disabled={saving || !valid || !conversationId}
          className={primaryBtn}
        >
          {saving ? t('common.loading') : t('chat.callback.submit')}
        </button>
      </div>
    </div>
  );
}
