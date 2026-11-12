# IVY USA · TalkTalk Widget — TASKS

> Danh sách việc để đưa widget về đúng thiết kế Figma. Đặc tả: [SPEC.md](SPEC.md) · kiến trúc: [ARCHITECTURE.md](ARCHITECTURE.md) · ca kiểm thử: [TEST-CASES.md](TEST-CASES.md) · lỗi: [BUGS.md](BUGS.md).
> Làm **lần lượt từng task theo thứ tự ở §1**. Mỗi task chỉ được coi là xong khi **toàn bộ TC của nó xanh** trên Playwright, kèm smoke `@T00`.

## 0. Quy trình cho mỗi task

1. **Đọc** mục SCR/BR/G tương ứng trong SPEC và các TC của task trong TEST-CASES.md. Tra tài liệu thư viện đúng phiên bản qua **Context7**.
2. **PLN:** `docs/plan/PLN-{YYMMDD}-IVY-T{nn}-{Topic}.md` gồm kế hoạch, side-impact (đa tenant!), **ASCII wireframe nếu đổi UI**, và mục `## Migration` nếu đụng `sql/` hoặc `*.entity.ts`. → **Dừng, chờ người dùng duyệt** (CLAUDE.md §7).
3. **Implement** theo quy ước repo: i18n đủ 6 locale, radius token, toast phản hồi, moderation, DTO snake/camel.
4. **Tự kiểm:** `npm run typecheck` · `npm test` · `npm run i18n:check` · `npm run radius:check`. Nếu đổi entity thì boot API thật (`Nest application successfully started`).
5. **E2E:** `cd e2e && npm run test:task -- @T{nn}` → xanh; sau đó `npm run test:smoke` → xanh. Nếu task có `@responsive` thì chạy thêm `--project=mobile`.
6. **Ghi lại:** cập nhật trạng thái ở bảng §1 + kết quả TC trong TEST-CASES.md; lỗi phát sinh ghi vào BUGS.md; viết RPT `docs/implementation/RPT-{YYMMDD}-IVY-T{nn}-{Topic}.md`.
   **Mở cổng CI:** khi toàn bộ TC của task đã xanh, thêm `|@T{nn}` vào script `test:ci` trong `e2e/package.json` trong cùng commit.
7. **Commit & push** lên `deploy/talk-ivyusa` (**không bao giờ dùng `main`**). Workflow *IVY CI/CD* sẽ chạy verify và e2e gate. Khi xanh, server **tự deploy production**, không có bước duyệt ([GUIDE-261110-IVY-CICD](../docs/guide/GUIDE-261110-IVY-CICD.md)).
   - Push = deploy, nên chỉ push khi task đã xong và đã kiểm.
   - Nếu có SQL thì phải áp lên production **trước khi push**.

Trạng thái: ⬜ Todo · 🟦 In progress · 🟨 Chờ duyệt PLN · ✅ Done · ⛔ Blocked

---

## 1. Bảng tổng

