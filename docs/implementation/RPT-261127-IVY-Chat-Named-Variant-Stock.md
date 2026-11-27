# RPT-261127 — Câu hỏi về một màu bán thành sản phẩm riêng: đọc đúng tồn kho, đúng thẻ

| | |
|---|---|
| Kế hoạch · Test | [PLN-261127](../plan/PLN-261127-IVY-Chat-Named-Variant-Stock.md) · [TCR-261127](../test/TCR-261127-IVY-Chat-Named-Variant-Stock.md) |
| Nguồn | Giới hạn D4 của [RPT-261126 §6](RPT-261126-IVY-Chat-Typed-Product-Questions.md) |
| Duyệt | Chủ dự án 2026-11-27: "ok làm tiếp phần màu Cosmic, deploy ngay" |
| Nhánh | `deploy/talk-ivyusa` |
| SQL | Không có |

## 1. Đã làm

Production gộp 12 màu "KISS imPRESS Color Press On Nails - …" (12 handle) vào một tài liệu kiến thức đứng tên Bubble Kiss (`#847`). Trước đây câu hỏi về Cosmic đọc tồn kho Bubble Kiss, thẻ hiện Bubble Kiss.

1. **Danh mục tên** — `ProductLiveService.catalogue()`: handle + title của sản phẩm storefront đang bán (`products_cache`), cache 5 phút; tenant không có Shopify thì rỗng (tìm kiếm, prompt như cũ).
2. **Họ sản phẩm** dùng chung với bản đồng bộ danh mục (`product-family.util.ts`, chuyển nguyên hàm từ `catalog-sync`). Chữ gọi tên một màu = đuôi tiêu đề trừ chữ đã có trong tên họ ("Bubble Kiss" → `bubble`; "RED by KISS … - Red" → không có).
3. **Đọc đúng màu (E1, E3, E4)** — với mỗi tài liệu sản phẩm trong ngữ cảnh: màu nào trong họ của nó được khách gọi tên thì đọc màu đó thay màu đại diện, đọc trước (không bị cắt bởi giới hạn 5). Chỉ dùng lời khách: câu hiện tại, rồi tới các câu khách gõ trước. Hơn 3 màu khớp = không đủ cụ thể → như cũ.
4. **Thẻ (E2)** — thẻ của mục được CITED là sản phẩm đã đọc cho mục đó, tức màu khách hỏi.
5. **Kéo tài liệu họ vào (E5)** — câu nêu đủ tên một màu (≥ 75 % chữ của tiêu đề và có chữ gọi tên màu): nhánh tên lấy thêm tài liệu của họ theo `external_key`, xếp như tiêu đề khớp.
6. Prompt: khi có dòng màu được gọi, thêm một câu quy tắc ("A STORE_DATA line can be for one color or size of its numbered item … the one the customer named").

## 2. File

| Phần | File |
|---|---|
| Họ sản phẩm (mới) | `apps/api/src/domain/product/product-family.util.ts` |
| Danh mục tên | `apps/api/src/domain/product/product-live.service.ts` (`CatalogueEntry`, `catalogue()`) |
| RAG | `apps/api/src/domain/chat/rag.service.ts`: `namedFamilies`, `namedMembers`, `storeItemsFor`, `answerProductCards(items, …)`, `NAMED_VARIANT_RULE`, `NAMED_FAMILY_BONUS`, nhánh tên lấy tài liệu theo `external_key`, tham số thứ 13 `catalogue` |
| Chat | `apps/api/src/domain/chat/chat.service.ts` (truyền `catalogue` cùng điều kiện với `storeLookup`) |
| Đồng bộ danh mục | `apps/api/src/domain/knowledge/catalog-sync.service.ts` (dùng `productFamilyKey`, không đổi hành vi) |
| Test | `product-family.util.spec.ts` (mới, 12), `rag.named-variant.spec.ts` (mới, 19), `product-live.service.spec.ts` (+4), `chat.service.store-data.spec.ts` (+1, sửa 3), `rag.store-data.spec.ts` (thẻ theo danh sách mục) |

## 3. Kết quả test (local)

| Bộ | Kết quả |
|---|---|
| Typecheck API | xanh |
| Unit mới / sửa | 5 file: 12 + 19 + 17 + 7 + 31 ca xanh |
| Chat + product + knowledge | 92 bộ, 953 / 953 |
| Toàn bộ unit API | 3.175 / 3.178. 3 ca đỏ chỉ trên Windows như RPT-261126 (`embed-loader`, `board-attachment`, `heic-conversion`) |
| Khởi động API thật | `Nest application successfully started` (`ProductLiveService` nhận repository `ProductCache`, không lỗi DI) |
| Truy vấn mới trên MySQL local | `kb.external_key IN (…)` và đọc danh mục (2.384 dòng) chạy đúng |
| Luật trên danh mục thật (2.384 dòng) | TCR §2: câu Cosmic → Cosmic; câu chỉ có tên họ, câu chính sách, "Is it in stock?" → không màu nào; "RED by KISS … Cap" → không nhận nhầm Red |

## 4. Triển khai

| Bước | Trạng thái |
|---|---|
| Re-sync đơn trước khi push | Không chạy (console Platforms, 17:4x giờ VN: chỉ đồng bộ định kỳ) |
| Commit + push | ⏳ |
| CI `IVY CI/CD` | ⏳ |
| Máy chủ tự deploy | ⏳ |
| Smoke production | ⏳ |
