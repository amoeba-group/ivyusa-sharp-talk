import { useTranslation } from 'react-i18next';
import type { ReadGroup } from '../../lib/format';

/**
 * The grey "New" / "Recent" band above a group of rows (IVY PRD v1 slide 9,
 * replacing the Today's / Yesterday's bands of SPEC BR-04). Shared by the
 * Order and Promo feeds and the Delivery chip's cards so all three read the same.
 */
export function GroupHeader({ group }: { group: ReadGroup<unknown>['key'] }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="notif-group"
      data-group={group}
      className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500"
    >
      {t(`notifications.groups.${group}`)}
    </div>
  );
}
