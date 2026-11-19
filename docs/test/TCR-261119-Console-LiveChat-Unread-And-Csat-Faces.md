# TCR-261119 — Live Chat: đã đọc / chưa đọc, màn gọn, mặt đánh giá

Kế hoạch: [PLN-261119](../plan/PLN-261119-Console-LiveChat-Unread-And-Csat-Faces.md) · Báo cáo: [RPT-261119](../implementation/RPT-261119-Console-LiveChat-Unread-And-Csat-Faces.md)

## 1. Unit (API, Jest)

`apps/api/src/domain/agent/conversation-read.service.spec.ts` — 15 ca.

| Ca | Kiểm điều gì |
|---|---|
| Đếm chưa đọc | Chỉ tin `sender_type = 'user'` sau dấu đọc của chính người xem; tham số chỉ có người xem và các cuộc trò chuyện trong trang |
| Nhân viên mới | Chưa có dấu đọc → chỉ tính tin gửi sau ngày tạo tài khoản (`users.created_at`) |
| Trang rỗng | Không chạy truy vấn |
| Mark as read | Đi qua `conversations` lọc theo `tenant_id`; bỏ trùng id |
| Mark all as read | Toàn bộ tenant, không tenant khác |
| Danh sách id rỗng | Không ghi gì (không được rơi về "tất cả") |
| Mark as unread | Dấu đặt ngay trước tin cuối của khách → đúng 1 tin chưa đọc |
| Khách chưa nhắn | Trả `false`, không ghi |
| Tenant khác | Truy vấn có `c.tenant_id = ?` → không thấy gì |
| Bộ lọc Unread | Thêm điều kiện chưa đọc cho `c` và cho cuộc trò chuyện mới hơn của phòng gộp (`c2`); gồm cả cuộc trò chuyện đã kết thúc |
| Không có người xem | Trả trang rỗng, không truy vấn |
| Bộ lọc khác | Không đụng `conversation_reads` |
| Mapper | Mặc định đã đọc; mang `unreadCount`, `lastSenderType`, `lastSenderName`; không có tin → `lastSenderType` null |

Toàn bộ suite API: xem RPT §3.

## 2. Tích hợp (API thật trên máy, MySQL portable, 2026-11-19)

Script `local-unread-api.cjs` (scratchpad), tài khoản Master seed, tenant `ivyusa`. 15 / 15 PASS.

| # | Kịch bản | Kết quả |
|---|---|---|
| 1 | Đăng nhập | 201 |
| 2 | Mark all as read → số chưa đọc | 0 |
| 3 | Dòng danh sách có `unreadCount`, `lastSenderType`, `lastSenderName` | Có (lần chạy đầu `lastSenderType` = null → sửa truy vấn tin cuối, chạy lại đạt) |
| 4–7 | Mark as unread một cuộc trò chuyện → số = 1 → bộ lọc Unread chỉ có nó với 1 tin chưa đọc | Đạt |
| 8–9 | Mark as read → số = 0 | Đạt |
| 10 | Khách nhắn 1 tin, AI trả lời 1 tin | Số = 1 (tin AI không tính) |
| 11 | Dòng: 1 chưa đọc, người nói cuối = `ai` | Đạt |
| 12–13 | Mark all as read → 0 | Đạt |
| 14–15 | Cuộc trò chuyện không tồn tại / của tenant khác: read, unread | 404 |

Migration `sql/261119-conversation-reads.sql` chạy **hai lần** trên DB local: bảng tạo một lần, seed 112 dòng cả hai lần (idempotent). API khởi động thật với entity mới: `Nest application successfully started`.

## 3. Giao diện console (Playwright trên máy, 1440 × 900 và 1280 × 800)

| Ca | Kết quả |
|---|---|
| Dòng chưa đọc: vạch trái, tên đậm, thời gian xanh đậm, số tin | Đạt |
| Dòng đã đọc: không ký hiệu, chữ nhạt; tiền tố "Customer:" / "AI:" | Đạt |
| Menu trái: số cạnh Live Chat | `1` trước khi mở, mất sau khi mở |
| Bộ lọc Unread | 1 dòng; mở ra thì dòng thành đã đọc **và vẫn ở chỗ cũ** |
| Đầu cuộc trò chuyện | Tên · Session · nhãn trạng thái "AI is answering" · Accept · End · More |
| More | Find in this conversation · Pin · Mark as unread · Assign this conversation · Turn off AI auto-reply and take over |
| Mặt đánh giá trong đoạn hội thoại | "Customer rated this chat" · 4 mặt, mặt đã chọn có vòng xanh, 3 mặt kia mờ · "Very satisfied" |
| Advanced tools bật | Select, Groups, lọc kênh/AI agent, chế độ AI, gộp phòng, IP, gắn khách, Comments, Handling history, AI Briefing hiện lại |
| 1280 px | Hàng lọc xuống dòng ở "Ended", không tràn |
| Bộ lọc Ended: dòng đã được đánh giá có khuôn mặt cạnh thời gian (bổ sung sau deploy) | 16 dòng có mặt; nhãn đọc màn hình "Rated Satisfied" / "Rated Very satisfied" |
| Lỗi console trình duyệt | Không có |

## 4. E2E widget (Playwright)

| Ca | Kết quả |
|---|---|
| TC-12-07 (mới) Đánh giá → tải lại trang → thẻ còn, "Satisfied" sáng, 3 mặt kia khoá, không có Skip, không hỏi lại, chỉ 1 lần `POST /chat/csat`, dấu kết thúc nằm dưới | Đạt |
| `@T12` | 7 / 7 |
| `test:ci` (desktop + mobile) | Xem RPT §3 |

## 5. Ca biên

- Tab trình duyệt ở chế độ nền: không đánh dấu đã đọc; quay lại tab thì đánh dấu.
- Đang mở một cuộc trò chuyện mà khách nhắn thêm: đánh dấu đã đọc ngay (đang nhìn thấy).
- Mark as unread cuộc trò chuyện đang mở: đóng nó lại, để tin tiếp theo không tự đọc mất.
- Phòng gộp: mở một phòng là đã đọc mọi cuộc trò chuyện trong phòng.
- Tắt Advanced tools khi đang lọc theo kênh / AI agent / nhóm: bộ lọc trở về "tất cả".
- Điểm cũ của thẻ 5 mặt (giá trị 2): widget và console hiện trên thang 5 mặt.
