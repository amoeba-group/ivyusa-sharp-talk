# IVY USA · TalkTalk Widget — ARCHITECTURE

> Kiến trúc của phần hệ thống liên quan tới widget IVY trên talk.ivyusa.com. Kiến trúc tổng thể của nền tảng SharpTalk nằm ở [/SPEC.md §3](../SPEC.md) và [/CONFIG.md](../CONFIG.md).
> Khảo sát trên commit `583ce121` (nhánh `deploy/talk-ivyusa`), ngày 2026-11-09.

---

## 1. Toàn cảnh

```
 Shopper (trình duyệt)
   │
   ▼
 ivyusa.com  (Shopify theme, layout/theme.liquid)
   │  <script> SHARPTALK_WIDGET_CONFIG / IVY_WIDGET_CONFIG + <script src="https://talk.ivyusa.com/widget/embed.js">
   │  trigger mode: chuông #st-bell trên header của ivyusa.com mở widget
   │
   ├──► /apps/ivy/identity  (Shopify App Proxy, có chữ ký Shopify)
   │        └──► talk.ivyusa.com/api/v1/shopify/proxy/identity  → gắn khách Shopify vào session
   │
   └──► <iframe sandbox src="https://talk.ivyusa.com/widget/?embed=1&shop=…&locale=…">
             │  React app (apps/widget) — polling, không websocket
             ▼
      talk.ivyusa.com  ──  AWS ELB (allowlist IP → 403 với nguồn lạ)
             ▼
      EC2 talkaibotprd01 · host nginx :80
             ▼
      docker  sharptalk_nginx :8080
        ├─ /widget/*      → sharptalk_widget  (nginx tĩnh, build base=/widget/)
        ├─ /api/*         → sharptalk_api     (NestJS 11, /api/v1)
        ├─ /widget-design/live/ → volume uploads
        └─ /*             → sharptalk_web     (console tenant + admin)
                               │
          sharptalk_api ───────┼── sharptalk_mysql    (MySQL 8, 127.0.0.1 only)
                               ├── sharptalk_redis    (cache session, unread)
                               ├── sharptalk_rabbitmq (thông báo/log bất đồng bộ)
                               └── sharptalk_qdrant   (vector cho RAG)

 Shopify ──webhooks (orders, fulfillments, GDPR; HMAC)──► sharptalk_api
 AI provider (Anthropic / stub) ◄── AI gateway trong API (mọi output qua ModerationService)
```

---

## 2. Monorepo — phần liên quan tới IVY widget

| Đường dẫn | Vai trò | Stack |
|---|---|---|
| `apps/widget` | Widget khách hàng (iframe) — **trọng tâm đợt này** | React 18.3 · Vite 5.3 · Tailwind 3.4 · Zustand 4.5 · TanStack Query 5.51 · i18next 23 / react-i18next 14 · axios 1.7 · font Pretendard |
| `apps/widget/public/embed.js` | Loader JS thuần cho storefront: tạo iframe, App Proxy identity, `ShopTalk.open/close/toggle/identify` | vanilla JS |
| `apps/api` | Backend `/api/v1` | NestJS 11 · TypeORM 0.3 · MySQL 8 · ioredis 5 · amqplib |
| `apps/web` | Console tenant (cấu hình tab, copy, scenario, theme widget, campaign) + admin hệ thống | React 18 · Vite 5 |
| `packages/types` | Kiểu dùng chung: `widget.types.ts` (response widget), `enum.types.ts` (`WIDGET_TABS_DEFAULT`), `status-map.ts` (nhãn stepper), `widget-theme.ts`, `widget-copy.ts`, `language.ts` | TS |
| `packages/common` | Ma trận quyền, tiện ích pagination/token | TS |
| `docker/self-hosted` | Compose + Dockerfile + nginx cho stack IVY | Docker |
| `scripts/deploy-self-hosted.sh` | Script deploy chạy trên server | bash |
| `e2e/` | **Mới** — bộ Playwright cho widget IVY (package độc lập, không phải workspace) | @playwright/test 1.65 |
| `ivy-docs/` | **Mới** — SPEC / TASKS / ARCHITECTURE / TEST-CASES / BUGS | Markdown |

