import { normalizeQueueAndCallback } from './ai-config.service';

/** PLN-261026 D2: the handoff form's queue timeout and callback keys. */
describe('normalizeQueueAndCallback', () => {
  it('keeps a valid timeout and trims the notice', () => {
    expect(
      normalizeQueueAndCallback({ reAlert: { afterMinutes: 1 }, queueTimeout: { afterMinutes: 3, notice: { KO: ' 잠시만요 ', VI: ' ' } } }),
    ).toEqual({ reAlert: { afterMinutes: 1 }, queueTimeout: { afterMinutes: 3, notice: { KO: '잠시만요' } } });
  });

  it('rejects a timeout that would fire before (or with) the reminder', () => {
    expect(() => normalizeQueueAndCallback({ reAlert: { afterMinutes: 3 }, queueTimeout: { afterMinutes: 3 } })).toThrow();
    expect(() => normalizeQueueAndCallback({ queueTimeout: { afterMinutes: 0 } })).toThrow();
    expect(() => normalizeQueueAndCallback({ queueTimeout: { afterMinutes: 31 } })).toThrow();
  });

  it('turns callbacks off when no contact kind is left', () => {
    expect(normalizeQueueAndCallback({ callback: { enabled: true, channels: ['fax'] } })?.callback).toEqual({
      enabled: false,
      channels: [],
    });
    expect(normalizeQueueAndCallback({ callback: { enabled: true, channels: ['phone', 'phone', 'email'] } })?.callback).toEqual({
      enabled: true,
      channels: ['phone', 'email'],
    });
  });

  it('leaves a config without these keys as it was', () => {
    const cfg = { assigneeUserIds: [1] };
    expect(normalizeQueueAndCallback(cfg)).toEqual(cfg);
    expect(normalizeQueueAndCallback(null)).toBeNull();
  });
});
