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
| 8 | T08 | Chat home — lời chào, 7 quick-reply có emoji, composer | UI · API · CFG | P0 | T01 | ✅ code · ⏳ cấu hình prod ([GUIDE](../docs/guide/GUIDE-261112-IVY-Chat-Home-Config.md)) | TC-08-01..06 |
| 9 | T09 | Kịch bản My Orders + chip "Start over" | UI · I18N | P1 | T08, T04 | ✅ | TC-09-01..07 |
| 10 | T10 | Kịch bản Product Help — danh mục, sản phẩm phổ biến | UI | P2 | T08 | ✅ | TC-10-01..07 |
| 11 | T11 | Contact Support + form liên hệ → inquiry | API · DB · UI | P1 | T08 | ✅ (prod: SQL, email hỗ trợ, SMTP, mail thử — 2026-11-13) | TC-11-01..08 |
| 12 | T12 | Affiliate + End → CSAT → kết thúc | UI · I18N · CFG | P1 | T08, T09 | ✅ code · ⏳ cấu hình prod ([GUIDE](../docs/guide/GUIDE-261113-IVY-Affiliate-Config.md)) | TC-12-01..06 |
| 13 | T13 | Settings / Privacy | UI | P2 | T01 | ✅ | TC-13-01..06 |
| 14 | T14 | i18n đủ 6 ngôn ngữ + copy KO theo thiết kế | I18N | P1 | T01–T13 | ✅ | TC-14-01..07 |
| 15 | T15 | Responsive (390px) & a11y | UI | P2 | T01–T13 | ✅ | TC-15-01..06 |
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
- **Quyết định của chủ dự án (2026-11-12):** "Delete All" chỉ xoá **chip đang xem**; vuốt trái để xoá chưa làm, để T15 cân nhắc. **T15 (2026-11-13, 3a):** vẫn chưa làm.
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

### T08 · Chat home — ✅ code (2026-11-12) · ⏳ cấu hình prod · [PLN](../docs/plan/PLN-261112-IVY-T08-Chat-Home.md) · [RPT](../docs/implementation/RPT-261112-IVY-T08-Chat-Home.md) · [GUIDE cấu hình](../docs/guide/GUIDE-261112-IVY-Chat-Home-Config.md)
- **Figma:** `1008:2291` (đối chiếu qua ảnh chủ dự án gửi), `993:1993`. **Gap:** G-12, G-13, G-14.
- **Quyết định của chủ dự án (2026-11-12):**
  - Placeholder là **trường mới của tenant**; tenant khác giữ "Type a message…".
  - Cấu hình production nhập trong console theo GUIDE (không chạy SQL).
- **Đã làm:**
  - Nút trả lời nhanh có `emoji`: API lưu và trả; console AI Settings có ô Emoji.
    - Sửa luôn **BUG-022**: lưu nút làm mất `message`.
  - Kiểu "card" = chip trắng viền 1px, bo tròn, emoji đầu, wrap; `data-testid="quick-replies"`.
  - Menu chỉ vẽ khi đã biết kiểu nút (**BUG-023**: lần đầu vào, menu hiện kiểu mặc định rồi đổi).
  - `widgetCopy.composerPlaceholder` (6 ngôn ngữ, console → Tenant Settings → Chat input placeholder).
  - Seed: preset IVY (lời chào, placeholder, kiểu card, công bố AI dưới ô nhập, 7 nút + emoji), áp cho DB mới (CI / local).
  - Mock trả nhãn theo ngôn ngữ; TC-08-03 kiểm KO (3 chip / hàng như thiết kế) và EN (chip theo độ dài chữ).
  - Thêm TC-08-06 (không đổi kiểu sau lần vẽ đầu). Thêm `@T08` vào `test:ci`.
- **Việc của chủ dự án:** nhập cấu hình theo [GUIDE-261112-IVY-Chat-Home-Config](../docs/guide/GUIDE-261112-IVY-Chat-Home-Config.md) (khoảng 15 phút).
- **TC:** TC-08-01..06 — **6/6** ✅.

### T09 · My Orders — ✅ (2026-11-12) · [PLN](../docs/plan/PLN-261112-IVY-T09-My-Orders.md) · [RPT](../docs/implementation/RPT-261112-IVY-T09-My-Orders.md)
- **Figma:** `1006:5530` (đối chiếu qua ảnh chủ dự án gửi). **Gap:** G-15. **BR:** 12. **Bug:** BUG-011 (phần còn lại).
- **Quyết định của chủ dự án (2026-11-12):**
  - **Track delivery** → tab Notifications, chip Delivery (thẻ giao hàng thật).
  - **Start over** → menu 7 nút hiện lại ở cuối cuộc chat.
