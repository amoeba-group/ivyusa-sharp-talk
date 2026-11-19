# RPT-261119 — Chat của IVY: bong bóng không tự đổi chữ, thẻ còn sau khi chuyển trang, ẩn "Knowledge referenced"

Kế hoạch: [PLN-261119](../plan/PLN-261119-IVY-Chat-Continuity-And-References.md), duyệt ngày 2026-11-19 (`1. ok 2. a 3. ok`). Lỗi: ivy-docs BUG-038, BUG-039.

## 1. Thay đổi

Không có SQL.

| # | Phần | File | Nội dung |
|---|---|---|---|
| 1 | API | `chat/dto/request/chat.request.ts`, `chat.controller.ts`, `scenario.service.ts` | `POST /chat/scenario` nhận `label` (≤ 120). Lời của khách được lưu = tên nút đã bấm; câu soạn sẵn của kịch bản chỉ là dự phòng |
| 1 | Widget | `services/chatService.ts`, `hooks/useChat.ts` | Gửi kèm `label` |
| 2 | Widget | `lib/thread-inserts.ts` (mới), `components/chat/ChatTab.tsx` | Thẻ của widget được lưu vào `sessionStorage` theo phiên + cuộc trò chuyện, khôi phục khi tải lại, xoá khi chat kết thúc. Thẻ nhớ vị trí; nếu số tin nhắn quay lại ít hơn thì thẻ nằm cuối thay vì biến mất |
| 3 | Kiểu dữ liệu · API · Console · Widget | `packages/types/.../widget-theme.ts`, `tenant.request.ts`, `tenant.service.ts`, `widget-design.service.ts`, `WidgetDesignsCard.tsx`, `settings.service.ts`, `locales/*/settings.json` (4 khoá × 6 ngôn ngữ), `MessageBubble.tsx`, `seed.runner.ts` | Tuỳ chọn thiết kế `citations: shown \| hidden` |
| — | Test bị "hẹn giờ" | `chat/thread.service.spec.ts` | BUG-039: test ghi cứng ngày `2026-10-20` trong khi code bỏ đoạn trích cũ hơn 30 ngày → tự đỏ từ 2026-11-19 và sẽ chặn cổng deploy. Đổi sang ngày tương đối |

## 2. Điều cần biết

- Ẩn danh sách nguồn cũng ẩn link sản phẩm và video AI gợi ý kèm câu trả lời.
- Thẻ chỉ được nhớ trong cùng tab; nhân viên vẫn không thấy các lần bấm Contact Support / My Orders (lựa chọn 2b chưa làm).
- Nút tuỳ biến kiểu `message` không đổi hành vi.
- Chưa có ca E2E cho mục 1: bộ giả lập API của E2E trả lời thay `/chat/scenario`; phần này có test đơn vị phía server.

## 3. Kiểm thử (local, 2026-11-19)

| Loại | Kết quả |
|---|---|
| API `scenario.service.spec.ts` | 2 ca mới (lưu tên nút; dự phòng + cắt 120 ký tự) — xanh |
| Widget `node --test` | 145 / 145 (8 ca mới cho `thread-inserts`) |
| `packages/types` `widget-theme.spec.ts` | 63 / 63 |
| E2E `test:ci` | 145 / 145 (TC-11-07 mới) |
| Toàn bộ API | 288 / 291 suite; 3 suite đỏ là 3 suite vốn đỏ trên Windows. `thread.service.spec.ts` xanh lại sau khi sửa BUG-039 |
| Typecheck · `i18n:check` | sạch · đủ 6 ngôn ngữ |

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit / CI | `5504ed3e` · IVY CI/CD run `44452218622` xanh (2026-11-19) |
| Server `talkaibotprd01` | ✅ bản build mới của widget được phục vụ từ 03:39 UTC ngày 2026-11-19 |
| Knowledge references = Hidden trên production | ✅ 2026-11-19, thiết kế "Ivyusa Talk"; ba tuỳ chọn hôm trước giữ nguyên (`none` · `hidden` · `white`). `session/ensure` trả `citations: hidden`. Bản trước lưu ở `D:/amoeba/_localdev/ivy-prod-backup-20261117/widget_designs_before_citations.json` |
| Chủ dự án thử lại trên bản Preview | ⏳ Tôi chỉ kiểm khung talk vẫn mở bình thường trên Preview; không gửi tin nhắn nào trên production, nên ba hành vi mới (tên nút giữ nguyên, thẻ còn sau khi chuyển trang, không có danh sách nguồn) chờ chủ dự án thử |
