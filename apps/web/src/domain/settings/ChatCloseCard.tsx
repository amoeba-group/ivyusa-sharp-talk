import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Field';
import { LanguageTabs } from '../ai-settings/LanguageTabs';
import type { ScenarioLang } from '../ai-settings/ai-settings.service';
// Source-path import: a value import of the package entry point breaks the browser build (CJS).
import {
  CHAT_CLOSE_DEFAULTS,
  CHAT_CLOSE_DEFAULT_COPY,
  CHAT_CLOSE_COPY_MAX,
  CHAT_CLOSE_MAX,
  CHAT_CLOSE_MIN,
} from '../../../../../packages/types/src/common/chat-close';
import { useChatClosePolicy, useSaveChatClosePolicy } from './settings.hooks';
import type { ChatClosePolicySettings } from './settings.service';

type CopyField = 'csatPrompt' | 'closingNotice' | 'thanksNotice';
const COPY_FIELDS: CopyField[] = ['csatPrompt', 'closingNotice', 'thanksNotice'];

/** Minute fields are edited as text and validated on save (1–60). */
interface Draft extends Omit<ChatClosePolicySettings, 'csatAfterMin' | 'closeAfterMin'> {
  csatAfterMin: string;
  closeAfterMin: string;
}

function validMinutes(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= CHAT_CLOSE_MIN && n <= CHAT_CLOSE_MAX ? n : null;
}

/** Drop blank lines: blank = the built-in text, and must not be stored as "". */
function compact(copy: Partial<Record<string, string>>): Partial<Record<string, string>> {
  return Object.fromEntries(Object.entries(copy).filter(([, v]) => v?.trim()));
}

/**
 * Rating request → auto close (PLN-261026-Chat-Auto-Close A1~A4).
 *
 * After the AI or an agent answered and the shopper went quiet, ask for a
 * rating; after a further wait, close with a notice. Off = the old platform
 * rule (30 min of silence → "anything else?" → close, agent threads only).
 */
export function ChatCloseCard() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { data, isLoading } = useChatClosePolicy();
  const save = useSaveChatClosePolicy();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lang, setLang] = useState<ScenarioLang>('EN');

  const stored: Draft = {
    enabled: data?.enabled ?? false,
    csatAfterMin: String(data?.csatAfterMin ?? CHAT_CLOSE_DEFAULTS.csatAfterMin),
    closeAfterMin: String(data?.closeAfterMin ?? CHAT_CLOSE_DEFAULTS.closeAfterMin),
    csatPrompt: data?.csatPrompt ?? {},
    closingNotice: data?.closingNotice ?? {},
    thanksNotice: data?.thanksNotice ?? {},
  };
  const current = draft ?? stored;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(stored);
  const patch = (next: Partial<Draft>) => setDraft({ ...current, ...next });
  const setLine = (field: CopyField, text: string) =>
    patch({ [field]: { ...current[field], [lang]: text } } as Partial<Draft>);

  const csatMin = validMinutes(current.csatAfterMin);
  const closeMin = validMinutes(current.closeAfterMin);
  const minutesInvalid = csatMin == null || closeMin == null;

  // Tabs mark a language as filled when any of the three lines has text.
  const filled = Object.fromEntries(
    COPY_FIELDS.flatMap((f) => Object.entries(current[f])).filter(([, v]) => v?.trim()),
  );

  const builtIn = (field: CopyField) =>
    (CHAT_CLOSE_DEFAULT_COPY[field] as Record<string, string>)[lang] ?? CHAT_CLOSE_DEFAULT_COPY[field].EN;

  const minutesRow = (key: 'csatAfterMin' | 'closeAfterMin', invalid: boolean) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-64 text-sm text-gray-700">{t(`chatClose.${key}`)}</span>
      <Input
        type="number"
        min={CHAT_CLOSE_MIN}
        max={CHAT_CLOSE_MAX}
        value={current[key]}
        disabled={isLoading}
        aria-invalid={invalid}
        onChange={(e) => patch({ [key]: e.target.value } as Partial<Draft>)}
        className="w-20"
      />
      <span className="text-sm text-gray-500">{t(`chatClose.${key}Suffix`)}</span>
    </div>
  );

  return (
    <Card title={t('chatClose.title')}>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={current.enabled}
          disabled={isLoading}
          onChange={(e) => patch({ enabled: e.target.checked })}
          className="mt-1"
        />
        <span>
          <span className="text-sm font-medium text-gray-800">{t('chatClose.enable')}</span>
          <p className="mt-0.5 text-xs text-gray-500">{t('chatClose.hint')}</p>
        </span>
      </label>

      {current.enabled && (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          <div className="space-y-2">
            {minutesRow('csatAfterMin', csatMin == null)}
            {minutesRow('closeAfterMin', closeMin == null)}
            {minutesInvalid && (
              <p className="text-xs text-error">
                {t('chatClose.minutesRange', { min: CHAT_CLOSE_MIN, max: CHAT_CLOSE_MAX })}
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">{t('chatClose.copyTitle')}</span>
              <LanguageTabs value={lang} onChange={setLang} filled={filled} />
            </div>
            <div className="space-y-2">
              {COPY_FIELDS.map((field) => (
                <div key={field} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="text-sm text-gray-700 sm:w-28 sm:shrink-0">{t(`chatClose.${field}`)}</span>
                  <Input
                    value={current[field][lang] ?? ''}
                    maxLength={CHAT_CLOSE_COPY_MAX}
                    disabled={isLoading}
                    placeholder={builtIn(field)}
                    onChange={(e) => setLine(field, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">{t('chatClose.copyHint')}</p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-1 text-xs text-gray-500">
        <p>
          {t('chatClose.noteWaitingPrefix')}{' '}
          <Link to="/settings/handoff" className="text-primary-600 hover:underline">
            {t('chatClose.noteWaitingLink')}
          </Link>{' '}
          {t('chatClose.noteWaitingSuffix')}
        </p>
        <p>{t('chatClose.noteExcluded')}</p>
        <p>{t('chatClose.noteOff')}</p>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" disabled={!dirty || save.isPending} onClick={() => setDraft(null)}>
          {tc('cancel')}
        </Button>
        <Button
          disabled={!dirty || save.isPending || (current.enabled && minutesInvalid)}
          onClick={() =>
            save.mutate(
              {
                enabled: current.enabled,
                // Off keeps the stored minutes valid for the next switch-on.
                csatAfterMin: csatMin ?? (data?.csatAfterMin ?? CHAT_CLOSE_DEFAULTS.csatAfterMin),
                closeAfterMin: closeMin ?? (data?.closeAfterMin ?? CHAT_CLOSE_DEFAULTS.closeAfterMin),
                csatPrompt: compact(current.csatPrompt),
                closingNotice: compact(current.closingNotice),
                thanksNotice: compact(current.thanksNotice),
              },
              { onSuccess: () => setDraft(null) },
            )
          }
        >
          {save.isPending ? tc('saving') : tc('save')}
        </Button>
      </div>
    </Card>
  );
}
