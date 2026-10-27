import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Pencil } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Input } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/cn';
import { makeCan } from '@/lib/rbac';
import { useAuthStore } from '@/store/auth-store';
import { toast } from '@/store/toast-store';
import { ChannelBadge } from '../live-chat/ChannelBadge';
import { ConversationTranscript } from '../history/ConversationTranscript';
import { useCustomerDetail, useUpdateCustomer } from './customers.hooks';
import { customersService } from './customers.service';
import type { Customer } from './customers.service';

type Tab = 'info' | 'conversations' | 'platforms';

function fmtDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1">
      <dt className="text-gray-500">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-gray-800">{children}</dd>
    </div>
  );
}

/**
 * A personal customer (PLN-261027 D9): who they are, how they first arrived,
 * the operator's memo, and their conversations. Phone and e-mail stay masked;
 * [보기] and editing them go through the audited reveal route, so a masked
 * value can never be saved back over the real one.
 */
export function CustomerDetailModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation('common');
  const principal = useAuthStore((s) => s.principal);
  const canReveal = makeCan(principal)('customer_pii_reveal');
  const { data, isLoading, error } = useCustomerDetail(id);
  const update = useUpdateCustomer();

  const [tab, setTab] = useState<Tab>('info');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', memo: '' });
  useEffect(() => {
    setTab('info');
    setConversationId(null);
    setRevealed(null);
    setEditing(false);
  }, [id]);

  const reveal = async (): Promise<Customer | null> => {
    if (!id) return null;
    if (revealed) return revealed;
    try {
      const c = await customersService.reveal(id);
      setRevealed(c);
      return c;
    } catch (e) {
      toast.error((e as Error).message || t('detail.revealFailed'));
      return null;
    }
  };

  const startEdit = async () => {
    if (!data) return;
    // Contact fields are editable only from the real values (audited reveal).
    const full = canReveal ? await reveal() : null;
    // A failed reveal must not open the form with blanks that would clear the real values.
    if (canReveal && !full) return;
    setForm({
      name: data.customer.name ?? '',
      phone: full?.phone ?? '',
      email: full?.email ?? '',
      memo: data.memo ?? '',
    });
    setEditing(true);
  };

  const save = () => {
    if (!id) return;
    const body = canReveal ? form : { name: form.name, memo: form.memo };
    update.mutate(
      { id, body },
      {
        onSuccess: () => {
          setEditing(false);
          setRevealed(null);
        },
      },
    );
  };

  const c = data?.customer;
  const shown = revealed ?? c;
  const tabs: Array<[Tab, string]> = [
    ['info', t('detail.tabInfo')],
    ['conversations', t('detail.tabConversations', { count: data?.conversations.length ?? 0 })],
    ['platforms', t('detail.tabPlatforms', { count: data?.platforms.length ?? 0 })],
  ];

  return (
    <Modal
      open={id != null}
      onClose={onClose}
      size="lg"
      title={c?.name ? t('detail.title', { name: c.name }) : t('detail.titleFallback')}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          {editing ? (
            <>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                {tc('cancel')}
              </Button>
              <Button onClick={save} disabled={update.isPending}>
                {tc('save')}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={conversationId ? () => setConversationId(null) : onClose}>
              {conversationId ? t('companyBack') : tc('close')}
            </Button>
          )}
        </div>
      }
    >
      {isLoading && <p className="text-sm text-gray-400">{t('companyLoading')}</p>}
      {error && <p className="text-sm text-error">{(error as Error).message}</p>}
      {data && conversationId && <ConversationTranscript conversationId={conversationId} />}
      {data && c && !conversationId && (
        <div className="space-y-4 text-sm">
          <div className="flex gap-1 border-b border-gray-200" role="tablist">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  '-mb-px border-b-2 px-3 py-2 text-sm',
                  tab === key ? 'border-primary-500 font-medium text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'info' && !editing && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" variant="secondary" onClick={() => void startEdit()}>
                  <Pencil className="h-4 w-4" /> {t('detail.edit')}
                </Button>
              </div>
              <dl>
                <Row label={t('name')}>{c.name ?? '—'}</Row>
                <Row label={t('detail.phone')}>
                  <span className="inline-flex items-center gap-2">
                    {shown?.phone ?? '—'}
                    {canReveal && c.masked && !revealed && c.phone && (
                      <button
                        type="button"
                        onClick={() => void reveal()}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                        title={t('detail.revealHint')}
                      >
                        <Eye className="h-3.5 w-3.5" /> {t('detail.reveal')}
                      </button>
                    )}
                  </span>
                </Row>
                <Row label={t('email')}>
                  <span className="inline-flex items-center gap-2">
                    {shown?.email ?? '—'}
                    {canReveal && c.masked && !revealed && c.email && (
                      <button
                        type="button"
                        onClick={() => void reveal()}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                        title={t('detail.revealHint')}
                      >
                        <Eye className="h-3.5 w-3.5" /> {t('detail.reveal')}
                      </button>
                    )}
                  </span>
                </Row>
                <Row label={t('detail.company')}>
                  {data.companies.length ? data.companies.map((co) => co.name ?? `#${co.id}`).join(', ') : '—'}
                </Row>
                <Row label={t('customerType')}>
                  {c.customerType === 'b2b_contact' ? (
                    <Badge tone="info">{t('typeB2b')}</Badge>
                  ) : (
                    <Badge tone="gray">{t('typeB2c')}</Badge>
                  )}
                  {c.tier && (
                    <span className="ml-2">
                      <Badge tone="primary">{c.tier}</Badge>
                    </span>
                  )}
                </Row>
                <Row label={t('detail.firstSeen')}>{fmtDateTime(data.firstSeenAt)}</Row>
                <Row label={t('detail.firstConversation')}>
                  <span className="inline-flex items-center gap-2">
                    {fmtDateTime(data.firstConversationAt)}
                    {data.firstChannel && <ChannelBadge channel={data.firstChannel} />}
                  </span>
                </Row>
                <Row label={t('detail.landingPage')}>{data.firstLandingPath ?? '—'}</Row>
                <Row label={t('detail.memo')}>{data.memo ?? <span className="text-gray-400">{t('detail.memoEmpty')}</span>}</Row>
              </dl>
              {revealed && <p className="text-xs text-gray-400">{t('detail.revealHint')}</p>}
            </div>
          )}

          {tab === 'info' && editing && (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-gray-500">{t('name')}</span>
                <Input value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              {canReveal ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">{t('detail.phone')}</span>
                    <Input value={form.phone} maxLength={40} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">{t('email')}</span>
                    <Input
                      type="email"
                      value={form.email}
                      maxLength={320}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </label>
                  <p className="text-xs text-gray-400">{t('detail.revealHint')}</p>
                </>
              ) : (
                <p className="text-xs text-gray-400">{t('detail.contactLocked')}</p>
              )}
              <label className="block">
                <span className="mb-1 block text-xs text-gray-500">
                  {t('detail.memo')} <span className="text-gray-400">({form.memo.length}/2000)</span>
                </span>
                <textarea
                  value={form.memo}
                  maxLength={2000}
                  rows={5}
                  placeholder={t('detail.memoPlaceholder')}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              </label>
            </div>
          )}

          {tab === 'platforms' &&
            (data.platforms.length === 0 ? (
              <p className="text-xs text-gray-400">{t('detail.noPlatforms')}</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-gray-500">
                  <tr>
                    <th className="py-1 font-normal">{t('detail.platform')}</th>
                    <th className="py-1 font-normal">ID</th>
                    <th className="py-1 font-normal">{t('name')}</th>
                    <th className="py-1 font-normal">{t('detail.firstSeen')}</th>
                    <th className="py-1 font-normal">{t('detail.lastSeen')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.platforms.map((p) => (
                    <tr key={`${p.provider}:${p.externalId}`}>
                      <td className="py-1.5">
                        <Badge tone="info">{t(`detail.provider.${p.provider}`, { defaultValue: p.provider })}</Badge>
                      </td>
                      <td className="py-1.5 font-mono text-xs">{p.externalId}</td>
                      <td className="py-1.5">{p.displayName ?? '—'}</td>
                      <td className="py-1.5 text-xs text-gray-500">{fmtDateTime(p.firstSeenAt)}</td>
                      <td className="py-1.5 text-xs text-gray-500">{fmtDateTime(p.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {tab === 'conversations' &&
            (data.conversations.length === 0 ? (
              <p className="text-xs text-gray-400">{t('detail.noConversations')}</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
                {data.conversations.map((cv) => (
                  <li key={cv.id}>
                    <button
                      type="button"
                      onClick={() => setConversationId(cv.id)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-500">#{cv.id}</span>
                        <ChannelBadge channel={cv.channel} />
                        <Badge tone={cv.status === 'ended' ? 'gray' : 'primary'}>{cv.status}</Badge>
                      </span>
                      <span className="text-xs text-gray-500">{fmtDateTime(cv.createdAt)} ›</span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}
    </Modal>
  );
}
