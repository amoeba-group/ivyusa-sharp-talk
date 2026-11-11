# RPT-261111 — IVY T02 · Notifications: chip Order · Delivery · Promo · Review, dòng đơn hàng

Kế hoạch: [PLN-261110-IVY-T02](../plan/PLN-261110-IVY-T02-Notifications-Order.md), duyệt ngày 2026-11-11. Task: ivy-docs/TASKS.md T02. SPEC: SCR-IVY-04, G-04..G-06, BR-01..08.

**Quyết định của chủ dự án (2026-11-11):**
1. Duyệt cả backend B1 + B2.
2. Ngày tính theo **múi giờ máy khách**.
3. Hiện "{n} days ago" tới 6 ngày, sau đó hiện ngày tháng "Nov 3".

## 1. Thay đổi

### API (không có migration)

| File | Nội dung |
|---|---|
| `order/order.service.ts` | **B1:** thông báo giao hàng thêm `refType: 'order'` và `refId` (chữ hiển thị giữ nguyên). `itemSummaries` chuyển sang dùng helper chung |
| `order/order-item-summary.ts` (mới) | `summarizeOrderItems()` (2 query cố định, chuyển từ OrderService) + `orderSummaryText()` ("X + 2 items") |
| `notification/notification.service.ts` | **B2** `ensureOrderNotices()` (chi tiết bên dưới).<br>**BUG-015:** feed và badge chỉ đọc kênh `in_app`.<br>`list()` sắp theo `createdAt DESC, id DESC` |
| `notification/notification.module.ts` | Đăng ký `OrderCache`, `OrderItem` (chỉ đọc) |
| `packages/types` `enum.types.ts` | `NOTIFICATION_REF` (`order`, `order_item`) |
| `packages/types` `order-status.ts` | `NOTICE_STATUS` + `noticeStatus()`: khớp chính xác chữ `ORDER_STATUS_UI` sang mã pill |
| `packages/types` `widget.types.ts` | Comment `refType` |

**B2 `ensureOrderNotices()`:**
- Với mỗi đơn ≤ 30 ngày (tối đa 10 đơn) chưa có thông báo đơn nào, kể cả dòng đã xoá mềm, server ghi 1 dòng `payment`:
  - `title` = mã đơn, `body` = "SP + n items", `statusBadge` = `Confirmed`, `refType` = `order`;
  - `createdAt` = ngày đặt đơn;
  - **chưa đọc** chỉ khi đơn đặt trong 24 giờ.
- Bỏ qua đơn `pending_payment`.
- Ghi thẳng vào repository, **không qua `notify()`**, nên không có push, email hay SMS.
- Chỉ chạy cho tenant có 1 tab danh sách (cùng điều kiện với `chipsFor` của widget).
- Khoá Redis `SET NX` 5 phút / khách. Không có Redis thì không chạy.
- Các lời gọi đồng thời (feed và badge cùng lúc) dùng chung một lần chạy. Lỗi chỉ ghi log `warn`, feed vẫn trả về bình thường.

### Widget

| File | Nội dung |
|---|---|
| `notifications/tab-chips.ts` | Layout 1 tab danh sách: **Order · Delivery · Promo · Review** (+ Inquiries nếu tenant có workflow), mặc định Order. Layout 3 tab giữ nguyên. `orderFeedRows()` |
| `notifications/NotificationsTab.tsx` | Xem các điểm bên dưới |
| `ui/StatusPill.tsx` (mới) | Pill theo mã: nhãn `notifications.status.*` và màu token (success / warning / neutral / review / error). `data-testid="status-pill"` + `data-status` |
| `ui/Badge.tsx` | Nhận thêm thuộc tính HTML (`data-*`, `className`) |
| `lib/format.ts` | `noticeTime()` (BR-05) và `shortDate()`. `groupByDate()` nhận `now` |
| `i18n/locales/*.ts` ×6 | `filters.order/promo`, `time.*`, `status.*`, `itemsMore_*`. EN: nhóm "Today's" / "Yesterday's" |

