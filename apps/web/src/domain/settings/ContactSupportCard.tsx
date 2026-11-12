import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { FormRow, Input } from '@/components/Field';
// Value import from source: @sharptalk/types ships CJS whose runtime exports Rollup cannot see.
import { isEmailAddress, SUPPORT_PHONE_RE } from '../../../../../packages/types/src/common/inquiry';
import { useSaveWidgetSettings, useWidgetSettings } from './settings.hooks';
import type { ContactSupportDraft } from './settings.service';

/**
 * Contact Support (ivy-docs T11 D1, BUG-010): what a shopper sees after tapping
 * Contact Support in the widget. Only what is filled in shows. The support
 * email is also where the widget's contact form notices are mailed (Reply-To =
 * the shopper), when the server has SMTP.
 */
export function ContactSupportCard() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { data, isLoading } = useWidgetSettings();
  const save = useSaveWidgetSettings();
  const [draft, setDraft] = useState<ContactSupportDraft | null>(null);
  const stored: ContactSupportDraft = {
    supportEmail: data?.supportEmail ?? '',
    supportPhone: data?.supportPhone ?? '',
    contactLiveChat: data?.contactLiveChat === true,
  };
  const v = draft ?? stored;
  const dirty = data != null && draft != null && JSON.stringify(draft) !== JSON.stringify(stored);
  const emailBad = !!v.supportEmail.trim() && !isEmailAddress(v.supportEmail);
  const phoneBad = !!v.supportPhone.trim() && !SUPPORT_PHONE_RE.test(v.supportPhone.trim());
  const nothing = !v.supportEmail.trim() && !v.supportPhone.trim();

  return (
    <Card title={t('contactSupport.title')} description={t('contactSupport.desc')}>
      <div className="max-w-md" data-testid="contact-support-settings">
        <FormRow label={t('contactSupport.email')}>
          <Input
            type="email"
            value={v.supportEmail}
            maxLength={254}
            disabled={isLoading}
            placeholder="hello@example.com"
            aria-invalid={emailBad || undefined}
            onChange={(e) => setDraft({ ...v, supportEmail: e.target.value })}
          />
        </FormRow>
        <p className={`mb-3 text-xs ${emailBad ? 'text-red-600' : 'text-gray-400'}`}>
          {emailBad ? t('contactSupport.emailInvalid') : t('contactSupport.emailHint')}
        </p>
        <FormRow label={t('contactSupport.phone')}>
          <Input
            type="tel"
            value={v.supportPhone}
            maxLength={32}
            disabled={isLoading}
            aria-invalid={phoneBad || undefined}
            onChange={(e) => setDraft({ ...v, supportPhone: e.target.value })}
          />
        </FormRow>
        <p className={`mb-3 text-xs ${phoneBad ? 'text-red-600' : 'text-gray-400'}`}>
          {phoneBad ? t('contactSupport.phoneInvalid') : t('contactSupport.phoneHint')}
        </p>
        <label className="mb-1 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={v.contactLiveChat}
            disabled={isLoading}
            onChange={(e) => setDraft({ ...v, contactLiveChat: e.target.checked })}
          />
          {t('contactSupport.liveChat')}
        </label>
        <p className="mb-4 text-xs text-gray-400">
          {nothing && !v.contactLiveChat ? t('contactSupport.liveChatFallback') : t('contactSupport.liveChatHint')}
        </p>
        <Button
          disabled={!dirty || emailBad || phoneBad || save.isPending || !data}
          onClick={() =>
            data &&
            save.mutate({ loginMode: data.loginMode, contact: v }, { onSuccess: () => setDraft(null) })
          }
        >
          {save.isPending ? tc('saving') : tc('save')}
        </Button>
      </div>
    </Card>
  );
}
