# RPT-261125 — PRD v1.0 của IVY, giai đoạn 1

| | |
|---|---|
| Kế hoạch | [PLN-261125-IVY-PRD-v1-Alignment](../plan/PLN-261125-IVY-PRD-v1-Alignment.md) §2 — ✅ duyệt 2026-11-25 (`ok duyệt, đã chạy SQL, CSAT a, E-02 b`) |
| Phân tích | [REQ-261125-IVY-PRD-v1-Gap](../analysis/REQ-261125-IVY-PRD-v1-Gap.md) |
| Kiểm thử | [TCR-261125-IVY-PRD-v1-Phase1](../test/TCR-261125-IVY-PRD-v1-Phase1.md) |
| Commit | `dceaf3e5` (thông báo, Order Detail, huỷ / hoàn tiền) + `09b53165` (chat, form liên hệ, campaign, console) |

## 1. Thay đổi

### 1.1 Thông báo (N-01, N-06) — PLN §2.1–2.2

| Phần | Nội dung | File |
|---|---|---|
| Nhóm | **New** (chưa đọc) / **Recent** (đã đọc) thay Today's / Yesterday's. Thẻ đọc trong lúc widget mở vẫn ở New tới lần mở sau: `panelOpenSeq` trong store + ảnh chụp id chưa đọc theo lần mở. Mọi thẻ chưa đọc đều tô nền | `NotificationsTab.tsx`, `GroupHeader.tsx` (thay `DateGroupHeader.tsx`), `useNewSnapshot.ts`, `widgetStore.ts`, `lib/format.ts` (`groupByRead`) |
| Giờ | Thời gian đã trôi qua, làm tròn xuống: Just now · N min ago · N hours ago · N days ago (47 giờ = 1 day ago). Bỏ "Yesterday" và ngày tháng. 6 ngôn ngữ | `lib/format.ts` (`noticeTime`), `notice-time-text.ts`, `i18n/locales/*.ts` |
| Tự đọc thẻ cũ | Ghi thông báo trạng thái mới (`payment` / `shipping`, `refType=order`) → các thông báo cũ chưa đọc của cùng đơn thành đã đọc. Mở danh sách → một lệnh `UPDATE … JOIN` dọn thông báo cũ hơn đã có thẻ mới | `notification.service.ts` (`readOlderStatusNotices`, `readSupersededStatusNotices`) |
| Badge | Tối đa 1 cho mỗi đơn (`countNewCards`) | `notification.service.ts` |
| Recent 30 ngày | Danh sách trả thẻ chưa đọc + thẻ đã đọc trong 30 ngày. Không xoá gì; lịch xoá 365 ngày giữ nguyên | `notification.service.ts` (`withRecentWindow`) |
| Xoá 1 thẻ | Nhấn giữ 0,5 giây / chuột phải / phím Menu → menu **Delete** → xoá, báo "1 notification deleted". Esc / chạm ra ngoài thì đóng | `NotificationsTab.tsx` (`RowMenu`) |
| Chip Delivery | Cùng New / Recent theo thông báo của đơn; tô thẻ đơn có thông báo chưa đọc; Track Order đánh dấu đã đọc | `ShipmentList.tsx` |

### 1.2 Order Detail (PRD slide 7 ②) — PLN §2.3

Nút xe tải cạnh mã đơn, chấm cam khi đang giao → chip Delivery, thẻ đơn đó đứng đầu và có viền. Mở từ tab Chat cũng được. Nhãn trạng thái giữ nguyên. Thêm dòng **Email us about this order** → form liên hệ có sẵn mã đơn.

File: `OrderDetail.tsx`, `tab-chips.ts` (`deliveryTab`), `ChatTab.tsx`, `NotificationsTab.tsx`.

### 1.3 Huỷ / hoàn tiền (N-02) — PLN §2.4

- Đồng bộ đọc `cancelledAt` (GraphQL) / `cancelled_at` (webhook). Đã đối chiếu schema Admin GraphQL 2026-01 qua Context7.
- Trạng thái mới `cancelled` → **Cancelled**, `refunded` (hoàn toàn bộ) → **Refunded**. Nhãn xám, 6 ngôn ngữ.
- Hoàn một phần không đổi trạng thái.
- Trạng thái vừa đổi sang một trong hai, thay đổi ≤ 48 giờ, đơn có khách → một thông báo chip Order.
- Thẻ "Confirmed" tạo muộn không còn tạo cho đơn đã huỷ / hoàn.

File: `shopify-admin.client.ts`, `shopify-sync.service.ts` (`mapStatus`, `noticeOrderEnded`), `packages/types` (`enum.types.ts`, `status-map.ts`, `order-status.ts`), `StatusPill.tsx`, `cafe24-admin.client.ts` (bảng xếp hạng phải đủ khoá).

### 1.4 Nút chat nhanh (C-01) — PLN §2.5

| Nút | Sau thay đổi | File |
|---|---|---|
| Payment check | Hành động mới `payment_status`. Thẻ đơn mới nhất: mã đơn, ngày, sản phẩm, tổng tiền, nhãn **Paid / Payment pending / Cancelled / Refunded**, câu hướng dẫn theo trạng thái. Chip Track delivery · Contact Support · Start over. Chưa đăng nhập → khung đăng nhập trước | `OrderStatusAnswers.tsx`, `lib/order-answers.ts` |
| Delivery inquiry | Đã đăng nhập → thẻ tracker 4 bước của đơn đang giao mới nhất (không có thì đơn mới nhất) + câu theo giai đoạn + chip Shipping policy · Contact Support · Start over. Khách vãng lai → kịch bản chính sách như cũ | như trên |
| Feedback | Hành động mới `feedback`. Ô nội dung + Send feedback → lưu ở console (Inquiries, loại Feedback), không gửi mail CS | `ContactForm.tsx` (`FeedbackAnswer`) |
| Contact Support | Email là kênh duy nhất (IVY) → mở thẳng form. Tenant có nhiều kênh vẫn thấy thẻ chọn kênh | `ChatTab.tsx` |

