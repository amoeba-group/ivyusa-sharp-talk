import { categoryChips, isRecommendationAsk, matchCategory } from './recommend-ask';

/** Free-text recommendation questions (IVY PRD v1 slides 16–17). */
describe('recommend-ask', () => {
  it.each([
    'Recommend your most popular product',
    'what are your best sellers?',
    'Any top rated nail glue?',
    '¿Cuáles son los productos más vendidos?',
    '인기 상품 추천해 주세요',
    'Sản phẩm nào bán chạy nhất?',
    '人気の商品は？',
    '有什么热门推荐吗',
  ])('reads "%s" as a recommendation question', (text) => {
    expect(isRecommendationAsk(text)).toBe(true);
  });

  it.each(['Where is my order?', 'How do I remove gel polish?', 'Is the Gel Polish Set in stock?', ''])(
    'does not read "%s" as one',
    (text) => {
      expect(isRecommendationAsk(text)).toBe(false);
    },
  );

  const CATEGORIES = [
    { id: 'hair', label: { EN: 'Hair', KO: '헤어' } },
    { id: 'nails', label: { EN: 'Nails', KO: '네일' } },
    { id: 'k-beauty', label: 'K-Beauty' },
  ];

  it('finds the category the shopper named — handle, label in any language, singular of a plural', () => {
    expect(matchCategory('popular nail products?', CATEGORIES)).toBe('nails');
    expect(matchCategory('네일 인기 상품', CATEGORIES)).toBe('nails');
    expect(matchCategory('best k beauty picks', CATEGORIES)).toBe('k-beauty');
    expect(matchCategory('what is popular?', CATEGORIES)).toBeNull();
  });

  it('one chip per category in the session language, the named one first', () => {
    expect(categoryChips(CATEGORIES, 'KO', 'nails')).toEqual([
      { id: 'popular_category:nails', label: '네일' },
      { id: 'popular_category:hair', label: '헤어' },
      { id: 'popular_category:k-beauty', label: 'K-Beauty' },
    ]);
    // A language the tenant did not translate falls back to English.
    expect(categoryChips(CATEGORIES, 'VI', null)[0]).toEqual({ id: 'popular_category:hair', label: 'Hair' });
  });
});
