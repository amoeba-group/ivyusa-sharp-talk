import type { FullConfig } from '@playwright/test';

/**
 * Fail fast with an actionable message instead of 40 timeouts when the stack is not up.
 *
 * Local only. talk.ivyusa.com answers 403 to clients that are not browsers —
 * Node's fetch here, curl — while a browser on the same machine is served
 * (measured 2026-11-17, ivy-docs BUG-004). A probe from Node would therefore
 * stop the production smoke before any test ran, on every machine. The smoke
 * itself runs in Chromium, and TC-16-01 is the health check.
 */
export default async function globalSetup(_config: FullConfig) {
  if (process.env.E2E_TARGET === 'prod') return;

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
      'Start the stack first: `npm run db:up` then `npm run dev` at the repo root (and copy apps/widget/.env.example → apps/widget/.env).';
    throw new Error(`E2E pre-flight failed:\n  - ${problems.join('\n  - ')}\n${hint}`);
  }
}
