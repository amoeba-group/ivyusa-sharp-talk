# RPT-261119 — Live Chat: đã đọc / chưa đọc, màn gọn, mặt đánh giá

Kế hoạch: [PLN-261119](../plan/PLN-261119-Console-LiveChat-Unread-And-Csat-Faces.md) (duyệt 2026-11-19: `1. ok 2. a 3. a 4. ok`) · Kiểm thử: [TCR-261119](../test/TCR-261119-Console-LiveChat-Unread-And-Csat-Faces.md)

Nguồn: chủ dự án, 2026-11-19 — (1) vì sao đoạn hội thoại không giữ mặt đánh giá đã chọn; (2) Live Chat phải cho thấy cuộc trò chuyện nào đã đọc, nào chưa ("hiện tại quá rối và tôi không thể kiểm tra"); (3) phân tích và ẩn các nút / khối không cần thiết để bàn giao dễ hơn.

## 1. Thay đổi

### 1.1 Đã đọc / chưa đọc (theo từng nhân viên)

```
(All)(Unread 2)(Needs agent)(Ended)
▌cong11              2 min     ← chưa đọc: vạch trái, tên đậm, số tin của khách
▌Customer: hi          (2)
 cong11              20 h      ← đã đọc: không ký hiệu, chữ nhạt
 AI: Become an IVY…
 Needs an agent                ← dòng 3 chỉ khi cần làm gì đó
```

- **Chưa đọc** = khách có tin nhắn sau dấu đọc của *nhân viên đang đăng nhập*. Tin của AI, nhân viên và thông báo hệ thống không tính.
- Mở cuộc trò chuyện là đã đọc; khách nhắn thêm trong lúc đang mở cũng là đã đọc. Tab trình duyệt ở nền thì không.
- Rê chuột trên dòng: **Mark as read / Mark as unread** và ghim. Trong More: Mark as unread (đóng cuộc trò chuyện lại).
- Bộ lọc **Unread** (có số), nút **Mark all as read** trong bộ lọc đó, số chưa đọc cạnh **Live Chat** ở menu trái (cập nhật mỗi 15 giây và khi quay lại tab).
- Nhân viên tạo tài khoản sau này: khi chưa có dấu đọc, chỉ tin gửi sau ngày tạo tài khoản mới tính.

### 1.2 Màn gọn (mặc định) và Advanced tools

Phân tích từng nút / khối ở [PLN §9.1](../plan/PLN-261119-Console-LiveChat-Unread-And-Csat-Faces.md). Tóm tắt:

- Đầu cuộc trò chuyện: tên · Session · **một nhãn trạng thái bằng chữ** (AI is answering · Needs an agent · With {tên} · AI is off · Ended · Draft waiting for approval) · **Accept** (hoặc Hand back to AI) · **End** · **More**.
- More: Find in this conversation · Pin · Mark as unread · Assign this conversation (quản lý, hoặc khi có hơn 1 AI agent) · Turn off AI auto-reply and take over · File issue (Advanced).
- Cột phải: **Customer** lên đầu, rồi Recent orders. Comments hiện khi đã có ghi chú.
- Công tắc **Advanced tools** (góc phải tiêu đề trang, nhớ theo trình duyệt) trả lại: chọn nhiều / nhóm / lọc kênh / lọc AI agent, chế độ trả lời AI, gộp phòng, gợi ý cùng khách, IP, gắn khách bằng tay, Handling history, AI Briefing, Knowledge lookup, chấm câu trả lời, lưu thành kiến thức, tra kiến thức / tạo phiếu từ tin của khách.
- Bỏ nút **Sync** (cuộc trò chuyện tự tải lại mỗi 5 giây và khi quay lại tab).

### 1.3 Mặt đánh giá

- **Console:** dòng ★★★★★ trong đoạn hội thoại thành hàng mặt khách đã thấy; mặt đã chọn có vòng xanh, các mặt khác mờ, kèm chữ ("Very satisfied").
- **Widget (BUG-043):** đánh giá xong rồi tải lại / chuyển trang, thẻ trở lại ở dạng chỉ đọc với mặt đã chọn sáng; không hỏi lại, không lặp lời cảm ơn; dấu "chat has ended" nằm dưới.

### 1.4 Bổ sung sau deploy: khuôn mặt trên dòng (chủ dự án trả lời "ok")

Chủ dự án mở Session 11 và không thấy khuôn mặt: cuộc trò chuyện đó chưa được đánh giá. Cuộc đã đánh giá (Session 16, "Very satisfied") đã tự kết thúc và nằm ở **Ended**, nơi hàng khuôn mặt hiện đúng. Để khỏi phải mở từng cái, dòng của cuộc trò chuyện đã được đánh giá hiện luôn khuôn mặt khách chọn, cạnh thời gian (rê chuột: "Rated Very satisfied"). API trả thêm `csatRating` trên mỗi dòng; không cần SQL. File: `agent.mapper.ts` (+ spec), `live-chat.service.ts`, `LiveChatPage.tsx`, `csat-faces.ts` (mới, dùng chung với `ThreadEventCard.tsx`).

### 1.5 File