- **Đã làm:**
  - Câu trả lời My Orders theo thiết kế:
    - bong bóng của khách "My Orders";
    - câu dẫn;
    - tối đa 3 thẻ đơn **bấm được** (mở Order Detail đè lên chat, Back về đúng chỗ), pill theo mã;
    - "Do you need anything else?" + chip **Track delivery · Cancel order · Start over**.
  - Câu trả lời này và menu của Start over **gắn vào đúng vị trí** trong luồng chat (BUG-024): tin nhắn sau hiện bên dưới, không chen lên trên.
  - Chip **Start over** do widget tự thêm vào mọi câu trả lời kịch bản có chip (BR-12).
  - Pill theo mã ở danh sách đơn; màu cố định theo trạng thái ở feed inquiry. **BUG-011 đóng.**
  - Thêm `@T09` vào `test:ci`.
- **TC:** TC-09-01..07 — **7/7** ✅ (05: Start over ở kịch bản khác; 06: Back từ Order Detail; 07: Track delivery).

### T10 · Product Help — ✅ (2026-11-12) · [PLN](../docs/plan/PLN-261112-IVY-T10-Product-Help.md) · [RPT](../docs/implementation/RPT-261112-IVY-T10-Product-Help.md)
- **Figma:** `1006:5588` (đối chiếu qua Figma MCP). `993:2207` / `993:2416` không xem được (hết lượt gọi). **Gap:** G-16. **BR:** 17. **Q-04:** chốt bỏ 2 chip "??".
- **Quyết định của chủ dự án (2026-11-12):**
  - Chủ đề trước, đúng `1006:5588`. Chip **Popular products** mở 11 danh mục, chọn danh mục thì hiện sản phẩm.
  - Exchange / Return và Cancel order theo chính sách thật trên ivyusa.com: **10 ngày**, email hello@ivyusa.com để huỷ.
  - Restock alert giữ là câu hỏi cho AI. Báo hàng về thật để task riêng (G-25).
- **Đã làm:**
  - Product inquiry trả lời **trong luồng chat**: bong bóng khách, "What do you need help with?", chip Popular products · How to use · Ingredients · Exchange / Return · Restock alert · Start over. Hàng chip vẫn hiện, chip đã chọn viền xanh (`aria-pressed`).
  - Danh mục cấu hình trên nút Product inquiry ở console: tên + collection Shopify, tối đa 20. Seed IVY 11 danh mục.
  - API `GET /products/popular?category=`: 5 sản phẩm "Best selling" của collection, đọc trực tiếp Shopify Admin API. Chỉ nhận collection đã cấu hình; cache 15 phút; Shopify lỗi hoặc chậm 4 giây thì trả link tới collection trên cửa hàng.
  - Exchange / Return chạy kịch bản `return_exchange` với copy tenant; seed IVY câu chính sách + chip Track delivery · Cancel order.
  - Thêm `@T10` vào `test:ci`.
- **TC:** TC-10-01..07 — **7/7** ✅ (06: Shopify không trả lời; 07: chip đã chọn, "Other categories").
- **Production:** nhập cấu hình theo [GUIDE-261112-IVY-Product-Help-Config](../docs/guide/GUIDE-261112-IVY-Product-Help-Config.md).

### T11 · Contact Support & form — ✅ (2026-11-13) · [PLN](../docs/plan/PLN-261112-IVY-T11-Contact-Form.md) · [RPT](../docs/implementation/RPT-261113-IVY-T11-Contact-Form.md)
- **Figma:** `1006:5650`, `1006:6529`, `1006:6597` (đối chiếu qua ảnh chủ dự án gửi). **Gap:** G-17, G-18. **BR:** 14, 15. **Q-08, Q-15:** chốt.
- **Quyết định của chủ dự án (2026-11-12):**
  - Email hỗ trợ của IVY là **hello@ivyusa.com** (email trên trang chính sách ivyusa.com).
  - Contact Support của IVY **chỉ có thẻ email**, đúng thiết kế.
  - Báo cho team bằng mail tới email hỗ trợ, **Reply-To là email khách**. Console có thêm tab Inquiries.
