import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Eye, EyeOff, Loader2, Mail, Phone } from 'lucide-react';
import { toast } from '@/store/toast-store';
import { useSetCallbackStatus } from './callbacks.hooks';
import { callbacksService } from './callbacks.service';
import type { CallbackRequest } from './callbacks.service';

/**
 * Channel icon + masked contact, with [보기] that fetches the plain value
 * (audited server-side, PLN-261026 D6). The plain value lives only in this
 * component's state — never in the query cache — and goes on unmount.
 */
export function CallbackContact({ item }: { item: CallbackRequest }) {
  const { t } = useTranslation('livechat');
  const [plain, setPlain] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const Icon = item.channel === 'phone' ? Phone : Mail;

  const reveal = async () => {
    setLoading(true);
    try {
      const r = await callbacksService.reveal(item.id);
      setPlain(r.contact);
    } catch (e) {
      toast.error((e as Error).message || t('callback.revealError'), { sticky: true });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!plain) return;
    try {
      await navigator.clipboard.writeText(plain);
      toast.success(t('callback.copied'));
    } catch {
      toast.error(t('callback.copyError'), { sticky: true });
    }
  };

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-label={t(`callback.channel_${item.channel}`, { defaultValue: item.channel })} />
      <span className="truncate font-mono text-xs text-gray-800">{plain ?? item.contactMasked}</span>
      {plain ? (
        <>
          <button type="button" className="text-gray-400 hover:text-gray-700" title={t('callback.copy')} aria-label={t('callback.copy')} onClick={copy}>
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="text-gray-400 hover:text-gray-700" title={t('callback.hide')} aria-label={t('callback.hide')} onClick={() => setPlain(null)}>
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-xs text-primary-600 hover:underline disabled:opacity-50"
          onClick={reveal}
          disabled={loading}
          title={t('callback.revealHint')}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
          {t('callback.reveal')}
        </button>
      )}
    </span>
  );
}

/** [처리 완료] [취소] for an open request, [다시 열기] for a closed one. */
export function CallbackActions({ item, doneOnly = false }: { item: CallbackRequest; doneOnly?: boolean }) {
  const { t } = useTranslation('livechat');
  const set = useSetCallbackStatus();
  const busy = set.isPending;
  const btn = 'rounded px-2 py-0.5 text-xs disabled:opacity-50';
  if (item.status === 'requested') {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          disabled={busy}
          className={`${btn} bg-primary-500 font-medium text-white hover:bg-primary-600`}
          onClick={() => set.mutate({ id: item.id, status: 'done' })}
        >
          {t('callback.markDone')}
        </button>
        {!doneOnly && (
          <button
            type="button"
            disabled={busy}
            className={`${btn} border border-gray-300 bg-white text-gray-600 hover:bg-gray-50`}
            onClick={() => set.mutate({ id: item.id, status: 'canceled' })}
          >
            {t('callback.cancel')}
          </button>
        )}
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      className={`${btn} border border-gray-300 bg-white text-gray-600 hover:bg-gray-50`}
      onClick={() => set.mutate({ id: item.id, status: 'requested' })}
    >
      {t('callback.reopen')}
    </button>
  );
}
