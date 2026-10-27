import { PhoneCall } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOpenCallback } from '../alerts/callbacks.hooks';
import { CallbackActions, CallbackContact } from '../alerts/CallbackParts';

/**
 * One line above the thread while the customer has an open callback request
 * (PLN-261026 D6) — masked contact, [보기] (audited reveal), [처리 완료].
 * Renders nothing otherwise.
 */
export function CallbackBanner({ conversationId }: { conversationId: string | null }) {
  const { t } = useTranslation('livechat');
  const item = useOpenCallback(conversationId);
  if (!item) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-gray-700" data-testid="callback-banner">
      <PhoneCall className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
      <span className="font-medium">{t('callback.banner')}</span>
      {/* key: a different request must not inherit a revealed contact. */}
      <CallbackContact key={item.id} item={item} />
      <span className="ml-auto">
        <CallbackActions item={item} doneOnly />
      </span>
    </div>
  );
}
