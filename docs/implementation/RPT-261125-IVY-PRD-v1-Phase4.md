# RPT-261125 — IVY PRD v1, giai đoạn 4: S-01 · N-05 · C-03

| | |
|---|---|
| Kế hoạch | [PLN-261125-IVY-PRD-v1-Phase4](../plan/PLN-261125-IVY-PRD-v1-Phase4.md). Bắt đầu theo lệnh chủ dự án 2026-11-25: "ok, bắt đầu làm việc thứ 5 luôn" |
| Kiểm thử | [TCR-261125-IVY-PRD-v1-Phase4](../test/TCR-261125-IVY-PRD-v1-Phase4.md) |
| SQL | `sql/261125-prd-v1-phase4-review-requests.sql` — **chạy trước khi push** |

## 1. Thay đổi

### 1.1 S-01 — kết thúc chat

| Phần | Nội dung | File |
|---|---|---|
| Widget | Nút **Start a new chat** dưới "The chat has ended". Chỉ hiện sau khi khách chấm điểm hoặc bỏ qua. Bấm thì xoá thẻ chèn, ô nhập phụ, lời chào đăng nhập, rồi về lời chào + menu | `ChatTab.tsx` |
| Widget | `startNewChat()` nhớ id cuộc chat đã kết thúc (`localStorage` `ivy.chat.cleared`). Lượt hỏi máy chủ sau và lần tải lại đều coi cuộc đó là "chưa có chat". Chỉ ẩn cuộc **ended**: nhân viên mở lại (BUG-044) thì cuộc chat hiện lại. Tin nhắn / nút nhanh tiếp theo mở cuộc mới như trước | `useChat.ts` |
| Widget | Chữ "Start a new chat" ×6 ngôn ngữ | `i18n/locales/*.ts` |
| API | `GET /agent/csat/conversations` trả thêm `mode` (`ai` / `agent`, cùng phép gán nhân viên với cột Agent) và `emailForm` (có phiếu liên hệ gửi từ cuộc chat — gồm form ngoài giờ E-02 b). Thêm 1 truy vấn mỗi trang; truy vấn lỗi thì cột để trống, báo cáo vẫn trả về | `agent.service.ts` |
| Console | Statistics → Satisfaction → By session: cột **Answered by**, **Email form** ×6 ngôn ngữ | `CsatSection.tsx`, `statistics.service.ts`, `statistics.json` ×6 |

Tự kết thúc chat **không đổi code**: chính sách Chat close (Settings → Widget) đã có từ PLN-261026, chờ bật trên production.

### 1.2 N-05 — yêu cầu review N ngày sau khi giao

| Phần | Nội dung | File |
|---|---|---|
| Bảng | `fulfillments.delivered_at`, `fulfillments.review_requested_at`, index `idx_ful_review_due`, `tenants.review_request_days` | entity ×2, SQL |
| Ngày giao | Đồng bộ Shopify: `deliveredAt` của gói giao sau cùng, không có thì giờ cập nhật; chỉ khi mọi gói đã giao. Ghi một lần. Đơn đã delivered trước đó được điền ở lần đọc sau. Webhook: lúc nhận | `shopify-shipment.ts`, `shopify-sync.service.ts`, `order.service.ts` |
| Lịch | `ReviewRequestService`: 90 giây sau khi khởi động, rồi mỗi 60 phút (`REVIEW_REQUEST_SWEEP_MIN`, 0 = tắt; CLI không chạy). Đơn giao N…N+7 ngày trước, chưa xử lý, có khách, không huỷ / hoàn, tối đa 200 / tenant / lượt. Đánh dấu trước rồi gửi, nên không gửi trùng | `review-request.service.ts`, `review.module.ts` |
| Gửi | Thông báo `review` cho sản phẩm đầu tiên chưa review (`order_item`): nút ⭐ Write Review của widget mở đúng form. Câu theo ngôn ngữ phiên gần nhất của khách (6 ngôn ngữ). Bỏ qua (vẫn đánh dấu) khách từ chối marketing (cùng danh sách campaign N-04) và đơn đã review hết | `review-request.service.ts`, `packages/types/src/common/review-request.ts` |
| Cài đặt | `PATCH /tenants/widget-settings` nhận `review_request_days` (1–60, `null` = tắt). Ngoài khoảng → **E5168** `REVIEW_REQUEST_DAYS_INVALID` + log cảnh báo. Response có `reviewRequestDays` | `tenant.request.ts`, `tenant.service.ts`, `tenant.response.ts`, `tenant.mapper.ts`, `error-code.constant.ts` |
| Console | Settings → Marketing & Helpdesk: thẻ **Review requests** (bật / tắt, số ngày, quy tắc), toast lưu / lỗi, 6 ngôn ngữ | `ReviewRequestCard.tsx`, `SettingsMarketingPage.tsx`, `settings.service.ts`, `settings.hooks.ts`, `settings.json` ×6 |

Write Review → Yotpo: chưa làm, cần khoá Yotpo của IVY (thứ 6).

### 1.3 C-03 — Cancel order

- Câu `cancel_order` của IVY trong seed: đăng nhập [tài khoản IVY](https://account.ivyusa.com/orders) → mở đơn → yêu cầu huỷ. Không thấy lựa chọn đó thì email hello@ivyusa.com. 6 ngôn ngữ. Link là markdown, widget đã hiển thị được (`RichText`). File: `seed.runner.ts`.
- **Không đổi code widget / API.**
- Production dùng câu đã lưu trong AI Settings → Script library. Sửa ở đó khi chủ dự án bảo.

## 2. Kiểm thử

Chi tiết ở TCR.

| Bộ | Kết quả |
|---|---|
| Unit mới / sửa: review request 8 · shipment +5 · tenant +5 · CSAT +2 | Xanh |
| API toàn bộ | 3031 / 3034. 3 ca chỉ đỏ trên Windows |
| `packages/types` / widget | 224 / 150, xanh |
| E2E T12 (desktop) | **9 / 9**, có TC-12-08..09 mới |
| Typecheck ×4, `i18n:check`, manifest migration | Sạch |
| Local | SQL ×2. API khởi động. E5168. Lịch gửi đúng 1 thông báo cho đơn giao 6 ngày trước (N = 5). Console hiện thẻ mới và 2 cột mới |

## 3. Trạng thái triển khai

| Bước | Ai | Trạng thái |
|---|---|---|
| 1. Chạy `sql/261125-prd-v1-phase4-review-requests.sql` trên DB production (lệnh `git show … \| docker exec -i sharptalk_mysql …`) | Chủ dự án | ⏳ |
| 2. Push `deploy/talk-ivyusa`. Kiểm không có re-sync đơn đang chạy | Tôi | ⏳ sau bước 1 |
| 3. Kiểm chỉ đọc: widget có nút Start a new chat; console có thẻ Review requests và 2 cột mới | Tôi | ⏳ |
| 4. Production: bật Chat close (đề xuất hỏi đánh giá sau 5 phút, đóng sau 3 phút) | Chủ dự án bảo | ⏳ |
| 5. Production: Review requests N ngày (đề xuất 7) | Chủ dự án bảo | ⏳ |
| 6. Production: câu Cancel order mới trong Script library | Chủ dự án bảo | ⏳ |
| 7. IVY: Shopify → Settings → Customer accounts → bật "Self-serve returns and cancellations" (có huỷ đơn) | IVY | ⏳ |
