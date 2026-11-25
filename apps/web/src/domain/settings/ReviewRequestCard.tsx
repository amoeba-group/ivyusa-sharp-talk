import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { FormRow, Input } from '@/components/Field';
// Value import from source: @sharptalk/types ships CJS whose runtime exports Rollup cannot see.
import {
  REVIEW_REQUEST_DAYS_DEFAULT,
  REVIEW_REQUEST_DAYS_MAX,
  REVIEW_REQUEST_DAYS_MIN,
  isReviewRequestDays,
} from '../../../../../packages/types/src/common/review-request';
import { useSaveWidgetSettings, useWidgetSettings } from './settings.hooks';

interface Draft {
  on: boolean;
  days: string;
}

/**
 * Review requests after delivery (IVY PRD v1 N-05, PLN-261125-IVY-PRD-v1-Phase4
 * §2.3). When on, the shopper gets a widget notification asking for a review
 * N days after the order was delivered, once per order. Customers who opted out
 * of marketing are skipped.
 */
export function ReviewRequestCard() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { data, isLoading } = useWidgetSettings();
  const save = useSaveWidgetSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const storedDays = data?.reviewRequestDays ?? null;
  const stored: Draft = {
    on: storedDays != null,
    days: String(storedDays ?? REVIEW_REQUEST_DAYS_DEFAULT),
  };
  const v = draft ?? stored;
  const days = Number(v.days);
  const daysBad = v.on && !isReviewRequestDays(days);
  const next = v.on ? days : null;
  const dirty = data != null && draft != null && next !== storedDays;

  return (
    <Card title={t('reviewRequest.title')} description={t('reviewRequest.desc')}>
      <div className="max-w-md" data-testid="review-request-settings">
        <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={v.on}
            disabled={isLoading || !data}
            onChange={(e) => setDraft({ ...v, on: e.target.checked })}
          />
          {t('reviewRequest.enable')}
        </label>
        {v.on && (
          <>
            <FormRow label={t('reviewRequest.days')}>
              <div className="w-28">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={REVIEW_REQUEST_DAYS_MIN}
                  max={REVIEW_REQUEST_DAYS_MAX}
                  value={v.days}
                  disabled={isLoading}
                  aria-invalid={daysBad || undefined}
                  onChange={(e) => setDraft({ ...v, days: e.target.value })}
                />
              </div>
            </FormRow>
            <p className={`mb-3 text-xs ${daysBad ? 'text-red-600' : 'text-gray-400'}`}>
              {daysBad
                ? t('reviewRequest.daysInvalid', { min: REVIEW_REQUEST_DAYS_MIN, max: REVIEW_REQUEST_DAYS_MAX })
                : t('reviewRequest.daysHint', { min: REVIEW_REQUEST_DAYS_MIN, max: REVIEW_REQUEST_DAYS_MAX })}
            </p>
          </>
        )}
        <p className="mb-4 text-xs text-gray-400">{t('reviewRequest.rules')}</p>
        <Button
          disabled={!dirty || daysBad || save.isPending || !data}
          onClick={() =>
            data &&
            save.mutate({ loginMode: data.loginMode, reviewRequestDays: next }, { onSuccess: () => setDraft(null) })
          }
        >
          {save.isPending ? tc('saving') : tc('save')}
        </Button>
      </div>
    </Card>
  );
}
