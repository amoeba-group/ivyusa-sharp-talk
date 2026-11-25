import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { cardNote, type CardNoteRequest } from '../services/chatService';

/**
 * The AI's line next to a data card (IVY PRD v1 C-02, PLN-261125-IVY-PRD-v1-Phase5 §1.2).
 *
 * `text` is null while there is nothing to say — no consent, no AI engine, an
 * error — and the card keeps the widget's own sentence. Asked once per card:
 * the same card in the same language does not ask again, and a failure is an
 * answer, not something to retry while the shopper reads.
 */
export function useCardNote(sessionToken: string | null, req: CardNoteRequest | null) {
  const { i18n } = useTranslation();
  const target = !req
    ? null
    : req.kind === 'stock'
      ? `${req.handle}|${req.q}`
      : req.kind === 'popular'
        ? req.category
        : req.orderId;
  const q = useQuery({
    queryKey: ['card-note', req?.kind ?? null, target, sessionToken, i18n.language],
    queryFn: () => cardNote(sessionToken!, req!).catch(() => null),
    enabled: !!sessionToken && !!req,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });
  return { text: q.data ?? null, loading: !!req && !!sessionToken && q.isLoading };
}
