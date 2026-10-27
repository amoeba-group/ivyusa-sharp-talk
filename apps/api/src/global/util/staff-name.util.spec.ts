import { staffDisplayName } from './staff-name.util';

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
