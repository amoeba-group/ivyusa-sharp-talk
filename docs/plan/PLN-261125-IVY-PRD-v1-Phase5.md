# PLN-261125 — IVY PRD v1, giai đoạn 5 (việc thứ 6): lời nhắn do AI viết (C-02), hướng dẫn test, bàn giao

| | |
|---|---|
| Kế hoạch gốc | [PLN-261125-IVY-PRD-v1-Alignment](PLN-261125-IVY-PRD-v1-Alignment.md) §4 (đã duyệt 2026-11-25) |
| Lệnh bắt đầu | Chủ dự án 2026-11-25: "ok, bắt đầu làm việc thứ 6 luôn" |
| Phạm vi | API, widget. Console không đổi |
| Migration | Không |

## 1. C-02 — lời nhắn do AI viết

PRD slide 13 và 20:

- Nút nhanh chỉ là lối vào; mọi câu chữ do AI viết.
- Thông tin đơn và giao hàng hiện bằng thẻ dữ liệu.
- Với kịch bản, AI chỉnh câu chữ, còn **bước và con số theo đúng kịch bản**.

### 1.1 Câu trả lời của kịch bản

Ví dụ: Exchange & refund, Cancel order, Affiliate, Shipping.

- Câu của kịch bản (bản tenant đã sửa, hoặc bản có sẵn) được đưa cho AI viết lại cho tự nhiên, đúng ngôn ngữ của khách.
- **Bộ kiểm** giữ nguyên dữ kiện. Bản viết lại chỉ được dùng khi qua đủ cả 4 điều kiện, sai một điều thì dùng câu gốc:
  - còn đủ mọi số, URL, email và link markdown của câu gốc;
  - không có số nào mới;
  - giữ đúng số dòng bước (`1.` `2.` `3.`), để thẻ bước của widget vẫn tách được;
  - độ dài trong khoảng 0,5–1,8 lần câu gốc.
- **Không gửi dữ liệu của khách cho AI:** chỉ có câu của kịch bản và ngôn ngữ.
- Kết quả lưu cache Redis 12 giờ theo (tenant, ngôn ngữ, nội dung câu), nên lần bấm sau trả lời ngay.
- Quá 5 giây, AI lỗi, hoặc engine là Stub: dùng câu gốc, như hiện nay.
- Bản viết lại vẫn qua cổng kiểm duyệt (moderation) như mọi câu AI.

### 1.2 Câu AI cạnh thẻ dữ liệu

Áp dụng cho 3 thẻ: Payment check, Delivery inquiry, Stock inquiry.

```
[Payment check]                         (khách bấm)
🤖 Here's the payment for your latest order:     ← câu dẫn cố định, giữ nguyên
   ┌──────────────────────────────┐
   │ #IVY-1042        Nov 20      │
   │ Gel Polish Set + 1 item      │
   │ Total $42.00        [Paid]   │
   └──────────────────────────────┘
🤖 Your payment for #IVY-1042 went through on   ← MỚI: AI viết từ dữ liệu thẻ
   Nov 20. We're preparing your order now.         (trước đây: câu cố định)
   [Track delivery] [Contact Support] [Start over]
```

- Widget gọi `POST /chat/card-note` với `{ kind: payment | delivery | stock, order_id?, product_handle? }`. API trả `{ text: string | null }`.
- **Máy chủ tự dựng dữ kiện** cho AI, không nhận từ widget, và kiểm đơn có thuộc phiên của khách không:
  - đơn: mã đơn, ngày, tổng tiền, trạng thái thanh toán, bước giao hàng, có mã vận đơn không;
  - sản phẩm: tên, còn hàng hay hết.
- AI viết 1–2 câu bằng ngôn ngữ của khách, chỉ dùng dữ kiện đó.
  - Bộ kiểm: không có số nào ngoài dữ kiện, tối đa 300 ký tự.
  - Sau đó qua moderation. Lỗi hoặc không đạt: `text: null`.
- **Chưa đồng ý Chat & AI:** không gọi AI, trả `null` (PRD slide 14: rút đồng ý là dừng AI ngay).
- Giới hạn 30 lần / phút mỗi phiên. Cache 10 phút theo dữ kiện.
- Widget hiện chấm "đang gõ" trong lúc chờ. Có câu AI thì hiện câu đó, `null` thì hiện câu cố định như hiện nay.
- **Popular products** (Product inquiry → danh mục, PRD slide 16 bước 6: "mô tả của AI + tối đa 3 thẻ"):
  - loại `popular` `{category}`, dữ kiện là đúng 3 sản phẩm widget đang hiện (lấy từ cache), kèm cách chọn (cửa hàng chọn / bán chạy + review);
  - AI viết 1–2 câu giới thiệu dưới 3 thẻ, không nhắc lại giá;
  - `null` thì không thêm câu nào, giống hiện nay.

