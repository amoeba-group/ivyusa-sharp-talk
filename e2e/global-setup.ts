import type { FullConfig } from '@playwright/test';

/**
 * Fail fast with an actionable message instead of 40 timeouts when the stack is not up.
 */
export default async function globalSetup(_config: FullConfig) {
  const api = process.env.E2E_RESOLVED_API_URL!;
  const widget = process.env.E2E_RESOLVED_WIDGET_URL!;

  const probe = async (url: string) => {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      return res.status;
    } catch (err) {
      return `unreachable (${(err as Error).message})`;
    }
  };

  const health = await probe(`${api}/health`);
  const page = await probe(widget);

  const problems: string[] = [];
  if (health !== 200) problems.push(`API health ${api}/health → ${health}`);
  if (page !== 200) problems.push(`Widget ${widget} → ${page}`);

  if (problems.length) {
    const hint =
      process.env.E2E_TARGET === 'prod'
        ? 'talk.ivyusa.com sits behind an AWS ELB that answers 403 to non-allowlisted IPs — run from an allowlisted network.'
        : 'Start the stack first: `npm run db:up` then `npm run dev` at the repo root (and copy apps/widget/.env.example → apps/widget/.env).';
    throw new Error(`E2E pre-flight failed:\n  - ${problems.join('\n  - ')}\n${hint}`);
  }
}
