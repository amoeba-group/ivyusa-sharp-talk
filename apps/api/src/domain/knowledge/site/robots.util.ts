/**
 * Minimal robots.txt reader (PLN-261026 S1): picks the group naming our bot,
 * else `*`, and applies longest-match Allow/Disallow with `*` and `$`
 * wildcards (RFC 9309). Anything unreadable means "allowed" — a broken
 * robots.txt is not a refusal.
 */

const BOT_TOKEN = 'sharptalkbot';

interface Rule {
  allow: boolean;
  pattern: string;
}

export interface RobotsPolicy {
  isAllowed(pathAndQuery: string): boolean;
}

export const ALLOW_ALL: RobotsPolicy = { isAllowed: () => true };

export function parseRobots(text: string): RobotsPolicy {
  const groups: Array<{ agents: string[]; rules: Rule[] }> = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === 'user-agent') {
      // Consecutive User-agent lines share one group.
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      // `Disallow:` with no value allows everything — no rule at all.
      if (!value) continue;
      current.rules.push({ allow: key === 'allow', pattern: value });
    }
  }

  const ours = groups.filter((g) => g.agents.includes(BOT_TOKEN));
  const chosen = ours.length ? ours : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules);
  if (!rules.length) return ALLOW_ALL;

  return {
    isAllowed(pathAndQuery: string): boolean {
      let best: Rule | null = null;
      for (const r of rules) {
        if (!matches(r.pattern, pathAndQuery)) continue;
        // Longest pattern wins; on a tie, Allow wins (least restrictive).
        if (
          !best ||
          r.pattern.length > best.pattern.length ||
          (r.pattern.length === best.pattern.length && r.allow && !best.allow)
        ) {
          best = r;
        }
      }
      return best ? best.allow : true;
    },
  };
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${re}${anchored ? '$' : ''}`).test(path);
}