| Phần | File |
|---|---|
| Bảng mới | `sql/261119-conversation-reads.sql`, `sql/artefacts.tsv`, `apps/api/src/domain/agent/entity/conversation-read.entity.ts` |
| API | `conversation-read.service.ts` (mới, + spec), `agent-console.controller.ts` (`GET /agent/sessions/unread-count`, `POST /agent/sessions/read-all`, `POST /agent/conversations/:id/read`, `POST /agent/conversations/:id/unread`; danh sách nhận `status=unread`), `agent.service.ts` (bộ lọc unread; tin cuối lấy thêm người gửi), `agent.mapper.ts` (`unreadCount`, `lastSenderType`, `lastSenderName`), `agent.module.ts`, `dto/request/agent.request.ts` |
| Console | `domain/live-chat/LiveChatPage.tsx`, `MoreMenu.tsx` (mới), `use-advanced-tools.ts` (mới), `LiveChatUnreadBadge.tsx` (mới), `ThreadEventCard.tsx`, `SessionAlias.tsx`, `live-chat.hooks.ts`, `live-chat.service.ts`, `layouts/Sidebar.tsx`, `layouts/nav-config.ts`, `i18n/locales/*/livechat.json` (6 ngôn ngữ) |
| Widget | `hooks/useChat.ts`, `components/chat/ChatTab.tsx`, `components/chat/CsatCard.tsx` |
| E2E | `e2e/tests/12-affiliate-csat.spec.ts` (TC-12-07) |
| Tài liệu | PLN (mục 9), TCR, RPT này; `ivy-docs/BUGS.md` (BUG-043), `TEST-CASES.md`, `SPEC.md` (BR-13), `TASKS.md`; `SPEC.md` gốc (§6.3) |

## 2. Migration

| | |
|---|---|
| SQL | `sql/261119-conversation-reads.sql` — tạo `conversation_reads`, rồi ghi sẵn "đã đọc tới tin mới nhất" cho mọi nhân viên hiện có × mọi cuộc trò chuyện có tin nhắn (để sau deploy danh sách không sáng đồng loạt). Chạy lại được (IF NOT EXISTS + INSERT IGNORE) |
| Thứ tự | **Chạy SQL trên production trước, rồi mới push.** Push trước thì `deploy-self-hosted.sh` dừng ở bước kiểm migration, production giữ bản cũ |
| Rollback | Lùi code trước, rồi `DROP TABLE conversation_reads;`. Không bảng nào khác phụ thuộc |

- [x] Local (MySQL 3316): chạy 2 lần, 112 dòng cả hai lần
- [x] Production (`talkaibotprd01`, container `sharptalk_mysql`): chủ dự án chạy 2026-11-19 trước khi push — bảng tạo xong, `seeded` = 16

## 3. Kiểm thử

| Bộ | Kết quả |
|---|---|
| Unit `conversation-read.service.spec.ts` + `agent.service.listsessions.spec.ts` | 30 / 30 |
| Toàn bộ API (Jest, Windows) | 2937 / 2940 — 3 ca chỉ đỏ trên Windows, xem §3.1 |
| API thật trên máy (đã đọc / chưa đọc, 404 tenant khác) | 15 / 15 |
| Khởi động API với entity mới | `Nest application successfully started` |
| E2E `test:ci` (desktop + mobile) | **148 / 148** (2.8 phút), gồm TC-12-07 mới |
| Typecheck console + widget, build console + widget | Sạch |
| `i18n:check` | 6 ngôn ngữ đủ |
| `check-migrations --check`, kiểm bo góc widget, `env:check` | Sạch |
| Giao diện console (Playwright 1440 / 1280 px) | TCR §3 — không lỗi console |

### 3.1 Toàn bộ API

Ba ca đỏ trên máy Windows, không liên quan thay đổi này; CI (Linux) xanh với chúng ở các commit trước:

| Spec | Vì sao đỏ trên Windows |
|---|---|
| `embed/embed-loader.spec.ts` › keeps the widget iframe sandboxed | Tìm chuỗi có xuống dòng LF; checkout Windows là CRLF |
| `board/board-attachment.service.spec.ts` › nine allowed formats | Đường dẫn ra `board\1\…` thay vì `board/1/…` |
| `attachment/heic-conversion.spec.ts` › HEIC as JPEG | Đường dẫn ra `7\202611\…` thay vì `7/202611/…` |

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL production | ✅ 2026-11-19, trước khi push (`seeded` = 16) |
| Commit / CI | `8f72842b` · IVY CI/CD [44487746906](https://github.com/amoeba-group/ivyusa-sharp-talk/actions/runs/44487746906) xanh (verify, e2e gate, deploy-gate) |
| Server `talkaibotprd01` | ✅ 08:37:30 UTC ngày 2026-11-19: widget phục vụ bundle mới `index-B4itaz8m.js` (trước đó `index-Bt0Ahgzv.js`). Console Live Chat (kiểm chỉ đọc): bộ lọc All · Unread · Needs agent · Ended; Advanced tools tắt; 7 dòng, 0 chưa đọc (đúng: đã ghi sẵn); mở một cuộc trò chuyện đã đọc → nhãn "AI is answering", Accept · End · More, thẻ Customer đầu cột phải, bong bóng AI không còn Rate answer / Save as knowledge / "· Default" |
| Bổ sung khuôn mặt trên dòng (§1.4) | `0b84580b` · CI [44491030846](https://github.com/amoeba-group/ivyusa-sharp-talk/actions/runs/44491030846) xanh · console bundle mới `index-eDTS5Yg2.js` lúc 08:57:24 UTC. Kiểm chỉ đọc trong một tab riêng: bộ lọc Ended có 10 dòng, 4 dòng đã đánh giá hiện 😍 "Rated Very satisfied" (Session 16, 14, 13, 11) |
| Chủ dự án thử | ⏳ (1) nhắn từ widget → dòng có vạch xanh + số ở menu trái, mở ra thì mất; (2) đánh giá rồi tải lại trang → mặt đã chọn còn sáng |