| Thứ tự | ID | Task | Loại | Ưu tiên | Phụ thuộc | Trạng thái | TC |
|---|---|---|---|---|---|---|---|
| 0 | T00 | Môi trường, Context7, Playwright, tài liệu | Setup | P0 | — | ✅ (trừ T00-b, T00-c) | TC-00-01..04 |
| 1 | T01 | Shell panel, header "Hi, {firstName}", 2 tab + badge | CFG · UI | P0 | T00 | ✅ code · ⏳ cấu hình prod | TC-01-01..08 |
| 2 | T02 | Notifications — chip Order/Delivery/Promo/Review, dòng, nhóm ngày, thời gian, đã đọc | UI · I18N · API | P0 | T01 | ✅ code · ⏳ cần tab Orders tắt trên prod (T01) | TC-02-01..06 |
| 3 | T03 | Delivery — thẻ + stepper 4 bước + Track Order | I18N · UI | P0 | T02 | ✅ | TC-03-01..05 |
| 4 | T07 | Chọn & xoá thông báo | UI · I18N · API | P1 | T02 | ✅ | TC-07-01..07 |
| 5 | T04 | Order Detail (+ địa chỉ, điện thoại) | API · UI | P1 | T02 | ✅ code · ⏳ quyền PCD Address/Phone cho app Shopify | TC-04-01..07 |
| 6 | T05 | Promo — coupon/sự kiện, mã coupon, link | UI · API · console | P1 | T02 | ✅ | TC-05-01..07 |
| 7 | T06 | Review — copy + toast lỗi lưu review | UI · I18N | P2 | T02 | ✅ | TC-06-01..05 |
| 8 | T08 | Chat home — lời chào, 7 quick-reply có emoji, composer | UI · API · CFG | P0 | T01 | 🟨 chờ duyệt [PLN](../docs/plan/PLN-261112-IVY-T08-Chat-Home.md) | TC-08-01..05 |
| 9 | T09 | Kịch bản My Orders + chip "Start over" | UI · I18N | P1 | T08, T04 | ⬜ | TC-09-01..04 |
| 10 | T10 | Kịch bản Product Help — danh mục, sản phẩm phổ biến | UI | P2 | T08 | ⬜ | TC-10-01..05 |
| 11 | T11 | Contact Support + form liên hệ → inquiry | API · DB · UI | P1 | T08 | ⬜ | TC-11-01..04 |
| 12 | T12 | Affiliate + End → CSAT → kết thúc | UI · I18N · CFG | P1 | T08, T09 | ⬜ | TC-12-01..04 |
| 13 | T13 | Settings / Privacy | UI | P2 | T01 | ⬜ (TC đã xanh 4/4, chỉ còn rà visual/copy) | TC-13-01..04 |
| 14 | T14 | i18n đủ 6 ngôn ngữ + copy KO theo thiết kế | I18N | P1 | T01–T13 | ⬜ | TC-14-01..03 |
| 15 | T15 | Responsive (390px) & a11y | UI | P2 | T01–T13 | ⬜ | TC-15-01..04 |
| 16 | T16 | Deploy talk.ivyusa.com + smoke production | Ops | P0 | mỗi đợt | ⬜ | TC-16-01..03 |

> Baseline E2E trên commit `583ce121` + tài liệu này: xem [TEST-CASES.md §0](TEST-CASES.md).

---

## 2. Chi tiết

### T00 · Môi trường & nền tảng — ✅
- [x] Clone nhánh `deploy/talk-ivyusa`, `npm install`, `db:up`, build `packages/*`, `db:seed`, `npm run dev`. Tất cả cổng đều 200.
- [x] `apps/widget/.env` từ `.env.example` (BUG-001).
- [x] Context7 MCP: `.mcp.json` (project) + `.claude/settings.local.json` `enabledMcpjsonServers` (máy này).
- [x] Playwright: package `e2e/` độc lập, `@playwright/test` 1.65 + Chromium; smoke 4/4 xanh.
- [x] `ivy-docs/` SPEC · TASKS · ARCHITECTURE · TEST-CASES · BUGS.
- [ ] **T00-b** Khi quota Figma reset: `get_variable_defs` / `get_design_context` cho node `992:526`, `992:935`, `1008:2291`, `1004:1367` → cập nhật token SPEC §4 (màu/khoảng cách chính xác).
- [ ] **T00-c** Đọc cấu hình tenant `ivyusa` trên production (widget_tabs, theme, copy, scenario) để biết điểm xuất phát thật. Cần quyền truy cập server/console production.
- [x] **T00-d** CI/CD ([PLN-261110-IVY-CICD](../docs/plan/PLN-261110-IVY-CICD.md)): workflow `IVY CI/CD` (verify + e2e gate `test:ci` + deploy-gate), script server `scripts/ivy-autodeploy.sh` + installer.
- [ ] **T00-e** Thiết lập một lần ([GUIDE §2](../docs/guide/GUIDE-261110-IVY-CICD.md)):
  - (1) ~~Reviewer cho environment `talk-ivyusa-production`~~: **bỏ**. Ngày 2026-11-10 quyết định không cần duyệt, push xanh là tự deploy.
  - (2) Token cho server (tuỳ chọn).
  - (3) ✅ 2026-11-10: đã cài **cron** trên `talkaibotprd01` (`appops`, `/docker/apps/talktalk`, không có sudo nên dùng `--cron`). Từ đây, **push lên `deploy/talk-ivyusa` mà CI xanh sẽ tự deploy production**.

