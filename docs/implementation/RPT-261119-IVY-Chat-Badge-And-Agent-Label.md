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

## 5. Bổ sung cùng ngày: số chưa đọc hiện nhanh hơn

Chủ dự án báo sau khi thử: nhân viên trả lời xong, số trên chuông ngoài website "đợi rất lâu" mới hiện.

- **Nguyên nhân:** widget hỏi số chưa đọc mỗi 30 giây, và không hỏi lại khi tab được nhìn tới (`refetchOnWindowFocus: false` là mặc định của widget). Trình duyệt lại dừng bộ đếm giờ ở tab nền: người thử gõ ở tab console, quay về tab cửa hàng thì phải chờ thêm tới hết một chu kỳ.
- **Sửa (`apps/widget/src/hooks/useNotifications.ts`):** hỏi mỗi **10 giây**, và hỏi **ngay** khi tab được nhìn tới lại. Phía server câu trả lời lấy từ cache 20 giây, cache này bị xoá mỗi khi có thông báo mới hoặc được đọc, nên số mới có ngay ở lượt hỏi kế tiếp.
- **Giới hạn:** vẫn là hỏi định kỳ, không phải đẩy tức thời: chậm nhất khoảng 10 giây khi tab đang mở. Tức thời thật sự cần kênh đẩy (WebSocket / SSE), hiện widget không có.
- **Tải:** mỗi trang cửa hàng đang mở của khách **đã đăng nhập** gửi 2–3 yêu cầu nhỏ mỗi 10 giây thay vì mỗi 30 giây. Khách vãng lai không gửi.
- TC-01-10 chạy lại với chu kỳ 10 giây; `test:ci` 147 / 147.
