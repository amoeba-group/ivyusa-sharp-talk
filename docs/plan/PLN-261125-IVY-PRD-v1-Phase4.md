# PLN-261125 — IVY PRD v1, giai đoạn 4: kết thúc chat (S-01), yêu cầu review (N-05), Cancel order (C-03)

| | |
|---|---|
| Kế hoạch gốc | [PLN-261125-IVY-PRD-v1-Alignment](PLN-261125-IVY-PRD-v1-Alignment.md) §4 (đã duyệt 2026-11-25) |
| Lệnh bắt đầu | Chủ dự án 2026-11-25: "ok, bắt đầu làm việc thứ 5 luôn" — danh sách việc thứ 5: bật Claude, N-05, S-01, C-03 |
| Phạm vi | widget, API, console |
| Migration | `sql/261125-prd-v1-phase4-review-requests.sql` (3 cột + 1 index). **Chạy trước khi push** |
| Trạng thái | ✅ Đã làm 2026-11-25: [RPT](../implementation/RPT-261125-IVY-PRD-v1-Phase4.md), [TCR](../test/TCR-261125-IVY-PRD-v1-Phase4.md). Live 07:35 UTC (`5bbd4e48`) |

Klaviyo, Yotpo và lời nhắn do AI viết (C-02) để thứ 6, PLN riêng.

## 1. S-01 — kết thúc chat

### 1.1 Tự kết thúc: đã có, chỉ cần bật

Chính sách đóng chat theo tenant đã có từ PLN-261026: Settings → Widget → **Chat close**.

- Hỏi đánh giá X phút sau câu trả lời cuối.
- Đóng Y phút sau đó.
- Câu chữ 6 ngôn ngữ.

Production IVY chưa bật vì IVY chưa chốt thời gian. Đề xuất X = 5, Y = 3. Bật trên console production chỉ khi chủ dự án bảo. Không đổi code.

### 1.2 Start new chat (widget)

Hiện tại, sau End đoạn chat cũ vẫn nằm trên màn. Chỉ khi khách gõ tiếp, máy chủ mới mở cuộc chat mới.

PRD muốn: hiện "Chat has ended", và chat mới bắt đầu lại từ đầu.

```
┌──────────────────────────────┐
│ … đoạn chat vừa xong …       │
│ [★ ★ ★ ★] (đã chấm / bỏ qua) │
│                              │
│            ( ✓ )             │
│    The chat has ended        │
│ Thank you for chatting with us!│
│    [ Start a new chat ]      │  ← mới, data-testid="start-new-chat"
└──────────────────────────────┘
          │ bấm
          ▼
┌──────────────────────────────┐
│ 🤖 Hi! How can I help you?   │  ← lời chào như lần đầu mở
│ [My Orders] [Payment check]… │  ← menu nhanh
│                              │
│ (đoạn cũ không còn trên màn) │
└──────────────────────────────┘
```

- Nút chỉ hiện khi cuộc chat đã kết thúc và khách đã chấm điểm hoặc bỏ qua.
- Bấm thì xoá mọi thứ trên màn: tin nhắn, thẻ chèn, phiếu đánh giá. Còn lại lời chào và menu.
- Widget nhớ id cuộc chat đã đóng (localStorage). Lần hỏi máy chủ sau và lần tải lại trang đều không vẽ lại cuộc đó.
- Tin nhắn hoặc nút nhanh tiếp theo mở cuộc chat mới, như hiện nay.
- Không đổi API.

### 1.3 Báo cáo cho admin

Statistics → CSAT → bảng theo cuộc chat. Thêm 2 cột:

```
| Ended | Session | Agent | Channel | Rating | Mode     | Email form | Resolved | Reason | Comment |
|-------|---------|-------|---------|--------|----------|------------|----------|--------|---------|
| 11/25 | Jane D. | —     | widget  | ★ 4    | AI       | —          | —        | —      | —       |
| 11/25 | #a1b2c3 | Mina  | widget  | ★ 2    | Agent    | Yes        | No       | slow   | …       |
```

- **Mode:** `AI` khi không có nhân viên nào trả lời, `Agent` khi có. Dùng đúng phép gán nhân viên mà cột Agent đang dùng.
- **Email form:** `Yes` khi cuộc chat có phiếu liên hệ gửi kèm (`inquiries.conversation_id`). Gồm cả form ngoài giờ (E-02 b).
- API `GET /agent/csat/conversations` trả thêm `mode` và `emailForm`. Một truy vấn thêm cho mỗi trang.

## 2. N-05 — yêu cầu review N ngày sau khi giao

### 2.1 Dữ liệu

| Bảng | Cột | Ý nghĩa |
|---|---|---|
| `fulfillments` | `delivered_at` DATETIME NULL | Lúc Shopify báo giao xong (`deliveredAt` của gói giao sau cùng). Gói giao không ghi giờ: lấy giờ cập nhật của gói. Đồng bộ ghi cột này khi trạng thái là delivered. Webhook không ghi giờ: lấy lúc nhận |
| `fulfillments` | `review_requested_at` DATETIME NULL | Đã xử lý yêu cầu review cho đơn này, dù gửi hay bỏ qua. Mỗi đơn chỉ một lần |
| `tenants` | `review_request_days` SMALLINT NULL | N ngày. NULL = tắt (mặc định) |

Index `idx_ful_review_due (tenant_id, status, delivered_at)`.

### 2.2 Lịch chạy

Mỗi 60 phút, đổi được bằng `REVIEW_REQUEST_SWEEP_MIN`, `0` = tắt. Lệnh CLI không chạy lịch này.

