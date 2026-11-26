# RPT-261126 — Câu hỏi sản phẩm gõ tự do: tồn kho thật + thẻ sản phẩm

| | |
|---|---|
| Yêu cầu · Kế hoạch · Test | [REQ-261126](../analysis/REQ-261126-IVY-Chat-Typed-Product-Questions.md) · [PLN-261126](../plan/PLN-261126-IVY-Chat-Typed-Product-Questions.md) · [TCR-261126](../test/TCR-261126-IVY-Chat-Typed-Product-Questions.md) |
| Duyệt | Chủ dự án 2026-11-26: "ok duyệt, 2 có, 3 deploy ngay" |
| Nhánh | `deploy/talk-ivyusa` |
| SQL | Không có |

## 1. Đã làm

Khách gõ câu hỏi về sản phẩm (bộ phân loại trả `product_inquiry`, không phải câu xin gợi ý):

1. RAG tìm kho kiến thức như cũ. Với các tài liệu sản phẩm tìm được (link `/products/{handle}`), API đọc Shopify **lúc hỏi**: còn bán online không, còn hàng không, giá thấp–cao, tên biến thể còn / hết. Tối đa 5 sản phẩm, cache 2 phút, chờ cửa hàng tối đa 4 giây (quá hạn = coi như không đọc được; giới hạn riêng của client là 10 giây).
2. Prompt có thêm khối `STORE_DATA`, đánh số theo CONTEXT, và quy tắc: tồn kho, giá **chỉ** lấy từ `STORE_DATA`; không có thì nói không xác nhận được và chỉ nút Stock inquiry. Không đọc được cửa hàng thì khối ghi rõ điều đó.
3. Dưới câu trả lời có **tối đa 3 thẻ** cho sản phẩm AI thật sự dùng (dòng `CITED`), theo thứ tự AI dùng (D1). Sản phẩm hết hàng vẫn có thẻ, nhãn **Out of stock** (D2). Sản phẩm không bán online thì không có thẻ (D3).
4. Lượt hỏi sản phẩm không phát lại câu trả lời đã lưu và không được lưu để dùng lại (D6).
5. Thẻ lưu trong `messages.retrieval_trace.products`, nên poll và tải lại trang vẫn còn. Trace ghi thêm `storeData` (số sản phẩm đọc được; −1 = cửa hàng lỗi).
6. Widget: component mới `AnswerProductCards`, cùng kiểu thẻ Stock inquiry (ảnh, tên, nhãn In stock / Out of stock, giá), chạm mở trang sản phẩm ở tab mới. Thẻ hiện cả khi tenant ẩn danh sách "Knowledge referenced" (IVY).

Tenant không có Shopify: lookup trả `null`, prompt y như trước (unit test so sánh nguyên văn).

## 2. File

| Phần | File |
|---|---|
| Shopify | `apps/api/src/domain/order/shopify-admin.client.ts`: `PRODUCTS_LIVE_QUERY`, `ShopifyLiveProduct`, `toLiveProduct`, `fetchLiveProducts` (trường kiểm theo Admin GraphQL 2026-01: `ProductVariant.title`, `availableForSale`, `ProductPriceRangeV2.maxVariantPrice`) |
| Dịch vụ mới | `apps/api/src/domain/product/product-live.service.ts`; `product.module.ts` (provide + export) |
| RAG | `apps/api/src/domain/chat/rag.service.ts`: `RetrievedChunk.handle`, `productHandleFrom`, `storeDataBlock`, `answerProductCards`, `STORE_RULE`, tham số `storeLookup`, `RagAnswer.products` / `storeData` |
| Chat | `chat.service.ts` (lookup cho intent sản phẩm, D6, trace, `reply.products`), `chat.module.ts` (import `ProductModule`), `chat.mapper.ts` (`productsOf`) |
| Kiểu dùng chung | `packages/types/src/api/widget.types.ts`: `ChatProductCard`, `ChatMessageResponse.products`, `ChatTurnResponse.reply.products` |
| Widget | `components/chat/AnswerProductCards.tsx` (mới), `MessageBubble.tsx`, `hooks/useChat.ts`, `lib/types.ts` |
| Test | `rag.store-data.spec.ts`, `product-live.service.spec.ts`, `chat.service.store-data.spec.ts` (mới), `chat.mapper.spec.ts` (+3), `e2e/tests/10-product-help.spec.ts` (TC-10-08, TC-10-09) |

