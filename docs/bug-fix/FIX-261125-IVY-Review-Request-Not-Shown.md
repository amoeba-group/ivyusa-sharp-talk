# FIX-261125 — Yêu cầu review (N-05) được tạo nhưng khách không thấy

| | |
|---|---|
| Phát hiện | 2026-11-25, khi soạn hướng dẫn test cho IVY (mục 12), trước khi IVY test |
| Ảnh hưởng | Production từ 07:35 UTC (bật Review requests 7 ngày): thông báo `review` được ghi nhưng không hiện ở đâu và không tăng badge. Không lộ dữ liệu, không lỗi trang |
| Liên quan | [PLN-261125-IVY-PRD-v1-Phase4](../plan/PLN-261125-IVY-PRD-v1-Phase4.md) §2, BUG-042 |

## 1. Nguyên nhân gốc

Widget của IVY chỉ có một thanh chip (Order · Delivery · Promo · Review):

- **Order** chỉ liệt kê thông báo `payment` và `shipping` (`tab-chips.ts` `ORDER_FEED_CATEGORIES`).
- **Review** là danh sách sản phẩm đã giao (`ReviewItemList`), không phải danh sách thông báo.
- **Badge** của widget một thanh chỉ đếm `payment` · `shipping` · `event` (`SINGLE_BAR_FEED_CATEGORIES`, BUG-042). Lý do: một thông báo không có chỗ hiện thì không đọc được, nên badge sẽ không bao giờ về 0.

Job N-05 ghi thông báo loại `review` (`refType = order_item`). Loại này không có chỗ hiện nào trên widget một thanh, và bị loại khỏi badge. Lúc làm PLN giai đoạn 4, tôi viết "badge +1" mà không đối chiếu với BUG-042.

## 2. Cách sửa

Chỗ hiện của yêu cầu review là **dòng sản phẩm** mà nó nhắc tới, trong chip Review:

- `GET /orders/review-items`: mỗi dòng có thêm `requestId` (thông báo review chưa đọc của dòng đó). Dòng có yêu cầu đứng đầu danh sách.
- Widget: dòng đó được tô sáng và có chấm đỏ, như thẻ chưa đọc (PRD slide 8). Bấm Write Review → `POST /notifications/:id/read`. Tô sáng tắt ngay; dòng giữ nguyên chỗ tới lần mở sau (slide 9, quy tắc 3).
- Badge của widget một thanh: đếm thêm `review`, **chỉ** khi `refType = order_item`. Dòng `review` cũ không gắn sản phẩm vẫn không được đếm (BUG-042).
- Gửi review (`POST /reviews`) cũng đánh dấu đã đọc yêu cầu của dòng đó.

File:

- `notification.service.ts`: `unreadCount`, `markReviewRequestsRead`
- `order.service.ts`, `order.mapper.ts`, `order.module.ts`
- `review.service.ts`
- `packages/types` (`ReviewItemResponse.requestId`)
- widget `ReviewItemList.tsx`

## 3. Kiểm thử

- **Unit:**
  - badge đếm `review` gắn sản phẩm, bỏ `review` không gắn;
  - `requestId` và thứ tự dòng;
  - gửi review thì đánh dấu đã đọc; lỗi khi đánh dấu không làm hỏng review.
- **E2E** TC-06-06: dòng có yêu cầu đứng đầu, `data-new="true"`, có chấm Unread. Write Review → `POST /notifications/77/read`.
- `06`, `02`, `17`: **23 / 23**.

## 4. Cách phòng

Khi server bắt đầu ghi **một loại thông báo mới** (category / refType), PLN phải trả lời được 3 câu hỏi cho widget một thanh của IVY:

1. Thông báo hiện ở chip nào?
2. Bấm vào đâu thì nó thành đã đọc?
3. Badge có đếm nó không (`SINGLE_BAR_FEED_CATEGORIES`)?

Thiếu một câu trả lời là thông báo vô hình, hoặc làm badge kẹt (BUG-042).