### T01 · Shell, header & tab — ✅ code (2026-11-10) · ⏳ cấu hình production · [PLN](../docs/plan/PLN-261110-IVY-T01-Shell-Header-Tabs.md) · [RPT](../docs/implementation/RPT-261110-IVY-T01-Shell-Header-Tabs.md)
- **Đã làm:**
  - Placeholder `{firstName}` cho *Signed-in greeting*.
  - Seed IVY preset cho DB mới.
  - Hint console ở 6 ngôn ngữ.
  - TC-01-08 ×11 (mọi kích thước màn hình qua `embed.js`).
  - Thêm `@T01` vào `test:ci`.
- **Còn lại:** chủ dự án cấu hình console production theo PLN §5 **sau khi code đã deploy**.
- Quyết định của chủ dự án (2026-11-10): chiều cao panel **600**; guest giữ **tên shop**.
- **Figma:** `992:526`, `1006:7825`, mockup desktop `1006:2431`. **Gap:** G-01, G-02, G-03.
- **Việc cần làm:**
  1. Cấu hình tenant ivyusa `widget_tabs = ["notifications","chat"]` (console → Settings › Widget, hoặc SQL seed cho local). Ghi lại thao tác cho production.
  2. Theme tenant: panel width **380**, radius `lg`.
  3. `WidgetPanel.tsx`: lời chào dùng **first name** (tách từ `customerName`, hoặc thêm `customerFirstName` vào `SessionResponse`). Guest theo Q-01.
  4. `Esc` đóng panel (nếu chưa có); mở lại giữ tab cuối.
- **AC:** đúng 2 tab; badge "{n} unread", 0 thì ẩn; "Hi, Kiho"; rộng 380px ±2; Close/Esc đóng; Settings mở và Back quay về.
- **TC:** TC-01-01..07.

### T02 · Notifications — Order — ✅ code (2026-11-11) · [PLN](../docs/plan/PLN-261110-IVY-T02-Notifications-Order.md) · [RPT](../docs/implementation/RPT-261111-IVY-T02-Notifications-Order.md)
- **Figma:** Master `992:526`, `1006:7825`, `1006:2930`. **Gap:** G-04, G-05, G-06. **BR:** 01–08.
- **Quyết định của chủ dự án (2026-11-11):** duyệt cả backend B1 + B2; ngày theo **múi giờ máy khách**; "{n} days ago" tới 6 ngày rồi "Nov 3".
- **Đã làm:**
  - Chip **Order · Delivery · Promo · Review** (layout 1 tab danh sách), `aria-pressed`. Layout 3 tab giữ nguyên.
  - Dòng thông báo theo thiết kế: mã đơn, pill theo **mã** trạng thái (6 ngôn ngữ, màu SPEC §4), "SP + 2 items", giờ BR-05. Nhóm Today's / Yesterday's. Chạm → đã đọc + mở Order Detail.
  - API B1: thông báo giao hàng gắn `refType 'order'` + `refId`.
  - API B2: tự tạo thông báo "Confirmed" cho đơn ≤ 30 ngày (tối đa 10), chỉ trong widget, không push.
  - Sửa BUG-011 (pill), BUG-015 (feed lặp mỗi sự kiện ×5 theo kênh), BUG-016 (fixture e2e hỏng lúc 00–02h New York).
  - Nút Select nằm ngoài vùng cuộn chip, luôn hiện (trước đây bị đẩy khỏi khung ở EN/VI).
  - Thêm `@T02` vào `test:ci`.
