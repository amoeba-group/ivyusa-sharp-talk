# PLN-261126 — Câu hỏi sản phẩm gõ tự do: trả lời bằng tồn kho thật + thẻ sản phẩm

| | |
|---|---|
| Yêu cầu | [REQ-261126-IVY-Chat-Typed-Product-Questions](../analysis/REQ-261126-IVY-Chat-Typed-Product-Questions.md) — PRD v1.0 slide 14, 17, A-04 |
| Trạng thái | ⏳ **Chờ chủ dự án duyệt** — chưa code |
| Nhánh | `deploy/talk-ivyusa` (push = deploy production) |
| Migration | Không có SQL. Thẻ lưu trong `messages.retrieval_trace` (JSON có sẵn) |
| Ước lượng | ~1 ngày làm việc + smoke production |

## 1. Mục tiêu

Khách gõ câu hỏi về một sản phẩm ("Is KISS Gel Fantasy Nails in stock?", "How much is …?"):

1. AI trả lời bằng **dữ liệu cửa hàng đọc lúc hỏi** (còn hàng, giá, biến thể) cộng mô tả trong kho kiến thức. Không có dữ liệu thì nói không xác nhận được, chỉ nút 📦 Stock inquiry, không đoán.
2. Sản phẩm AI nhắc tới hiện **một lần, dạng thẻ** dưới câu trả lời: ảnh · tên · giá · In stock / Out of stock · link. Tối đa 3.

Ngoài phạm vi: luồng gợi ý (A-01…A-04), nút 📦 Stock inquiry, câu cạnh thẻ: giữ nguyên.

## 2. Quyết định đề xuất (cần chủ dự án xác nhận)

| # | Đề xuất | Lý do |
|---|---|---|
| D1 | Thẻ chỉ cho sản phẩm AI **thật sự dùng** để trả lời (dòng `CITED` sẵn có), tối đa 3, theo thứ tự AI dùng | Slide 17: tránh hiện sản phẩm không liên quan; FIX-260806 §7-1 |
| D2 | Sản phẩm khách hỏi đích danh mà **hết hàng** vẫn có thẻ, nhãn **Out of stock** | Khách hỏi chính sản phẩm đó. Luồng **gợi ý** vẫn bỏ hàng hết (A-04) |
| D3 | Sản phẩm không còn bán online (nháp, lưu trữ, ẩn): **không có thẻ**; AI nói sản phẩm hiện không bán trên cửa hàng | PRD: "hidden products always excluded" |
| D4 | Màu / cỡ: đưa **tên biến thể + còn / hết** của sản phẩm tìm thấy vào dữ liệu cửa hàng. Màu là **sản phẩm riêng** (IVY: "… - Aphrodite") mà kho kiến thức không tìm ra: AI nói không xác nhận được màu đó, chỉ 📦 Stock inquiry | Làm được ngay, không đoán. Bản sau có thể tìm thêm trên cửa hàng bằng chữ của khách |
| D5 | Chỉ đọc cửa hàng cho lượt hỏi **về sản phẩm** (bộ phân loại trả `product_inquiry`, không phải lỗi phân loại) | Không thêm độ trễ cho câu hỏi chính sách / đơn hàng |
| D6 | Lượt hỏi sản phẩm có dữ liệu cửa hàng **không phát lại câu trả lời cũ** và **không được lưu để dùng lại** | Câu "còn hàng" của hôm qua có thể sai hôm nay (REQ G4) |

## 3. Thiết kế

```
Khách gõ ──► phân loại ──► xin gợi ý? ──có──► nút danh mục (giữ nguyên)
                              │không
                              ▼
                    tìm kho kiến thức (giữ nguyên)
                              │
              có tài liệu sản phẩm + intent sản phẩm + có kết nối Shopify?
                    │có                                   │không
                    ▼                                     ▼
   đọc Shopify theo handle (≤ 5, cache 2 phút)     prompt như hiện nay
                    │
   STORE_DATA vào prompt ──► AI trả lời + CITED ──► moderation (giữ nguyên)
                    │
   thẻ = sản phẩm được CITED có dữ liệu cửa hàng (≤ 3) ──► reply.products + retrieval_trace.products
```

**API**

