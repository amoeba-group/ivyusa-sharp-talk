import { useEffect, useState } from 'react';
import { isAppMode } from '../lib/host-bridge';

/** The loader's phone rule (`embed.js` COMPACT): a page narrower than 640px. */
const PHONE_QUERY = '(max-width: 639.98px)';

/**
 * The widget page opened on its own: not through `embed.js` (which adds
 * `?embed=1`) and not inside a host app. Only then is this document the page
 * itself — inside the loader's iframe its width is the frame's, never the
 * page's (FIX-260920), which is why the loader decides there (`?compact=1`).
 */
function isStandalonePage(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('embed') !== '1' && !isAppMode();
  } catch {
    return false;
  }
}

/**
 * A standalone widget page on a phone-sized screen (ivy-docs T15 D2) — e.g.
 * `talk.ivyusa.com/widget/?shop=…`, the page used to try the widget before it is
 * embedded. It then lays out like the phone a shopper gets from the loader,
 * instead of a desktop card hanging off one edge. Follows a rotation.
 */
export function useStandalonePhone(): boolean {
  const [standalone] = useState(isStandalonePage);
  const [narrow, setNarrow] = useState(
    () => standalone && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches,
  );
  useEffect(() => {
    if (!standalone || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(PHONE_QUERY);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [standalone]);
  return standalone && narrow;
}
