import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CsatSurveyAnswers } from '../../services/chatService';
import {
  CSAT_COMMENT_MAX_CHARS,
  CSAT_REASON,
  CSAT_REASON_MAX_RATING,
  CSAT_REASON_VALUES,
} from '../../../../../packages/types/src/common/csat';

/**
 * Satisfaction prompt shown once a conversation ends (PLN-260810 P3), restyled
 * to the Master Shots' emoji card (PLN-260817 W-6, frame 67).
 *
 * Two tenant modes (PLN-261019-Csat-Survey-Disclosure):
 *  - `rating`  — the one-question card every tenant has had: tapping a face
 *                sends it straight away (a misclick can be corrected, D6).
 *  - `survey`  — "was it resolved?" → the same five faces in a segmented box →
 *                for an unhappy rating, a reason (+ free text for "other") →
 *                one [Submit]. Nothing is sent until the button, because the
 *                three answers travel together.
 *
 * `rating` shows the design's FOUR faces (ivy-docs T12, Figma 1006:6110):
 * 😞 Dissatisfied · 😐 Neutral · 😊 Satisfied · 😍 Very satisfied, stored as
 * 1 · 3 · 4 · 5 (SPEC Q-12). The scale stays 1–5 because `csat_avg` is already
 * recorded against it — four faces on the same scale keep every average, old
 * and new, comparable. `survey` keeps all five in its segmented box.
 *
 * Skipping is a first-class outcome, not a failure. The parent owns it
 * (`onSkip`): it remembers the choice per conversation, so a shopper who does
 * not want to rate is not asked again every time they reopen the widget, and it
 * shows the "chat has ended" mark in the card's place (BR-13).
 */
const FACES = ['😞', '😕', '😐', '😊', '😍'];
/** The design's four faces and the 1–5 value each one stores (Q-12). */
const RATING_FACES = [1, 3, 4, 5] as const;

