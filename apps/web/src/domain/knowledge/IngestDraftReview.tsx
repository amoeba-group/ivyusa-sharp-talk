import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/Badge';
import { Input } from '@/components/Field';
import type { ApproveArticle, IngestDraft } from './knowledge.service';

export interface ReviewDraft extends IngestDraft {
  selected: boolean;
  expanded: boolean;
}

/**
 * Drafts become local, editable review state. A draft whose title is already
 * on the board starts unselected (PLN-261026 D3) — re-running an analysis
 * should not silently double the board, but the operator can still opt in.
 */
export function toReviewDrafts(drafts: IngestDraft[]): ReviewDraft[] {
  return drafts.map((d) => ({ ...d, selected: !d.duplicateOnBoard, expanded: false }));
}

/** The approve payload — the page URL rides along so the board document links its source. */
export function toApproveArticles(drafts: ReviewDraft[]): ApproveArticle[] {
  return drafts
    .filter((d) => d.selected)
    .map((d) => ({
      title: d.title,
      category: d.category,
      content: d.content,
      ...(d.sourceUrl ? { source_url: d.sourceUrl } : {}),
    }));
}

function shortPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || '/';
  } catch {
    return url;
  }
}

/** Draft review list shared by AI import (file/video) and the website policy agent. */
export function IngestDraftReview({
  drafts,
  onPatch,
}: {
  drafts: ReviewDraft[];
  onPatch: (index: number, patch: Partial<ReviewDraft>) => void;
}) {
  const { t } = useTranslation('knowledge');

  if (!drafts.length) return <p className="text-sm text-gray-500">{t('ingestNoDrafts')}</p>;

  return (
    <ul className="max-h-96 space-y-2 overflow-y-auto">
      {drafts.map((d, i) => (
        <li key={i} className="rounded-md border border-gray-200 p-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={d.selected}
              aria-label={t('ingestSelectDraft')}
              onChange={(e) => onPatch(i, { selected: e.target.checked })}
            />
            <Input value={d.title} onChange={(e) => onPatch(i, { title: e.target.value })} className="flex-1" />
            {d.fallback && <Badge tone="warning">{t('ingestFallback')}</Badge>}
            {d.duplicateOnBoard && <Badge tone="warning">{t('site.duplicate')}</Badge>}
          </div>
          <div className="mt-1 flex items-center gap-2 pl-6">
            <span className="shrink-0 whitespace-nowrap text-xs text-gray-500">{t('category')}</span>
            <Input
              value={d.category}
              onChange={(e) => onPatch(i, { category: e.target.value })}
              className="w-48"
            />
            <button
              type="button"
              className="shrink-0 whitespace-nowrap text-xs text-primary-600 hover:underline"
              onClick={() => onPatch(i, { expanded: !d.expanded })}
            >
              {d.expanded ? t('ingestHideContent') : t('ingestShowContent')}
            </button>
            <span className="ml-auto text-xs tabular-nums text-gray-400">{d.content.length.toLocaleString()}</span>
          </div>
          {d.sourceUrl && (
            <a
              href={d.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={d.sourceUrl}
              className="mt-1 block truncate pl-6 text-xs text-gray-500 hover:text-primary-600 hover:underline"
            >
              🔗 {shortPath(d.sourceUrl)}
            </a>
          )}
          {d.expanded && (
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs">
              {d.content}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}
