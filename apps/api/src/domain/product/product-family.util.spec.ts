import { productFamilyKey, questionWords, variantWords } from './product-family.util';

/**
 * The fold the catalogue sync applies, and the words that tell its members
 * apart (PLN-261127). Titles are production's.
 */
describe('productFamilyKey', () => {
  it('the part before the dash; the colours of one product share it', () => {
    expect(productFamilyKey('KISS imPRESS Color Press On Nails - Cosmic')).toBe('kiss impress color press on nails');
    expect(productFamilyKey('KISS imPRESS Color Press On Nails - Bubble Kiss')).toBe('kiss impress color press on nails');
    // An en dash, a hyphenated "Press-On": still the same family (production folds it there).
    expect(productFamilyKey('KISS imPRESS Color Press-On Nails – Solid Color Shades, Short Squoval')).toBe(
      'kiss impress color press on nails',
    );
  });

  it('a different head is a different family', () => {
    expect(productFamilyKey('KISS imPRESS Color Press On Nails Matte - Brie')).toBe(
      'kiss impress color press on nails matte',
    );
  });

  it('no dash: the whole title, so identical titles still fold', () => {
    expect(productFamilyKey('Gold Finger Solid Color Nails')).toBe('gold finger solid color nails');
    expect(productFamilyKey('2-in-1 Curling Iron')).toBe('2 in 1 curling iron');
  });
});

describe('variantWords', () => {
  it.each([
    ['KISS imPRESS Color Press On Nails - Cosmic', ['cosmic']],
    // "kiss" is already the brand: only "bubble" tells this colour apart.
    ['KISS imPRESS Color Press On Nails - Bubble Kiss', ['bubble']],
    ['KISS imPRESS Color Press On Nails -  Beet Snacks', ['beet', 'snacks']],
    ['Kiss New York Gel Pro Nail Polish Core Colors - Under the Pecan Tree', ['under', 'the', 'pecan', 'tree']],
  ])('%s → %j', (title, words) => {
    expect(variantWords(title)).toEqual(words);
  });

  it.each([
    ['no suffix', 'Gold Finger Holiday Limited Edition Nails'],
    ['the suffix is the brand', 'RED by KISS Satin Lined Baseball Cap - Red'],
    ['only filler words', 'Gel Pro - Do It'],
    ['only filler words, three letters long', 'Gel Pro - For You'],
  ])('null: %s', (_why, title) => {
    expect(variantWords(title)).toBeNull();
  });
});

describe('questionWords', () => {
  it('letters and digits of any script, lower-cased', () => {
    expect(questionWords('KISS imPRESS Color Press-On Nails - Cosmic 재고 있나요?')).toEqual([
      'kiss', 'impress', 'color', 'press', 'on', 'nails', 'cosmic', '재고', '있나요',
    ]);
  });
});
