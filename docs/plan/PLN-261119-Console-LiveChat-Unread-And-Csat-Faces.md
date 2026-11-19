# PLN-261119 — Live Chat: phân biệt đã đọc / chưa đọc, và hiện lại lựa chọn đánh giá trong cuộc trò chuyện

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt** 2026-11-19: `1. ok 2. a 3. a 4. ok` (chưa đọc theo từng nhân viên · mặt đánh giá ở cả widget và console · chủ dự án chạy SQL). Cùng tin nhắn, chủ dự án yêu cầu phân tích và ẩn các nút / khối không cần thiết của màn Live Chat → mục 9. Đã làm: [RPT](../implementation/RPT-261119-Console-LiveChat-Unread-And-Csat-Faces.md) |
| Nguồn | Chủ dự án, 2026-11-19: (A) "tại sao không để lại mức độ hài lòng với icons và actived icon đã chọn trong cuộc hội thoại… phân tích xem nếu bỏ trong cuộc hội thoại live-chat nữa thì có hợp lý không"; (B) "trong Live chat… hãy thể hiện đoạn chat đã đọc và chưa đọc để admin có thể dễ nhận biết nhất. Hiện tại quá rối và tôi không thể kiểm tra" |
| Phạm vi | `apps/api` (agent, chat), `apps/web` (Live Chat), `apps/widget` (thẻ đánh giá), `packages/types`, `sql/` |
| Migration | **Có** — một bảng mới (mục 5). Production chạy `DB_SYNCHRONIZE=false`: phải chạy SQL trên server **trước** khi deploy |

## 1. Hiện trạng

### A. Đánh giá mức độ hài lòng
- **Widget:** khách bấm một khuôn mặt → thẻ đánh giá biến mất, còn lại câu hỏi và dấu "The chat has ended". Tải lại trang cũng vậy. Khách không thấy mình đã chọn gì.
- **Console:** trong đoạn hội thoại có một dòng nền vàng với 5 ngôi sao ("★★★★★ 5"). Khách thì chọn trong **4 khuôn mặt** (lưu thành 1 · 3 · 4 · 5), nên nhân viên nhìn sao phải tự quy đổi; mức "3 sao" thực ra là khuôn mặt Neutral, mức 2 không tồn tại.
- Điểm vẫn được lưu đúng (`conversations.csat_rating`) và có ở Statistics → Satisfaction.

### B. Danh sách phiên ở Live Chat
Hệ thống **không lưu** nhân viên đã xem cuộc trò chuyện nào. Mọi dòng trông như nhau, dù khách vừa nhắn hay đã xong từ hôm qua. Mỗi dòng lại mang 6–8 mẩu thông tin cùng cỡ:

```
cong11 ✎                                   [Default]
Session 11                     [Widget] [AI answering]
Become an IVY Beauty affiliate partner! 💼 1. Submit…
Opened 20h ago · Last reply 20h ago
```

"Default", "Widget", "AI answering" giống nhau ở gần như mọi dòng của IVY, nên chúng chiếm chỗ mà không giúp phân biệt dòng nào cần xem.

## 2. Phân tích (A): có nên hiện lựa chọn đánh giá ngay trong cuộc trò chuyện?

**Nên, ở cả hai phía.**

| Phía | Lợi | Rủi ro | Kết luận |
|---|---|---|---|
| Widget (khách) | Khách thấy lựa chọn của mình đã được ghi nhận; mở lại cuộc trò chuyện cũ vẫn thấy. Khớp với cách thiết kế vẽ hàng khuôn mặt | Khách có thể tưởng bấm lại được | Hiện hàng khuôn mặt ở dạng **chỉ đọc**: khuôn mặt đã chọn sáng, các khuôn mặt khác mờ, không bấm được |
| Console (nhân viên) | Nhân viên thấy đúng thứ khách đã thấy và đã chọn, không phải quy đổi từ sao. Đặt ngay cuối đoạn hội thoại là đúng ngữ cảnh: đọc xong cuộc trò chuyện là thấy khách hài lòng hay không | Thêm một khối vào đoạn hội thoại | Thay dòng sao bằng hàng khuôn mặt cùng kiểu, vẫn một dòng |

Điểm số và trang Statistics không đổi. Tôi chưa mở được frame Figma của màn sau-khi-đánh-giá (kết nối Figma hết lượt), nên dạng "chỉ đọc" ở trên là đề xuất của tôi, không phải số đo từ thiết kế.

