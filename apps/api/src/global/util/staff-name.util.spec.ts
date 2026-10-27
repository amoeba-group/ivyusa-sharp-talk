import { staffDisplayName, staffLabel } from './staff-name.util';

describe('staffDisplayName', () => {
  it('prefers the name', () => {
    expect(staffDisplayName({ name: 'Thao', email: 'thao@go2joy.vn' })).toBe('Thao');
  });

  it('falls back to the local part when the name is empty or blank', () => {
    expect(staffDisplayName({ name: null, email: 'minh.le@go2joy.vn' })).toBe('minh.le');
    expect(staffDisplayName({ name: '   ', email: 'an@x.io' })).toBe('an');
  });

  it('keeps an address without @ whole and returns null with nothing to show', () => {
    expect(staffDisplayName({ name: null, email: 'legacy' })).toBe('legacy');
    expect(staffDisplayName({ name: null, email: null })).toBeNull();
    expect(staffDisplayName(null)).toBeNull();
  });
});

describe('staffLabel', () => {
  it('shows id(name), the id alone without a name, and no duplicate when they match', () => {
    expect(staffLabel({ name: 'Minh', email: 'minh.le@go2joy.vn' })).toBe('minh.le(Minh)');
    expect(staffLabel({ name: null, email: 'thao@go2joy.vn' })).toBe('thao');
    expect(staffLabel({ name: 'thao', email: 'thao@go2joy.vn' })).toBe('thao');
    expect(staffLabel({ name: 'Only Name', email: null })).toBe('Only Name');
    expect(staffLabel(null)).toBeNull();
  });
});
