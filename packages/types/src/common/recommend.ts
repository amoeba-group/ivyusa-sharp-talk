import type { LocalizedText } from './language';

/**
 * Product recommendations asked in free text (IVY PRD v1 slides 16–17, A-02, C-04).
 *
 * "Recommend your most popular product" is answered from the recommendation
 * selector (Admin Selected / AI Auto, at most three, never out of stock), not
 * from the knowledge base — which has no sales data, and which IVY's test
 * showed answering with random products from the wrong category. The answer is
 * a short line plus one chip per Product Help category; a chip's id is this
 * prefix + the Shopify collection handle, and opens that category's Popular
 * products in the widget.
 */
export const POPULAR_CATEGORY_CHIP_PREFIX = 'popular_category:';

/** The line above the category chips. The AI may word it (C-02); the meaning stays. */
export const RECOMMEND_ASK_COPY: LocalizedText = {
  EN: 'I can show you our most popular picks. Which category would you like to see?',
  ES: 'Puedo mostrarte nuestros productos más populares. ¿Qué categoría quieres ver?',
  KO: '가장 인기 있는 상품을 보여드릴게요. 어떤 카테고리를 보시겠어요?',
  VI: 'Mình có thể gợi ý các sản phẩm được yêu thích nhất. Bạn muốn xem danh mục nào?',
  JA: '人気の商品をご紹介します。どのカテゴリーをご覧になりますか？',
  ZH: '我可以为您推荐最受欢迎的商品。您想看哪个类别？',
};