## 3. Thiết kế (B): danh sách phiên đọc được trong một cái liếc mắt

Người dùng là nhân viên hỗ trợ của một cửa hàng mỹ phẩm, mở màn này nhiều lần trong ngày với một câu hỏi: **"dòng nào khách đang chờ tôi?"**. Danh sách phải trả lời câu đó trước khi họ đọc chữ nào.

### 3.1 Định nghĩa "chưa đọc"
Một cuộc trò chuyện là **chưa đọc với một nhân viên** khi khách có tin nhắn mà nhân viên đó chưa mở xem. Tin của AI và của nhân viên không tính. Mở cuộc trò chuyện là đã đọc. Trạng thái này của **từng nhân viên** (câu hỏi 2, mục 8).

### 3.2 Token (giữ hệ thiết kế hiện có của console, không thêm màu mới)

| Vai trò | Giá trị | Dùng cho |
|---|---|---|
| Mực chính | `gray-900`, chữ đậm 600 | Tên khách ở dòng chưa đọc |
| Mực phụ | `gray-600` / `gray-400`, chữ 400 | Tên và nội dung ở dòng đã đọc |
| Nhấn | `primary-500` (xanh periwinkle của IVY) | Thanh dọc mép trái và số đếm của dòng chưa đọc — **chỗ duy nhất** dùng màu nhấn trong danh sách |
| Cần người | `amber-600` (chữ) | "Needs agent" |
| Nền chọn | `primary-500/5` | Dòng đang mở (đã có) |

Chữ: Pretendard như cả console. Phân cấp bằng **độ đậm và độ sáng của mực**, không bằng thêm nhãn.

### 3.3 Hai phương án bố cục đã cân nhắc

```
PHƯƠNG ÁN 1 — chấm tròn + in đậm (kiểu hộp thư)      PHƯƠNG ÁN 2 — thanh mép trái + số đếm (chọn)
┌────────────────────────────────────────┐           ┌────────────────────────────────────────┐
│ ● cong11                       2 phút  │           │▌cong11                        2 phút   │
│   Khách: tôi muốn đổi địa chỉ…         │           │▌Khách: tôi muốn đổi địa chỉ…      (3)  │
│ ○ Session 7                    22 giờ  │           │ Session 7                      22 giờ   │
│   AI: Here's what I found…             │           │ AI: Here's what I found…               │
└────────────────────────────────────────┘           └────────────────────────────────────────┘
```

Chọn **phương án 2**. Chấm tròn buộc mắt tìm một điểm nhỏ ở từng dòng và chiếm một cột ở cả những dòng không có gì; thanh mép trái tạo thành một dải liền khi nhiều dòng chưa đọc đứng cạnh nhau, và số đếm cho biết luôn khách đã nhắn mấy tin. Dòng đã đọc không mang ký hiệu nào, nên sự vắng mặt chính là tín hiệu.

### 3.4 Dòng mới

```
┌──────────────────────────────────────────────┐
│ Sessions                              Select │
│ (All 7) (Unread 2) (Needs agent 1) (Ended)   │   ← thêm bộ lọc Unread, có số đếm
│ [ Search by customer name or email      ]    │
├──────────────────────────────────────────────┤
│▌cong11                              2 min    │   CHƯA ĐỌC: thanh xanh, tên đậm,
│▌Customer: I want to change my address… ( 3 ) │   nội dung mực chính, số tin chưa xem
│▌Needs agent                                  │   dòng 3 chỉ hiện khi có điều cần biết
├──────────────────────────────────────────────┤
│ cong11                              20 h     │   ĐÃ ĐỌC: không ký hiệu, mực phụ
│ AI: Become an IVY Beauty affiliate partner…  │
├──────────────────────────────────────────────┤
│ Session 7                           22 h     │
│ AI: Here's what I found for you: …           │
│ Ended                                        │
└──────────────────────────────────────────────┘
```

Thay đổi so với hiện nay:

| Thành phần | Hiện nay | Mới |
|---|---|---|
| Trạng thái đọc | Không có | Thanh mép trái + tên đậm + số tin chưa xem |
| Ai nói câu cuối | Không rõ | Tiền tố "Customer:" / "AI:" / tên nhân viên trước nội dung |
| Thời gian | "Opened 20h ago · Last reply 20h ago" (một dòng riêng) | Một mốc "lần cuối" ở góc phải dòng 1; giờ mở phiên xem ở tooltip |
| "Session 11" | Một dòng riêng | Tooltip của tên, và vẫn ở tiêu đề khi mở cuộc trò chuyện |
| Nhãn AI agent ("Default") | Mọi dòng | Chỉ hiện khi tenant có hơn một AI agent |
| Nhãn kênh ("Widget") | Mọi dòng | Chỉ hiện khi kênh không phải Widget |
| Trạng thái ("AI answering") | Nhãn màu ở mọi dòng | Dòng 3 dạng chữ, chỉ khi khác bình thường: Needs agent, With agent, Ended, AI off |
| Ghim, đổi tên, chọn nhiều | Có | Giữ nguyên |

