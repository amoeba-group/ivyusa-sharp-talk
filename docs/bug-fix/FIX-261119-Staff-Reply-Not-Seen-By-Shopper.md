# FIX-261119 — Tin nhân viên trả lời không hiện trong khung chat của khách (BUG-044)

Chủ dự án duyệt hướng sửa ngày 2026-11-19: `1. ok 2. a`.

## 1. Hiện tượng

Chủ dự án gửi 3 tin từ console vào cuộc trò chuyện của khách `cong11`. Trên website, chuông vẫn báo có tin mới, nhưng mở khung chat ra thì không thấy 3 tin đó; khung chat đang hiện một cuộc trò chuyện khác đã kết thúc.

## 2. Nguyên nhân

Dữ liệu production lúc báo lỗi, đọc từ danh sách Live Chat:

| Cuộc trò chuyện | Phiên chat | Trạng thái |
|---|---|---|
| 12–16 | 168 | đã kết thúc |
| **11**: khung chat của chủ dự án đang hiện | 166 | đã kết thúc, đã đánh giá |
| **10**: nơi 3 tin được gửi | 165 | đang mở |
| 8, 9 | 161, 162 | đang mở |

Có ba điểm cộng lại:

1. **Một khách có nhiều phiên chat.** Mỗi trình duyệt, thiết bị, hoặc mỗi lần quay lại sau 24 giờ thì widget mở phiên mới. Các cuộc trò chuyện của phiên cũ vẫn ở trạng thái "đang mở" trong console.
2. **Widget chỉ hiện cuộc trò chuyện mới nhất của đúng phiên nó đang giữ** (`ChatService.findLatestConversation`). Tin gửi vào phiên khác, hoặc vào một cuộc cũ hơn trong cùng phiên, không bao giờ hiện ra.
3. **Thông báo "nhân viên đã trả lời" gửi theo khách, không theo phiên.** Vì vậy chuông vẫn sáng. Mở Chat còn đánh dấu thông báo là đã đọc, dù tin không hiện.

Đọc code còn thấy thêm một lỗi tiềm ẩn. Khi cuộc trò chuyện được hiện đổi giữa hai lần widget hỏi tin mới, widget hỏi tiếp bằng con trỏ của cuộc cũ và ghép tin của cuộc mới vào lịch sử cuộc cũ. Hàm `reconcile` còn giữ nguyên đoạn chat cũ mỗi khi đoạn mới ngắn hơn.

## 3. Sửa

| Phần | Thay đổi | File |
|---|---|---|
| API | Chỉ cho trả lời **cuộc mới nhất của phiên**, vì đó là cuộc khách thấy. Cuộc cũ hơn trả `409 E5165 CONVERSATION_SUPERSEDED` và không lưu gì | `agent.service.ts`, `error-code.constant.ts` |
| API | Trả lời cuộc **đã kết thúc** thì mở lại cuộc đó, theo lựa chọn của chủ dự án: giao cho nhân viên vừa trả lời, xoá thời điểm kết thúc, bắt đầu lại chu kỳ tự đóng | `agent.service.ts` (`reopenForReply`, dùng lại `accept`) |
| API | Phiên vừa được trả lời trở thành phiên "mới hoạt động nhất" (`sessions.updated_at`). Identify của khách đã đăng nhập chọn đúng phiên này | `agent.service.ts` (`touchSession`) |
| API | Màn chi tiết cuộc trò chuyện trả thêm `latestConversationId` | `agent-console.controller.ts` |
| Widget | Giữ chữ ký identify của trang để hỏi lại server khi khách mở panel, mở tab Chat, hoặc khi số thông báo "nhân viên đã trả lời" tăng. Nếu server chỉ sang phiên khác thì widget chuyển sang phiên đó | `useEmbedCommands.ts`, `useTabBar.ts`, `widgetStore.ts` |
| Widget | Khi đổi phiên hoặc server đổi cuộc trò chuyện thì đọc lại **toàn bộ** và thay đoạn chat; khi khách tự bắt đầu cuộc mới thì vẫn giữ cách cũ | `useChat.ts` |
| Widget | Cuộc trò chuyện được mở lại không còn thẻ đánh giá cũ nằm dưới tin mới, và đóng widget không hỏi đánh giá lần nữa | `ChatTab.tsx` |
| Console | Ở cuộc không phải cuộc mới nhất của phiên: dải vàng "The customer no longer sees this conversation. Their chat shows Session N." kèm nút **Open Session N**, và ô gửi bị khoá. Ở cuộc đã kết thúc, ô gửi ghi "Reply to reopen this conversation"; gửi xong báo "Conversation reopened…" | `LiveChatPage.tsx`, `live-chat.service.ts`, `locales/*/livechat.json` |