export function CsatCard({
  mode = 'rating',
  onRate,
  onSkip,
}: {
  mode?: 'rating' | 'survey';
  onRate: (rating: number, survey?: CsatSurveyAnswers) => Promise<void>;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Survey answers held until [Submit].
  const [resolved, setResolved] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const send = async (value: number, survey?: CsatSurveyAnswers) => {
    if (busy || submitted != null) return;
    setBusy(true);
    setFailed(false);
    try {
      await onRate(value, survey);
      setSubmitted(value);
    } catch {
      // Silent failure is banned (dev-kit §4.3): without this the face simply
      // stayed unselected and the shopper had no idea the rating never landed.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const survey = mode === 'survey';
  const askReason = survey && rating != null && rating <= CSAT_REASON_MAX_RATING;
  const canSubmit =
    survey &&
    resolved != null &&
    rating != null &&
    (!askReason || (reason != null && (reason !== CSAT_REASON.OTHER || comment.trim().length > 0)));

  // Survey only: all five faces as a radio group, sent with the other answers.
  const faces = (
    <div
      className="flex overflow-hidden rounded-st-md border border-gray-200"
      role="radiogroup"
      aria-label={t('chat.csatSurvey.q2')}
    >
      {FACES.map((face, i) => {
        const value = i + 1;
        const chosen = rating === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={t(`chat.csatLevel.${value}`)}
            disabled={busy || submitted != null}
            onClick={() => setRating(value)}
            className={`st-csat-option flex flex-1 items-center justify-center py-2.5 transition-colors ${
              i > 0 ? 'border-l border-gray-200' : ''
            } ${chosen ? 'bg-primary-100' : 'bg-white hover:bg-gray-50'} ${submitted != null ? 'cursor-default' : ''}`}
          >
            <span className="text-3xl leading-none">{face}</span>
          </button>
        );
      })}
    </div>
  );

  if (!survey) {
    // The design's card (T12, Figma 1006:6110): a title, four faces, Skip. A
    // tap sends at once; the thanks and the "chat has ended" mark follow below
    // it in the thread, so the card keeps the chosen face lit.
    return (
      <div
        className="st-csat rounded-st-lg border-2 border-primary-300 bg-white px-3 py-4 text-center"
        data-testid="csat-card"
      >
        <p className="mb-3 text-sm font-medium text-gray-800">{t('chat.csatTitle')}</p>
        <div className="flex justify-center gap-1" role="group" aria-label={t('chat.csatTitle')}>
          {RATING_FACES.map((value) => {
            const chosen = submitted === value;
            const label = t(`chat.csatLevel.${value}`);
            return (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={chosen}
                disabled={busy || submitted != null}
                onClick={() => void send(value)}
                className={`st-csat-option flex flex-1 flex-col items-center gap-1 rounded-st-md px-1 py-1.5 transition-all ${
                  submitted == null ? 'hover:bg-gray-50' : 'cursor-default'
                } ${submitted != null && !chosen ? 'opacity-30' : ''}`}
              >
                <span className="text-3xl leading-none" aria-hidden="true">
                  {FACES[value - 1]}
                </span>
                <span className="break-keep text-[10px] leading-tight text-gray-500">{label}</span>
              </button>
            );
          })}
        </div>
        {failed && <p className="mt-2 text-xs text-error">{t('chat.csatFailed')}</p>}
        {submitted == null && (
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="mt-3 text-xs text-gray-400 underline-offset-2 hover:underline disabled:opacity-50"
          >
            {t('chat.csatDismiss')}
          </button>
        )}
      </div>
    );
  }

  const radio = (
    name: string,
    value: string,
    checked: boolean,
    onPick: () => void,
    label: string,
  ) => (
    <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={busy || submitted != null}
        onChange={onPick}
        className="h-4 w-4 accent-primary-500"
      />
      {label}
    </label>
  );

  return (
    <div className="st-csat rounded-st-lg border border-gray-200 bg-white text-left shadow-sm" data-testid="csat-card">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="text-sm font-semibold text-gray-900">{t('chat.csatSurvey.title')}</span>
        {submitted == null && (
          <button
            type="button"
            onClick={onSkip}
            aria-label={t('chat.csatDismiss')}
            className="rounded-st-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {submitted != null ? (
        <p className="px-4 py-5 text-center text-sm text-gray-700">{t('chat.csatThanks')}</p>
      ) : (
        <div className="space-y-4 px-4 py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">{t('chat.csatSurvey.q1')}</p>
            {radio('csat-resolved', 'yes', resolved === true, () => setResolved(true), t('chat.csatSurvey.q1Resolved'))}
            {radio('csat-resolved', 'no', resolved === false, () => setResolved(false), t('chat.csatSurvey.q1Unresolved'))}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">{t('chat.csatSurvey.q2')}</p>
            {faces}
            {rating != null && (
              <p className="text-xs text-gray-500">{t(`chat.csatLevel.${rating}`)}</p>
            )}
          </div>
          {askReason && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">{t('chat.csatSurvey.reasonTitle')}</p>
              {CSAT_REASON_VALUES.filter((r) => r !== CSAT_REASON.OTHER).map((r) =>
                radio('csat-reason', r, reason === r, () => setReason(r), t(`chat.csatSurvey.reasons.${r}`)),
              )}
              {radio(
                'csat-reason',
                CSAT_REASON.OTHER,
                reason === CSAT_REASON.OTHER,
                () => setReason(CSAT_REASON.OTHER),
                t('chat.csatSurvey.reasons.other'),
              )}
              {reason === CSAT_REASON.OTHER && (
                <div className="relative">
                  <textarea
                    value={comment}
                    maxLength={CSAT_COMMENT_MAX_CHARS}
                    rows={3}
                    disabled={busy}
                    placeholder={t('chat.csatSurvey.otherPlaceholder')}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full rounded-st-md border border-gray-200 px-3 py-2 pr-12 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-gray-400">
                    {comment.length}/{CSAT_COMMENT_MAX_CHARS}
                  </span>
                </div>
              )}
            </div>
          )}
          {failed && <p className="text-xs text-error">{t('chat.csatFailed')}</p>}
          <button
            type="button"
            disabled={!canSubmit || busy}
            onClick={() =>
              void send(rating as number, {
                resolved: resolved as boolean,
                ...(askReason && reason ? { reason } : {}),
                ...(askReason && reason === CSAT_REASON.OTHER && comment.trim() ? { comment: comment.trim() } : {}),
              })
            }
            className="st-csat-submit w-full rounded-st-md bg-primary-500 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-40"
          >
            {t('chat.csatSurvey.submit')}
          </button>
        </div>
      )}
    </div>
  );
}