Seed IVY đổi theo. Console AI Settings có thêm 2 hành động: **Payment status card**, **Feedback form**.

### 1.5 Form liên hệ (E-01) — PLN §2.6

- Form mở từ thẻ đơn / Order Detail hiện "Order IVY-xxxxx" và gửi `order_id`. API chỉ gắn khi đơn là của **chính khách** trong tenant; ngược lại ghi log và bỏ qua.
- Mail gửi CS:
  - tiêu đề "— order IVY-xxxxx";
  - dòng "Order:";
  - **20 tin gần nhất** của cuộc chat (`[HH:MM UTC] Customer/AI/Staff: …`, mỗi tin ≤ 500 ký tự);
  - link "Open the chat in the console".
- `kind`: `inquiry` | `feedback`. Feedback chỉ cần nội dung; khách vãng lai không có email thì không gắn khách nào.
- Console Inquiries: lọc theo loại; cột Type, Order; hộp chi tiết hiện mã đơn và nhãn Feedback.

File: `inquiry.service.ts`, `inquiry.entity.ts`, `inquiry.request.ts`, `inquiry.controller.ts`, `inquiry.mapper.ts`, `inquiry.module.ts`, `packages/types/src/common/inquiry.ts` (`INQUIRY_KIND`, `feedbackProblems`), `inquiryService.ts` (widget), `InquiriesTab.tsx`, `inquiries.service.ts`.

### 1.6 Campaign (N-04) — PLN §2.7

- **Send to**: All customers / Specific customers (dán email, mỗi dòng một). API tìm khách qua blind index của email.
- Lưu `target_customer_ids`. Lưu xong báo các email không phải khách của shop.
- Danh sách rỗng → 400 **E5166**. Không ai khớp → lưu được nhưng **Send** bị từ chối.
- Dispatch chỉ gửi cho người được chọn. **Bỏ khách đã từ chối marketing hoặc CCPA**: có dòng tuỳ chọn marketing bị tắt và không dòng nào bật. Áp dụng cả thông báo trong widget.
- Khách chưa từng chạm cài đặt vẫn nhận trong widget.
- Audit ghi `targeted` / `skippedOptOut`.
- Lỗi "mất nội dung khi lưu" IVY báo: không tái hiện được. Có test giữ nội dung khi sửa.

File: `campaign.service.ts`, `campaign.entity.ts`, `campaign.request.ts`, `campaign.mapper.ts`, `notification.service.ts` (`marketingRefusers`), `error-code.constant.ts` (E5166), `CampaignsPage.tsx`, `campaigns.hooks.ts`, `campaigns.service.ts`.

### 1.7 SQL

`sql/261125-prd-v1-phase1.sql`:

- `inquiries.kind varchar(16) NOT NULL DEFAULT 'inquiry'`;
- `campaigns.target_customer_ids json NULL`.

Idempotent: chạy 2 lần trên MySQL 8 máy local không lỗi. `sql/artefacts.tsv` đã sinh lại.

## 2. Kiểm thử

| Bộ | Kết quả |
|---|---|
| API (Jest), toàn bộ | 2991 / 2994 — 3 ca chỉ đỏ trên Windows, xanh trên CI Linux |
| Widget (`node --test`) | 150 / 150 |
| E2E cổng CI (`npm run test:ci`, desktop + mobile) | **160 / 160** |
| Typecheck API · widget · console; `i18n:check`; `env:check` | Sạch |
| API khởi động thật sau khi đổi entity | `Nest application successfully started` |
| Console trên máy | Form campaign có Send to; danh sách rỗng → E5166; Inquiries có cột Type / Order; AI Settings có 2 hành động mới; không lỗi trang |
| Widget, ảnh chụp với dữ liệu giả lập | Các màn sau đúng như wireframe: New / Recent; menu Delete; xe tải chấm cam; Delivery có viền; thẻ Payment; thẻ Delivery; form có mã đơn |

## 3. Trạng thái triển khai

| Bước | Ai | Trạng thái |
|---|---|---|
| 1. Duyệt PLN (và 2 câu hỏi CSAT / E-02 cho các giai đoạn sau) | Chủ dự án | ✅ 2026-11-25 — CSAT **a** (giữ Figma), E-02 **b** (ngoài giờ → form email) |
| 2. Chạy `sql/261125-prd-v1-phase1.sql` trên DB production | Chủ dự án | ✅ 2026-11-25 |
| 3. Push `deploy/talk-ivyusa` → CI → tự deploy (gồm cả Bedrock `d2073407`, vô hại khi chưa có `.env`). Trước khi push: không có Re-sync đơn đang chạy (04:13 UTC) | Tôi | ⏳ đang push |
| 4. Console → AI Settings: "Payment check" → **Payment status card**; "Feedback" → **Feedback form** → Save | Chủ dự án (hoặc tôi, khi được cho phép) | ⏳ sau 3 |
| 5. Thử trên talk.ivyusa.com: New / Recent, nhấn giữ xoá, xe tải, Payment check, Feedback, form có mã đơn | Chủ dự án | ⏳ |
