import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, ShoppingBag } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import { formatMoney } from '../../lib/format';
import { safeLink } from '../../lib/promo';
import { usePopularProducts } from '../../hooks/usePopularProducts';
import type { PopularProduct, ProductCategory } from '../../lib/types';
import { MessageBubble } from './MessageBubble';
import { ChatChip } from './ChatChip';
import { categoryChips, OTHER_CATEGORIES_ID, productHelpChips, START_OVER_ID } from './reply-chips';

/**
 * Product Help in the thread (ivy-docs T10, SCR-IVY-12, Figma 1006:5588).
 *
 * Each step is a ChatTab thread insert: the shopper's pick as their own
 * bubble, the bot's question, and a chip row that stays on screen with the
 * picked chip outlined — the design keeps answered rows visible instead of
 * clearing them like the follow-ups under a scripted reply.
 */

const now = () => new Date().toISOString();

function Asked({ id, text }: { id: string; text?: string | null }) {
  return text ? <MessageBubble message={{ id: `${id}-asked`, senderType: 'user', body: text, createdAt: now() }} /> : null;
}

function Bot({ id, text }: { id: string; text: string }) {
  return <MessageBubble message={{ id, senderType: 'ai', body: text, createdAt: now() }} />;
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5 pl-1">{children}</div>;
}

/** Step 1: "What do you need help with?" and the topics. */
export function ProductHelpAnswer({
  insertKey,
  asked,
  hasCategories,
  picked,
  disabled,
  onChip,
}: {
  insertKey: string;
  asked?: string | null;
  hasCategories: boolean;
  /** The chip already picked in this row, if any. */
  picked?: string;
  disabled?: boolean;
  onChip: (id: string, label: string) => void;
}) {
  const { t } = useTranslation();
  const chips = productHelpChips(hasCategories, {
    popular: t('chat.productHelp.popular'),
    usage: t('chat.productHelp.usage'),
    ingredients: t('chat.productHelp.ingredients'),
    exchange: t('chat.productHelp.exchange'),
    restock: t('chat.productHelp.restock'),
    startOver: t('chat.startOver'),
  });
  return (
    <div className="space-y-2" data-testid="product-help">
      <Asked id={insertKey} text={asked} />
      <Bot id={`${insertKey}-lead`} text={t('chat.productHelp.lead')} />
      <ChipRow>
        {chips.map((c) => (
          <ChatChip
            key={c.id}
            label={c.label}
            disabled={disabled}
            selected={picked ? picked === c.id : undefined}
            onClick={() => onChip(c.id, c.label)}
          />
        ))}
      </ChipRow>
    </div>
  );
}

/** Step 2 (Popular products): which category. */
export function CategoryPicker({
  insertKey,
  asked,
  categories,
  picked,
  disabled,
  onCategory,
  onStartOver,
}: {
  insertKey: string;
  asked?: string | null;
  categories: ProductCategory[];
  /** `category:<id>` or `control:<id>` of the chip already picked. */
  picked?: string;
  disabled?: boolean;
  onCategory: (category: ProductCategory) => void;
  onStartOver: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2" data-testid="product-categories">
      <Asked id={insertKey} text={asked} />
      <Bot id={`${insertKey}-lead`} text={t('chat.productHelp.pickCategory')} />
      <ChipRow>
        {categoryChips(categories, t('chat.startOver')).map((c) => {
          const key = `${c.kind}:${c.id}`;
          return (
            <ChatChip
              key={key}
              label={c.label}
              disabled={disabled}
              selected={picked ? picked === key : undefined}
              onClick={() => (c.kind === 'category' ? onCategory({ id: c.id, label: c.label }) : onStartOver())}
            />
          );
        })}
      </ChipRow>
    </div>
  );
}

/** A best seller: tapping it opens the product page on the store, in a new tab. */
function ProductCard({ product }: { product: PopularProduct }) {
  const href = safeLink(product.productUrl);
  const image = safeLink(product.imageUrl);
  const meta = [product.vendor, product.price != null ? formatMoney(product.price, product.currency) : null]
    .filter(Boolean)
    .join(' · ');
  const body = (
    <>
      {image ? (
        <img src={image} alt="" loading="lazy" className="h-14 w-14 flex-shrink-0 rounded-st-md bg-gray-50 object-cover" />
      ) : (
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-st-md bg-gray-100 text-gray-400">
          <ShoppingBag className="h-5 w-5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-semibold text-gray-900">{product.title}</span>
        {meta && <span className="mt-0.5 block truncate text-xs text-gray-500">{meta}</span>}
      </span>
    </>
  );
  const box = 'flex w-full items-center gap-3 rounded-st-lg border border-gray-200 bg-white p-2.5 text-left';
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="product-card"
      className={`${box} transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
    >
      {body}
    </a>
  ) : (
    <div data-testid="product-card" className={box}>
      {body}
    </div>
  );
}

/** "ivyusa.com" out of the collection link, for "See all … on ivyusa.com". */
function storeName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Step 3: the category's best sellers, then Other categories · Start over. */
export function PopularProductsAnswer({
  insertKey,
  sessionToken,
  category,
  picked,
  disabled,
  onChip,
  onSettled,
}: {
  insertKey: string;
  sessionToken: string | null;
  category: ProductCategory;
  picked?: string;
  disabled?: boolean;
  onChip: (id: string, label: string) => void;
  /** Called once the products loaded (or failed), so the thread can follow them down. */
  onSettled?: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = usePopularProducts(sessionToken, category.id);
  useEffect(() => {
    if (!isLoading) onSettled?.();
    // Once per settle, not per render of the parent's callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const products = data?.available ? data.products : [];
  const link = safeLink(data?.collectionUrl);
  const name = category.label;
  const lead = isError || !data?.available
    ? t('chat.productHelp.popularUnavailable', { category: name })
    : products.length
      ? t('chat.productHelp.popularLead', { category: name })
      : t('chat.productHelp.popularEmpty', { category: name });
  const chips = [
    { id: OTHER_CATEGORIES_ID, label: t('chat.productHelp.otherCategories') },
    { id: START_OVER_ID, label: t('chat.startOver') },
  ];

  return (
    <div className="space-y-2" data-testid="popular-products">
      <Asked id={insertKey} text={name} />
      {isLoading ? (
        <Spinner label={t('common.loading')} />
      ) : (
        <>
          <Bot id={`${insertKey}-lead`} text={lead} />
          {(products.length > 0 || link) && (
            <div className="space-y-2 pl-6">
              {products.map((p) => (
                <ProductCard key={p.handle} product={p} />
              ))}
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 underline-offset-2 hover:underline"
                >
                  {t('chat.productHelp.seeAll', { category: name, store: storeName(link) })}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </div>
          )}
          <ChipRow>
            {chips.map((c) => (
              <ChatChip
                key={c.id}
                label={c.label}
                disabled={disabled}
                selected={picked ? picked === c.id : undefined}
                onClick={() => onChip(c.id, c.label)}
              />
            ))}
          </ChipRow>
        </>
      )}
    </div>
  );
}
