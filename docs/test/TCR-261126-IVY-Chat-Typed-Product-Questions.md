# TCR-261126 — Câu hỏi sản phẩm gõ tự do: tồn kho thật + thẻ sản phẩm

| | |
|---|---|
| Yêu cầu | [REQ-261126](../analysis/REQ-261126-IVY-Chat-Typed-Product-Questions.md) |
| Kế hoạch | [PLN-261126](../plan/PLN-261126-IVY-Chat-Typed-Product-Questions.md) (D1–D6) |
| Báo cáo | [RPT-261126](../implementation/RPT-261126-IVY-Chat-Typed-Product-Questions.md) |

## 1. Unit (API)

### 1.1 `rag.store-data.spec.ts` (mới, 20 ca)

| Ca | Kỳ vọng |
|---|---|
| `productHandleFrom`: link `/products/{handle}`, có `?variant=`, có `/collections/…/products/…/` | Ra handle chữ thường |
| `productHandleFrom`: tài liệu chính sách, tài liệu sản phẩm không có link (hướng dẫn dùng), trang collection, chuỗi không phải URL, cú pháp tìm kiếm trong handle | `null` |
| `storeDataBlock`: còn hàng có khoảng giá + biến thể; không bán online; handle cửa hàng không có | Mỗi mục một dòng theo số của CONTEXT; mục không có bị bỏ |
| `storeDataBlock`: hết hàng, một giá, không biến thể | `sold out; price 9.99 USD` |
| `storeDataBlock`: tên sản phẩm có xuống dòng | Gộp về một dòng (không phá khối) |
| `storeDataBlock`: không đọc được cửa hàng / cửa hàng không có mục nào | Khối ghi rõ "could not be read" / "has no data" |
| `answerProductCards`: thứ tự CITED, mỗi sản phẩm một lần, tối đa 3 (D1) | `c, a, b`; đủ trường thẻ |
| `answerProductCards`: sản phẩm hết hàng được nhắc tới (D2) | Vẫn có thẻ, `inStock: false` |
| `answerProductCards`: không bán online / không có link (D3) | Không có thẻ |
| `answerProductCards`: không có dòng CITED; không đọc được cửa hàng | Không có thẻ |
| `answer()` có tài liệu sản phẩm + lookup | Chỉ hỏi handle của tài liệu sản phẩm; khối `STORE_DATA` sau `CONTEXT_END`, cùng số với CONTEXT; có quy tắc và "Answer ONLY from the context and STORE_DATA."; trả `products`, `storeData: 1`; bỏ dòng CITED khỏi câu |
| `answer()` cửa hàng lỗi | Khối "could not be read", vẫn có quy tắc; không thẻ; `storeData: -1` |
| `answer()` lookup trả `null` (không có Shopify) | Prompt **giống hệt** khi không truyền lookup; không `products`, không `storeData` |
| `answer()` sản phẩm hết hàng | Thẻ `inStock: false` |
| `answer()` AI chỉ trích tài liệu chính sách | Không thẻ dù đã đọc cửa hàng |

### 1.1b Nhánh tên sản phẩm — `rag.store-data.spec.ts` (thêm 8 ca, [FIX-261126](../bug-fix/FIX-261126-Product-Name-Not-Retrieved.md))

| Ca | Kỳ vọng |
|---|---|
| `pickProductTitles`: câu nêu đúng tên | Tài liệu đúng tên đứng đầu; sản phẩm gần giống (4/5 từ) theo sau |
| Câu tiếng Hàn chứa tên tiếng Anh · tên có dấu gạch | Vẫn ra đúng sản phẩm |
| Bằng điểm | Tên dài hơn (cụ thể hơn) trước |
| Thiếu nhiều từ của tên · tên dưới 4 từ | Không lấy |
| Nhiều tài liệu đạt | Tối đa 3 |
| `answer()` có ưu tiên sản phẩm, nhánh từ khoá bỏ sót sản phẩm đúng tên | Sản phẩm đó thành mục [1], được hỏi cửa hàng, có thẻ |
| `answer()` không có ưu tiên sản phẩm | Không đọc danh sách tên, kết quả như cũ |
| Hai câu hỏi liên tiếp | Danh sách tên đọc 1 lần (giữ 5 phút) |

