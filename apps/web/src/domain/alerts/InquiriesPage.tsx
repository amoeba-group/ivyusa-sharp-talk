import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { InquiriesTab } from './InquiriesTab';

/**
 * Contact forms from the widget, on a page of their own with a sidebar entry
 * (owner's request, 2026-11-19). The same list is a tab of the alarm center,
 * which is reached only through the header bell — the people who answer these
 * forms did not find it there.
 */
export function InquiriesPage() {
  const { t } = useTranslation(['nav', 'livechat']);
  return (
    <div className="space-y-4">
      <PageHeader title={t('nav:inquiries')} subtitle={t('livechat:inquiry.hint')} />
      <InquiriesTab />
    </div>
  );
}
