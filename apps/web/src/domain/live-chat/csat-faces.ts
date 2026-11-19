/**
 * The widget's satisfaction faces, by the 1–5 value each one stores (widget
 * CsatCard). The one-question card offers four of them — 1 · 3 · 4 · 5
 * (ivy-docs SPEC Q-12); the survey card all five. The console shows a rating
 * as the face the customer tapped, never as stars (PLN-261119).
 */
export const CSAT_FACES = ['😞', '😕', '😐', '😊', '😍'] as const;
export const CSAT_FOUR = [1, 3, 4, 5] as const;
export const CSAT_FIVE = [1, 2, 3, 4, 5] as const;

/** Face for a stored rating; out-of-range values are clamped to the scale. */
export function csatFace(rating: number): string {
  return CSAT_FACES[Math.max(1, Math.min(5, Math.round(rating))) - 1];
}