---

## 3. Bên trong widget (`apps/widget/src`)

```
index.html ─► /widget-config.js (window.__SHOPTALK_CONFIG__.apiBase, runtime)
          └─► main.tsx   — áp theme cache trước first paint, fetch theme, React Query
               └─► App.tsx  — embed=1|mode=app → chỉ widget; ngược lại thêm storefront demo phía sau
                    └─► components/widget/Widget.tsx       — launcher + teaser
                         └─► components/widget/WidgetPanel.tsx — header, tab, close-feedback
                              ├─ TopTabs.tsx / BottomTabs.tsx / tab-defs.ts / useTabBar.ts
                              ├─ notifications/NotificationsTab.tsx · tab-chips.ts · ShipmentList.tsx · NotificationIcon.tsx
                              ├─ orders/OrderList.tsx · OrderDetail.tsx · TrackingStepperH.tsx · TrackingStepper.tsx
                              │         ReviewItemList.tsx · ReviewForm.tsx
                              ├─ chat/ChatTab.tsx · ScenarioMenu.tsx · InlineOrderCard.tsx · ContactCard.tsx
                              │       ContactEmailCard.tsx · CallbackCard.tsx · AffiliateCard.tsx · CsatCard.tsx
                              │       TypingBubble.tsx · ConsentBanner.tsx · reply-chips.ts
                              ├─ settings/PreferencesPanel.tsx
                              └─ widget/LanguageSwitcher.tsx
```

| Mối quan tâm | Cách làm hiện tại |
|---|---|
| Điều hướng | **Không có router.** `store/widgetStore.ts` (Zustand) giữ tab đang mở + cờ settings; màn chi tiết là state cục bộ của component. Tab đã mở thì giữ mounted. |
| Dữ liệu server | React Query hooks trong `src/hooks/*` (`useSession`, `useNotifications`, `useOrders`, `useChat`, `useScenario`, `usePrivacy`…). Query key luôn có `sessionToken`. |
| API client | `src/lib/api-client.ts` (axios): base = `window.__SHOPTALK_CONFIG__.apiBase` → `VITE_API_BASE_URL` → `${origin}/api/v1`; bóc envelope `{success,data,error}`; GET gửi token qua header `X-Session-Token`. |
| Realtime | **Polling**: chat `GET /chat/conversation` mỗi 5s (`useChat.ts`), unread `GET /notifications/unread-count` mỗi 30s (chỉ khi `authenticated`). |
| i18n | `src/i18n/i18n.ts`, 1 namespace `translation`, locale là file TS `src/i18n/locales/{en,es,ko,vi,ja,zh}.ts` (~420 dòng/ngôn ngữ). Danh sách ngôn ngữ duy nhất ở `packages/types/src/common/language.ts`. Thứ tự chọn: host page → `localStorage.ivy_lang` → trình duyệt → `en` (giới hạn theo tenant). |
| Theme | `tailwind.config.js` + `src/index.css` + `src/lib/theme.ts` áp theme tenant lúc chạy. Radius qua class `rounded-st-{xs..xl}` (CI: `npm run radius:check`). Primary 500 = `#2B7FFF`; status: success `#00C950`, warning `#FF6900`, error `#FF385C`, info `#3B82F6`, review `#AD46FF`; dòng nổi bật `#FEF9F3`. Class `st-panel`, `st-tab`, `st-quick-reply`… là hook ổn định cho CSS tenant. |
| Cấu hình theo tenant (trả về trong `POST /session/ensure`) | `widgetTabs`, `widgetTabPosition`, `widgetTheme`, `widgetCopy` (lời chào, header…), `headerControls`, `languages`, `consentNoticeVersion`, `csatMode`, `commerceEnabled`… — xem `SessionResponse` trong `packages/types/src/api/widget.types.ts`. |
| Unit test | `npm test -w @sharptalk/widget` = `node --test test/` (11 file, module nhỏ build bằng esbuild + `embed.js`). **Chưa có test DOM/component** → khoảng trống do `e2e/` lấp. |