- **Còn lại:** chip mới và B2 chỉ chạy khi tenant **tắt tab Orders** (bước cấu hình console của T01 trên production).
- **Việc cần làm (gốc):**
  1. `tab-chips.ts`: bar gộp → **Order · Delivery · Promo · Review**. Bỏ "All" (Q-10); nhãn mới cho 6 locale (KO: 주문 · 배송 · 프로모 · 리뷰). Chip có `aria-pressed`. Phải giữ được hành vi cho tenant khác (thay đổi có điều kiện hoặc theo cấu hình).
  2. Dòng thông báo: icon · **mã đơn** · pill trạng thái (map theo **mã** trạng thái → i18n + màu, không đoán theo text) · tóm tắt "{item} + {n} items" · thời gian BR-05 (`format.ts`: "Just now", "{n}mins ago", "{n}h ago", "Yesterday", …).
  3. Nhóm "Today's" / "Yesterday's" theo ~~`America/New_York`~~ **múi giờ máy khách** (chốt 2026-11-11).
  4. Chạm dòng → `POST /notifications/:id/read` + mở Order Detail (refType `order`) hoặc vị trí giao hàng (BR-07).
  5. Thêm test-id theo SPEC §9: `notif-item` (+`data-id`, `data-unread`, `data-category`), `notif-group`, `notif-time`, `status-pill` (+`data-status`).
- **TC:** TC-02-01..06 — **6/6** ✅.

### T03 · Delivery — ✅ (2026-11-11) · [PLN](../docs/plan/PLN-261111-IVY-T03-Delivery.md) · [RPT](../docs/implementation/RPT-261111-IVY-T03-Delivery.md)
- **Figma:** `992:935`, `1007:1069`. **Gap:** G-07. **BR:** 06.
- **Quyết định của chủ dự án (2026-11-11):** bước 2 ở ES / VI / JA / ZH dịch theo "Processing" của thiết kế EN; dải ngày trên thẻ tính theo **ngày đặt đơn**.
- **Đã làm:**
  - Nhãn bước **Preparing · Processing · In Transit · Delivered** ở server (`DELIVERY_STEPS_BY_LANG`) và bản dự phòng của widget, 6 ngôn ngữ. KO giữ 발송준비 · 배송시작 · 배송중 · 배송완료.
  - Thẻ theo Figma `1007:1069`:
    - stepper vòng 40px chỉ icon, `delivery-step` + `data-state`;
    - pill theo mã (BUG-011);
    - "SP + 2 more items";
    - "Your order is on the way!" (cam) / "Your order is Delivered!" (đen đậm);
    - nút **Track Order**;
    - dải ngày Today's / Yesterday's.
  - Sửa 2 test e2e chập chờn: BUG-017 (TC-03-05) và BUG-018 (TC-01-06 trong cổng CI).
  - Thêm `@T03` vào `test:ci`.
- **Có hiệu lực ngay**, không cần chờ cấu hình T01. Khi chưa tắt tab Orders, thay đổi hiện ở tab Orders → chip Delivery.
- **TC:** TC-03-01..05 — **5/5** ✅.

### T07 · Chọn & xoá — ✅ (2026-11-12) · [PLN](../docs/plan/PLN-261111-IVY-T07-Select-Delete.md) · [RPT](../docs/implementation/RPT-261112-IVY-T07-Select-Delete.md)
- **Figma:** `992:526`, `1006:2814`, `1006:2698`. **Gap:** G-11. **BR:** 09.
- **Quyết định của chủ dự án (2026-11-12):** "Delete All" chỉ xoá **chip đang xem**; vuốt trái để xoá chưa làm, để T15 cân nhắc.
- **Đã làm:**
  - Copy "Delete Selected Notifications" / "Delete All Notifications" (KO 선택 알림 삭제 / 전체 알림 삭제), 6 ngôn ngữ, bỏ số đếm trong nút.
  - Xác nhận "Delete All" ngay trong panel (`role="alertdialog"`), thay `window.confirm`. Focus ở Cancel; Esc chỉ đóng hộp xác nhận.
  - Toast dùng chung cho widget (`lib/toast.ts` + `ui/ToastHost.tsx`): thành công tự tắt ~3 giây, lỗi đóng tay. T05/T06 dùng lại.
  - Ô chọn: tròn ✓ xám / xanh, tên theo dòng ("Select IVY-39891").
  - API `DELETE /notifications`: `all` nhận thêm `categories` / `scope`, chỉ xoá dòng `in_app`. Client cũ gửi `{ all: true }` vẫn chạy.
  - Đổi chip thì thoát chế độ chọn, để không xoá nhầm dòng của chip khác đang bị ẩn.
  - Sửa 2 chỗ test e2e đọc DOM không chờ (BUG-019). Thêm `@T07` vào `test:ci`.
