# RPT-261119 — Số chưa đọc của Chat (BUG-041) và tên nhân viên hiện với khách

Nguồn: chủ dự án thử trả lời từ live chat của console ngày 2026-11-19 và báo hai điểm: (1) số "2" hiện ở chuông và tab Notifications, không ở Chat, và không mất; (2) khách thấy tên tài khoản của nhân viên ("Master Owner"), nên là một tên khác, ví dụ "Ivyusa Support".

Điểm (1) là lỗi, làm theo quy trình bug-fix (ivy-docs BUG-041). Điểm (2) là yêu cầu trực tiếp của chủ dự án; cách làm (một tuỳ chọn thiết kế) do tôi chọn để không đổi hành vi của tenant khác.

## 1. Thay đổi

Không có SQL.

| Phần | File | Nội dung |
|---|---|---|
| Phạm vi đếm | `packages/types/.../enum.types.ts`, `apps/api/.../notification.service.ts` | `NOTIFICATION_SCOPE` thêm `feed` (mọi loại trừ `chat`) và `chat`; `notice` cũng bỏ `chat`. Không phạm vi = tất cả (chuông trên trang cửa hàng) |
| Đọc khi mở Chat | `notification.controller.ts`, `notification.service.ts` | `POST /notifications/read-chat` đánh dấu đã đọc mọi thông báo loại `chat` của khách, xoá cache số chưa đọc |
| Widget | `components/widget/useTabBar.ts`, `services/notificationService.ts` | Số của Notifications = phạm vi `feed`. Số của Chat = tin tới trong lúc trang mở + phạm vi `chat`. Khung đang mở ở tab Chat → gọi read-chat, số về 0 |
| Tên nhân viên | `packages/types/.../widget-theme.ts`, `tenant.request.ts`, `tenant.service.ts`, `widget-design.service.ts`, `WidgetDesignsCard.tsx`, `settings.service.ts`, `locales/*/settings.json`, `MessageBubble.tsx`, `seed.runner.ts` | Tuỳ chọn thiết kế `agentName: person \| label`. `label`: khi tenant đã đặt **Agent sender name**, mọi câu trả lời của nhân viên mang nhãn đó, không hiện tên hay ảnh hồ sơ của nhân viên. Chưa đặt nhãn thì vẫn hiện tên riêng |
| Test | `notification.service.spec.ts`, `widget-theme.spec.ts`, `e2e/fixtures/mock-api.ts`, `e2e/tests/01-shell-header.spec.ts` | 3 ca API mới + 3 ca sửa; TC-01-09, TC-01-10 |

## 2. Hành vi sau khi sửa

- Nhân viên trả lời khi khách không mở khung: chuông trên trang cửa hàng tăng. Khách mở khung (mặc định vào tab Chat) → thấy tin, số mất.
- Khách đang ở tab Notifications: số hiện trên **tab Chat**; số của Notifications không đổi.
- "Delete all" ở danh sách thông báo không xoá các thông báo loại `chat`.

## 3. Kiểm thử (local, 2026-11-19)

| Loại | Kết quả |
|---|---|
| API `src/domain/notification`, `src/domain/tenant` | 166 / 166 |
| `packages/types` `widget-theme.spec.ts` | 64 / 64 |
| Widget `node --test` | 146 / 146 |
| E2E `test:ci` | 147 / 147 (TC-01-09, TC-01-10 mới) |
| Typecheck · `i18n:check` | sạch · đủ 6 ngôn ngữ |

Chưa kiểm ở local với nhân viên thật trả lời: đường đó cần console + khách đã đăng nhập; chờ chủ dự án thử lại trên bản Preview.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit / CI | ⏳ |
| Server `talkaibotprd01` | ⏳ (build lại `api`, `web`, `widget`) |
| Production: Agent sender name = "Ivyusa Support" (6 ngôn ngữ) + Agent name shown to shoppers = The generic label | ⏳ sau deploy, trong console |
| Chủ dự án thử lại | ⏳ |