---

## 4. API mà widget dùng (`/api/v1`, public, định danh bằng session token)

| Nhóm | Endpoint (controller) |
|---|---|
| Session / consent | `POST /session/ensure` · `/session/opened` · `/session/consent` · `/session/language` (`domain/session/session.controller.ts`) |
| Định danh | `GET /shopify/proxy/identity` (App Proxy, `shopify-proxy.controller.ts`) · `POST /public/embed/identify` (HMAC-SHA256 bằng `tenant.embed_secret`, `domain/embed/embed.controller.ts`) |
| Thông báo | `GET /notifications?category=&page=&size=&scope=` (phân trang) · `GET /notifications/unread-count` · `DELETE /notifications` `{ids \| all}` · `POST /notifications/:id/read` · `GET/PUT /notifications/prefs` · `GET/PUT /notifications/marketing-opt-out` |
| Đơn / giao hàng | `GET /orders` · `GET /orders/:id` · `GET /orders/:id/tracking` · `GET /orders/review-items` · `POST /orders/guest-lookup` · `GET /issues` |
| Review / Affiliate | `POST /reviews` · `POST /affiliate/apply` · `GET /affiliate/status` |
| Chat | `GET /ai-config/scenario?language=` · `POST /chat/scenario` · `POST /chat/message` · `GET /chat/conversation` · `GET /chat/thread` · `POST /chat/end` · `POST /chat/csat` · `POST /chat/escalate` · `POST /chat/consult-category` · `POST /chat/contact-email` · `POST /files/upload` |
| Callback | `GET /callback/options` · `POST /callback` |
| Privacy | `GET /privacy/export` · `POST /privacy/delete` · `POST /privacy/opt-out` · `GET /privacy/opt-out/status` |
| **Có sẵn nhưng widget chưa dùng** | `POST/GET /inquiries` · `POST /restock/subscribe` · `GET /subscriptions` · `GET /products/categories` · `GET /products?category=` · `GET /products/recommendations` · `GET /products/:handle` |

Envelope: `{ success, data, error?, timestamp }`; danh sách thêm `pagination: { page, size, totalCount, totalPages, hasNext, hasPrev }`.
Tenant của session xác định theo `shop_domain` (`session.service.ts`); nếu không truyền shop thì chỉ chạy được khi DB có **đúng 1 tenant** (đúng với local seed).

---

## 5. Luồng chính

**5.1 Mở widget:** launcher → `POST /session/ensure {locale}` → nhận token + cấu hình tenant → `GET /ai-config/scenario` + `GET /chat/conversation` → `POST /session/opened`. Chưa có consent → banner consent trong thread → `POST /session/consent`.
> Ở dev, `React.StrictMode` khiến `session/ensure` chạy **2 lần** (2 token) — xem BUG-003.

**5.2 Nhận diện khách:** trên ivyusa.com, `embed.js` gọi App Proxy `/apps/ivy/identity` → API xác thực chữ ký Shopify → session `verified` → `authenticated: true`, `customerName`. Đường khác: host gọi `ShopTalk.identify({userId, hash})` → `POST /public/embed/identify`. Khách vãng lai → "Verify your identity" / Guest order lookup.

**5.3 Thông báo:** webhook Shopify (orders/fulfillments) và campaign từ console → tạo bản ghi `notification` (category: payment/shipping/event/review/…) → widget đọc `GET /notifications` theo chip và poll badge 30s. Xoá là soft-delete phía shopper.