Thêm:
- Di chuột vào dòng: nút **Mark as unread** (để nhắc mình quay lại).
- Menu trái: số cuộc trò chuyện chưa đọc cạnh chữ **Live Chat**.
- Nút **Mark all as read** ở đầu danh sách khi đang lọc Unread.

### 3.5 Tự soát lại so với lối mòn
- Không thêm thẻ bo góc, đổ bóng hay nền màu cho từng dòng: danh sách vẫn là danh sách, phân tách bằng một đường kẻ mảnh như hiện nay.
- Không dùng chữ in hoa hay nhãn phụ phía trên; không nối thông tin bằng dấu chấm giữa.
- Màu nhấn chỉ xuất hiện ở dòng chưa đọc. Nếu mọi dòng đều có màu thì không dòng nào nổi.
- Không có chuyển động tự phát; thanh mép trái biến mất ngay khi mở cuộc trò chuyện là phản hồi cho thao tác của nhân viên.

## 4. Thiết kế (A): hàng khuôn mặt

```
WIDGET — sau khi khách chọn                    CONSOLE — cuối đoạn hội thoại
┌──────────────────────────────┐              ┌─────────────────────────────────────────┐
│ How satisfied were you with  │              │  Customer rated this chat   11/19 13:32 │
│ this conversation?           │              │   😞   😐   😊  [😍]   Very satisfied   │
│   😞    😐    😊   [😍]      │              └─────────────────────────────────────────┘
│            Very satisfied    │               khuôn mặt đã chọn sáng, ba cái kia mờ
│  ✓ The chat has ended        │
└──────────────────────────────┘
```

Tenant dùng chế độ khảo sát (5 mặt + lý do) hiện 5 mặt theo cùng cách; IVY dùng 4 mặt.

## 5. Kỹ thuật và Migration

**Bảng mới** `conversation_reads` — ai đã xem tới tin nào:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | BIGINT PK | |
| `tenant_id` | BIGINT, index | |
| `conversation_id` | BIGINT | |
| `user_id` | BIGINT | nhân viên |
| `last_read_message_id` | BIGINT | tin cuối đã xem |
| `updated_at` | DATETIME | |
| | UNIQUE (`conversation_id`, `user_id`) | |

File `sql/261119-conversation-reads.sql` (idempotent), gồm cả một lệnh ghi sẵn "đã đọc tới tin mới nhất" cho mọi nhân viên × mọi cuộc trò chuyện đang có, để sau deploy danh sách không sáng đồng loạt.

**API:** danh sách phiên trả thêm `unreadCount`, `lastSender`; tham số lọc `unread=1`; `POST /agent/conversations/:id/read` và `/unread`; `GET /agent/conversations/unread-count` cho menu. Phản hồi cuộc trò chuyện của widget trả thêm `csatRating`.

**Thứ tự triển khai (bắt buộc):** chạy SQL trên DB production **trước**, rồi mới push code. Script deploy tự dừng nếu còn SQL chưa chạy. Tôi sẽ đưa đúng một lệnh để chủ dự án chạy trên server.

**Rollback:** `DROP TABLE conversation_reads;` — không bảng nào khác phụ thuộc; code cũ không đọc bảng này.

## 6. Ảnh hưởng phụ

- Áp cho mọi tenant của bản cài.
- Danh sách phiên thêm một truy vấn đếm theo lô cho các dòng đang hiển thị.
- "Chưa đọc" theo từng nhân viên: nhân viên A xem rồi thì với nhân viên B vẫn là chưa đọc. Số ở menu vì vậy khác nhau theo người.
- Cuộc trò chuyện AI tự trả lời xong vẫn là chưa đọc với nhân viên cho tới khi họ mở xem: đúng với mục đích kiểm tra.
- Các nhãn bị ẩn (Default, Widget, Session N) không mất: xem ở tooltip và ở tiêu đề khi mở cuộc trò chuyện.

## 7. Kiểm thử