- **Migration:** `sql/261112-inquiry-contact-form.sql` thêm 4 cột vào `inquiries` (tên, email, nội dung đều mã hoá; ngôn ngữ). **Chạy trên production trước khi push.**
- **Đã làm:**
  - Kênh liên hệ là cấu hình tenant (`widgetCopy.supportEmail` / `supportPhone` / `contactLiveChat`), sửa ở console → Settings → Widget → **Contact Support**. Bỏ `1588-0000` và `help@ivy.com` khỏi 6 file ngôn ngữ (**BUG-010 đóng**). Tenant không điền gì thì chỉ có thẻ live chat.
  - Contact Support trả lời **trong luồng chat** (BUG-024): bong bóng khách, "Please choose how you'd like to reach us.", thẻ 📧 Email inquiry · Open 24 hours · Reply within 1 business day · email, chip Start over.
  - Thẻ email mở form Name · Email · Message (điền sẵn tên và email khi đã đăng nhập). Lỗi hiện dưới từng ô, không gọi API. Gửi lỗi → toast lỗi, form giữ nội dung. Gửi xong → thẻ tối "YOUR INQUIRY" + bong bóng "Your message has been sent successfully."
  - API `POST /inquiries { name, email, message }`: cần consent; cùng luật kiểm tra với widget (`inquiryProblems`); khách chưa đăng nhập được tạo lead từ email; tối đa 5 lần / phiên / giờ; email đã xin xoá thì từ chối. Mail tới email hỗ trợ (Reply-To = khách) nếu server có SMTP.
  - Console → chuông 🔔 → View all → Alarm center → tab **Inquiries** (`/live-chat/alerts?tab=inquiries`, không có trong menu trái): danh sách (email che bớt), mở một inquiry (đọc đầy đủ, ghi audit), **Reply by email**, **Mark answered** / Open again.
  - Xoá dữ liệu cá nhân xoá luôn tên / email / nội dung của inquiry; DSAR xuất 3 trường này.
  - Thêm `@T11` vào `test:ci`.
- **TC:** TC-11-01..08 — **8/8** ✅ (05: thẻ live chat khi tenant bật; 06: gửi lỗi; 07: tenant không cấu hình; 08: gửi thật lên API).
- **Production:** chạy SQL, rồi kiểm cấu hình theo [GUIDE-261113-IVY-Contact-Support-Config](../docs/guide/GUIDE-261113-IVY-Contact-Support-Config.md).

### T12 · Affiliate + CSAT — ✅ (2026-11-13) · [PLN](../docs/plan/PLN-261113-IVY-T12-Affiliate-CSAT.md) · [RPT](../docs/implementation/RPT-261113-IVY-T12-Affiliate-CSAT.md)
- **Figma:** `1006:5990…6290`. **Gap:** G-19, G-20. **BR:** 12, 13. **Bug:** BUG-024 (phần Affiliate), BUG-025.
- **Chủ dự án duyệt (2026-11-13):** `1. ok 2. a 3. a 4. a` — Apply now mở form liên hệ; thêm nút thứ 8 "💼 Affiliate"; câu chữ theo thiết kế (IVY Beauty, 10%).
- **Đã làm:**
  - Affiliate là kịch bản trên server (`affiliate`, `affiliate_details`): cuộc chat được ghi lại, có cái để đánh giá sau End, nhân viên thấy trong lịch sử. 3 dòng `1. **Tên** — mô tả` của câu trả lời vẽ thành 3 thẻ bước.
  - Câu chữ sửa ở console → AI Settings → Built-in conversations. IVY: seed cho DB mới, production theo [GUIDE-261113-IVY-Affiliate-Config](../docs/guide/GUIDE-261113-IVY-Affiliate-Config.md).
  - Chip Apply now · Learn more · Start over · End (Start over đứng trước End). Apply now = form liên hệ T11 điền sẵn → Inquiries + mail.
  - End → câu hỏi → thẻ `csat-card` 4 mặt (lưu 1·3·4·5) + Skip → "Thank you for your feedback" → "The chat has ended". Chip `end_chat` hết báo lỗi (BUG-025).
  - Bỏ thẻ Affiliate cũ (`AffiliateCard`) và lời gọi `/affiliate/*` của widget.
  - Thêm `@T12` vào `test:ci`.
- **TC:** TC-12-01..06.

