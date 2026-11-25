# TCR-261125 — IVY PRD v1, giai đoạn 5: lời nhắn do AI viết (C-02)

| | |
|---|---|
| Kế hoạch | [PLN-261125-IVY-PRD-v1-Phase5](../plan/PLN-261125-IVY-PRD-v1-Phase5.md) |
| Báo cáo | [RPT-261125-IVY-PRD-v1-Phase5](../implementation/RPT-261125-IVY-PRD-v1-Phase5.md) |

## 1. Unit

### 1.1 Bộ kiểm dữ kiện — `ai-wording.spec.ts` (mới, 13 ca)

| Ca | Kỳ vọng |
|---|---|
| Viết lại câu Return của IVY, giữ đủ dữ kiện | Đạt |
| Đổi "10 days" → "14 days" · bỏ "$6.95" · thêm "5 business days" | Từ chối: số khác |
| Bỏ email · đổi link · biến link markdown thành chữ | Từ chối: email / URL / link khác |
| Câu Affiliate: 3 dòng bước + chữ đậm | Đạt. Gộp dòng → từ chối. Bỏ chữ đậm → từ chối |
| Tiền | "42.00 USD" = "$42". "6.95" = "6,95". "42.50" ≠ "42" |
| Rỗng · quá ngắn · quá dài | Từ chối |
| Số nằm trong URL / email | Không tính là số trong câu |
| `onlyKnownNumbers` | Số có trong dữ kiện: đạt. "3 days" không có trong dữ kiện: từ chối |
| `cleanModelText` | Bỏ ngoặc kép và nhãn "Rewritten message:" ở đầu |

### 1.2 Viết lại câu kịch bản — `script-wording.service.spec.ts` (mới, 7 ca)

| Ca | Kỳ vọng |
|---|---|
| Chức năng chat là Stub, hoặc không có engine | Giữ nguyên câu kịch bản, **không gọi** model |
| Engine thật, bản viết lại giữ đủ dữ kiện | Dùng bản viết lại. Lời gọi: chức năng `chat`, feature `script_wording`, quy tắc ngôn ngữ (Korean). **Chỉ** gửi câu kịch bản. Cache 12 giờ |
| Bản viết lại đổi một con số | Giữ câu kịch bản. Ghi nhớ "từ chối" 1 giờ |
| Engine rơi về Stub (`degraded`) · quá 5 giây | Giữ câu kịch bản |
| Có trong cache (bản viết lại / "từ chối") | Trả từ cache, không gọi model |
| Gateway lỗi | Giữ câu kịch bản, không ném lỗi |
| `withTimeout` | Hết hạn → `null` |

### 1.3 `scenario.service.spec.ts` (thêm 2 ca)

| Ca | Kỳ vọng |
|---|---|
| Có bản viết lại | Bản viết lại đi qua moderation (`scope: ai`), là câu trả về và câu được lưu |
| Chưa đồng ý Chat & AI | Không xin bản viết lại |

### 1.4 Câu cạnh thẻ — `card-note.service.spec.ts` (mới, 8 ca)

| Ca | Kỳ vọng |
|---|---|
| Payment | Dữ kiện lấy từ dữ liệu của mình: mã đơn, sản phẩm, tổng tiền, thanh toán, bước giao hàng. Đọc đơn có lọc tenant |
| Chưa đồng ý · Stub | `text: null`, không gọi model |
| Đơn của khách khác | `null`, không gọi model, có log cảnh báo |
| Câu có số lạ ("3 days") · moderation chặn | `null` |
| Delivery | Dữ kiện có bước giao hàng, hãng vận chuyển, có link theo dõi hay không |
| Stock | Dữ kiện lấy từ cùng kết quả tìm của widget (cache). Sản phẩm không có trong kết quả → `null` |
| Popular | Dữ kiện là tối đa 3 sản phẩm của cùng kết quả widget có (sản phẩm thứ 4 bị bỏ), cách chọn "chosen by the store"; prompt dặn không nhắc lại giá. Không có sản phẩm → `null` |

## 2. E2E (widget, engine Stub)

`09-my-orders`, `10-product-help`, `11-contact` (Payment / Delivery / Stock / Feedback / Contact) và `12-affiliate-csat`: **39 / 39** desktop. Sau khi thêm Popular: `10` + `11` chạy lại **23 / 23**.

Với Stub, API trả `text: null`, nên widget giữ câu cũ và mọi assertion không đổi.

## 3. Còn phải kiểm khi bật AI

Kiểm khi chức năng chat của production có Bedrock (Haiku):

1. Bấm Exchange & refund, Cancel order, Affiliate ở 2–3 ngôn ngữ. Câu đọc tự nhiên, số và link đúng như kịch bản, Affiliate vẫn hiện 3 thẻ bước.
2. Payment check / Delivery inquiry / Stock inquiry / Popular products: câu dưới thẻ khớp thẻ, không có ngày hay số tiền lạ.
3. Log API: tỉ lệ `script wording refused`. Nếu Haiku hay bị từ chối, chỉnh câu lệnh cho model; dữ kiện vẫn an toàn vì đã rơi về câu gốc.