- Unit API: đếm chưa đọc chỉ tính tin của khách sau mốc đã xem; đánh dấu đã đọc / chưa đọc; lọc `unread`; phạm vi tenant (không lộ chéo); nhân viên này không đổi trạng thái của nhân viên khác.
- SQL: chạy file trên MySQL local hai lần (idempotent), kiểm dữ liệu ghi sẵn.
- Khởi động API thật sau khi thêm entity.
- Console local: chụp màn hình danh sách với dòng chưa đọc / đã đọc / cần người / đã kết thúc ở 1440px và 390px; kiểm bàn phím và trình đọc màn hình ("3 unread messages").
- Widget: unit + E2E cho hàng khuôn mặt chỉ đọc sau khi đánh giá và sau khi tải lại.

## 8. Cần chủ dự án quyết

1. **Duyệt hướng làm** (mục 3 và 4)?
2. **"Đã đọc" là của ai:**
   - a. Của từng nhân viên (khuyên dùng): mỗi người có danh sách chưa đọc của riêng mình.
   - b. Chung cả nhóm: một người mở là đã đọc với mọi người.
3. **Đánh giá trong cuộc trò chuyện:**
   - a. Cả widget lẫn console (khuyên dùng).
   - b. Chỉ console.
   - c. Chỉ widget.
4. **SQL trên production:** chủ dự án chạy một lệnh trên server khi tôi báo (bắt buộc với phương án có bảng mới). Đồng ý?

## 9. Bổ sung khi duyệt: đơn giản hoá màn Live Chat

Yêu cầu (2026-11-19, kèm ảnh màn Live Chat): *"có quá nhiều button và nhiều section… tôi không biết nó là để làm gì… Cái nào không cần thiết hãy ẩn đi… khi bàn giao cho khách hàng cũng không biết và thêm rối, hãy đơn giản hóa"*.

Nguyên tắc: **không xoá chức năng nào** (trừ Sync). Việc làm mỗi lần → để ngoài. Việc thỉnh thoảng làm → menu **More**. Công cụ dành cho đội lớn hoặc nhiều kênh → sau công tắc **Advanced tools** ở góc phải tiêu đề trang. Công tắc này nhớ theo trình duyệt; mặc định tắt.

### 9.1 Phân tích từng phần

| Phần trên màn | Nó làm gì | Cần cho IVY? | Quyết định |
|---|---|---|---|
| Accept | Nhận cuộc trò chuyện về mình, AI thôi trả lời | Có, mỗi lần nhân viên vào thay AI | **Giữ**, là nút chính (nền xanh) |
| End | Kết thúc cuộc trò chuyện; khách được mời đánh giá | Có | **Giữ**, chữ đỏ trên nền trắng thay vì cả nút đỏ |
| Hand back to AI | Trả cuộc trò chuyện cho AI | Có, khi đang do nhân viên giữ | **Giữ**, thay chỗ Accept khi đã nhận |
| Turn off AI auto-reply and take over | Tắt AI mà không nhận cuộc trò chuyện | Hiếm khi, dễ nhầm với Accept | **More** |
| Find | Tìm chữ trong cuộc trò chuyện | Thỉnh thoảng | **More** ("Find in this conversation") |
| Pin | Ghim cuộc trò chuyện lên đầu danh sách | Thỉnh thoảng | **More**, và nút ghim khi rê chuột trên dòng |
| Assign | Giao cho AI agent khác hoặc nhân viên khác | IVY có 1 AI agent; chỉ quản lý giao cho người | **More** (chỉ hiện với quản lý, hoặc khi có hơn 1 AI agent) |
| File issue | Tạo phiếu ở Issue board | Chưa dùng | **Advanced** (trong More) |
| Sync | Tải lại tin nhắn ngay | Không: tự tải lại mỗi 5 giây và khi quay lại tab | **Bỏ** |
| Ô chọn "Channel default (On)" + nhãn "AI answering" + "AI: Default" + nhãn trạng thái + nhãn người nhận | 5 nhãn cùng nói "ai đang trả lời" | Gộp được | **Một nhãn chữ thường**: AI is answering · Needs an agent · With {tên} · AI is off · Ended. Ô chọn chế độ AI → **Advanced** |
| Merge same customer / Add to merged room | Gộp các phiên của cùng một khách vào một phòng | Không (tính năng cho khách sạn Go2Joy) | **Advanced** |
| Same customer · 4 other session(s) · Group as timeline | Gợi ý nhóm các phiên cùng khách | Không | **Advanced** |
| Rate answer (dưới câu trả lời) | Nhân viên chấm câu trả lời đúng/sai để thống kê | Chưa dùng | **Advanced** |
| Save as knowledge (dưới câu AI) | Biến câu hỏi/đáp thành tài liệu kiến thức | Thỉnh thoảng, chỉ chủ shop | **Advanced** |
| Nút rê chuột trên tin của khách: Translate · Knowledge · Reply · Issue | Dịch · tra kiến thức · trích dẫn · tạo phiếu | Dịch và trích dẫn: có | **Giữ** Translate + Reply; Knowledge + Issue → **Advanced** |
| Handling history | Ai đã xử lý, theo thời gian | Hiếm khi | **Advanced** |
| AI Briefing | AI tóm tắt cuộc trò chuyện | Không (AI hiện là bản Stub) | **Advanced** |
| Comments (Thread / Session) | Ghi chú nội bộ | Hiếm khi | **Advanced**, nhưng **luôn hiện khi đã có ghi chú** để không ai bỏ sót ghi chú của đồng nghiệp |
| Knowledge lookup | Hỏi kho kiến thức rồi gửi câu trả lời | Thỉnh thoảng | **Advanced** |
| Customer (tên, email, điện thoại, hạng) | Khách là ai | Có | **Giữ**, đưa **lên đầu** cột phải |
| IP · Link existing customer · Save as new customer | Địa chỉ IP; gắn khách bằng tay | Không: khách đăng nhập tự gắn | **Advanced** |
| Recent orders | Đơn gần đây của khách | Có | **Giữ** |
| Danh sách: Select · Groups · All channels · All agents | Chọn nhiều để nhóm; lọc theo nhóm, kênh, AI agent | Không: 1 kênh, 1 AI agent | **Advanced** |
| Danh sách: All · Needs agent · Ended | Lọc theo trạng thái | Có | **Giữ**, thêm **Unread** |
| Danh sách: Customer / Conversation text + ô tìm | Tìm theo tên khách hoặc nội dung | Có | **Giữ** |