### 1.3 Câu hỏi gợi ý sản phẩm gõ tự do

PRD slide 16–17, A-02 / C-04. IVY đã thấy lỗi: hỏi "Recommend your most popular product" thì AI trả lời từ kho kiến thức (không có số bán), tự bịa thứ hạng và lẫn danh mục.

Từ nay câu hỏi đó đi qua **bộ chọn sản phẩm**:

- Điều kiện: bộ phân loại đọc là `product_inquiry` **và** câu có từ hỏi gợi ý (popular / best seller / recommend…, 6 ngôn ngữ). Tenant phải có danh mục Product Help.
- AI trả lời một câu ("…bạn muốn xem danh mục nào?", có thể do AI viết lại theo §1.1), qua moderation. Kèm **chip các danh mục**; danh mục khách đã nhắc tới đứng đầu.
- Khách bấm chip: widget mở đúng phần Popular products của danh mục đó (Admin Selected / AI Auto, tối đa 3 thẻ, câu AI §1.2).
- Thread đang chờ nhân viên, hoặc chủ đề nằm trong deny-list: đi theo đường cũ.

```
🧑 Recommend your most popular nail products
🤖 I can show you our most popular picks. Which category would you like to see?
   [Nails] [Hair] [K-Beauty] … [Start over]       ← chip; danh mục khách nhắc tới đứng đầu
🧑 Nails                                           (bấm chip)
🤖 Here are popular Nails products:
   [thẻ 1] [thẻ 2] [thẻ 3]
🤖 (câu giới thiệu AI §1.2)
```

### 1.4 Khi nào bật

Cả hai phần dùng engine của chức năng **chat** (đang dùng để phân loại câu hỏi). Production đang là Stub, nên chưa đổi gì.

Khi chủ dự án gán Bedrock (đề xuất **Haiku** cho chat, **Sonnet** cho rag) sau khi PM duyệt kho kiến thức, C-02 tự bật. Không cần deploy lại.

## 2. Klaviyo · Yotpo

Cần khoá của IVY. Chưa có khoá thì không làm được phần chạy thật. Khi có khoá:

- Klaviyo: đồng bộ opt-out hai chiều.
- Yotpo: nút Write Review gửi review sang Yotpo.

Hai phần này làm theo PLN riêng.

## 3. Kiểm thử toàn bộ và bàn giao

- **Kiểm thử toàn bộ:** API, types, widget, e2e `test:ci` (desktop + mobile), build. Kiểm chỉ đọc trên production theo từng mục PRD.
- **Hướng dẫn test cho IVY, song ngữ EN + KO:**
  - môi trường: theme "Ivyusa Talk Staging Theme", console talk.ivyusa.com;
  - từng mục PRD: làm gì, thấy gì, giới hạn hiện tại;
  - cách báo lỗi.
- Bản nguồn `docs/guide/GUIDE-261125-IVY-Test-Guide.md`, xuất PDF.

## 4. Ảnh hưởng phụ

- Câu kịch bản trên production có thể khác chữ một chút giữa các ngày (cache 12 giờ). Dữ kiện không đổi, nhờ bộ kiểm.
- E2E chạy với engine Stub, nên kết quả không đổi.
- Tốn token: kịch bản thì 1 lần gọi mỗi (câu, ngôn ngữ) trong 12 giờ; thẻ thì 1 lần gọi mỗi lần bấm, nếu dữ kiện thay đổi so với 10 phút trước.
- Phiên chưa đồng ý AI vẫn thấy câu cố định.

## 5. Kiểm thử

- **Unit:**
  - bộ kiểm dữ kiện: số, URL, email, link, dòng bước, độ dài;
  - Stub / quá giờ / lỗi → câu gốc;
  - cache;
  - card-note: quyền sở hữu đơn, chưa đồng ý, dữ kiện, bộ kiểm.
- **E2E:** các ca T12 / C-01 hiện có vẫn xanh với Stub.
- **Local:** gán engine giả có trả lời, xem câu đổi và bị chặn đúng lúc.
