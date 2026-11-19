# RPT-261119 — Console: mục Inquiries trong menu, ẩn tab Callback requests khi không dùng

Nguồn: chủ dự án, 2026-11-19. Sau khi hỏi "khách gửi Contact Support thì lưu ở đâu", chủ dự án không tìm thấy trang đó trong console (nó chỉ tới được qua chuông ở thanh trên → View all → tab Inquiries). Yêu cầu: thêm mục menu ("đúng, hãy làm nó"), và ẩn hai tab Alarms / Callback requests **nếu dự án này không dùng**.

## 1. Kết quả kiểm trên production trước khi làm

| Tab | Dùng không | Căn cứ (2026-11-19) |
|---|---|---|
| Alarms | **Có** → giữ | 2 báo động đang có. Đây là danh sách phía sau chuông của console: khách bấm "Talk to an agent" thì nhân viên được báo ở đây |
| Callback requests | **Không** → ẩn | 0 yêu cầu; `handoffConfig` của tenant trống, tức tính năng xin gọi lại chưa bật |
| Inquiries | Có | 5 form liên hệ |

## 2. Thay đổi

Không có SQL. Thay đổi giao diện console, chủ dự án duyệt trong chat.

```
Conversations                         Alerts (qua chuông → View all)
  Live Chat                             [ Alarms ] [ Inquiries (n) ]
  Inquiries          ← mới              (Callback requests chỉ hiện khi tenant bật
  Conversation History                   xin gọi lại, hoặc đã có yêu cầu)
```

| Phần | File | Nội dung |
|---|---|---|
| Menu | `apps/web/src/layouts/nav-config.ts`, `Sidebar.tsx`, `locales/*/nav.json` | Mục **Inquiries** ngay dưới Live Chat, cùng quyền với Live Chat (`live_chat`). Live Chat không còn được đánh dấu "trang hiện tại" khi đang ở trang Inquiries (`notUnder`) |
| Trang | `apps/web/src/domain/alerts/InquiriesPage.tsx` (mới), `router/AppRouter.tsx` | `/live-chat/inquiries`: cùng danh sách với tab Inquiries của trang Alerts. Nằm dưới `/live-chat` để dùng chung cổng quyền |
| Tab Callback | `apps/web/src/domain/alerts/AlertsPage.tsx` | Chỉ hiện khi tenant bật `handoffConfig.callback.enabled`, hoặc đã có ít nhất một yêu cầu, hoặc mở thẳng bằng `?tab=callbacks` |
| Email báo inquiry | `apps/api/src/domain/inquiry/inquiry.service.ts` | Dòng chỉ đường trong email: "Inquiries, in the left menu" |

Tab Inquiries trong trang Alerts vẫn giữ, để link cũ và thói quen cũ không hỏng.

## 3. Kiểm thử (local, 2026-11-19)

- Console local, tài khoản Master seed: menu có Inquiries; mở `/live-chat/inquiries` → tiêu đề "Inquiries", breadcrumb "Conversations › Inquiries", chỉ mục Inquiries được đánh dấu hiện tại; ở `/live-chat` và `/live-chat/alerts` thì Live Chat được đánh dấu; trang Alerts có hai tab "Alarms | Inquiries".
- Typecheck monorepo sạch; `i18n:check` đủ 6 ngôn ngữ; `src/domain/inquiry` 9 / 9.
- Console không có bộ E2E riêng (E2E của IVY chỉ chạy widget).

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit / CI | `ef85eaa9` · IVY CI/CD xanh (2026-11-19) |
| Server `talkaibotprd01` | ✅ 06:41 UTC ngày 2026-11-19: `/live-chat/inquiries` có tiêu đề "Inquiries", 5 dòng, mục Inquiries được đánh dấu hiện tại; trang Alerts còn hai tab "Alarms | Inquiries" (4 inquiry đang mở) |
