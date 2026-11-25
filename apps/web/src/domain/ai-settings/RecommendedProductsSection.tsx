import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Loader2, Search, X } from 'lucide-react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input, Select } from '@/components/Field';
import { toast } from '@/store/toast-store';
import { useTenantKey } from '@/lib/use-tenant-key';
import {
  recommendedProductsService,
  type RecConfigMode,
  type RecProduct,
  type RecType,
} from './recommended-products.service';

const TYPES: RecType[] = ['popular', 'recommended', 'new'];

/** API error code → copy (backend messages are English; the console localizes by code). */
const ERROR_KEYS: Record<string, string> = { E5167: 'recommended.errorInvalid' };

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');
const money = (p: RecProduct) =>
  p.price == null ? '' : new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency || 'USD' }).format(p.price);

/**
 * Recommended products (IVY PRD v1 A-01…A-04, slide 18;
 * PLN-261125-IVY-Recommended-Products §3.3). Per Product Help category and
 * type: AI Auto (sales + reviews, the default) or Admin Selected (your picks,
 * in order, for a period). A preview shows what shoppers get right now.
 */
export function RecommendedProductsSection() {
  const { t, i18n } = useTranslation('aiSetting');
  const qc = useQueryClient();
  const tenantKey = useTenantKey();
  const view = useQuery({
    queryKey: ['recommended-products', tenantKey],
    queryFn: () => recommendedProductsService.view(),
  });

  const categories = view.data?.categories ?? [];
  const max = view.data?.maxProducts ?? 10;
  const [category, setCategory] = useState('');
  const [type, setType] = useState<RecType>('popular');
  const [mode, setMode] = useState<RecConfigMode>('auto');
  const [handles, setHandles] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  // Cards for the picked handles: what the store returned, plus anything added from search.
  const [known, setKnown] = useState<Record<string, RecProduct>>({});
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    if (!category && categories.length) setCategory(categories[0].id);
  }, [categories, category]);

  useEffect(() => {
    setKnown((k) => ({ ...(view.data?.products ?? {}), ...k }));
  }, [view.data?.products]);

  // Switching category or type loads what is saved for it (none = AI Auto).
  const saved = useMemo(
    () => view.data?.configs.find((c) => c.categoryHandle === category && c.recType === type) ?? null,
    [view.data?.configs, category, type],
  );
  useEffect(() => {
    setMode(saved?.mode === 'admin' ? 'admin' : 'auto');
    setHandles(saved?.productHandles ?? []);
    setStartsAt(day(saved?.startsAt));
    setEndsAt(day(saved?.endsAt));
  }, [saved, category, type]);

  // Debounced store search.
  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), 350);
    return () => clearTimeout(id);
  }, [q]);
  const search = useQuery({
    queryKey: ['recommended-products-search', tenantKey, term],
    queryFn: () => recommendedProductsService.search(term),
    enabled: term.length >= 2,
  });

  const preview = useQuery({
    queryKey: ['recommended-products-preview', tenantKey, category, type],
    queryFn: () => recommendedProductsService.preview(category, type),
    enabled: !!category,
  });

  const save = useMutation({
    mutationFn: () =>
      recommendedProductsService.save({
        category_handle: category,
        rec_type: type,
        mode,
        product_handles: mode === 'admin' ? handles : [],
        starts_at: mode === 'admin' && startsAt ? startsAt : null,
        ends_at: mode === 'admin' && endsAt ? endsAt : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recommended-products', tenantKey] });
      qc.invalidateQueries({ queryKey: ['recommended-products-preview', tenantKey] });
      toast.success(t('recommended.saved'));
    },
    onError: (e: Error & { code?: string }) =>
      toast.error(ERROR_KEYS[e.code ?? ''] ? t(ERROR_KEYS[e.code ?? '']) : e.message || t('recommended.saveError'), {
        sticky: true,
      }),
  });

  const move = (i: number, by: -1 | 1) =>
    setHandles((list) => {
      const next = [...list];
      const j = i + by;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = (p: RecProduct) => {
    setKnown((k) => ({ ...k, [p.handle]: p }));
    setHandles((list) => (list.includes(p.handle) || list.length >= max ? list : [...list, p.handle]));
  };

  const labelOf = (c: { id: string; label: unknown }) =>
    typeof c.label === 'string'
      ? c.label
      : ((c.label as Record<string, string> | null)?.[i18n.language.slice(0, 2).toUpperCase()] ??
        (c.label as Record<string, string> | null)?.EN ??
        c.id);
  const periodInvalid = mode === 'admin' && !!startsAt && !!endsAt && startsAt > endsAt;
  const adminEmpty = mode === 'admin' && handles.length === 0;

  return (
    <Card title={t('recommended.title')} description={t('recommended.hint')}>
      {view.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('recommended.loading')}
        </p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-gray-500">{t('recommended.noCategories')}</p>
      ) : (
        <div className="space-y-4" data-testid="recommended-products">
          <div className="flex flex-wrap gap-3">
            <label className="min-w-[180px] flex-1 text-xs text-gray-500">
              {t('recommended.category')}
              <Select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {labelOf(c)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="min-w-[160px] flex-1 text-xs text-gray-500">
              {t('recommended.type')}
              <Select value={type} onChange={(e) => setType(e.target.value as RecType)} className="mt-1">
                {TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(`recommended.type_${ty}`)}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <fieldset>
            <legend className="mb-1 text-xs text-gray-500">{t('recommended.mode')}</legend>
            <div className="flex flex-wrap gap-5">
              {(['auto', 'admin'] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm text-gray-800">
                  <input type="radio" name="rec-mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
                  {t(`recommended.mode_${m}`)}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              {mode === 'auto' ? t('recommended.modeAutoHint') : t('recommended.modeAdminHint')}
            </p>
          </fieldset>

          {mode === 'admin' && (
            <>
              <div>
                <p className="mb-1 text-xs text-gray-500">{t('recommended.period')}</p>
                {/* Fixed-width wrappers: the shared Input is full width. */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-44">
                    <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} aria-label={t('recommended.periodStart')} />
                  </div>
                  <span className="text-gray-400">~</span>
                  <div className="w-44">
                    <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} aria-label={t('recommended.periodEnd')} />
                  </div>
                </div>
                <p className={`mt-1 text-[11px] ${periodInvalid ? 'text-error' : 'text-gray-400'}`}>
                  {periodInvalid ? t('recommended.periodInvalid') : t('recommended.periodHint')}
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs text-gray-500">{t('recommended.selected', { max })}</p>
                {handles.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-400">{t('recommended.selectedEmpty')}</p>
                ) : (
                  <ol className="divide-y divide-gray-100 rounded-lg border border-gray-200" data-testid="recommended-selected">
                    {handles.map((h, i) => {
                      const p = known[h];
                      return (
                        <li key={h} className="flex items-center gap-3 px-3 py-2">
                          <span className="w-5 text-right text-xs tabular-nums text-gray-400">{i + 1}</span>
                          {p?.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="h-9 w-9 rounded object-cover" />
                          ) : (
                            <span className="h-9 w-9 rounded bg-gray-100" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-gray-900">{p?.title ?? h}</span>
                            <span className={`text-[11px] ${p?.available === false || !p ? 'text-error' : 'text-success'}`}>
                              {!p ? t('recommended.notOnSale') : p.available === false ? t('recommended.outOfStock') : t('recommended.inStock')}
                            </span>
                          </span>
                          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('recommended.moveUp')} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => move(i, 1)} disabled={i === handles.length - 1} aria-label={t('recommended.moveDown')} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => setHandles((l) => l.filter((x) => x !== h))} aria-label={t('recommended.remove')} className="rounded p-1 text-gray-500 hover:bg-gray-100">
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              <div>
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('recommended.searchPlaceholder')} aria-label={t('recommended.search')} className="pl-9" />
                </label>
                {term.length >= 2 && (
                  <div className="mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200">
                    {search.isLoading ? (
                      <p className="px-3 py-2 text-xs text-gray-400">{t('recommended.loading')}</p>
                    ) : (search.data ?? []).length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400">{t('recommended.searchEmpty')}</p>
                    ) : (
                      (search.data ?? []).map((p) => (
                        <div key={p.handle} className="flex items-center gap-3 border-b border-gray-50 px-3 py-2 last:border-0">
                          {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="h-8 w-8 rounded bg-gray-100" aria-hidden />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-gray-900">{p.title}</span>
                            <span className="text-[11px] text-gray-400">
                              {money(p)} · {p.available === false ? t('recommended.outOfStock') : t('recommended.inStock')}
                            </span>
                          </span>
                          <Button size="sm" variant="secondary" disabled={handles.includes(p.handle) || handles.length >= max} onClick={() => add(p)}>
                            {t('recommended.add')}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="rounded-lg bg-gray-50 p-3" data-testid="recommended-preview">
            <p className="mb-2 text-xs font-medium text-gray-600">
              {t('recommended.preview')}
              {preview.data?.mode && <span className="ml-2 font-normal text-gray-400">· {t(`recommended.previewMode_${preview.data.mode}`)}</span>}
            </p>
            {preview.isLoading ? (
              <p className="text-xs text-gray-400">{t('recommended.loading')}</p>
            ) : !preview.data?.available || preview.data.products.length === 0 ? (
              <p className="text-xs text-gray-400">{t('recommended.previewEmpty')}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {preview.data.products.map((p) => (
                  <a key={p.handle} href={p.productUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-gray-200 bg-white p-2 hover:border-gray-300">
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="mb-1 aspect-square w-full rounded object-cover" /> : <span className="mb-1 block aspect-square w-full rounded bg-gray-100" aria-hidden />}
                    <span className="line-clamp-2 text-xs text-gray-900">{p.title}</span>
                    <span className="text-[11px] text-gray-500">{money(p)}</span>
                  </a>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-gray-400">{t('recommended.previewHint')}</p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending || periodInvalid || adminEmpty || !category}>
              {save.isPending ? t('recommended.saving') : t('recommended.save')}
            </Button>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">{t('recommended.history')}</p>
            {(view.data?.history ?? []).length === 0 ? (
              <p className="text-xs text-gray-400">{t('recommended.historyEmpty')}</p>
            ) : (
              <ul className="space-y-1 text-xs text-gray-600" data-testid="recommended-history">
                {(view.data?.history ?? []).map((h, i) => (
                  <li key={i}>
                    <span className="tabular-nums text-gray-400">{new Date(h.at).toLocaleString()}</span> · {h.actor ?? '—'} · {h.target ?? ''} →{' '}
                    {h.metadata?.after
                      ? `${t(`recommended.mode_${h.metadata.after.mode === 'admin' ? 'admin' : 'auto'}`)}${
                          h.metadata.after.mode === 'admin' ? ` (${h.metadata.after.productHandles.length})` : ''
                        }`
                      : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
