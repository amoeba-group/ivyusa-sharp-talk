# TCR-261125 — PRD v1.0 của IVY, giai đoạn 1

Kế hoạch: [PLN-261125-IVY-PRD-v1-Alignment](../plan/PLN-261125-IVY-PRD-v1-Alignment.md) §2. Phân tích: [REQ-261125](../analysis/REQ-261125-IVY-PRD-v1-Gap.md).

## 1. Unit — API (Jest)

| Bộ | Ca | Kết quả |
|---|---|---|
| `notification.new-recent.spec.ts` | Thông báo trạng thái mới của một đơn → đánh dấu đã đọc các thông báo cũ chưa đọc của **đúng đơn đó**. Chỉ dòng `in_app`, chỉ `payment` / `shipping`, không đụng dòng vừa ghi | ✅ |
| | Promo, yêu cầu review, thông báo không gắn đơn → không đánh dấu gì | ✅ |
| | Mở danh sách → chạy lệnh dọn thông báo đã có thẻ mới hơn, rồi lấy "chưa đọc + đã đọc trong 30 ngày" | ✅ |
| | Badge: 2 thông báo chưa đọc của cùng đơn = 1; promo đếm riêng | ✅ |
| | `countNewCards`: review và promo mỗi cái một; thông báo không có `refId` đếm riêng | ✅ |
| `notification.service.spec.ts` (sửa) | Phạm vi feed (order / notice / feed / chat) giữ nguyên trên cả hai nửa của điều kiện Recent; badge đọc qua `find` | ✅ |
| `shopify-sync.order-ended.spec.ts` | Đơn huỷ → `cancelled` / "Cancelled" + đúng 1 thông báo `payment`, badge "Cancelled", `refType=order` | ✅ |
| | Hoàn toàn bộ → `refunded` + thông báo; hoàn một phần không đổi trạng thái, không báo | ✅ |
| | Huỷ thắng `fulfilled` | ✅ |
| | Đơn đã huỷ đọc lại → không báo lần 2 | ✅ |
| | Huỷ từ 30 ngày trước (đồng bộ lại) → lưu trạng thái, không báo | ✅ |
| `inquiry.prd-v1.spec.ts` | Feedback chỉ cần nội dung: lưu `kind=feedback`, không địa chỉ, không tạo khách, không gửi mail, audit `feedback.created` | ✅ |
| | Feedback trống hoặc địa chỉ sai → từ chối, không lưu | ✅ |
| | Inquiry vẫn bắt buộc tên + email | ✅ |
| | Đơn của chính khách → `order_id` lưu; mail có "— order IVY-39891" ở tiêu đề và dòng "Order:" | ✅ |
| | Đơn của khách khác / phiên ẩn danh → không gắn | ✅ |
| | Gửi từ một cuộc chat → mail có "Recent chat (last N messages)", mỗi tin một dòng `[HH:MM UTC] Customer/AI/Staff`, cũ trước mới sau, link console `…/live-chat?c=ID` | ✅ |
| | Dòng chat dài > 500 ký tự bị cắt, xuống dòng gộp thành dấu cách | ✅ |
| | Console lọc theo `kind`, có `orderNumber` | ✅ |
| `campaign.targets.spec.ts` | Người nhận theo email (không phân biệt hoa thường, trùng 1 lần), báo email không phải khách; chỉ họ nhận | ✅ |
| | Không có danh sách = mọi khách (như cũ) | ✅ |
| | Danh sách rỗng → 400 E5166, không bao giờ hiểu là "mọi người" | ✅ |
| | Không ai khớp → lưu được, **Send** bị từ chối | ✅ |
| | `null` → quay về mọi khách | ✅ |
| | Khách đã tắt marketing không nhận; khách tắt rồi bật lại vẫn nhận; khách chưa chạm cài đặt vẫn nhận. Audit `targeted` / `skippedOptOut` | ✅ |
| | Form sửa nhận lại danh sách email | ✅ |
| | Sửa campaign giữ nguyên nội dung tin (lỗi IVY báo "mất nội dung khi lưu" — không tái hiện) | ✅ |

Toàn bộ API: **2991 / 2994**. 3 ca đỏ là 3 ca chỉ đỏ trên Windows (embed-loader CRLF, board-attachment và heic-conversion đường dẫn), xanh trên CI Linux.

