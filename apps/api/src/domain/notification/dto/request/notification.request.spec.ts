import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DeleteNotificationsRequest } from './notification.request';

/**
 * ivy-docs T07 §7-2a: "Delete All" names the chip it deletes. Older clients
 * still send `{ all: true }` alone and must keep working.
 */
describe('DeleteNotificationsRequest', () => {
  function errorsFor(payload: Record<string, unknown>): string[] {
    return validateSync(plainToInstance(DeleteNotificationsRequest, payload)).flatMap((e) =>
      Object.values(e.constraints ?? {}),
    );
  }

  it('accepts the old shapes: selected ids, or all', () => {
    expect(errorsFor({ session_token: 'tok', ids: [1, 2] })).toEqual([]);
    expect(errorsFor({ session_token: 'tok', all: true })).toEqual([]);
  });

  it('accepts all with chip categories or a scope', () => {
    expect(errorsFor({ session_token: 'tok', all: true, categories: ['payment', 'shipping'] })).toEqual([]);
    expect(errorsFor({ session_token: 'tok', all: true, categories: ['event'] })).toEqual([]);
    expect(errorsFor({ session_token: 'tok', all: true, scope: 'notice' })).toEqual([]);
  });

  it('rejects an unknown category, the "all" sentinel and an unknown scope', () => {
    expect(errorsFor({ session_token: 'tok', all: true, categories: ['bogus'] }).length).toBeGreaterThan(0);
    expect(errorsFor({ session_token: 'tok', all: true, categories: ['all'] }).length).toBeGreaterThan(0);
    expect(errorsFor({ session_token: 'tok', all: true, scope: 'everything' }).length).toBeGreaterThan(0);
  });
});