Với mỗi tenant đã bật, chọn đơn thoả cả 4 điều kiện:

- đã giao, và giao cách đây từ N đến N + 7 ngày. Bật tính năng không kéo theo đơn giao từ lâu;
- chưa xử lý;
- có khách;
- không huỷ, không hoàn tiền.

Mỗi lượt tối đa 200 đơn.

Mỗi đơn được xử lý như sau:

1. Đánh dấu đơn (`UPDATE … WHERE review_requested_at IS NULL`). Hai tiến trình chạy cùng lúc không gửi trùng.
2. Bỏ qua (vẫn đánh dấu) khi:
   - khách đã từ chối marketing (cùng danh sách campaign dùng, N-04);
   - mọi sản phẩm của đơn đã được review.
3. Còn lại, gửi một thông báo `review` cho sản phẩm đầu tiên chưa review. `refType = order_item`, nên nút ⭐ Write Review của widget mở đúng form.
   - Câu chữ theo ngôn ngữ phiên gần nhất của khách (6 ngôn ngữ).
   - Tiêu đề: "How was your order?"
   - Nội dung: "Leave a review for {sản phẩm} ({mã đơn})."

### 2.3 Console

Settings → Marketing, thẻ mới phía trên Klaviyo / Yotpo:

```
┌ Review requests ─────────────────────────────────────────────┐
│ [✓] Ask for a review after delivery                          │
│     Days after delivery  [ 7 ]   (1–60)                      │
│ Customers who opted out of marketing are skipped.            │
│ Each order is asked once.                                    │
│                                                    [ Save ]  │
└──────────────────────────────────────────────────────────────┘
```

- Lưu qua `PATCH /tenants/widget-settings` (`review_request_days`, `null` = tắt).
- Toast thành công / lỗi, 6 ngôn ngữ.
- Ngoài khoảng 1–60 thì API trả **E5168** (`REVIEW_REQUEST_DAYS_INVALID`).

### 2.4 Chưa làm ở đây

Write Review mở Yotpo khi có khoá: thứ 6, cần khoá Yotpo của IVY. Không có khoá thì vẫn dùng form hiện tại.

## 3. C-03 — Cancel order

Câu trả lời kịch bản của widget đã hiện link markdown (`RichText`). Shopify cũng đã có sẵn chức năng cho khách tự yêu cầu huỷ đơn trong tài khoản: Settings → Customer accounts → **Self-serve returns and cancellations**, có từ 06/2026. Vì vậy **không cần code**.

- Đổi câu `cancel_order` của IVY (seed) thành: vào [tài khoản](https://account.ivyusa.com/orders) → mở đơn → yêu cầu huỷ. Không thấy lựa chọn đó thì đơn đã vào khâu chuẩn bị: email hello@ivyusa.com càng sớm càng tốt.
- Production: sửa cùng câu trong AI Settings → Script library khi chủ dự án bảo.
- IVY: bật "Self-serve returns and cancellations", chọn loại gồm cả huỷ đơn. Câu trả lời trả lại của IVY đã dẫn khách tới account.ivyusa.com, nên phần trả hàng có vẻ đã bật.

## 4. Bật Claude (Bedrock)

Không đổi code. Thêm 3 dòng vào `.env.self-hosted` trên máy chủ:

- `AWS_REGION`
- 2 ARN inference profile mà IVY cấp

Không có khoá AWS: máy chủ dùng IAM role, đúng yêu cầu của IT IVY.

Lần deploy sau, API nhận các dòng này. Sau đó:

1. Console → AI engines → thêm 2 engine Bedrock → **Test connection**.
2. Đo thời gian trả lời.
3. Gán chức năng sau khi PM duyệt KB.

## 5. Ảnh hưởng phụ

- **Start new chat** chỉ ẩn cuộc đã đóng trên máy của khách. Dữ liệu và console không đổi. "Earlier conversations" (khách đăng nhập) vẫn liệt kê cuộc đó.
- **Đồng bộ đơn:** khi trạng thái delivered thì ghi thêm `delivered_at`.
  - Đơn đã delivered trước khi deploy: lần đồng bộ sau sẽ điền cột này. Đơn giao trong cửa sổ N…N+7 ngày sẽ được hỏi; đơn giao lâu hơn thì không.
  - Re-sync nhiều tháng: không gửi gì cho đơn cũ, vì cửa sổ tính theo ngày giao của Shopify, không theo lúc đồng bộ.
- **Thông báo review:**
  - đi qua cùng kênh NOTIFICATION, nên trần kênh của tenant và lựa chọn của khách vẫn áp dụng;
  - tăng badge chưa đọc thêm 1;
  - chip Review của widget vẫn liệt kê mọi sản phẩm đã giao như trước.
- **Bảng CSAT:** thêm 2 cột. Bảng rộng hơn, đã cuộn ngang được.

## 6. Kiểm thử

- **Unit:**
  - bộ chọn đơn tới hạn (cửa sổ ngày, huỷ / hoàn, khách từ chối, đã review hết, chạy trùng);
  - câu chữ theo ngôn ngữ;
  - `delivered_at` từ Shopify và từ webhook;
  - validate N;
  - `mode` / `emailForm` của báo cáo.
- **E2E (widget, mock API):**
  - End → chấm điểm → Start a new chat → chỉ còn lời chào và menu;
  - tải lại vẫn sạch;
  - gõ tin mới mở cuộc mới.
- **Local:** SQL chạy 2 lần; API khởi động; console lưu N; lịch chạy với dữ liệu giả gửi đúng 1 thông báo.