Khác PLN: không thêm khoá i18n `aria-label`. Tên của link là chữ trên thẻ (tên, tồn kho, giá), giống thẻ Popular products; nhãn In stock / Out of stock dùng khoá `chat.stock.*` đã có 6 ngôn ngữ.

## 3. Kết quả test (local)

| Bộ | Kết quả |
|---|---|
| Typecheck | `packages/types` build, API, widget, console: xanh |
| Unit mới / sửa | 4 file, 55 ca: xanh (cùng `rag.service.spec`, `chat.service.recommend.spec`: 76 / 76) |
| Toàn bộ unit API | 3.130 / 3.133. 3 ca đỏ chỉ trên Windows, không liên quan (`embed-loader`, `board-attachment`, `heic-conversion`: dấu `\` trong đường dẫn, CRLF); CI Linux xanh với các ca này |
| Khởi động API thật | `Nest application successfully started` (ChatModule → ProductModule, không lỗi DI) |
| e2e `@T10` desktop | 9 / 9, gồm TC-10-08, TC-10-09 |
| e2e `@T08 @T10 @T11 @T12` desktop + mobile | 44 / 44 |
| Build widget · `i18n:check` | xanh · đủ 6 ngôn ngữ |
| Ảnh chụp | Thẻ EN + KO ở 380 px: nhãn 재고 있음 / 품절, tên dài xuống 2 dòng |

## 4. Triển khai

| Bước | Trạng thái |
|---|---|
| Commit + push | ✅ `37e0d9f4`, 07:05 UTC |
| CI `IVY CI/CD` (verify, e2e gate, deploy-gate) | ✅ run 45772816056, xanh 07:11:59 UTC |
| Máy chủ tự deploy | ✅ widget production đổi bundle `index-D0MyTYaF.js` → `index-Cdw2ZguA.js` lúc 07:13:23 UTC; bundle mới có `answer-product` |
| Smoke production (lần 1) | 🟡 thẻ + tồn kho chạy, nhưng sản phẩm hỏi đích danh không được tìm ra — §5 |
| Sửa tìm theo tên (`FIX-261126`) — push, CI, deploy, smoke lại | ⏳ |

## 5. Smoke production và bản sửa tìm theo tên

Khách vãng lai trên talk.ivyusa.com/widget, sau deploy `37e0d9f4`:

| Câu hỏi | Thời gian | Kết quả |
|---|---|---|
| "Is KISS Gel Fantasy Nails in stock?" (tên ví dụ trong PRD, không phải tên thật) | 5,1 s | AI nói không xác nhận được, chỉ nút Stock inquiry. Không thẻ. Đúng: không có sản phẩm tên đó |
| "Is Gold Finger Holiday Limited Edition Nails in stock? How much is it?" (bán chạy #1 mục Nails) | 4,1 s | Không xác nhận được, không thẻ — **sai**: sản phẩm có trong kho kiến thức |
| "Tell me about Kiss Gel Fantasy Glue On Nails - Long Lasting False Nails. Is it in stock?" (bán chạy #2) | 6,7 s | Không tìm ra sản phẩm này; nói về "Kiss New York Gel Pro Nail Polish Core Colors - Under the Pecan Tree": **in stock**, thẻ In stock · $11.99 · link ivyusa.com — phần cửa hàng + thẻ chạy đúng |

Nguyên nhân và cách sửa: [FIX-261126](../bug-fix/FIX-261126-Product-Name-Not-Retrieved.md). Tóm tắt: tài liệu đúng tên không lọt vào 8 ứng viên của nhánh từ khoá giữa 1.940 tài liệu sản phẩm giống nhau. Thêm **nhánh tên sản phẩm** cho lượt hỏi sản phẩm: so tên trên toàn bộ tài liệu sản phẩm (`titleMatchScore` ≥ 0,75, tối đa 3), gộp như nhánh thứ ba. Thêm 8 ca unit (`pickProductTitles` + `answer()`); 42 bộ test chat 382 / 382.

## 6. Giới hạn còn lại

- **Màu / cỡ là sản phẩm riêng** (D4): nếu kho kiến thức không tìm ra đúng sản phẩm màu đó, AI không xác nhận và chỉ nút Stock inquiry. Bản sau: tìm thêm trên cửa hàng bằng chữ của khách.
- Lượt hỏi sản phẩm không còn dùng lại câu trả lời đã lưu (D6), nên mỗi câu đều gọi AI.
- Thẻ chỉ có khi AI ghi dòng `CITED`. Không có dòng này thì không thẻ (tránh hiện sản phẩm không liên quan).