1. `RetrievedChunk.handle` cho tài liệu sản phẩm: `externalKey` (catalog sync, CSV import), không có thì tách từ `sourceUrl` (`/products/{handle}`).
2. Dịch vụ mới `ProductLiveService.lookup(tenantId, handles)` trong module `product`. Gọi `ShopifyAdminClient.fetchProductsByHandles` (đã có, `shopify-admin.client.ts:658`) với bộ trường riêng có thêm `variants { title availableForSale }`. Bộ trường của truy vấn gợi ý / tìm kiếm giữ nguyên. Cache Redis 2 phút theo tenant + handle. Lỗi Shopify → map rỗng + `logger.warn`.
3. `RagService.answer`: tham số tuỳ chọn mới `storeLookup`. Sau `capContext`, đọc handle của các mục sản phẩm, thêm khối:

   ```
   STORE_DATA_START (read from the store just now)
   [3] KISS Gel Fantasy Nails — on sale — in stock — 9.99 USD — variants: Ribbon (in stock), Lace (sold out)
   [5] Gel Pro Top Coat — not on sale online
   STORE_DATA_END
   ```

   cùng quy tắc: *"Stock, availability and prices come ONLY from STORE_DATA. For an item not in STORE_DATA, say you cannot confirm it here and suggest the Stock inquiry button. Never guess."* Trả thêm `products` theo D1–D3.
4. `ChatService`: truyền `storeLookup` theo D5; bỏ qua phát lại / lưu để dùng lại theo D6; lưu `retrievalTrace.products`; `reply.products`.
5. `ChatMapper.productsOf(m)` như `citationsOf`, để tải lại trang vẫn thấy thẻ. Kiểu `ChatProductCard { handle, title, imageUrl, price, currency, productUrl, inStock }`.
6. Log: `retrievalTrace.storeData = số sản phẩm đọc được`, để đo trên production.

**Widget**

1. Component mới `AnswerProductCards`: cùng kiểu thẻ Stock inquiry (ảnh, tên, nhãn `Badge` In stock / Out of stock, giá, chạm → trang sản phẩm ở tab mới). Thẻ Popular products / Stock inquiry đang chạy **không sửa**.
2. `MessageBubble` hiện thẻ dưới câu AI khi có `message.products`. **Không phụ thuộc** tuỳ chọn `citations: hidden`: danh sách "Knowledge referenced" vẫn ẩn với IVY.
3. Nhãn dùng `chat.stock.inStock` / `outOfStock` (đã có 6 ngôn ngữ). Thêm 1 khoá `aria-label` cho link thẻ × 6 ngôn ngữ, chạy `npm run i18n:check`.

## 4. Wireframe (widget 380 px, tab Chat)

AS-IS (production hôm nay):

```
┌──────────────────────────────────────┐
│ Chat                          🌐 ⚙ ✕ │
│              ┌─────────────────────┐ │
│              │ Is KISS Gel Fantasy │ │  ← khách gõ
│              │ Nails in stock?     │ │
│              └─────────────────────┘ │
│ ┌────────────────────────────────┐   │
│ │ KISS Gel Fantasy Nails is a    │   │  ← AI: chỉ có mô tả trong kho kiến
│ │ ready-to-wear gel nail set…    │   │     thức; không có tồn kho, giá
│ └────────────────────────────────┘   │
│                                      │  ← không có sản phẩm nào hiện ra
│ [ Type a message…          ] [Send]  │
└──────────────────────────────────────┘
```

TO-BE:

```
┌──────────────────────────────────────┐
│ Chat                          🌐 ⚙ ✕ │
│              ┌─────────────────────┐ │
│              │ Is KISS Gel Fantasy │ │
│              │ Nails in stock?     │ │
│              └─────────────────────┘ │
│ ┌────────────────────────────────┐   │
│ │ Yes — KISS Gel Fantasy Nails   │   │  ← AI: dùng dữ liệu cửa hàng
│ │ is in stock at $9.99. The Lace │   │
│ │ design is sold out right now.  │   │
│ └────────────────────────────────┘   │
│ ┌──────┬─────────────────────────┐   │  ← thẻ mới (≤ 3), chạm → trang
│ │ img  │ KISS Gel Fantasy Nails   │   │     sản phẩm, tab mới
│ │      │ [In stock]   $9.99       │   │
│ └──────┴─────────────────────────┘   │
│ [ Type a message…          ] [Send]  │
└──────────────────────────────────────┘
```

