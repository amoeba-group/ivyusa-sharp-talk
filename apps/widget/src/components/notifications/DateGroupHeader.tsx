import { useTranslation } from 'react-i18next';
import type { DateGroup } from '../../lib/format';

/**
 * The grey "Today's" / "Yesterday's" / date band above a day's rows (ivy-docs
 * SPEC BR-04). Shared by the Order chip's notices and the Delivery chip's
 * cards so both read the same.
 */
export function DateGroupHeader({ group }: { group: Pick<DateGroup<unknown>, 'relative' | 'label'> }) {
  const { t } = useTranslation();
  return (
    <div data-testid="notif-group" className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500">
      {group.relative ? t(`notifications.groups.${group.relative}`) : group.label}
    </div>
  );
}
