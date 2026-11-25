import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, ShoppingBag } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import { Badge } from '../ui/Badge';
import { formatMoney } from '../../lib/format';
import { safeLink } from '../../lib/promo';
import { searchStock, type StockProduct } from '../../services/productService';
import { MessageBubble } from './MessageBubble';
import { ChatChip } from './ChatChip';
import { START_OVER_ID } from './reply-chips';

/**
 * Stock inquiry (IVY PRD v1 C-01: "pick product → answer from stock data";
 * PLN-261125). The shopper types a product name, picks one of up to five
 * products on sale, and sees whether it can be bought now — read live from
 * the store. A thread insert like the other quick-menu answers: its chips only
 * show while nothing came after it.
 */

const now = () => new Date().toISOString();

function Thumb({ url }: { url: string | null }) {
  const image = safeLink(url);
  return image ? (
    <img src={image} alt="" loading="lazy" className="h-12 w-12 flex-shrink-0 rounded-st-md bg-gray-50 object-cover" />
  ) : (
    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-st-md bg-gray-100 text-gray-400">
      <ShoppingBag className="h-5 w-5" aria-hidden />
    </span>
  );
}

export function StockInquiryAnswer({
  insertKey,
  sessionToken,
  asked,
  active,
  picked,
  disabled,
  onPick,
  onContact,
  onStartOver,
  onSettled,
}: {
  insertKey: string;
  sessionToken: string | null;
  asked?: string | null;
  active: boolean;
  picked?: string;
  disabled?: boolean;
  onPick: (id: string) => void;
  onContact: () => void;
  onStartOver: () => void;
  onSettled?: () => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [chosen, setChosen] = useState<StockProduct | null>(null);
  const results = useQuery({
    queryKey: ['stock', sessionToken, term],
    queryFn: () => searchStock(sessionToken!, term),
    enabled: !!sessionToken && term.length >= 2,
    staleTime: 60_000,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = q.trim();
    if (next.length < 2) return;
    setTerm(next);
    setChosen(null);
    // The results arrive below the box; the thread follows them down.
    setTimeout(() => onSettled?.(), 300);
  };
  const choose = (p: StockProduct) => {
    setChosen(p);
    setTimeout(() => onSettled?.(), 100);
  };
  const again = () => {
    onPick('again');
    setChosen(null);
    setQ('');
    setTerm('');
  };

  const products = results.data?.available ? results.data.products : [];
  const href = chosen ? safeLink(chosen.productUrl) : null;

  return (
    <div className="space-y-2" data-testid="stock-answer">
      {asked && <MessageBubble message={{ id: `${insertKey}-asked`, senderType: 'user', body: asked, createdAt: now() }} />}
      <MessageBubble message={{ id: `${insertKey}-lead`, senderType: 'ai', body: t('chat.stock.lead'), createdAt: now() }} />

      {!chosen && (
        <form onSubmit={submit} className="flex gap-2 pl-1" data-testid="stock-search" role="search">
          <label htmlFor={`${insertKey}-q`} className="sr-only">
            {t('chat.stock.placeholder')}
          </label>
          <input
            id={`${insertKey}-q`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={80}
            placeholder={t('chat.stock.placeholder')}
            className="min-w-0 flex-1 rounded-st-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="submit"
            disabled={q.trim().length < 2}
            aria-label={t('chat.stock.search')}
            className="flex items-center justify-center rounded-st-md bg-gray-900 px-3 text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
          >
            <Search className="h-4 w-4" aria-hidden />
          </button>
        </form>
      )}

      {!chosen && term.length >= 2 && (
        results.isLoading ? (
          <Spinner label={t('chat.stock.searching')} />
        ) : results.isError || !results.data?.available ? (
          <MessageBubble message={{ id: `${insertKey}-down`, senderType: 'ai', body: t('chat.stock.unavailable'), createdAt: now() }} />
        ) : products.length === 0 ? (
          <MessageBubble message={{ id: `${insertKey}-none`, senderType: 'ai', body: t('chat.stock.none', { q: term }), createdAt: now() }} />
        ) : (
          <div className="space-y-1.5 pl-6" role="list" aria-label={t('chat.stock.pick')}>
            {products.map((p) => (
              <button
                key={p.handle}
                type="button"
                role="listitem"
                data-testid="stock-result"
                onClick={() => choose(p)}
                className="flex w-full items-center gap-3 rounded-st-lg border border-gray-200 bg-white p-2 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <Thumb url={p.imageUrl} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-semibold text-gray-900">{p.title}</span>
                  {p.price != null && <span className="mt-0.5 block text-xs text-gray-500">{formatMoney(p.price, p.currency)}</span>}
                </span>
              </button>
            ))}
          </div>
        )
      )}

      {chosen && (
        <>
          <MessageBubble message={{ id: `${insertKey}-chosen`, senderType: 'user', body: chosen.title, createdAt: now() }} />
          <div className="pl-6">
            <div
              data-testid="stock-card"
              data-in-stock={chosen.inStock ? 'true' : 'false'}
              className="flex items-center gap-3 rounded-st-lg border border-gray-200 bg-white p-2.5"
            >
              <Thumb url={chosen.imageUrl} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-semibold text-gray-900">{chosen.title}</span>
                <span className="mt-1 flex items-center gap-2">
                  <Badge tone={chosen.inStock ? 'success' : 'neutral'}>
                    {chosen.inStock ? t('chat.stock.inStock') : t('chat.stock.outOfStock')}
                  </Badge>
                  {chosen.price != null && <span className="text-xs text-gray-500">{formatMoney(chosen.price, chosen.currency)}</span>}
                </span>
              </span>
            </div>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-block text-xs font-medium text-primary-600 hover:underline"
              >
                {t('chat.stock.view')}
              </a>
            )}
          </div>
          <MessageBubble
            message={{
              id: `${insertKey}-guide`,
              senderType: 'ai',
              body: chosen.inStock ? t('chat.stock.guideIn', { title: chosen.title }) : t('chat.stock.guideOut', { title: chosen.title }),
              createdAt: now(),
            }}
          />
        </>
      )}

      {active && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {chosen && (
            <ChatChip label={t('chat.stock.again')} disabled={disabled} selected={picked ? picked === 'again' : undefined} onClick={again} />
          )}
          <ChatChip
            label={t('chat.contactSupport')}
            disabled={disabled}
            selected={picked ? picked === 'contact' : undefined}
            onClick={() => {
              onPick('contact');
              onContact();
            }}
          />
          <ChatChip
            label={t('chat.startOver')}
            disabled={disabled}
            selected={picked ? picked === START_OVER_ID : undefined}
            onClick={() => {
              onPick(START_OVER_ID);
              onStartOver();
            }}
          />
        </div>
      )}
    </div>
  );
}