- **Có hiệu lực ngay**, không cần chờ cấu hình T01. Khi chưa tắt tab Orders, chế độ chọn ở tab Notifications (chip All / Event).
- **TC:** TC-07-01..07 — **7/7** ✅ (01..03 theo thiết kế, 04..07 thêm cho phạm vi chip, Esc, tên ô chọn, lỗi xoá).

### T04 · Order Detail — ✅ code (2026-11-12) · ⏳ quyền PCD · [PLN](../docs/plan/PLN-261112-IVY-T04-Order-Detail.md) · [RPT](../docs/implementation/RPT-261112-IVY-T04-Order-Detail.md)
- **Figma:** `1008:3254` (EN), `1006:4282` (KO), đối chiếu qua ảnh chủ dự án gửi ngày 2026-11-12. `1154:116`, `1007:250`. **Gap:** G-08.
- **Quyết định của chủ dự án (2026-11-12):**
  - Địa chỉ đọc **trực tiếp từ Shopify** khi mở Order Detail, không lưu DB, nên không có migration.
  - Quyền PCD của app production chưa rõ: khối địa chỉ tự ẩn cho tới khi có quyền.
  - Chữ KO theo ảnh Figma.
- **Lưu ý:** địa chỉ và điện thoại là dữ liệu được bảo vệ của Shopify (PCD). App phải được cấp quyền **Address** và **Phone** thì mới đọc được (REQ-260920 G8). Việc cấp quyền do chủ dự án làm trên dashboard Shopify; bật xong không cần deploy lại.
- **Đã làm:**
  - API `GET /orders/:id/addresses` (`OrderAddressService`): kiểm tra sở hữu, chỉ đơn Shopify, chờ tối đa 4 giây. Không có quyền / lỗi → `available: false`. Không lưu, không log địa chỉ.
  - Màn Order Detail theo Figma:
    - tiêu đề "Order Detail";
    - **Information** | **Billing address** ("-" khi đơn không có) 2 cột, **Shipping address** bên dưới, ZIP một dòng riêng, tên quốc gia theo ngôn ngữ;
    - hàng **Contact**;
    - mã đơn "IVY-39891" không thêm "#";
    - "Qty" chỉ khi > 1.
  - Pill trạng thái dùng `StatusPill` như dòng thông báo ("Confirmed", không còn "Paid"): hết BUG-011 trên màn này.
  - Sửa test khớp chữ ở tab bị ẩn (BUG-020). Thêm `@T04` vào `test:ci`.
- **TC:** TC-04-01..07 — **7/7** ✅ (06, 07 thêm: không có quyền → ẩn khối địa chỉ; không có billing → "-").

### T05 · Promo — ✅ (2026-11-12) · [PLN](../docs/plan/PLN-261112-IVY-T05-Promo.md) · [RPT](../docs/implementation/RPT-261112-IVY-T05-Promo.md)
- **Figma:** `1006:5284`, `1007:1978`, icon `993:1254` (chưa mở được, dựa vào SPEC). **Gap:** G-09. **Q-16:** mã nhập trong console Campaigns.
- **Quyết định của chủ dự án (2026-11-12):**
  - Loại và mã coupon **lưu trong campaign**, không có migration. Hai trường này **khoá sau khi gửi**.
  - Một campaign có một mã dùng chung. Coupon riêng cho từng khách tách thành task sau.
- **Đã làm:**
  - Console → Campaigns: ô **Type** (Event / Coupon) và **Coupon code** (1–32 ký tự chữ / số / `-` / `_`). Hai ô này mờ khi campaign đã gửi. Lỗi E5158 / E5159 hiện theo ngôn ngữ console.
  - API:
    - kiểm tra loại và mã khi tạo / sửa / gửi;
    - khoá theo `sentAt`;
    - mã coupon đi qua moderation; bị chặn hoặc bị che → không gửi, có audit;
    - thông báo ghi `ref_type 'campaign'` + id campaign;
    - feed trả `kind` + `couponCode`, tra theo lô và chỉ trong cùng tenant (`NotificationPromoService`).
  - Widget:
    - coupon có icon quà nền navy `#1A2E6B`, sự kiện có icon lấp lánh nền magenta `#E91E8C`;
    - coupon có ô mã + **Copy code** (toast);
    - bấm thẻ có link `https` thì mở tab mới;
    - thông báo cũ chưa có loại: đoán theo link như trước;
    - khi đang chọn (T07): không có Copy, không mở link.
  - Sửa TC-05-04 đọc URL tab mới quá sớm (cùng kiểu BUG-017). Thêm `@T05` vào `test:ci`.