Sản phẩm hết hàng: cùng thẻ, nhãn xám **[Out of stock]**. Không tìm thấy / không bán online: không có thẻ, AI chỉ nút 📦 Stock inquiry.

## 5. Các bước

| Bước | Việc | File chính |
|---|---|---|
| P1 API | handle cho chunk; `ProductLiveService`; khối STORE_DATA + quy tắc; `products` theo CITED; D5, D6; trace; mapper; kiểu | `rag.service.ts`, `chat.service.ts`, `chat.mapper.ts`, `product/product-live.service.ts` (mới), `product.module.ts`, `shopify-admin.client.ts`, `packages/types` |
| P2 Widget | `AnswerProductCards`; gắn vào `MessageBubble`; kiểu `ChatMessage.products`; 1 khoá i18n × 6 | `components/chat/AnswerProductCards.tsx` (mới), `MessageBubble.tsx`, `lib/types.ts`, `i18n/locales/*.ts` |
| P3 Test + tài liệu | Unit, e2e, TCR, RPT; sửa mục 4 của hướng dẫn test; TASKS, TEST-CASES | `*.spec.ts`, `e2e/tests/…`, `docs/test/TCR-261126-…`, `docs/implementation/RPT-261126-…` |

## 6. Ảnh hưởng phụ

| Chỗ | Ảnh hưởng | Xử lý |
|---|---|---|
| Độ trễ | +1 lần gọi Shopify (~0,3–0,6 giây) cho lượt hỏi sản phẩm khi chưa có cache; lượt khác không đổi | Cache 2 phút; đo trên production |
| Giới hạn API Shopify | 1 truy vấn ≤ 5 handle mỗi lượt | Cache; lỗi → trả lời như hôm nay |
| Prompt | +~5 dòng (~150 token) | — |
| Dùng lại câu trả lời | Lượt hỏi sản phẩm không phát lại / không lưu (D6) → nhiều lần gọi AI hơn cho câu hỏi lặp lại | Lưu lượng IVY thấp; câu chính sách vẫn dùng lại như cũ |
| Moderation | Không đổi: câu AI vẫn qua `ModerationService.moderate()`. Thẻ là dữ liệu Shopify | — |
| Luồng gợi ý, Stock inquiry, câu cạnh thẻ | Không đổi | Test hiện có phải xanh |
| Tuỳ chọn `citations: hidden` | Danh sách tham chiếu vẫn ẩn; thẻ sản phẩm hiện riêng | Test cả hai giá trị |
| Tenant không có Shopify | Không đọc cửa hàng, prompt y như hôm nay | Unit test |
| e2e hiện có | Không ảnh hưởng: thẻ chỉ hiện khi `products` có dữ liệu | Chạy `test:ci` |

## 7. Kiểm thử

- **Unit:** tách handle (externalKey / URL / không có); khối STORE_DATA (còn, hết, không bán online, biến thể); `products` theo CITED, tối đa 3, D2, D3; không kết nối Shopify → prompt không đổi; Shopify lỗi → không khối + cảnh báo; D6 bỏ phát lại; `productsOf` khi tải lại.
- **e2e (widget, API giả):** câu trả lời có `products` → thẻ, `data-in-stock`, tối đa 3; `citations: hidden` vẫn hiện thẻ; tải lại vẫn còn thẻ; 6 ngôn ngữ nhãn đúng. Gắn tag task mới vào `test:ci`.
- **Smoke production** (cùng chủ dự án, theme Preview): 1 sản phẩm còn hàng, 1 hết hàng, 1 tên không có; đo thời gian trả lời.

## 8. Triển khai

- Không SQL. Push = deploy, API khởi động lại ~1–2 phút. Không push khi đang Re-sync đơn.
- IVY test từ 2026-11-27. Đề xuất: làm ngay khi được duyệt, push khi CI xanh, rồi sửa dòng "Typed product questions" ở mục 4 hướng dẫn test và báo IVY.

## 9. Cần chủ dự án duyệt

1. Duyệt PLN (D1–D6).
2. D2: hiện thẻ cho sản phẩm hết hàng khi khách hỏi đích danh? (đề xuất: có)
3. Thời điểm deploy: trong đợt IVY test (đề xuất) hay sau vòng test đầu.