## 2. Unit — widget (`node --test`)

| Bộ | Ca |
|---|---|
| `notice-row.test.mjs` | < 1 phút Just now; 1–59 phút; 1–23 giờ; ≥ 24 giờ ra ngày, làm tròn xuống (47 giờ = 1 ngày); 30 ngày vẫn là "days"; ví dụ IVY-39891 của PRD (2 hours / 1 day / 2 days); đồng hồ chạy trước → Just now; nhóm New rồi Recent, giữ thứ tự, bỏ nhóm rỗng; thẻ đọc trong lúc mở vẫn ở New |
| `tab-chips.test.mjs` | `deliveryTab`: tab có chip Delivery (một tab danh sách → Notifications; hai tab → Orders; không có → null) |
| `order-answers.test.mjs` | Đơn mới nhất theo giờ đặt; Delivery inquiry chọn đơn đang giao mới nhất, không có thì đơn mới nhất; trạng thái thanh toán từ `status_internal`; giai đoạn giao |

Toàn bộ widget: **150 / 150**.

## 3. E2E (Playwright, widget + API giả lập)

| TC | Nội dung |
|---|---|
| TC-02-02 | Nhóm New rồi Recent; dòng trong New đều chưa đọc, trong Recent đều đã đọc |
| TC-02-04 | Chữ giờ: `Just now · N min ago · 1 hour ago · N hours ago · 1 day ago · N days ago` |
| TC-02-07 | Chạm thẻ → Back: đã đọc nhưng vẫn ở New; đóng / mở widget → sang Recent |
| TC-02-08 | Chuột phải → menu, Delete có focus → `DELETE {ids:[502]}` → toast "1 notification deleted" |
| TC-02-09 | Esc đóng menu, widget còn mở |
| TC-02-10 | Điện thoại: nhấn giữ → menu; nhấc tay không mở Order Detail |
| TC-04-08 | Nút xe tải → chip Delivery, thẻ đơn đó đứng đầu và viền; đổi chip → hết |
| TC-04-09 | Đơn đang giao có chấm cam |
| TC-11-01 | Email là kênh duy nhất → Contact Support mở thẳng form |
| TC-11-02…07 | Form như cũ, không còn bước chọn thẻ email |
| TC-11-09 | Payment check → thẻ đơn mới nhất "Paid" + câu hướng dẫn → Contact Support → form có "Order IVY-39891" → gửi kèm `order_id` |
| TC-11-10 | Delivery inquiry → tracker của đơn đang giao + 3 chip |
| TC-11-11 | Feedback trống → báo lỗi, không gọi API; có nội dung → `kind: feedback` → thẻ đã gửi + cảm ơn |
| TC-11-12 | Order Detail → "Email us about this order" → tab Chat, form có mã đơn |

## 4. Tích hợp và biên

| Ca | Cách kiểm | Kết quả |
|---|---|---|
| SQL chạy 2 lần | `sql/261125-prd-v1-phase1.sql` trên MySQL 8 máy local, 2 lần liền | Không lỗi; `inquiries.kind varchar(16) default 'inquiry'`, `campaigns.target_customer_ids json null` |
| Lệnh dọn tự join | `EXPLAIN UPDATE notifications n JOIN notifications m …` | MySQL 8 nhận; dùng chỉ mục `idx_notif_ref` / `idx_notif_customer` |
| API khởi động thật | `node dist/main.js` sau khi đổi entity | `Nest application successfully started` |
| Shopify `cancelledAt` | Context7, Admin GraphQL 2026-01: `Order.cancelledAt`, `OrderDisplayFinancialStatus.REFUNDED` / `PARTIALLY_REFUNDED` | Có trong schema |
| Khách mở widget lúc thẻ mới tới | Snapshot thêm id chưa đọc mới vào New | Theo unit `useNewSnapshot` qua TC-02-07 |
| Khách tắt marketing qua CCPA | CCPA ghi mọi kênh ngoài = tắt, gồm cả mục marketing → bị loại | Unit `marketingRefusers` |
| Tenant có nhiều kênh liên hệ | Live chat bật → vẫn hiện thẻ chọn kênh | TC-11-05 |