**`NotificationsTab.tsx`:**
- Chip Order đọc nửa `scope=order` rồi giữ `payment` + `shipping`.
- Mỗi dòng nối `refId` với danh sách đơn (20 đơn / 90 ngày, dùng chung cache) để vẽ mã đơn, "SP + 2 items" theo ngôn ngữ, pill và giờ BR-05.
- Chạm dòng: đánh dấu đã đọc và mở Order Detail. Trong chế độ chọn, chạm dòng thì chọn/bỏ chọn.
- Test-id theo SPEC §9: `notif-item` (`data-id`, `data-category`, `data-unread`), `notif-group`, `notif-time`. Chip có `aria-pressed`.
- Nút Select nằm **ngoài** vùng cuộn chip. Trước đây nó bị cắt ở EN 380px và bị đẩy khỏi khung ở VI.

### Test và tài liệu

| File | Nội dung |
|---|---|
| `apps/widget/test/notice-row.test.mjs` (mới) | 10 test: biên thời gian, nhóm ngày, mã pill |
| `apps/widget/test/tab-chips.test.mjs` | 6 test cho bar mới |
| `notification.service.spec.ts` | 10 test B2 và BUG-015. Cập nhật 2 test scope cũ (thêm `channel`) |
| `order.service.tracking.spec.ts` | Test B1 |
| `e2e/fixtures/ivy-data.ts` | `yesterday()` = đúng 24 giờ trước (BUG-016) |
| `e2e/package.json` | `test:ci` thêm `@T02` |
| `ivy-docs/{TASKS,TEST-CASES,BUGS,SPEC}.md`, GUIDE §7, PLN | Trạng thái và quyết định. SPEC BR-04/BR-05/Q-02 ghi múi giờ máy khách; §9 các selector T02 ✅ |

## 2. Kiểm thử (local, 2026-11-11)

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit`: api, widget, web, types, e2e | sạch |
| `vite build` widget | OK |
| Jest notification + order | 12 suite, **129/129**. Toàn bộ API: 2781/2784; 3 ca đỏ chỉ trên Windows (dấu `\` trong đường dẫn, CRLF: embed-loader, board-attachment, heic), không liên quan T02 (cùng loại BUG-012) |
| Jest `packages/types` | 197/197 |
| `node --test apps/widget/test/*.mjs` | **77/77** (+13 test mới) |
| `npm run i18n:check` | đủ 6 ngôn ngữ |
| `@T02` | **6/6** (baseline 0/6) |
| Toàn bộ desktop | **50 pass / 35 fail** (trước T02: 37 / 48). Mọi ca đỏ thuộc T03–T12 chưa làm. Nhờ T02 có thêm: T04 3/5, T14 8/8, T15 4/4. T07 giữ 1/3 (không tệ hơn baseline) |
| `@T02` + cổng CI cũ, `--repeat-each=2` | **68/68** |
| Tích hợp API + MySQL thật (B2) | Tạo 2 dòng "Confirmed": đúng `refId`, `createdAt` = ngày đặt đơn, đã đọc. Gọi lại: không tạo thêm. Dòng đã xoá mềm: không bị tạo lại. Đơn mới (< 24 giờ): chưa đọc, badge 2 → 3, "Check Item A + 1 item". Dữ liệu thử đã dọn |
| Boot API sau khi đổi module (A-1) | `Nest application successfully started` |

Đã kiểm tra bằng mắt qua ảnh chụp EN / KO / VI / ES ở 380px: khớp wireframe PLN §3; Select luôn hiện.

## 3. Ghi chú cho production

- **Chip mới và B2 chỉ có tác dụng khi tenant ivyusa tắt tab Orders.** Đây là bước cấu hình console của T01 (PLN-T01 §5), vẫn đang chờ. Trước đó production vẫn giữ layout 3 tab như cũ, chỉ có BUG-015 và B1 tác động.
- **BUG-015:** badge của khách thật sẽ **giảm** về đúng số sự kiện chưa đọc, vì trước đây mỗi sự kiện bị đếm theo số kênh. Đây là thay đổi đúng.
- **B2:** lần mở đầu tiên sau khi bật layout 1 tab, khách sẽ thấy đơn ≤ 30 ngày của mình ở trạng thái đã đọc. Đơn đặt trong 24 giờ hiện chưa đọc. Không có push hay email nào được gửi.
- Không có SQL hay migration.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Commit | _(điền sau khi push)_ |
| CI | _(điền sau khi push)_ |
| Server `talkaibotprd01` | _(cron tự deploy khi CI xanh, xem `~/ivy-autodeploy.log`)_ |
| SQL / migration | Không có |
