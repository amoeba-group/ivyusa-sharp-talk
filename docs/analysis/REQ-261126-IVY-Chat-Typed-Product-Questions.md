# REQ-261126 — Khách gõ câu hỏi về sản phẩm trong chat: tồn kho và thẻ sản phẩm

| | |
|---|---|
| Nguồn | Câu hỏi của chủ dự án 2026-11-26: "khi hỏi tên sản phẩm trong đoạn chat thì có đề cập đến sản phẩm và sản phẩm hiển thị lên không? Trong đặc tả có không, và phần stock đã xong chưa" |
| Đặc tả | IVY PRD v1.0 (`[EN]IVY_TalkTalk_PRD___202611_1.pptx`, sửa 2026-11-25): slide 13 (quick menu), slide 14 (nguồn trả lời), slide 15–17 (thẻ sản phẩm), bảng A-04 |
| Đối chiếu với | nhánh `deploy/talk-ivyusa` tại `2d8bf3ba` (production đang chạy `f4faad2f`, cùng code chat) |
| Kế hoạch | [PLN-261126-IVY-Chat-Typed-Product-Questions](../plan/PLN-261126-IVY-Chat-Typed-Product-Questions.md) |

## 1. Đặc tả nói gì

| Slide | Nội dung |
|---|---|
| 13 · Quick menu | Stock inquiry: "Pick product → AI answer from stock data". Ô nhập tự do luôn mở |
| 14 · AI Response | Bảng nguồn trả lời: **"Product · stock → Product catalog · stock data"**, ví dụ *"Is this color in stock?"*. Guardrail: "Never makes up anything not in the source data", "Uses only Shopify real-time lookups and injected order data" |
| 15–16 · Gợi ý | Cả hai chế độ: "Shown as product cards (image · price · link)"; "AI description + up to 3 product cards" |
| 17 · Lỗi IVY đã thấy | "Same products appear twice in the numbered list and the link list below" → cải tiến "Show products once as card UI" |
| A-04 | "Exclude out-of-stock · hidden, product cards (image · price · link), mode log" (P0) |

PRD đòi thẻ sản phẩm rõ ràng cho câu trả lời **gợi ý**. Với câu hỏi gõ tự do về một sản phẩm, PRD đòi trả lời từ **catalog + tồn kho**; thẻ không được ghi riêng, nhưng slide 17 yêu cầu sản phẩm trong câu trả lời hiện **một lần, dạng thẻ**.

## 2. AS-IS (bằng chứng trong code)

| Trường hợp | Hiện tại | Bằng chứng |
|---|---|---|
| Nút 📦 Stock inquiry | ✅ Live từ 2026-11-25: gõ tên → chọn 1 trong ≤ 5 sản phẩm đang bán → thẻ In stock / Out of stock + câu AI. Tồn kho đọc thẳng từ Shopify, mức **sản phẩm** (còn ≥ 1 biến thể mua được) | `product-recommendation.service.ts:340-373`, `shopify-admin.client.ts:381-397`, RPT-261125-Phase1 §1.9, RPT Phase5 |
| Gõ "gợi ý / phổ biến" | ✅ Nút danh mục → ≤ 3 thẻ sản phẩm phổ biến (ảnh · giá · link) | `chat.service.ts:970-979, 1795-1839`, `recommend-ask.ts` |
| Gõ tên sản phẩm / hỏi tồn kho, giá | AI (Sonnet) trả lời từ kho kiến thức. Tài liệu sản phẩm chỉ có tên, mô tả, tag, tên biến thể; **không có tồn kho, không có giá** (cố ý, vì giá trị cũ trong vector index sai mà không ai biết) | `chat.service.ts:991-1006`, `rag.service.ts:558-738`, `catalog-sync.service.ts:296-339` |
| Sản phẩm hiện dưới câu trả lời | Chỉ có danh sách chữ "Knowledge referenced" (🛍 tên + link), **không phải thẻ**. IVY production đặt `citations: hidden` từ 2026-11-19 (theo Figma) → **không hiện gì** | `MessageBubble.tsx:145-192`, RPT-261119-IVY-Chat-Continuity-And-References (dòng "Knowledge references = Hidden") |
| Dùng lại câu trả lời cũ | Câu hỏi gần giống một câu đã trả lời → phát lại câu đã lưu, không gọi AI (trừ câu hỏi về đơn) | `chat.service.ts:1007-1033` |

Kết quả với khách: hỏi "Is KISS Gel Fantasy Nails in stock?" → AI nói về sản phẩm (nếu tìm thấy trong kho kiến thức) nhưng **không xác nhận được tồn kho**, không có giá, và **không thấy sản phẩm** nào trên màn hình.

## 3. TO-BE

1. Câu hỏi gõ tự do về sản phẩm được trả lời bằng **dữ liệu cửa hàng lúc hỏi** (tồn kho, giá) cộng mô tả trong kho kiến thức.
2. Sản phẩm AI nhắc tới hiện **một lần, dạng thẻ** (ảnh · tên · giá · In stock / Out of stock · link), tối đa 3, dưới câu trả lời.
3. Không có dữ liệu cửa hàng (lỗi Shopify, sản phẩm đã ẩn) → AI nói không xác nhận được và chỉ nút 📦 Stock inquiry; không đoán.

## 4. Khoảng trống

| # | Khoảng trống | Mức |
|---|---|---|
| G1 | Câu hỏi tồn kho / giá gõ tự do không dùng dữ liệu tồn kho (slide 14) | P0 theo PRD |
| G2 | Sản phẩm trong câu trả lời gõ tự do không hiện dạng thẻ (slide 17, A-04) | P0 theo PRD |
| G3 | Tồn kho theo **màu / cỡ** ("Is this color in stock?"): Stock inquiry chỉ báo mức sản phẩm. Ở IVY nhiều màu là **sản phẩm riêng** (ví dụ "Nail Polish Core Colors - Aphrodite"); kho kiến thức gộp chúng vào một tài liệu đại diện | Một phần; xem PLN D4 |
| G4 | Câu trả lời được dùng lại có thể mang trạng thái tồn kho cũ nếu G1 được làm mà không chặn phần dùng lại | Rủi ro khi làm G1 |

## 5. Luồng người dùng (TO-BE)

1. Khách gõ "Is KISS Gel Fantasy Nails in stock?".
2. Phân loại câu hỏi: hỏi về sản phẩm, không phải xin gợi ý → đi đường kho kiến thức như hiện nay.
3. Tìm trong kho kiến thức ra các tài liệu sản phẩm → đọc dữ liệu cửa hàng của các sản phẩm đó (1 lần gọi Shopify, có cache).
4. AI viết câu trả lời từ mô tả + dữ liệu cửa hàng, ghi lại sản phẩm nào đã dùng.
5. Moderation như mọi câu AI.
6. Widget hiện câu trả lời, rồi ≤ 3 thẻ sản phẩm; chạm thẻ → trang sản phẩm (tab mới). Tải lại trang vẫn thấy thẻ.

## 6. Ràng buộc

- Guardrail PRD: không bịa; tồn kho và giá chỉ lấy từ dữ liệu Shopify vừa đọc.
- Moderation không bỏ qua được (FR-069).
- Push lên `deploy/talk-ivyusa` = deploy production (API khởi động lại ~1–2 phút). IVY test từ 2026-11-27.
- Không đổi schema: thẻ lưu trong `messages.retrieval_trace` (JSON), như `citations` và `followUps`.
- 6 ngôn ngữ: nhãn In stock / Out of stock đã có (`chat.stock.*`).
- AWS / model: không đổi engine hay region (IVY IT yêu cầu hỏi trước).