**5.4 Chat & AI:** `POST /chat/message` → phân loại intent → RAG (MySQL FULLTEXT + Qdrant) → AI gateway (stub/Anthropic) → **`ModerationService.moderate()` (fail-safe chặn)** → trả lời theo `session.language`; widget poll `GET /chat/conversation` mỗi 5s. Kịch bản (`POST /chat/scenario`) trả follow-up chip từ `apps/api/src/domain/chat/scenario-scripts.ts`.

**5.5 Kết thúc:** `POST /chat/end` → thẻ CSAT → `POST /chat/csat` (thang 1–5).

---

## 6. Deploy lên talk.ivyusa.com

| Bước | Ai / ở đâu | Lệnh |
|---|---|---|
| 1. Commit & push | máy dev | `git push origin deploy/talk-ivyusa` (**không** deploy) |
| 2. Áp SQL migration (nếu PR có `sql/*.sql` hoặc `*.entity.ts`) | server, **trước** khi deploy code | theo `## Migration` trong PR; skill `pre-deploy-check` |
| 3. Kéo code | server `talkaibotprd01` | `git pull` (fast-forward) |
| 4. Deploy | server | `bash scripts/deploy-self-hosted.sh` |
| 5. Xác minh | server + trình duyệt | log boot `successfully started`, tuổi container (`docker ps`), `/api/v1/health` ok, `/widget/` và `/` = 200; route mới: 401 = đã deploy, 404 = chưa, 502 = API đang restart |
| 6. Smoke E2E | mạng được allowlist | `cd e2e && npm run test:prod` |

`deploy-self-hosted.sh` làm: kiểm `docker/self-hosted/.env.self-hosted` (có `UPLOAD_DIR=/data/uploads` + secret bắt buộc) → ghi `docker/self-hosted/widget-config.js` (API base) → nếu MySQL đang chạy thì `scripts/check-migrations.sh` và **dừng nếu còn SQL chưa áp** (script không tự chạy SQL) → `docker compose -f docker/self-hosted/docker-compose.self-hosted.yml --env-file … up -d --build` → kiểm health/widget/console/boot log.

Cache nginx: `/widget/embed.js` và `index.html` không cache; `/widget/v1/embed.js` 5 phút; `/widget/assets/` 1 năm (tên file có hash). Không có header chặn frame → storefront nhúng được.

> Truy cập server: `secrets/` (gitignored, không có trong bản clone này). Checklist IVY: [deploy/profiles/SharpTalk-USA-IVY/CHECKLIST.md](../deploy/profiles/SharpTalk-USA-IVY/CHECKLIST.md) (các ô host/domain còn chưa tick — cần cập nhật, xem BUG-005).

---

## 7. Môi trường local

| Thành phần | Cổng | Ghi chú |
|---|---|---|
| MySQL / Redis / RabbitMQ (+UI) / Qdrant | 3316 / 6389 / 5682 (15682) / 6343 | `npm run db:up` (`docker/docker-compose.dev.yml`) |
| API | 3000 | `npm run dev` (watch) — với E2E nên chạy bản build: `npm run build -w @sharptalk/api && node apps/api/dist/main.js` (BUG-002) |
| Console | 5173 | |
| Widget | 5174 | **cần** `apps/widget/.env` (`VITE_API_BASE_URL=http://localhost:3000/api/v1`) — BUG-001 |
| PWA | 5175 | |

Mở widget ở local: `http://localhost:5174/?shop=ivyusa.myshopify.com`. Tham số hữu ích: `embed=1` (chỉ widget), `compact=1` (cỡ điện thoại), `mode=app` (toàn màn hình), `reopen=chat|notifications|orders`, `locale=ko&host_locale=1`. Trang thử trong `apps/widget/public/`: `embed-test.html`, `trigger-test.html` (chuông kiểu ivyusa), `webview-test.html`.

---

