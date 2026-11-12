/**
 * Which message a failed review save shows (ivy-docs T06 D3, BUG-009). The API
 * answers in English and the client localizes by code (CLAUDE.md §2):
 * E4002 = the moderation gate refused the text, which the shopper can fix.
 */
export const REVIEW_BLOCKED_CODE = 'E4002';

export function reviewErrorKey(err: unknown): 'review.blocked' | 'review.saveFailed' {
  const code = (err as { code?: unknown } | null)?.code;
  return code === REVIEW_BLOCKED_CODE ? 'review.blocked' : 'review.saveFailed';
}
