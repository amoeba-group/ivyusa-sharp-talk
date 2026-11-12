import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Input, Label } from '@/components/Field';
import { LANGUAGES } from '../../../../../packages/types/src/common/language';
import {
  PRODUCT_CATEGORY_LABEL_MAX,
  PRODUCT_CATEGORY_MAX,
  collectionHandleFrom,
} from '../../../../../packages/types/src/common/product-category';
import type { ProductCategory, ScenarioLang } from './ai-settings.service';
import { scenarioLabelText } from './ai-settings.service';

/** A row is ready to save when its collection reads as a handle and it has a name. */
export function categoryProblem(c: ProductCategory, lang: ScenarioLang): 'handle' | 'name' | null {
  if (!collectionHandleFrom(c.id)) return 'handle';
  // scenarioLabelText falls back to English, then any language — as the widget does.
  if (!scenarioLabelText(c.label, lang).trim()) return 'name';
  return null;
}

/**
 * Store collections under the widget's "Popular products" (ivy-docs T10 D2),
 * edited on the Product Help button. The name follows the page's language tabs
 * like the button label; the collection takes a bare handle or a pasted store
 * URL and is tidied to the handle when the field is left.
 */
export function ProductCategoriesEditor({
  value,
  lang,
  onChange,
}: {
  value: ProductCategory[];
  lang: ScenarioLang;
  onChange: (next: ProductCategory[]) => void;
}) {
  const { t } = useTranslation('aiSetting');

  const update = (i: number, next: ProductCategory) => onChange(value.map((c, idx) => (idx === i ? next : c)));
  /** Same seeding rule as the button label: typing one language keeps the other five. */
  const setName = (i: number, text: string) => {
    const c = value[i];
    const base =
      typeof c.label === 'string'
        ? Object.fromEntries(LANGUAGES.map((l) => [l.session, c.label as string]))
        : { ...(c.label ?? {}) };
    update(i, { ...c, label: { ...base, [lang]: text } });
  };
  const tidyHandle = (i: number) => {
    const handle = collectionHandleFrom(value[i].id);
    if (handle && handle !== value[i].id) update(i, { ...value[i], id: handle });
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="w-full rounded-lg bg-gray-50 p-3" data-testid="product-categories-editor">
      <p className="text-sm font-medium text-gray-800">{t('productCategories.title')}</p>
      <p className="mt-0.5 text-xs text-gray-500">{t('productCategories.hint')}</p>
      {value.length > 0 && (
        <div className="mt-3 space-y-2">
          {value.map((c, i) => {
            const problem = c.id.trim() || scenarioLabelText(c.label, lang).trim() ? categoryProblem(c, lang) : null;
            return (
              // Index key: the handle is what is being typed, so it cannot be the key.
              <div key={i} className="flex flex-wrap items-start gap-2">
                <div className="min-w-[140px] flex-1">
                  {i === 0 && <Label>{t('productCategories.name', { lang })}</Label>}
                  <Input
                    value={scenarioLabelText(c.label, lang)}
                    aria-label={t('productCategories.name', { lang })}
                    maxLength={PRODUCT_CATEGORY_LABEL_MAX}
                    onChange={(e) => setName(i, e.target.value)}
                  />
                  {problem === 'name' && <p className="mt-0.5 text-[11px] text-error">{t('productCategories.nameMissing')}</p>}
                </div>
                <div className="min-w-[160px] flex-1">
                  {i === 0 && <Label>{t('productCategories.collection')}</Label>}
                  <Input
                    value={c.id}
                    aria-label={t('productCategories.collection')}
                    placeholder="nails"
                    onChange={(e) => update(i, { ...c, id: e.target.value })}
                    onBlur={() => tidyHandle(i)}
                  />
                  {problem === 'handle' && (
                    <p className="mt-0.5 text-[11px] text-error">{t('productCategories.handleInvalid')}</p>
                  )}
                </div>
                <div className={`flex items-center gap-1 ${i === 0 ? 'pt-5' : ''}`}>
                  <Button variant="ghost" size="sm" aria-label={t('moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('moveDown')}
                    disabled={i === value.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('remove')}
                    onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <Button
          size="sm"
          variant="secondary"
          disabled={value.length >= PRODUCT_CATEGORY_MAX}
          onClick={() => onChange([...value, { id: '', label: '' }])}
        >
          <Plus className="h-4 w-4" /> {t('productCategories.add')}
        </Button>
        <span className="text-xs tabular-nums text-gray-400">
          {value.length} / {PRODUCT_CATEGORY_MAX}
        </span>
      </div>
    </div>
  );
}
