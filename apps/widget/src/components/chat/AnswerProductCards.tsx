import { useTranslation } from 'react-i18next';
import { ShoppingBag } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { formatMoney } from '../../lib/format';
import { safeLink } from '../../lib/promo';
import type { AnswerProduct } from '../../lib/types';

/** Cards under one answer (IVY PRD v1 slide 16: "up to 3 product cards"). */
const MAX_CARDS = 3;

/**
 * The products an AI answer is about, as the store showed them when it
 * answered (IVY PRD v1 slide 14, 17, A-04; PLN-261126): picture, name,
 * In stock / Out of stock and price, shown once, under the answer. The card is
 * the Stock inquiry card; tapping it opens the product page in a new tab, like
 * a Popular products card. The link's name is the card's own text, so a
 * screen reader hears the product, its stock and its price.
 */
export function AnswerProductCards({ products }: { products: AnswerProduct[] }) {
  const { t } = useTranslation();
  const shown = products.slice(0, MAX_CARDS);
  if (!shown.length) return null;
  return (
    <ul className="mt-2 space-y-1.5" data-testid="answer-products">
      {shown.map((p) => {
        const href = safeLink(p.productUrl);
        const image = safeLink(p.imageUrl);
        const body = (
          <>
            {image ? (
              <img
                src={image}
                alt=""
                loading="lazy"
                className="h-12 w-12 flex-shrink-0 rounded-st-md bg-gray-50 object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-st-md bg-gray-100 text-gray-400">
                <ShoppingBag className="h-5 w-5" aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-semibold text-gray-900">{p.title}</span>
              <span className="mt-1 flex items-center gap-2">
                <Badge tone={p.inStock ? 'success' : 'neutral'}>
                  {p.inStock ? t('chat.stock.inStock') : t('chat.stock.outOfStock')}
                </Badge>
                {p.price != null && <span className="text-xs text-gray-500">{formatMoney(p.price, p.currency)}</span>}
              </span>
            </span>
          </>
        );
        const box = 'flex w-full items-center gap-3 rounded-st-lg border border-gray-200 bg-white p-2.5 text-left';
        const stock = p.inStock ? 'true' : 'false';
        return (
          <li key={p.handle}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="answer-product"
                data-in-stock={stock}
                className={`${box} transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
              >
                {body}
              </a>
            ) : (
              <div data-testid="answer-product" data-in-stock={stock} className={box}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
