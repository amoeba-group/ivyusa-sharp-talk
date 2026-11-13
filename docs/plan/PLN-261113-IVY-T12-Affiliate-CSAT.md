# PLN-261113 — IVY T12 · Affiliate và đánh giá khi kết thúc chat (CSAT)

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-13** (`1. ok 2. a 3. a 4. a`) và đã làm — [RPT-261113](../implementation/RPT-261113-IVY-T12-Affiliate-CSAT.md) |
| Task | [ivy-docs/TASKS.md T12](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-14 · G-19 · G-20 · BR-12 · BR-13 · Q-12 · BUG-024 (phần Affiliate) |
| Figma | `1006:5990`, `1006:6050`, `1006:6110` (CSAT), `1006:6200`, `1006:6290` (kết thúc). Figma MCP hết lượt gọi; kế hoạch dựa vào SPEC. Nếu tiện, gửi ảnh 5 frame này (link ở §8) |
| TC | TC-12-01..04 ([e2e/tests/12-affiliate-csat.spec.ts](../../e2e/tests/12-affiliate-csat.spec.ts)), baseline **0/4** (chạy 2026-11-13) |
| Migration | **Không có SQL** |
| Deploy | Test xanh → push → CI → server tự deploy. Đổi `apps/api`, `apps/widget`, `apps/web` (một ô gợi ý trong AI Settings) |

## 1. Hiện trạng → mục tiêu

| | Thiết kế (SPEC SCR-IVY-14) | Hiện tại |
|---|---|---|
| Bấm Affiliate | Bot "IVY Beauty 제휴 파트너가 되어주세요! 💼" → **3 thẻ bước có mô tả** → "궁금한 점이 있으시면 언제든 물어봐주세요!" → chip **Apply now · Learn more · Start over · End** | Tiêu đề + 3 dòng chỉ có tên bước + một nút "Apply now". Không có Learn more, Start over, End |
| Vị trí trong luồng | Câu trả lời nằm đúng chỗ được hỏi | Thẻ nằm ở ô cố định cuối luồng (BUG-024) |
| Bấm End | Bot "오늘 상담이 도움이 되셨으면 좋겠습니다 상담은 어떠셨나요?" → thẻ "상담 만족도를 선택해주세요" với **4 mặt** + **Skip** | Không có chip End. Nút "End chat" trên dòng công bố AI có hỏi xác nhận |
| Thẻ đánh giá | 😞 Dissatisfied · 😐 Neutral · 😊 Satisfied · 😍 Very satisfied · Skip | **5 mặt** · nút "Close" |
| Sau khi đánh giá | "Thank you for your feedback" **rồi** "The chat has ended / Thank you…" | Dòng "This conversation has ended" nằm **phía trên** thẻ đánh giá |

## 2. Phát hiện khi khảo sát

1. **Menu IVY không có nút Affiliate.** 7 nút của IVY (T08, theo thiết kế SCR-IVY-10) không có Affiliate. Test dùng mock để thêm nút. Trên production hiện **khách không vào được** kịch bản này.
2. **ivyusa.com chưa có chương trình affiliate.** Mình thử `/pages/affiliate`, `/affiliates`, `/ambassador`, `/partner`… đều 404, trang chủ cũng không có app affiliate nào (UpPromote, GoAffPro, Refersion…).
3. **"Apply now" hiện ghi đơn vào DB nhưng không ai thấy.** Nút gọi `POST /affiliate/apply` (khách phải đăng nhập), đơn nằm ở trạng thái "pending". Console **không có trang** xem hay duyệt các đơn này.
4. **Bấm chip "End" hiện báo lỗi.** Console cho phép thêm chip `end_chat` vào kịch bản, nhưng widget không xử lý nó: widget gửi "end_chat" lên như một kịch bản, server không có kịch bản đó nên trả 404, khách thấy "Sorry, that didn't go through. Please try again.".
5. **Thẻ Affiliate chỉ vẽ ở trình duyệt**, không tạo cuộc chat trên server. Khách chỉ bấm Affiliate rồi End thì **không có cuộc chat nào để đánh giá**: thẻ CSAT không hiện được.
6. Câu chữ 3 bước của thiết kế có điều khoản riêng của IVY ("10%"). Không được viết cứng vào widget dùng chung, phải là cấu hình của tenant (G-19).

## 3. Quyết định thiết kế

**D1 — Affiliate thành một kịch bản trên server** (G-19, BUG-024).
- Bấm Affiliate thì server ghi câu hỏi của khách và câu trả lời của bot, giống các kịch bản đổi trả / huỷ đơn. Nhờ vậy:
  - có cuộc chat để đánh giá sau khi bấm End (phát hiện 5);
  - nhân viên thấy khách hỏi về affiliate trong lịch sử chat;
  - câu trả lời nằm đúng chỗ trong luồng (BUG-024).
- Câu trả lời viết dạng chữ thường, 3 bước là danh sách đánh số: `1. **Tên bước** — mô tả`. Widget vẽ danh sách đó thành **3 thẻ bước** (nền tím nhạt), câu mở đầu và câu kết thành bong bóng bot.
  - Chỉ áp dụng cho câu trả lời của **kịch bản** (có chip). Câu trả lời của AI giữ nguyên như cũ.
- Câu chữ sửa được theo từng ngôn ngữ ở **console → AI Settings → kịch bản**, nơi IVY đã sửa câu đổi trả / huỷ đơn (T10). **Không cần màn console mới, không cần SQL.**
- Câu mặc định là câu chung, không có tên shop và không có "%": "Become our affiliate partner! 💼 … earn a commission on every sale". Câu của IVY (tên IVY Beauty, 10%) theo §8-4.
- Bỏ thẻ Affiliate cũ (`AffiliateCard`).

**D2 — 4 chip theo thiết kế: Apply now · Learn more · Start over · End.**
- **Apply now:** theo §8-2.
- **Learn more:** một kịch bản thứ hai (`affiliate_details`), câu chữ cũng sửa được ở AI Settings. Mặc định: affiliate chia sẻ link riêng, nhận hoa hồng khi có người mua qua link, đơn được xét trong 1–3 ngày làm việc, đối tác được duyệt nhận link và điều khoản qua email. Dưới nó có chip Apply now · Start over · End.
- **Start over:** menu đầu hiện lại (như T09). Đứng **trước** End.
- **End:** kết thúc chat **ngay**, không hỏi xác nhận (thiết kế không có bước này), rồi tới D3.
- Sửa luôn phát hiện 4: chip `end_chat` ở **mọi** kịch bản đều kết thúc chat đúng cách.

**D3 — End → đánh giá → kết thúc** (G-20, BR-13, Q-12).
1. Bong bóng bot: "We hope today's chat was helpful. How was your chat today?"
2. Thẻ `csat-card`: "Please rate your satisfaction" + **4 mặt** 😞 Dissatisfied · 😐 Neutral · 😊 Satisfied · 😍 Very satisfied + **Skip**.
   - DB vẫn lưu thang 1–5 (Q-12): 4 mặt lưu thành **1 · 3 · 4 · 5**. Điểm trung bình cũ và mới vẫn so được với nhau.
3. Chọn mặt → `POST /chat/csat` → mặt được chọn sáng, 3 mặt kia mờ → bong bóng "Thank you for your feedback" → khối ✓ **"The chat has ended" / "Thank you for chatting with us!"** nằm **dưới**.
4. **Skip** → không gửi đánh giá → khối "The chat has ended" hiện ngay.
5. Khối "The chat has ended" chuyển xuống **sau** thẻ đánh giá (trước đây nằm trên). Sau khi chat kết thúc, chip của tin nhắn cuối được ẩn đi.
- Nút "End chat" trên dòng công bố AI vẫn hỏi xác nhận, rồi đi đúng luồng này.
- Gửi đánh giá lỗi: báo lỗi ngay trong thẻ như hiện nay ("We couldn't save your rating. Please try again.").
- Chế độ "survey" (một tuỳ chọn khác của tenant, IVY không dùng) giữ 5 mặt; chỉ đổi chữ Skip và thứ tự khối kết thúc.

**D4 — Lối vào Affiliate cho IVY:** §8-3.

## 4. Wireframe

**Widget, tab Chat, 380px — bấm Affiliate:**

```
│                ┌──────────────────────────────┐ │
│                │ How to become an Affiliate?  │ │ ← bong bóng khách
│                └──────────────────────────────┘ │
│ (🤖) Become an IVY Beauty affiliate partner! 💼  │
│   ┌──────────────────────────────────────────┐  │
│   │ Submit an application                    │  │ ← thẻ bước, nền tím nhạt
│   │ Fill out a short form.                   │  │   (tên đậm, mô tả chữ nhỏ)
│   └──────────────────────────────────────────┘  │
│   ┌──────────────────────────────────────────┐  │
│   │ Review (1–3 business days)               │  │
│   │ Our team will review it and email you.   │  │
│   └──────────────────────────────────────────┘  │
│   ┌──────────────────────────────────────────┐  │
│   │ Start earning                            │  │
│   │ Share your link → earn 10% on every sale!│  │ ← chữ của IVY (§8-4)
│   └──────────────────────────────────────────┘  │
│ (🤖) If you have any questions, just ask!        │
│ ( Apply now ) ( Learn more ) ( Start over )      │
│ ( End )                                          │
```

**Bấm End:**

```
│ (🤖) We hope today's chat was helpful.           │
│      How was your chat today?                    │
│   ┌──────────────── csat-card ────────────────┐ │
│   │       Please rate your satisfaction        │ │
│   │    😞        😐        😊        😍         │ │
│   │ Dissatisfied Neutral Satisfied Very        │ │
│   │                                satisfied   │ │
│   │                  Skip                      │ │
│   └────────────────────────────────────────────┘ │
```

**Chọn 😍:**

```
│   ┌──────────────── csat-card ────────────────┐ │
│   │    ░░        ░░        ░░        😍         │ │ ← 3 mặt kia mờ, hết Skip
│   └────────────────────────────────────────────┘ │
│ (🤖) Thank you for your feedback                 │
│                       ✓                          │
│               The chat has ended                 │
│         Thank you for chatting with us!          │
```

**Bấm Skip:** thẻ và câu hỏi biến mất, chỉ còn khối ✓ "The chat has ended".

**Bấm Apply now (nếu §8-2a):** dùng lại form của T11.

```
│                           ┌───────────┐          │
│                           │ Apply now │          │ ← bong bóng khách
│                           └───────────┘          │
│ (🤖) Leave your details and our team will email  │
│      you about the affiliate program.            │
│   ┌──────────────── form (T11) ───────────────┐ │
│   │ NAME     [                              ] │ │
│   │ EMAIL    [hykim4@ivyent.com             ] │ │ ← điền sẵn khi đã đăng nhập
│   │ MESSAGE  [I'd like to join the affiliate ] │ │ ← điền sẵn, khách sửa được
│   │          [program. Where I'd share IVY:  ] │ │
│   │ [             Send Message              ] │ │
│   └────────────────────────────────────────────┘ │
```

Gửi xong giống T11: thẻ "YOUR INQUIRY" + "Your message has been sent successfully." Tin vào tab Inquiries trên console và mail tới `hello@ivyusa.com`.

**Console → AI Settings → kịch bản `affiliate`** (màn có sẵn, chỉ thêm một dòng gợi ý):

```
┌ affiliate ─────────────────────── [EN][KO][ES][VI][JA][ZH] ┐
│ Reply                                                      │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Become an IVY Beauty affiliate partner! 💼              │ │
│ │ 1. **Submit an application** — Fill out a short form.  │ │
│ │ 2. **Review (1–3 business days)** — Our team will …    │ │
│ │ 3. **Start earning** — Share your link → earn 10% …    │ │
│ │ If you have any questions, just ask!                   │ │
│ └────────────────────────────────────────────────────────┘ │
│ ⓘ Numbered lines show as step cards in the widget.         │ ← dòng gợi ý mới
│ Follow-up chips: Apply now · Learn more · End              │
└────────────────────────────────────────────────────────────┘
```

## 5. Thay đổi

| Phần | File | Nội dung |
|---|---|---|
| API | `chat/scenario-scripts.ts` | Kịch bản `affiliate` và `affiliate_details`, đủ 6 ngôn ngữ. Chip điều khiển mới `affiliate_apply`. Nút có action `affiliate` chạy kịch bản `affiliate` |
| API | `database/seed.runner.ts` | IVY: câu chữ `affiliate` theo thiết kế (§8-4); nút thứ 8 nếu §8-3a. Chỉ áp dụng cho DB mới |
| Widget | `chat/ChatTab.tsx` | Affiliate → kịch bản; xử lý chip `end_chat`, `affiliate_apply`; thứ tự đánh giá → kết thúc; ẩn chip sau khi kết thúc; bỏ ô Affiliate cũ |
| Widget | `chat/CsatCard.tsx` | 4 mặt (1·3·4·5), tiêu đề, Skip, `data-testid="csat-card"` |
| Widget | `chat/MessageBubble.tsx` + hàm tách bước (mới, có unit test) | Câu trả lời kịch bản có danh sách đánh số → bong bóng + thẻ bước + bong bóng |
| Widget | `chat/ContactForm.tsx` | Nhận thêm bong bóng khách, câu dẫn và nội dung điền sẵn (cho Apply now) |
| Widget | `chat/reply-chips.ts` | Start over đứng trước End |
| Widget | `chat/AffiliateCard.tsx` (xoá), `services/miscService.ts`, `i18n/locales/*.ts` ×6 | Bỏ thẻ cũ; câu chữ mới (đánh giá, kết thúc, form affiliate) |
| Console | `ai-settings/ScenarioReplyEditor.tsx`, i18n ×6 | Thêm `affiliate_apply` vào danh sách chip; dòng gợi ý về thẻ bước |
| E2E | `12-affiliate-csat.spec.ts`, fixtures | TC-12-01..04, thêm TC-12-05 (Apply now mở form điền sẵn) và TC-12-06 (Learn more). `@T12` vào `test:ci` |
| Docs | ivy-docs, GUIDE | TASKS / TEST-CASES / BUGS (BUG-024 phần Affiliate; lỗi chip End) / SPEC; GUIDE cấu hình Affiliate của IVY trên production |

## 6. Deploy

1. Không có SQL. Test xanh hết thì mình push; CI xanh thì server tự deploy.
2. Sau deploy, tenant IVY trên production có từ trước nên seed không áp dụng. Câu chữ của IVY (§8-4) và nút thứ 8 (§8-3a) nhập trên console theo GUIDE mình viết, khoảng 10 phút.
   - Chưa nhập thì kịch bản dùng câu mặc định chung, không có tên IVY và "10%".

## 7. Ảnh hưởng phụ

- **Mọi khách, ngay sau deploy:**
  - Thẻ đánh giá còn **4 mặt**, không chọn được mức 2 nữa. Thang lưu vẫn 1–5.
  - Nút đóng thẻ đánh giá đổi chữ "Close" → "Skip".
  - Câu kết thúc đổi "This conversation has ended" → "The chat has ended", kể cả khi nhân viên kết thúc chat.
  - Khối kết thúc chuyển xuống dưới thẻ đánh giá.
  - Chip "End" (nếu tenant có đặt) kết thúc chat thay vì báo lỗi.
- **Affiliate:**
  - Thẻ cũ và nút đăng ký cũ biến mất. API đăng ký cũ (`/affiliate/*`) giữ nguyên, chỉ widget không gọi nữa.
  - Mỗi lần khách bấm Affiliate là một cuộc chat mới trên server. Nhân viên thấy nó trong lịch sử; số liệu "cuộc chat" tăng tương ứng.
- **Không có SQL**, không gửi push / SMS. Mail chỉ phát sinh khi khách gửi form Apply now (§8-2a), giống form liên hệ T11.

## 8. Xin bạn xác nhận

1. **Duyệt kế hoạch này?** Duyệt thì mình làm, test xanh rồi push.
2. **Nút "Apply now" làm gì:**
   - **a (khuyến nghị):** mở form liên hệ của T11 ngay trong chat, nội dung điền sẵn "I'd like to join the affiliate program…". Đơn vào tab Inquiries trên console và mail tới `hello@ivyusa.com`. Không cần làm thêm gì phía IVY.
   - **b:** mở một trang đăng ký IVY đã có (Google Form, app affiliate…). Bạn gửi link. ivyusa.com hiện chưa có trang nào như vậy.
   - **c:** giữ đăng ký nội bộ (khách phải đăng nhập). Phải làm thêm trang duyệt đơn trên console, nên T12 lớn hơn nhiều.
3. **Khách vào Affiliate từ đâu** (menu thiết kế chỉ có 7 nút, không có Affiliate):
   - **a:** thêm nút thứ 8 **"💼 Affiliate"** vào cuối menu của IVY. Khác thiết kế 7 nút.
   - **b:** giữ 7 nút đúng thiết kế. Kịch bản làm sẵn nhưng khách chưa vào được, cho tới khi bạn thêm nút trong console AI Settings.
   - Nếu frame Figma cho thấy lối vào khác, bạn gửi ảnh để mình làm theo.
4. **Câu chữ 3 bước của IVY:**
   - **a:** dùng đúng thiết kế: "IVY Beauty", duyệt "1–3 business days", hoa hồng **10%**.
   - **b:** "10%" chưa chắc là chính sách thật → dùng câu chung "earn a commission on every sale" cho tới khi IVY xác nhận.
5. **Ảnh thiết kế (tuỳ chọn):** [1006:5990](https://www.figma.com/design/fviVlvtkuHYU0Agre1daTr/?node-id=1006-5990) · [1006:6050](https://www.figma.com/design/fviVlvtkuHYU0Agre1daTr/?node-id=1006-6050) · [1006:6110](https://www.figma.com/design/fviVlvtkuHYU0Agre1daTr/?node-id=1006-6110) · [1006:6200](https://www.figma.com/design/fviVlvtkuHYU0Agre1daTr/?node-id=1006-6200) · [1006:6290](https://www.figma.com/design/fviVlvtkuHYU0Agre1daTr/?node-id=1006-6290)

Trả lời ví dụ: `1. ok  2. a  3. a  4. a`