**Giới hạn:** việc tự chuyển phiên chỉ áp dụng cho khách đã đăng nhập qua đoạn mã ký trên theme. Khách chưa đăng nhập chỉ thấy tin trả lời trên trình duyệt có phiên đó; dải báo của console vẫn cho nhân viên biết khi trả lời sai chỗ.

## 4. Kiểm thử

- **Unit:** `agent.service.reply-target.spec.ts`, 5 ca:
  - Cuộc cũ bị chặn với 409 E5165.
  - Cuộc mới nhất gửi được và phiên được đánh dấu.
  - Cuộc đã kết thúc được mở lại.
  - Tin bị kiểm duyệt chặn thì không mở lại.
  - Đánh dấu phiên lỗi không làm hỏng tin đã gửi.

  Toàn bộ agent domain đạt 205/205.
- **E2E:**
  - TC-08-09: server đổi cuộc trò chuyện thì đoạn chat được thay, không ghép.
  - TC-08-10: storefront giả có identify; nhân viên trả lời ở phiên khác, mở lại Chat thì widget sang phiên đó.

  Khi tạm bỏ phần sửa của widget, cả hai ca đều đỏ.
- **Thử trên máy (API thật + console):** 9/9 đạt.
  - Cuộc cũ: 409, không lưu tin; có dải báo, ô gửi khoá; nút Open Session đưa sang cuộc mới nhất.
  - Cuộc mới nhất đã kết thúc: trả lời thì mở lại (status `agent`, xoá thời điểm kết thúc, giao cho người trả lời); `sessions.updated_at` được cập nhật.

## 5. Deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit / CI | `b0ff7e1a` · IVY CI/CD [44500480662](https://github.com/amoeba-group/ivyusa-sharp-talk/actions/runs/44500480662) xanh |
| Production | ✅ 10:05:03 UTC ngày 2026-11-19, widget bundle `index-DCVE3BaY.js`. Kiểm chỉ đọc trong tab riêng: Session 12 (cuộc cũ của phiên 168) có dải báo "…Their chat shows Session 16" và ô gửi khoá; Session 16 (đã kết thúc) mời "Reply to reopen this conversation"; Session 10 gửi bình thường |
| Chủ dự án thử | ⏳ trả lời trong Session 10 rồi mở chat trên theme có đoạn mã ký |

## 6. Phòng ngừa

- Thao tác nào ghi tin vào một cuộc trò chuyện cũng phải trả lời được câu hỏi "khách sẽ thấy tin này ở đâu". Nếu khách không thấy được thì không cho gửi, và chỉ chỗ đúng.
- Thông báo cho khách và nội dung khách thấy phải cùng một phạm vi. Nếu thông báo tính theo khách mà khung chat lại theo phiên, chuông sẽ sáng ở chỗ không có gì để đọc.
- Khi dữ liệu trên màn hình đổi nguồn (phiên khác, cuộc trò chuyện khác), đọc lại toàn bộ; không dùng con trỏ "tin mới" của nguồn cũ.