- **Ngoài phạm vi:** coupon riêng từng khách (cần quyền Shopify `write_discounts`); icon theo nhóm khách (subscription / IVY member / Beautizen / Round).
- **TC:** TC-05-01..07 — **7/7** ✅ (05..07 thêm: thông báo cũ, copy lỗi, chế độ chọn).

### T06 · Review — ✅ (2026-11-12) · [PLN](../docs/plan/PLN-261112-IVY-T06-Review.md) · [RPT](../docs/implementation/RPT-261112-IVY-T06-Review.md)
- **Figma:** `992:192`, `1008:2191` (chưa mở được, dựa vào SPEC). **Gap:** G-10. **Bug:** BUG-009 (đã sửa).
- **Quyết định của chủ dự án (2026-11-12):** giữ cách mở review (Q-06): có link sản phẩm → trang ivyusa.com; không có → form trong widget.
- **Đã làm:**
  - Dòng review theo SCR-IVY-08: pill tím **Review** (`StatusPill`), "title · price", ⭐ **Write Review** chữ cam, thời gian BR-05 (dùng chung với feed).
    - Chữ cam là `#C94F00` (4.56:1); cam thiết kế `#FF6900` chỉ đạt 2.89:1, vẫn dùng cho ngôi sao.
    - Bỏ icon ↗.
  - Lưu review lỗi → toast lỗi, form giữ số sao và nội dung. Bị bộ lọc nội dung chặn (E4002) → câu chỉ rõ phải bỏ gì. Thành công → màn "Thanks".
  - `ToastHost` gắn ở màn review riêng và trong Order Detail.
  - EN "Write Review" dùng chung ở chip Review, Order Detail và dòng thông báo.
  - Sửa TC-06-02 (đọc URL tab mới quá sớm, BUG-017) và TC-06-03 (trước luôn bị skip). Thêm `@T06` vào `test:ci`.
- **TC:** TC-06-01..05 — **5/5** ✅ (04: gửi lại sau lỗi thì lưu được; 05: bị chặn E4002).

### T08 · Chat home — 🟨 chờ duyệt PLN · [PLN](../docs/plan/PLN-261112-IVY-T08-Chat-Home.md)
- **Figma:** `1008:2291`, `993:1993`. **Gap:** G-12, G-13, G-14.
- **Hợp đồng API đề xuất** (`ScenarioButtonResponse`): `emoji?: string` (console cho nhập, lưu cùng scenario config).
- **Ghi chú từ T01:** bong bóng chào trong Chat vẫn ghi họ tên đầy đủ ("Hi Kiho Lee! Welcome back…", lấy từ `welcomeGreeting` với `{name}`). Nếu thiết kế cần first name, mở rộng `{firstName}` sang `welcomeGreeting` (`lib/copy.ts`) giống header.
- **Việc cần làm:**
  1. Kiểu hiển thị **chip wrap** (nền trắng, viền 1px, bo tròn, emoji đầu) cho quick-reply (`ScenarioMenu.tsx`).
  2. Cấu hình tenant ivyusa: 7 nút theo SPEC SCR-IVY-10 (EN theo Q-07) + lời chào "Hi! This is IVY Beauty. How can I help you?" (KO theo thiết kế).
  3. Composer placeholder "Ask Anything" (copy tenant hoặc i18n); nút gửi disabled khi rỗng.
  4. Thanh công bố AI: giữ nhưng thu gọn (Q-13).
  5. Test-id `quick-replies`.
- **TC:** TC-08-01..05.