### 9.2 Bố cục sau khi gọn

```
Live Chat                                                    ( ) Advanced tools
┌──────────────────────┐┌──────────────────────────────────────────┐┌───────────────────┐
│ Sessions (8)         ││ cong11 ✎ Session 15   [AI is answering]  ││ 👤 Customer       │
│ (All)(Unread 2)      ││                 [✓ Accept] [⊗ End] [⋯ More]││ Name   cong11     │
│ (Needs agent)(Ended) │├──────────────────────────────────────────┤│ Email  c***@…     │
│ Customer | Text      ││                                          ││ Tier   —          │
│ [🔍 Search…        ] ││  Customer · cong11                       │├───────────────────┤
├──────────────────────┤│  hi                                      ││ Recent orders     │
│▌cong11        2 min  ││                     ┌──────────────────┐ ││ #1042  Delivered  │
│▌Customer: hi    (2)  ││                     │ Ivyusa Support   │ │└───────────────────┘
├──────────────────────┤│                     │ amoeba           │ │
│ cong11        20 h   ││                     └──────────────────┘ │  (Comments chỉ hiện
│ AI: Become an IVY…   ││                                          │   khi đã có ghi chú)
│ Needs an agent       │├──────────────────────────────────────────┤
└──────────────────────┘│ 📎 [ Type a reply…                ] [➤]  │
                        └──────────────────────────────────────────┘
More ▾: Find in this conversation · Pin · Mark as unread · Assign this conversation ·
        Turn off AI auto-reply and take over · (Advanced: File issue)
```

Bật **Advanced tools** thì mọi thứ trong bảng 9.1 ghi "Advanced" hiện lại đúng chỗ cũ. Tắt công tắc thì các bộ lọc ẩn (kênh, AI agent, nhóm) cũng trở về "tất cả", để danh sách không bị lọc bởi thứ không còn nhìn thấy.

### 9.3 Thêm khi làm

- Nhân viên tạo tài khoản sau này không nhận toàn bộ lịch sử là "chưa đọc": khi chưa có dấu đọc, chỉ tin nhắn sau ngày tạo tài khoản mới tính.
- Trong bộ lọc Unread, dòng vừa mở giữ nguyên chỗ cho tới khi mở dòng khác, không biến mất giữa lúc đang đọc.
- Bong bóng AI không còn ghi "· Default" khi cửa hàng chỉ có một AI agent.
