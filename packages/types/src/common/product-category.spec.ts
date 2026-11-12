import { collectionHandleFrom, collectionUrl } from './product-category';

describe('collectionHandleFrom (ivy-docs T10 D2)', () => {
  it('keeps a bare handle, lower-cased and trimmed', () => {
    expect(collectionHandleFrom('nails')).toBe('nails');
    expect(collectionHandleFrom('  Face-Body-Care-Main ')).toBe('face-body-care-main');
    expect(collectionHandleFrom('a_bundle-listing')).toBe('a_bundle-listing');
  });

  it('reads the handle out of a pasted store URL', () => {
    expect(collectionHandleFrom('https://ivyusa.com/collections/nails?sort_by=best-selling')).toBe('nails');
    expect(collectionHandleFrom('ivyusa.com/collections/k-beauty#top')).toBe('k-beauty');
    expect(collectionHandleFrom('/collections/for-men/')).toBe('for-men');
  });

  it('accepts handles in other scripts', () => {
    expect(collectionHandleFrom('네일')).toBe('네일');
    expect(collectionHandleFrom('%EB%84%A4%EC%9D%BC')).toBe('네일');
  });

  it('rejects what cannot be a handle', () => {
    for (const v of ['', '   ', 'nails polish', '../admin', '-nails', 'a'.repeat(101), '<b>', '%', null, 3]) {
      expect(collectionHandleFrom(v)).toBeNull();
    }
  });
});

describe('collectionUrl', () => {
  it('links the best-selling view of the collection', () => {
    expect(collectionUrl('https://ivyusa.com/', 'nails')).toBe('https://ivyusa.com/collections/nails?sort_by=best-selling');
  });
});