### T09 · My Orders — ⬜
- **Figma:** `1006:5530`. **Gap:** G-15. **BR:** 12.
- **Việc cần làm:** `InlineOrderCard` bấm được → Order Detail; follow-up chip **Track delivery · Cancel order · Start over** luôn hiện; chip **Start over** dùng chung cho mọi kịch bản (quay lại menu quick-reply).
- **TC:** TC-09-01..04.

### T10 · Product Help — ⬜
- **Figma:** `1006:5588`, `993:2207`, `1008:2613`, `1008:2722`. **Gap:** G-16. **BR:** 17.
- **Việc cần làm:** menu con (Usage · Ingredients · Exchange / Return · Restock alert · **Start over**); nhánh danh mục từ `GET /products/categories` → chip → "Popular products" (`/products/recommendations` hoặc `/products?category=`) → thẻ sản phẩm; Exchange / Return → câu chính sách 7 ngày (copy tenant/KB). Q-04: ẩn 2 chip "??".
- **TC:** TC-10-01..05.

### T11 · Contact Support & form — ⬜ (có thể có migration)
- **Figma:** `1006:5650`, `1006:6529`, `1006:6597`. **Gap:** G-17, G-18. **BR:** 14, 15.
- **Hợp đồng API đề xuất:** `POST /inquiries` nhận thêm `{ name, email, message }` (snake_case DTO, validate email); console hiển thị được inquiry.
- **Việc cần làm:** kênh liên hệ lấy từ cấu hình tenant (IVY: email; live chat theo Q-15), bỏ hard-code 1588-0000; thẻ "Email inquiry" mở form (Name / Email điền sẵn / Message, nút **Send Message**); gửi xong hiện thẻ "YOUR INQUIRY" + bubble thành công; validate và hiện lỗi khi thiếu/sai.
- **TC:** TC-11-01..04.

### T12 · Affiliate + CSAT — ⬜
- **Figma:** `1006:5990…6290`. **Gap:** G-19, G-20. **BR:** 12, 13.
- **Việc cần làm:** 3 bước có mô tả (copy tenant); chip **Apply now · Learn more · Start over · End**; End → `POST /chat/end` → thẻ CSAT **4 mức** (Q-12: map 1·3·4·5) + **Skip**; đánh giá → `POST /chat/csat` → "Thank you for your feedback" → "The chat has ended" (thứ tự này). Test-id `csat-card`.
- **TC:** TC-12-01..04.

### T13 · Settings / Privacy — ⬜
- **Figma:** `1004:1367`, `1004:1447`. **Gap:** G-21.
- **Việc cần làm:** đối chiếu copy/khoảng cách; xác nhận ý nghĩa toggle marketing; header biến thể (Q-09).
- **TC:** TC-13-01..04.

### T14 · i18n — ⬜
- **Việc cần làm:** mọi key mới đủ 6 locale; copy KO bám thiết kế (sửa lỗi chính tả ở SPEC §11, ví dụ 혜택); `npm run i18n:check` xanh.
- **TC:** TC-14-01..03.

### T15 · Responsive & a11y — ⬜
- **Việc cần làm:** ≤ 480px → panel toàn màn hình; focus vào panel khi mở; `Esc` đóng; `aria-pressed` cho chip; không lỗi console.
- **TC:** TC-15-01..04 (TC-15-01 chạy ở project `mobile`).

### T16 · Deploy & smoke production — ⬜
- **Điều kiện:** máy chạy test phải nằm trong allowlist của ELB (BUG-004); người có quyền server (`secrets/`).
- **Việc cần làm:**
  1. Áp SQL (nếu có).
  2. Deploy:
     - Khi T00-e xong: push → CI xanh → timer trên `talkaibotprd01` tự deploy.
     - Trước đó: `git pull` + `bash scripts/deploy-self-hosted.sh` bằng tay.
  3. Xác minh boot log, container và health.
  4. Chạy `cd e2e && npm run test:prod`.
  5. Ghi RPT kèm SHA và trạng thái từng môi trường. Cập nhật `deploy/profiles/SharpTalk-USA-IVY/CHECKLIST.md` và `/SPEC.md §12` (BUG-005).
- **TC:** TC-16-01..03.
