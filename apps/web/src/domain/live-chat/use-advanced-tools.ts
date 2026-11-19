import { useCallback, useState } from 'react';

const KEY = 'sharptalk.livechat.advanced';

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * "Show advanced tools" on the Live Chat page (PLN-261119), remembered per
 * browser. Off by default: answering a customer needs the list, the thread, a
 * reply box and who the customer is. Grouping, merging, AI-agent routing,
 * knowledge lookup, briefings and answer ratings are for a team that has
 * decided to use them — and one switch brings all of them back.
 */
export function useAdvancedTools(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(stored);
  const set = useCallback((next: boolean) => {
    setOn(next);
    try {
      if (next) localStorage.setItem(KEY, '1');
      else localStorage.removeItem(KEY);
    } catch {
      /* not remembered is fine; the switch still works for this visit */
    }
  }, []);
  return [on, set];
}