### 1.2 `product-live.service.spec.ts` (mới, 13 ca)

| Ca | Kỳ vọng |
|---|---|
| Đọc cửa hàng | Bỏ trùng, chữ thường, một lần gọi; cache Redis `live:v1:{tenant}:{handles}` 120 giây |
| Nhiều hơn 5 handle | Chỉ hỏi 5 cái đầu |
| Có cache / cache hỏng | Không gọi cửa hàng / coi như không có cache |
| Không có kết nối Shopify | `null`, không gọi cửa hàng |
| Cửa hàng lỗi · không làm mới được token | `{ ok: false }` |
| Cửa hàng không trả lời trong 4 giây | `{ ok: false }`, không ghi cache (fake timers) |
| Không có handle nào | `{ ok: true }` rỗng, không gọi cửa hàng |
| `toLiveProduct` | Đủ trường; hết hàng khi không biến thể nào mua được; nháp / không có trên online store → `onSale: false`; biến thể "Default Title" không tính; thiếu handle / tên → `null` |

### 1.3 `chat.service.store-data.spec.ts` (mới, 6 ca)

| Ca | Kỳ vọng |
|---|---|
| Câu hỏi sản phẩm | `rag.answer` nhận lookup (tham số thứ 12), lookup gọi `ProductLiveService.lookup(4, handles)` |
| D6 | Không tra kho câu trả lời dùng lại, không lưu vào đó |
| Thẻ | Có trong `reply.products` và trong `retrievalTrace` của lượt AI (`products`, `storeData`) |
| Intent khác · phân loại lỗi · không có `ProductLiveService` | Không lookup; kho dùng lại chạy như cũ |

### 1.4 `chat.mapper.spec.ts` (thêm 3 ca)

| Ca | Kỳ vọng |
|---|---|
| Lượt AI có `products` | Trả đúng thẻ |
| Thiếu trường tuỳ chọn / dòng thiếu `productUrl` / `null` / chuỗi | Trường tuỳ chọn → `null`; dòng không đủ bị bỏ |
| Không có `products` / trace rỗng / giá trị sai | Không có `products` |

## 2. e2e (widget, `10-product-help.spec.ts`, tag `@T10` — đã có trong `test:ci`)

| TC | Kỳ vọng |
|---|---|
| TC-10-08 | Gõ "Is KISS Gel Fantasy Nails in stock?" → câu trả lời + 2 thẻ `answer-product`: link trang sản phẩm, tab mới, `data-in-stock` true / false, "In stock" / "Out of stock", "$9.99"; sau lượt poll vẫn 2 thẻ |
| TC-10-09 | Mở Chat khi lượt AI đã lưu có `products` → thấy lại 2 thẻ |

## 3. Tình huống biên

| Tình huống | Kỳ vọng |
|---|---|
| Tenant không có Shopify | Prompt như cũ, không thẻ (unit 1.1) |
| Shopify lỗi / hết hạn token | AI không nói tồn kho, chỉ nút Stock inquiry (quy tắc + khối "could not be read") |
| Sản phẩm đã ẩn / nháp | Dòng "not on sale online", không thẻ |
| Màu là sản phẩm riêng mà kho kiến thức không tìm ra (D4) | Không có trong STORE_DATA → AI nói không xác nhận được, chỉ Stock inquiry |
| Thiết kế `citations: hidden` (IVY) | Danh sách tham chiếu vẫn ẩn; thẻ vẫn hiện (thẻ không phụ thuộc tuỳ chọn này) |
| Câu trả lời dùng lại (reuse) | Không áp dụng cho lượt hỏi sản phẩm (D6) |

## 4. Smoke production (sau deploy)

| Ca | Cách làm |
|---|---|
| Sản phẩm còn hàng | Hỏi tên một sản phẩm đang bán → câu có tồn kho / giá + thẻ "In stock" |
| Sản phẩm hết hàng | Hỏi một sản phẩm hết hàng → thẻ "Out of stock" |
| Tên không có | Không thẻ; AI không bịa tồn kho |
| Thời gian | Ghi lại thời gian trả lời |
