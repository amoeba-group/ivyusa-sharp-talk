# PLN-261030 — Console UX refresh (light/dark, navigation, dashboard, screens)

- Branch: `deploy/talk-ivyusa` (talk.ivyusa.com). `main` untouched.
- Scope: `apps/web` only (tenant console + platform admin + auth pages). No API, schema, widget or env change.
- Approved by the requester on 2026-10-30 (scope option "redesign every screen", default theme "follow the system").

## 1. Goals

| # | Goal | How |
|---|---|---|
| G1 | Light / dark / system theme on every screen | CSS-variable colour system mapped into Tailwind (`theme.palette.js`); per-utility dark steps (tint backgrounds go dark, text on tints goes light, buttons keep their fill). Light mode keeps the original hex values. |
| G2 | Find any screen fast | Sidebar grouped by job (6 tenant groups, 2 admin groups), breadcrumb, ⌘K / Ctrl+K / "/" menu search that also reaches the 8 settings tabs and actions (theme, my page, sign out). |
| G3 | Dashboard that answers "how are we doing" | KPI tiles + activity section with one range control (7/14/30 days): daily widget opens vs conversations (line chart, crosshair tooltip, table view) and the impression → access → conversation funnel. Built per the dataviz skill; palette validated in both modes. |
| G4 | Lists that are quick to filter | One-line filter bar (search, compact selects, date chips, reset) on history, products, customers, companies, work log, journey board, alarm center, AI engines, statistics. |
| G5 | Long screens that are quick to navigate | "On this page" sticky bar listing every card (AI settings, knowledge, settings tabs). |
| G6 | Details without losing your place | Right-hand drawer for transcripts (history, work log). |
| G7 | Consistent primitives | Button (loading, no wrapping), Card (description, flush, nav label; tables inside drop their own border), Badge (tinted + ring), Table (skeleton rows, empty state), Modal, Toast, Tabs, Segmented, Field, PageHeader, KpiCard (trend + footer). |

## 2. Wireframe — shell (desktop)

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ ◆ IVY USA    │ Group › Screen          [🔍 Search menus…  ⌘K] 🔔 ☀ EN 👤 ▾│
│   SharpTalk  ├──────────────────────────────────────────────────────────┤
│ OVERVIEW     │ Title                                   [secondary][Primary]│
│ ▣ Dashboard  │ subtitle                                                  │
│ CONVERSATIONS│ ┌ On this page: [Card A] [Card B] [Card C] … ─────────────┐ │
│ ✉ Live chat  │ ┌ FilterBar: [🔍 search……] [From ▢] [Status ▾] [⟲ Reset] ┐ │
│ ▦ Issues     │ ┌ Table ───────────────────────────────────────────────┐ │
│ ⟲ History    │ │ COL      COL      STATUS   DATE                ⋯     │ │
│ ⇢ Journey    │ │ …        …        ● Ended  Oct 30, 4:06 PM            │ │
│ INSIGHTS …   │ └──────────────────────────────────────────────────────┘ │
│ AI & KNOW… … │                                    1–20 of 412   ‹ 1/21 › │
│ CUSTOMERS …  │                                                          │
│ WORKSPACE …  │                                     ┌ Drawer (details) ┐ │
│ « Collapse   │                                     │ title · meta   ✕ │ │
└──────────────┴─────────────────────────────────────┴──────────────────┴─┘
```

Below `lg` the sidebar becomes a drawer opened from the ☰ button; ⌘K stays.

## 3. Wireframe — dashboard

```
Dashboard                                     [Manage knowledge] [Open live chat]
┌Active chats┐ ┌Unresolved┐ ┌AI resolution ━━━━━░░┐
┌Total conv. ┐ ┌Notifications┐ ┌Total orders┐
Activity                                          (7 days | 14 days | 30 days)
┌ Daily widget activity     [Table] Open statistics ┐ ┌ Impression → conversation ┐
│ — Widget opened  — Conversations                  │ │ Impressions ████████ 714  │
│  ╱╲    ╱╲__╱      (crosshair tooltip)  end labels │ │ Access      █████    396  │
│ ╱  ╲__╱                                           │ │ Conversations ██     191  │
└───────────────────────────────────────────────────┘ │ AI 72%   Escalated 18%    │
┌ Popular questions ───────────────┐ ┌ Integrations ┐ └───────────────────────────┘
Recent orders (table)
```

## 4. Side-impact analysis

| Area | Impact | Mitigation |
|---|---|---|
| Light mode | Same colours (variables carry the original hex). | Visual diff of all 38 routes before/after. |
| Shopper widget previews in settings | Must stay light in a dark console. | `data-theme="light"` re-pins the light variables for the preview subtree. |
| Markdown editor (board, journey report) | Had `data-color-mode="light"` hard-coded. | Follows the resolved theme. |
| Printing (journey report) | Dark variables would print dark. | `@media print` pins light variables. |
| Live chat viewport math (`100dvh-112px`) | Depends on header 64px + main padding 48px. | Header height and main vertical padding unchanged. |
| Sticky side panels (AI settings studio, knowledge QA) | Used `top-6`, slid under the sticky header. | Offset below header + section bar. |
| Platform admin | Fired `/routing-categories` (403) on every screen; overview card showed "no integrations" from a 403. | Routing categories only for tenant users; integration card hides on error. |
| i18n | New strings (nav groups, search, theme, dashboard activity, filters). | Added in en/es/ko/vi/ja/zh; `npm run i18n:check` clean. |
| Storage | New keys `st_theme`, `st_ui` (sidebar rail). | Read defensively; private mode falls back to defaults. |

## 5. Test plan

- `npm run typecheck`, `npm test`, `npm run build`, `i18n:check`, `env:check`, migration manifest, radius check.
- Playwright: every tenant/admin/public route in light and dark (console errors collected), mobile 390px, ⌘K navigation + ranking, theme switch persistence + no flash on reload, sidebar rail persistence, history drawer.
- Production: deploy via `scripts/deploy-self-hosted.sh` (web image rebuild; no SQL), smoke `/`, `/widget/`, `/api/v1/health`, login screens.