## 8. Kiến trúc kiểm thử E2E (`e2e/`)

```
e2e/
├─ package.json            # độc lập — KHÔNG nằm trong npm workspaces, không đụng package-lock gốc
├─ playwright.config.ts    # projects: desktop (1280×900) · mobile (Pixel 7, chỉ @responsive); target local|prod
├─ global-setup.ts         # kiểm /health + trang widget trước khi chạy, báo lỗi dễ hiểu
├─ fixtures/
│  ├─ ivy-data.ts          # dữ liệu mẫu lấy đúng từ Figma (IVY-39891, Kiho, Rose Hip…)
│  ├─ mock-api.ts          # page.route: vá session/ensure + mock notifications/orders/tracking…
│  └─ widget.ts            # Page Object + test fixture `widget`
└─ tests/                  # 1 file / nhóm task, tiêu đề test = mã TC trong TEST-CASES.md
```

**Hai lớp test:**
1. **Design/UI (mock API)** — dữ liệu Figma cố định, không phụ thuộc seed hay định danh Shopify. Chỉ vá các field cần của `session/ensure` (`authenticated`, `customerName`, `widgetTabs`) và mock các endpoint cần khách đã nhận diện. Kiểm cả request gửi đi (ví dụ `DELETE /notifications` mang đúng `ids`).
2. **Integration (API thật)** — chạy với stack local đã seed: consent, kịch bản chat, đổi ngôn ngữ, guest gate, settings. Đánh dấu `@integration`.

Tag: `@T<nn>` (task), `@smoke`, `@design`, `@integration`, `@i18n`, `@a11y`, `@responsive`. Chạy theo task: `npx playwright test --grep @T03`.

---

## 9. Nguyên tắc khi sửa code (tóm tắt từ CLAUDE.md + đặc thù IVY)

1. **Cấu hình tenant trước, code sau.** Tab, copy, theme, scenario button đều cấu hình được. Chỉ sửa code khi cấu hình không đáp ứng được.
2. **Đa tenant an toàn.** Không xoá hành vi mà tenant khác đang dùng. Thay đổi riêng cho IVY phải có điều kiện theo cấu hình.
3. **i18n:** không hard-code chuỗi; thêm key cho cả 6 locale; `npm run i18n:check`.
4. **Moderation:** mọi output AI/agent đều đi qua `ModerationService.moderate()`.
5. **Phản hồi UX:** mọi thao tác lưu/xoá đều có toast thành công/lỗi.
6. **Radius:** dùng `rounded-st-*`; `npm run radius:check`.
7. **Schema:** đổi entity → SQL trong `sql/` + `## Migration` trong PR, **áp SQL trước khi deploy code**. Sau khi đổi entity phải boot thật (`Nest application successfully started`), vì union type thiếu `type` sẽ crash lúc boot mà `tsc` không bắt được.
8. **UI thay đổi → PLN có ASCII wireframe → chờ duyệt → implement** (CLAUDE.md §7).

---

## 10. Công cụ cho AI agent

- **Context7 MCP** (`.mcp.json`, server `context7` → `https://mcp.context7.com/mcp`): dùng để tra tài liệu **đúng phiên bản** trước khi viết code: NestJS 11, TypeORM 0.3, React 18, Vite 5, Tailwind 3, TanStack Query 5, i18next 23, Zustand 4, Playwright 1.65, Shopify (App Proxy, webhooks, theme app extensions). Cách dùng: `resolve-library-id` → `get-library-docs` (hoặc viết "use context7" trong prompt).
- **Figma MCP:** file `fviVlvtkuHYU0Agre1daTr`, node id ở [SPEC.md §6](SPEC.md). Gói Starter giới hạn lượt gọi, nên gọi theo lô và dùng lại node id đã ghi.
- Skill dự án: `.claude/skills/sharptalk-dev` (quy ước), `.claude/skills/pre-deploy-check` (migration).
