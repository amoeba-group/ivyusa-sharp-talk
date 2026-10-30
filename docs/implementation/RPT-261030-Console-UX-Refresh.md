# RPT-261030 — Console UX refresh (light/dark, navigation, dashboard, screens)

- Basis: [PLN-261030](../plan/PLN-261030-Console-UX-Refresh.md) — approved by the requester on 2026-10-30 (scope "redesign every screen", default theme "follow the system").
- Branch: `deploy/talk-ivyusa` (talk.ivyusa.com). `main` untouched.
- Scope: `apps/web` only. No API, schema, widget or env change → **no SQL, no migration**.

## 1. What changed

| # | Change |
|---|---|
| G1 Theme | Light / dark / system on every screen. `theme.palette.js` maps Tailwind colours to CSS variables per utility job (bg / text / border); dark steps are chosen, not inverted (tint backgrounds darken, text on tints lightens, filled buttons keep their fill). Light mode keeps the original hex values. No-flash inline script in `index.html` (`st_theme`, default `system`). `data-theme="light"` re-pins light variables for subtrees that must stay light (shopper widget previews, auth brand panel); `@media print` prints light. Markdown editors follow the resolved theme. |
| G2 Find a screen | Sidebar grouped by job (6 tenant groups, 2 admin groups), collapsible rail (persisted in `st_ui`), mobile drawer. Breadcrumb in the header. ⌘K / Ctrl+K / "/" command palette: every menu, the 8 settings tabs, and actions (theme, my page, sign out); label matches rank above keyword matches. Account menu and theme menu in the header. |
| G3 Dashboard | KPI tiles (trend + footer) + "Activity" section with one 7/14/30-day control scoping a line chart (daily widget opens vs conversations — crosshair tooltip, ←/→ keys, direct end labels, table view) and an impression → access → conversation funnel with AI / escalated shares. Built per the dataviz skill; palette validated in light (#2a78d6 / #eb6834 on #ffffff) and dark (#3987e5 / #d95926 on #151922). |
| G4 Lists | One-line `FilterBar` (search, compact selects, date chips, reset) on history, products, customers, companies, work log, journey board, alarm center, AI engines, statistics. |
| G5 Long screens | "On this page" sticky bar listing every card (AI settings, knowledge, settings tabs); sticky side panels offset below header + bar. |
| G6 Details | Right-hand drawer for transcripts (history, work log). |
| G7 Primitives | Button (loading, no wrap), Card (description, flush, nav label; tables inside drop their own border), Badge (tinted + ring), Table (skeleton rows, empty state), Modal (xl, animation), Toast, Tabs, Segmented, Field, PageHeader, Pagination (aria labels), DateRangePicker (pills). Dates formatted via `Intl` in the UI language (`lib/format.ts`). |
| Fixes found on the way | Platform admin fired `/routing-categories` (403) on every screen → only for tenant users. Admin overview showed "no integrations" from a 403 → card hides on error. Table action buttons overflowed on narrow widths → `flex-wrap` (17 files). |
| i18n | New keys in `nav` (groups, search, theme, user menu, sidebar), `dashboard` (activity, ranges, chart labels, funnel), `common` (filters, pagination, on this page) × en/es/ko/vi/ja/zh. |

### Files (99, +4089 / −997)

- New: `theme.palette.js` · `lib/{theme,format,use-dismiss}.ts` · `layouts/{CommandPalette,ThemeMenu,UserMenu}.tsx` · `layouts/use-shell.ts` · `components/{Drawer,OnThisPage,Segmented,Tabs,Toolbar}.tsx` · `components/charts/{LineChart,FunnelBars}.tsx`
- Shell: `index.html` · `index.css` · `tailwind.config.js` · `main.tsx` · `store/ui-store.ts` · `layouts/{AppLayout,Header,Sidebar,nav-config}.ts(x)`
- Components: Badge · Button · Card · DateRangePicker · Field · KpiCard · Modal · PageHeader · Pagination · Table · Toast
- Screens: dashboard (page + hooks) · history (page + transcript) · work-log · customers (page, companies panel, detail modal) · products · orders · journey (board, report modal) · statistics (page, access, journey, trend chart) · alerts · knowledge (page, board card, site policy agent) · ai-settings (page, proposal card) · settings (layout, page, widget designs) · board document · live chat (page + 4 small) · menu · auth shell · campaigns · users (page, labels modal, region editor) · admin (overview, users, AI engines, audit, tenants, tenant users) · routing-categories hooks
- Locales: `common`, `dashboard`, `nav` × 6 languages
- Docs: PLN-261030 · this RPT · CHANGELOG `[Unreleased]`

## 2. Tests

| Check | Result |
|---|---|
| `npm run typecheck` | 9/9 packages pass |
| `npm test` | api 2,773 · types 197 · common 60 · widget 59 (`node --test test/*.mjs`; the bare `test/` form fails on Node 22 only — pre-existing, CI runs Node 20) — all pass |
| `npm run build` | 6/6 pass |
| `i18n:check` · `env:check` · migration manifest · radius check · `git diff --check` | clean |
| Playwright, local | 38 routes (tenant, admin, public) in light and dark — no console errors except the expected admin `/integrations` 403 (card now hidden) and the `/settings` → `/settings/basic` redirect. Mobile 390 px. ⌘K navigation + ranking ("widget" → Settings › Widget). Theme switch persists and applies before first paint on reload (production build: dark body `rgb(13,16,22)`). Sidebar rail persists. History drawer opens / closes. |

## 3. Deploy state

| Env | State |
|---|---|
| Commit | `ff9bb663` on `deploy/talk-ivyusa` (parent `6fb0bfb1`) |
| GitHub | **Push pending** — the session's GitHub access returned 403 for `amoeba-group/ivyusa-sharp-talk`; the requester chose "deploy first, push later". The commit reached the server as a git bundle (sha256 `18bdb18f…94695`, `git bundle verify` OK, fast-forward only). |
| Production (talk.ivyusa.com, EC2 `talkaibotprd01`) | Deployed `ff9bb663` on 2026-10-30 05:27–05:28 UTC (12:27 ICT) via `bash scripts/deploy-self-hosted.sh` (log `~/sharptalk-deploy-20261030-0527.log`, exit 0, no error lines). Script checks: config complete, health `ok`, widget 200, console 200, boot log 1× `successfully started`. `sharptalk_web` / `sharptalk_widget` recreated; API, MySQL, Redis, RabbitMQ, Qdrant untouched (`Up 2 days`). Smoke: `/`, `/admin/login`, `/widget/` 200 through `sharptalk_nginx` (:8080) and the host nginx (:80, `Host: talk.ivyusa.com`); served `index.html` carries the theme script; bundle `index-o_EOqPhI.js` carries `st_ui`. Browser on https://talk.ivyusa.com: new shell + dashboard render, dark mode switches and reverts to system, no console errors. |
| SQL / migration | None (web-only change) |

## 4. Remaining / notes

- Push `ff9bb663` and this RPT commit to `origin/deploy/talk-ivyusa` once write access to the repository is added to the session; the server's branch already points at `ff9bb663`, so the next `git pull` there is a no-op fast-forward.
- Theme preference and sidebar rail are per browser (`localStorage`); nothing is stored server-side.
- The dashboard activity chart reads `/analytics/access` (daily rows); a tenant with no widget traffic in the range sees the "no activity yet" state rather than an empty plot.
