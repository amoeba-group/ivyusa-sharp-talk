import { POPULAR_CATEGORY_CHIP_PREFIX, localized } from '@sharptalk/types';
import type { LocalizedText, ScenarioFollowUpResponse } from '@sharptalk/types';

/**
 * A free-text product recommendation question (IVY PRD v1 slides 16–17).
 *
 * Read together with the classifier's `product_inquiry`: the words alone would
 * catch "can you recommend how to remove gel?", the label alone every product
 * question. Both together are the questions the selector — not the knowledge
 * base — has to answer. One pattern per widget language.
 */
const ASK_PATTERNS: RegExp[] = [
  // EN
  /\b(popular|best[\s-]?sell(?:er|ers|ing)|recommend\w*|top[\s-]?(?:rated|picks?|sellers?|products?)|trending|most[\s-]loved|bestsellers?|new arrivals?|must[\s-]haves?)\b/i,
  // ES
  /\b(populares?|recomi[eé]nd\w*|recomendaci\w*|m[aá]s vendid\w*|novedades|lo m[aá]s nuevo)\b/i,
  // KO
  /(인기|추천|베스트|잘\s?팔리|많이\s?팔리|신상)/,
  // VI
  /(phổ biến|bán chạy|gợi ý|đề xuất|nổi bật|hàng mới|sản phẩm mới|được yêu thích)/i,
  // JA
  /(人気|おすすめ|オススメ|売れ筋|ベストセラー|新商品|新作)/,
  // ZH
  /(热门|推荐|畅销|爆款|新品|最受欢迎)/,
];

export function isRecommendationAsk(text: string): boolean {
  const t = (text ?? '').trim();
  return !!t && ASK_PATTERNS.some((re) => re.test(t));
}

export interface ChipCategory {
  /** Shopify collection handle. */
  id: string;
  label: string | LocalizedText;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, ' ').trim();

/** Every spelling a category goes by: its handle and its label in each language. */
function names(c: ChipCategory): string[] {
  const labels = typeof c.label === 'string' ? [c.label] : Object.values(c.label ?? {});
  return [c.id, ...labels].filter((x): x is string => !!x && x.trim().length >= 2).map(norm);
}

/** The category the shopper named, if any — "popular nail products" → `nails`. */
export function matchCategory(text: string, categories: ChipCategory[]): string | null {
  const t = norm(text ?? '');
  if (!t) return null;
  for (const c of categories) {
    // "nails" also matches "nail": a plural handle against a singular word.
    if (names(c).some((n) => t.includes(n) || (n.endsWith('s') && n.length > 3 && t.includes(n.slice(0, -1))))) {
      return c.id;
    }
  }
  return null;
}

/** One chip per category in the session language, the named one first. */
export function categoryChips(categories: ChipCategory[], language: string, first: string | null): ScenarioFollowUpResponse[] {
  const ordered = first ? [...categories.filter((c) => c.id === first), ...categories.filter((c) => c.id !== first)] : categories;
  return ordered
    .map((c) => ({
      id: `${POPULAR_CATEGORY_CHIP_PREFIX}${c.id}`,
      label: (typeof c.label === 'string' ? c.label : localized(c.label, language)).trim(),
    }))
    .filter((c) => !!c.label);
}