### T13 · Settings / Privacy — ✅ (2026-11-13) · [PLN](../docs/plan/PLN-261113-IVY-T13-Settings-Privacy.md) · [RPT](../docs/implementation/RPT-261113-IVY-T13-Settings-Privacy.md)
- **Figma:** `1004:1367` (EN, ảnh chủ dự án gửi 2026-11-13), `1004:1447` (KO, chưa có ảnh). **Gap:** G-21.
- **Chủ dự án duyệt (2026-11-13):** `1. ok 2. a 3. a` + ảnh EN. Ảnh giữ thanh đầu trắng "Hi, Kiho", nên lúc đầu mình làm theo ảnh (quy tắc PLN §7-4). **Sau đó chủ dự án chọn "làm 2a" (2026-11-13), nên đã làm 2a** ([RPT §5](../docs/implementation/RPT-261113-IVY-T13-Settings-Privacy.md)).
- **Đã làm:**
  - Cỡ chữ và khoảng cách theo ảnh: tiêu đề khối 16px, dòng 14px, ghi chú 12px, lề 24px, 28px giữa các khối; "← Back" 14px.
  - Nút "Withdraw consent" viền đỏ, bo 11px; câu dưới nút "…stops immediately." (6 ngôn ngữ).
  - Toggle 44×24, là `switch` có tên (trước đây là nút không tên). Bỏ icon trước dòng CCPA. Link Download / Delete 14px, xám đậm.
  - Thanh đầu khi mở Settings (2a): thanh màu brand "← Settings" chữ trắng + ✕ (sắc 700 của brand, chữ trắng 5,0:1, đạt AA); ẩn lời chào, 🌐 và ⚙; ← và Esc quay về tab. Focus chuyển vào ← khi mở, về lại ⚙ khi đóng. Nút ⚙ không có ô nền; vòng focus chỉ hiện khi dùng bàn phím.
  - Toggle marketing giữ chữ thiết kế (3a): bật = không nhận marketing qua email / SMS / push; thông báo trong app vẫn hiện.
- **TC:** TC-13-01..06.

### T14 · i18n — ✅ (2026-11-13) · [PLN](../docs/plan/PLN-261113-IVY-T14-I18n.md) · [RPT](../docs/implementation/RPT-261113-IVY-T14-I18n.md)
- **Chủ dự án duyệt (2026-11-13):** `1. ok 2. a`.
- **Nguồn chữ:** bản trích toàn bộ chữ trang Figma `23:2`. Frame Settings KO `1004:1447` vẫn để chữ tiếng Anh, nên giữ bản dịch KO hiện có. Lỗi chính tả ở SPEC §11 (해택, 4월 전, KR) không có trong code.
- **Đã làm:**
  - Tiếng Hàn chỉ xuống dòng ở dấu cách (`html:lang(ko)`); JA / ZH giữ nguyên (BUG-028).
  - Chữ 4 bước giao hàng lấy từ bảng của widget, nên đổi ngôn ngữ là đổi ngay (BUG-026).
  - Hàng chip xuống hàng 2 khi không vừa (2a): ES / VI thấy đủ 4 chip, các ngôn ngữ khác vẫn 1 hàng (BUG-027).
  - Chữ KO theo Figma: pill 결제완료, "리뷰 쓰기", "고객님께 배송중입니다!".
  - Tóm tắt đơn theo BR-08 ở thẻ giao hàng, thẻ đơn trong chat, danh sách đơn: "+ 2 items" / "외 2개".
  - Nhóm hôm qua ES / VI cùng kiểu nhóm hôm nay.
  - `npm run i18n:check` xanh; không còn chữ chưa dịch hay viết cứng trong widget.
- **TC:** TC-14-01..07.

### T15 · Responsive & a11y — ✅ (2026-11-13) · [PLN](../docs/plan/PLN-261113-IVY-T15-Responsive-A11y.md) · [RPT](../docs/implementation/RPT-261113-IVY-T15-Responsive-A11y.md)
- **Chủ dự án duyệt (2026-11-13):** `1. ok 2. a 3. a`.
  - 2a: điện thoại màn cao cũng phủ kín màn hình.
  - 3a: chưa làm vuốt trái để xoá (BR-09 tuỳ chọn); trên điện thoại vẫn xoá bằng Chọn → "Delete Selected".
- **Đã làm:**
  - Điện thoại (màn < 640px, cùng quy tắc với `embed.js`): panel `100vw × 100dvh`, kể cả iPhone 15 / Pixel 7 (trước: bottom sheet cao 680px).
  - Trang widget mở thẳng (`talk.ivyusa.com/widget/`) trên điện thoại: bố cục điện thoại như trên ivyusa.com (BUG-030).
  - Tab / Shift+Tab đi vòng trong panel, không thoát ra trang phía sau (BUG-029, NFR-02). Nút đang có focus mà biến mất (ví dụ Accept của banner đồng ý) thì focus về lại panel, không rơi ra `<body>`.
  - Đã có từ trước, nay kiểm lại: Esc đóng panel, `aria-pressed` cho chip, `aria-selected` cho tab, console sạch.
  - 6 ngôn ngữ trên điện thoại 390×844: không gì tràn hay bị cắt.
  - `test:ci` chạy thêm project `mobile`, để TC-15-01 vào cổng.
- **TC:** TC-15-01..06.

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
