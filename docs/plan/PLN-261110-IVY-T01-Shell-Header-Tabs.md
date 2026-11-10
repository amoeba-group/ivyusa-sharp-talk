# PLN-261110 — IVY T01 · Shell panel, header "Hi, {firstName}", 2 tab

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt** 2026-11-10. (1) OK. (2) Chiều cao **600** như đề xuất, phải hiển thị đúng trên **mọi PC, tablet và điện thoại** → thêm TC-01-08 ×11 kích thước màn hình qua `embed.js`. (3) Guest **giữ tên shop**. Kết quả: [RPT-261110-IVY-T01](../implementation/RPT-261110-IVY-T01-Shell-Header-Tabs.md) |
| Task | [ivy-docs/TASKS.md T01](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-01..03 · Gap G-01, G-02, G-03 · Q-01 |
| Figma | `992:526` (Master), `1006:7825` (header EN), `1006:2431` (mockup desktop) |
| TC | TC-01-01..07 ([e2e/tests/01-shell-header.spec.ts](../../e2e/tests/01-shell-header.spec.ts)). Baseline 4/7 xanh; đỏ: 01-01, 01-02, 01-06 |
| Migration | **Không có** (không đổi entity, không có SQL) |
| Deploy | Push lên `deploy/talk-ivyusa` → CI xanh → server tự deploy. Đây là **lần đầu cron build thật**, xem §6 |

## 1. Hiện trạng → mục tiêu

| # | Thiết kế | Code hiện tại | Kết luận |
|---|---|---|---|
| G-01 | 2 tab **Notifications · Chat** | Mặc định 3 tab (`WIDGET_TABS_DEFAULT`). Tenant chọn tab qua cột `tenants.widget_tabs`, trong console *Settings › Widget › Show these tabs* | **Cấu hình**, không sửa code |
| G-03 | Panel **380px**, bo ~16px | Mặc định 404×600, bo 12px. Tenant chỉnh qua `widget_theme.design.panel.width` (360–480) và `design.radius` (`lg` = 16px) trong console *Corners / Panel size* | **Cấu hình**, không sửa code |
| G-02 | **"Hi, Kiho"** (first name) | `customerName` = họ tên đầy đủ: `[firstName, lastName].join(' ')` khi đọc từ Shopify, hoặc tên do host gửi. Header = copy tenant `headerGreeting` với `{name}`, hoặc mặc định `Hi, {{name}}` → ra **"Hi, Kiho Lee"** | **Sửa code** (nhỏ): thêm placeholder `{firstName}` |
| SCR-01 | ✕ và Esc đóng panel; mở lại giữ tab cuối | Đã có (TC-01-05 xanh) | Giữ nguyên |
| SCR-02 | ⚙ mở Settings, Back quay về | Đã có (TC-01-07 xanh) | Giữ nguyên |
| SCR-03 | Badge "{n} unread", bằng 0 thì ẩn | Đã có (TC-01-03/04 xanh) | Giữ nguyên |
| Q-01 | Thiết kế không vẽ trạng thái guest | Guest thấy tiêu đề tenant (`headerTitle` → `displayName` → "Notification Center") | Giữ nguyên. Nếu bạn muốn hiện "Hi there" thì đặt copy *Header title* (cấu hình, xem §5) |

## 2. Quyết định thiết kế

**D1 — Tab, chiều rộng, bo góc là cấu hình của tenant ivyusa, không phải code.**
- Không đổi mặc định của hệ thống, vì code này dùng chung cho nhiều tenant.
- Local và CI: seed cấu hình này cho tenant `ivyusa`, **chỉ khi tạo mới tenant**. Seed chạy lúc boot (`SEED_ON_BOOT`) trên production sẽ không bao giờ ghi đè cấu hình tenant đang có.
- Production: bạn đặt trong console (§5).

**D2 — "Hi, {firstName}" bằng placeholder mới `{firstName}` trong copy *Signed-in greeting* của tenant.** Mặc định "Hi, {name}" của hệ thống giữ nguyên.
- Lý do không đổi mặc định cho mọi tenant: không phải văn hoá nào cũng gọi bằng từ đầu tiên của tên. Ví dụ tên Việt "Nguyễn Văn A" thì từ đầu là họ, mà có tenant tiếng Việt.
- **first name = từ đầu tiên** của `customerName` sau khi bỏ khoảng trắng thừa. Shopify lưu `firstName + " " + lastName`, nên từ đầu chính là first name.
- Hạn chế: first name nhiều từ ("Mary Ann Lee") sẽ chỉ còn "Mary". Có thể chấp nhận, và đã ghi vào hint của console.
- Không đổi API, `SessionResponse` hay DB.

**D3 — Không đụng tới cơ chế Esc/Close/Settings/badge**, vì TC đã xanh.

## 3. Wireframe (desktop, khách đã nhận diện)

```
                                   ┌──────────────── 380px ────────────────┐
                                   │ Hi, Kiho                🌐EN  ⚙   ✕  │ ← .st-header-title = "Hi, {firstName}"
                                   ├───────────────────┬───────────────────┤
                                   │ Notifications (4) │      Chat (1)     │ ← đúng 2 tab, badge "{n} unread"
                                   │ ━━━━━━━━━━━━━━━━━ │                   │   (badge ẩn khi bằng 0)
                                   ├───────────────────┴───────────────────┤
                                   │  (nội dung tab — T02…T13)             │
                                   │                                       │
                                   │                                       │   bo góc 16px (radius lg)
                                   └───────────────────────────────────────┘
                                                                     ( ● )  ← launcher
Trước:  "Hi, Kiho Lee" · 3 tab [Notifications][Orders][Chat] · rộng 404px · bo 12px
```

Guest: header vẫn là tiêu đề tenant (không đổi). Mobile ≤ 480px: toàn màn hình như hiện nay.

## 4. Thay đổi code

| File | Thay đổi |
|---|---|
| `apps/widget/src/lib/copy.ts` | `firstNameOf(name)`: từ đầu tiên, null-safe. `greetingFor(template, name)`: thay `{firstName}` rồi `{name}` |
| `apps/widget/src/components/widget/WidgetPanel.tsx` | Tiêu đề dùng `greetingFor(headerGreeting, customerName)`. Nhánh mặc định `t('header.greeting')` giữ nguyên |
| `apps/widget/test/header-greeting.test.mjs` (mới) | Unit test: "Kiho Lee" → "Kiho", có khoảng trắng thừa, tên một từ, tên CJK không có khoảng trắng, chuỗi rỗng; template chỉ có `{name}` → vẫn ra họ tên đầy đủ (không ảnh hưởng tenant khác) |
| `packages/types/src/api/widget.types.ts` | Cập nhật comment của `headerGreeting`: `{name}` và `{firstName}` |
| `apps/web/src/i18n/locales/{en,es,ko,vi,ja,zh}/settings.json` | `headerGreetingHint`: thêm "{firstName} = tên gọi (từ đầu tiên)" ở cả 6 ngôn ngữ |
| `apps/api/src/database/seed.runner.ts` | Khi **tạo mới** tenant ivyusa: `widgetTabs: ['notifications','chat']`, `widgetTheme.design: { radius: 'lg', panel: { width: 380, height: 600 } }`, `widgetCopy.headerGreeting` theo §5 |
| `e2e/package.json` | Khi 7/7 TC-01 xanh: thêm `\|@T01` vào `test:ci` |
| `ivy-docs/TASKS.md`, `TEST-CASES.md`, RPT | Cập nhật trạng thái và kết quả |

Sau khi sửa: `npm run typecheck` · `npm test` · `npm run i18n:check` · `radius:check` (trên Linux) · `cd e2e && npm run test:task -- @T01` + `npm run test:ci`.

## 5. Cấu hình production (bạn làm trong console sau khi deploy)

Console talk.ivyusa.com → đăng nhập Tenant Master ivyusa → **Settings › Widget**:

| Mục | Giá trị | Ghi chú |
|---|---|---|
| Show these tabs | ☑ Notifications · ☐ Orders · ☑ Chat | Lọc đơn hàng tự chuyển sang tab Notifications (hành vi sẵn có) |
| Corners | Large (16px) | |
| Panel size | width **380**, height giữ **600** | Figma cao ~738. Mình đề xuất **giữ 600** vì màn laptop thấp (768px) có thể không đủ chỗ; T15 sẽ rà lại |
| Signed-in greeting | EN `Hi, {firstName}` · ES `Hola, {firstName}` · KO `{firstName}님` · VI `Chào {firstName}` · JA `{firstName}さん` · ZH `{firstName} 您好` | Giống mặc định của từng ngôn ngữ, chỉ đổi họ tên thành first name |
| (Tuỳ chọn, Q-01) Header title (guest) | ví dụ EN `Hi there` | Bỏ trống thì giữ như hiện nay |

⚠️ **Thứ tự:** đặt *Signed-in greeting* **sau khi** code mới đã chạy trên production. Nếu đặt trước, widget cũ sẽ hiện nguyên chữ "Hi, {firstName}". Tab, Corners và Panel size đặt lúc nào cũng được.

Nếu console không vào được từ mạng của bạn: mình sẽ soạn câu `UPDATE tenants … JSON_SET(…)` để chạy qua SSM, kèm bản backup cột trước khi sửa.
⚠️ Khi làm cách này, phải đưa SQL vào bằng file qua `docker exec -i … mysql --default-character-set=utf8mb4 < file.sql`. Gõ thẳng chuỗi qua `docker exec … -e "…"` sẽ làm hỏng tiếng Hàn/Nhật/Trung/Việt thành mojibake, việc này đã xảy ra với DB local khi làm T01.

## 6. Ảnh hưởng phụ và deploy

- **Đa tenant:** không đổi gì nếu tenant không dùng `{firstName}`. Mặc định và placeholder `{name}` giữ nguyên.
- **API, DB, migration:** không có.
- **Console:** chỉ đổi text hint ở 6 ngôn ngữ.
- **Local DB đã có sẵn** (máy dev): seed không ghi đè tenant đã có, nên cần chỉnh tay trong console local. CI luôn dựng DB mới nên tự có cấu hình.
- **Deploy:** đây là commit đầu tiên có thay đổi `apps/`, nên cron trên `talkaibotprd01` sẽ **build lại và khởi động lại web/widget/api** lần đầu, mất vài phút. API có thể gián đoạn vài giây khi container được tạo lại. Lúc đó mình sẽ nhờ bạn chạy `tail -f ~/ivy-autodeploy.log` để cùng theo dõi.

## 7. Xin bạn xác nhận

1. Duyệt PLN này để mình bắt đầu sửa code.
2. Chiều cao panel: giữ **600** (đề xuất) hay đặt theo Figma **738**?
3. Guest (Q-01): giữ tiêu đề tenant (đề xuất) hay đặt "Hi there"?
