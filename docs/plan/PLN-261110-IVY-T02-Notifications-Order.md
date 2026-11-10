# PLN-261110 — IVY T02 · Notifications: chip Order · Delivery · Promo · Review, dòng đơn hàng

| | |
|---|---|
| Trạng thái | 🟨 **Chờ duyệt.** Chưa sửa dòng code nào |
| Task | [ivy-docs/TASKS.md T02](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-04 · G-04, G-05, G-06 · BR-01..08 · BUG-011 |
| Figma | Master `992:526` (KR, có chế độ chọn), `1006:7825` (EN), `1006:2930` |
| TC | TC-02-01..06 ([e2e/tests/02-notifications-order.spec.ts](../../e2e/tests/02-notifications-order.spec.ts)), baseline 0/6. T07 (chọn/xoá) dùng chung danh sách này |
| Migration | **Không có.** Dùng các cột đã có: `notifications.ref_type/ref_id/status_badge/deleted_at` |
| Deploy | Push → CI → server tự deploy (có đổi `apps/api` và `apps/widget`) |

## 1. Hiện trạng → mục tiêu

| | Thiết kế (Master) | Code hiện tại (layout 1 tab danh sách, như IVY sau T01) |
|---|---|---|
| Chip | **Order · Delivery · Promo · Review**; không có All (Q-10) | **All · Payment · Delivery · Event · Review**. "Payment" mở **danh sách đơn**, không phải thông báo |
| Dòng | 📦 · `IVY-39891` · pill **Confirmed** · "Hydrating Face Mask (10pcs) + 2 items" · "Just now" | Tiêu đề/nội dung tự do. Pill = chữ server **chưa dịch**, màu **đoán theo chữ** (BUG-011). Thời gian `Intl` ("10 minutes ago") |
| Nhóm | **Today's** / **Yesterday's** / ngày cũ hơn | "Today's notifications" / "Yesterday" / ngày |
| Chạm | Đánh dấu đã đọc + mở **Order Detail** | Chỉ đánh dấu đã đọc |
| Test-id | `notif-item` `notif-group` `notif-time` `status-pill`, chip có `aria-pressed` (SPEC §9) | Chưa có |

**Vấn đề dữ liệu (phát hiện khi khảo sát):**
- Chip *Order* của thiết kế là **feed thông báo sự kiện đơn hàng**, và T07 xoá chính các dòng đó qua `DELETE /notifications`.
- Nhưng server **chưa từng tạo thông báo "đơn đã xác nhận"**. Nó chỉ tạo thông báo giao hàng (`order.service.ts`: "Shipping update / Your order IVY-x is now In Transit."), và thông báo đó **không có `refType`/`refId`** nên không mở được đơn.
- Hệ quả: nếu chỉ đổi UI, chip Order sẽ **trống với khách thật**. Đây chính là lỗi REQ-260818 từng gặp với chip "Payment".

## 2. Quyết định thiết kế

**D1 — Chip Order = feed thông báo sự kiện đơn hàng** (category `payment` + `shipping`).
- Mỗi dòng vẽ theo thiết kế bằng cách **nối `refId` với đơn** trong danh sách đơn widget đã tải (`orderNumber`, `firstItemTitle`, `itemCount`).
- Nếu không tìm thấy đơn (thông báo cũ, hoặc đơn ngoài cửa sổ 30 ngày), dòng dùng `title`/`body` của thông báo.
- Giữ nguyên trạng thái đọc/chưa đọc, nhóm theo thời điểm sự kiện và chọn/xoá (T07).

**D2 — Backend bổ sung thông báo đơn hàng còn thiếu.** Không có migration và **không bắn push**.
- **B1:** thông báo giao hàng (`order.service.ts`) thêm `refType: 'order', refId: order.id`. Title/body giữ nguyên, nên tenant khác không đổi gì.
- **B2:** `NotificationService.ensureOrderNotices(customer)`. Với tối đa 10 đơn gần nhất (≤ 30 ngày) chưa có thông báo đơn nào, kể cả đã xoá mềm, server tạo một dòng `payment`:
  - nội dung: `title = orderNumber`, `body = "{sản phẩm đầu} + {n} items"`, `statusBadge = 'Confirmed'`, `refType = 'order'`, `createdAt = orderedAt`;
  - **chưa đọc** nếu đơn đặt trong 24 giờ qua, ngược lại là đã đọc.
- Chạy khi widget gọi danh sách thông báo hoặc số chưa đọc, **tối đa 1 lần / 5 phút / khách** (khoá Redis).
- Ghi thẳng vào repository, **không qua `notify()`**, vì `notify()` tự toả sang các kênh ngoài, trong đó có push thật tới app.
- Khách đã có đơn từ trước sẽ thấy đơn ngay lần mở đầu tiên. Đơn mới sẽ hiện chưa đọc và được cộng vào badge.
- Chỉ áp dụng cho tenant **không bật tab Orders**, tức layout 1 tab danh sách như IVY. Tenant 3 tab không thay đổi gì.

**D3 — Pill theo mã trạng thái, không đoán theo chữ.**
- `statusBadge` hiện là chữ cố định từ `ORDER_STATUS_UI` ('Confirmed', 'In Transit', 'Delivered', 'Review', 'Pending payment', 'Cancel requested'). Ánh xạ **chính xác** chữ đó sang mã trạng thái (`confirmed`, `in_transit`, …), rồi dùng mã để lấy **nhãn i18n** và **màu**.
- Màu theo SPEC §4: xanh lá #22C55E · cam #F97316 · xám #9CA3AF · tím #A855F7, chữ trắng, bo theo radius token.
- Chữ lạ thì hiện nguyên văn với màu trung tính. Pill của event cũ không đổi theo trạng thái hiện tại của đơn, vì feed là lịch sử sự kiện.

**D4 — Thời gian và nhóm theo BR-05 / Q-02, dùng múi giờ của trình duyệt khách.**
- Hôm nay: "Just now" / "{n}mins ago" / "{n}h ago".
- Hôm qua: "Yesterday".
- 2–6 ngày: "{n} days ago".
- Cũ hơn: "Nov 3".
- Nhóm: "Today's" / "Yesterday's" / ngày.
- Có đủ 6 ngôn ngữ.

**D5 — Bố cục chip chỉ đổi ở layout 1 tab danh sách** (`chipsFor`). Layout 3 tab (Notifications + Orders + Chat) giữ nguyên.
- Delivery = danh sách giao hàng hiện có (T03 sẽ làm lại giao diện).
- Promo = thông báo `event` (T05 làm lại giao diện thẻ).
- Review = danh sách sản phẩm chờ đánh giá hiện có (T06).
- Chip *Inquiries* vẫn hiện cho tenant có issue workflow.
- Thông báo loại `chat` (chỉ dành cho app) không còn hiện trong widget, vì trùng với chính cuộc chat.

**D6 — Chạm vào dòng:**
- Có `refType: 'order'` → đánh dấu đã đọc và mở **Order Detail** (view sẵn có).
- Không có đơn → chỉ đánh dấu đã đọc, như hiện nay.
- *Review* giữ nút "Write review" (T06).

## 3. Wireframe (chip Order, desktop 380px)

```
┌──────────────────────── 380px ────────────────────────┐
│ Hi, Kiho                              🌐EN   ⚙    ✕   │
├──────────────────────────┬────────────────────────────┤
│   Notifications (2)      │          Chat              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━ │                            │
├──────────────────────────┴────────────────────────────┤
│ (Order) ( Delivery ) ( Promo ) ( Review )     Select  │ ← chip, aria-pressed; Order đậm nền đen
├───────────────────────────────────────────────────────┤
│ Today's                                               │ ← notif-group, nền xám nhạt
├───────────────────────────────────────────────────────┤
│ ( 📦 ) IVY-39891  [Confirmed]                      ●  │ ← notif-item data-unread=true, nền tô nhạt,
│        Hydrating Face Mask (10pcs) + 2 items          │   chấm đỏ; pill xanh lá (status-pill
│        Just now                                       │   data-status=confirmed); notif-time
├───────────────────────────────────────────────────────┤
│ ( 📦 ) IVY-39641  [In Transit]                        │ ← pill cam
│        Vitamin C Serum Set                            │   (1 sản phẩm: không có "+ n items")
│        10mins ago                                     │
├───────────────────────────────────────────────────────┤
│ Yesterday's                                           │
├───────────────────────────────────────────────────────┤
│ ( 📦 ) IVY-39880  [Delivered]                         │ ← pill xám
│        Hydrating Face Mask 10pcs + 2 items            │
│        Yesterday                                      │
└───────────────────────────────────────────────────────┘
  Chạm dòng → đánh dấu đã đọc → Order Detail (← Back về danh sách)
```

Mobile ≤ 480px giống bố cục trên, chỉ rộng hết màn hình. Chip cuộn ngang nếu hết chỗ (đã có).

## 4. Thay đổi

| Lớp | File | Thay đổi |
|---|---|---|
| API | `order/order.service.ts` | B1: `refType/refId` cho thông báo giao hàng |
| API | `notification/notification.service.ts` (+ spec) | B2: `ensureOrderNotices` (đơn ≤ 30 ngày, tối đa 10, idempotent kể cả với dòng đã xoá mềm, khoá Redis 5 phút, chỉ tenant không có tab Orders); gọi từ `list` và `unreadCount`; xoá cache số chưa đọc khi tạo dòng mới |
| Types | `packages/types/src/domain/status-map.ts` | `orderStatusKey(statusBadge)`: chữ `ORDER_STATUS_UI` → mã (`confirmed`/`in_transit`/`delivered`/`review`/`pending_payment`/`cancel_requested`) |
| Widget | `notifications/tab-chips.ts` | Layout 1 tab danh sách: `order`(feed) · `shipping` · `event`(Promo) · `review` (+`inquiries`). Mặc định `order` |
| Widget | `notifications/NotificationsTab.tsx` | Chip `order` = thông báo `payment`+`shipping`. Dòng mới: nối đơn, pill theo mã, test-id, `aria-pressed`, chạm mở Order Detail |
| Widget | `ui/StatusPill.tsx` (mới) | Pill theo mã: nhãn i18n + màu theo SPEC §4. Dùng radius token |
| Widget | `lib/format.ts` | `notificationTime()` (BR-05) và nhóm "Today's/Yesterday's" theo lịch địa phương |
| Widget | `i18n/locales/*.ts` (×6) | Nhãn chip Order/Promo, nhóm, thời gian, nhãn pill theo mã, "+ {n} items" |
| Test | `apps/widget/test/*.test.mjs` | `notificationTime` (biên phút/giờ/hôm qua/6 ngày), `chipsFor` (layout 1 tab và 3 tab), `orderStatusKey` |
| Test | API jest | `ensureOrderNotices`: tạo đúng, không lặp, không tạo lại dòng đã xoá, chưa đọc chỉ khi ≤ 24 giờ, bỏ qua tenant có tab Orders |
| E2E | `e2e/package.json` | Thêm `@T02` vào `test:ci` khi 6/6 xanh |

## 5. Ảnh hưởng phụ

- **Tenant khác:**
  - Layout 3 tab: không đổi gì, cả chip lẫn B2.
  - Layout 1 tab danh sách: chip mới và B2 áp dụng giống IVY.
  - B1 chỉ thêm tham chiếu, chữ hiển thị giữ nguyên.
- **Khách thật:** lần mở đầu sau khi deploy, chip Order sẽ hiện các đơn ≤ 30 ngày ở trạng thái đã đọc. Đơn đặt trong 24 giờ hiện chưa đọc và được cộng vào badge.
- **Push và email:** không gửi gì thêm, vì B2 không đi qua `notify()`.
- **Bỏ chip All:**
  - Thông báo `chat` (của app) không còn hiện trong widget.
  - Thông báo `shipping` không gắn đơn (ví dụ báo có hàng lại) vẫn hiện ở chip Order dưới dạng dòng chữ.
- **Tải:** B2 chạy tối đa 1 lần / 5 phút / khách; mỗi lần đọc ≤ 10 đơn và kiểm tra trùng.
- **T03/T05/T06/T07:** dùng chung chip và dòng mới. T07 xoá thông báo (xoá mềm, B2 không tạo lại).

## 6. Kiểm thử

`tsc` (api/widget/types) · jest API · `node --test apps/widget/test/*.mjs` · `npm run i18n:check` · radius (Linux) · `cd e2e && npm run test:task -- @T02` 6/6 · T07 không được tệ hơn baseline (1/3) · `test:ci` · chạy lại các ca đã xanh ×2 (không regression) · TC-01-08 (thiết bị) vẫn xanh.

## 7. Xin bạn xác nhận

1. **Duyệt PLN** (gồm backend B1 + B2: tự tạo thông báo cho đơn, chỉ trong widget, **không gửi push**)?
2. **Múi giờ** cho "Today's/Yesterday's": **giờ của máy khách** (mình đề xuất, mỗi khách thấy đúng "hôm nay" của mình) hay cố định **America/New_York**?
3. **Từ 2 ngày trở lên** (Q-02): "{n} days ago" tới 6 ngày rồi chuyển sang ngày tháng "Nov 3" (mình đề xuất), hay hiện ngày tháng ngay từ ngày thứ 2?
