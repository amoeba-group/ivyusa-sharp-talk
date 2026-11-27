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
5. **Kéo tài liệu họ vào (E5, E6)** — nhánh tên lấy thêm tài liệu của họ theo `external_key`, xếp như tiêu đề khớp, khi câu hỏi:
   - nêu đủ tên một màu (≥ 75 % chữ của tiêu đề) — E5; hoặc
   - có tên màu **hiếm** (chữ chỉ có trong ≤ 3 tiêu đề) và một chữ của tên họ — E6, thêm sau smoke lần 1 (§5).
6. Prompt: khi có dòng màu được gọi, thêm một câu quy tắc ("A STORE_DATA line can be for one color or size of its numbered item … the one the customer named").

## 2. File

| Phần | File |
|---|---|
| Họ sản phẩm (mới) | `apps/api/src/domain/product/product-family.util.ts` |
| Danh mục tên | `apps/api/src/domain/product/product-live.service.ts` (`CatalogueEntry`, `catalogue()`) |
| RAG | `apps/api/src/domain/chat/rag.service.ts`: `namedFamilies` (E5, E6), `namedMembers`, `storeItemsFor`, `answerProductCards(items, …)`, `NAMED_VARIANT_RULE`, `NAMED_FAMILY_BONUS`, nhánh tên lấy tài liệu theo `external_key`, tham số thứ 13 `catalogue` |
| Chat | `apps/api/src/domain/chat/chat.service.ts` (truyền `catalogue` cùng điều kiện với `storeLookup`) |
| Đồng bộ danh mục | `apps/api/src/domain/knowledge/catalog-sync.service.ts` (dùng `productFamilyKey`, không đổi hành vi) |
| Test | `product-family.util.spec.ts` (mới, 12), `rag.named-variant.spec.ts` (mới, 24), `product-live.service.spec.ts` (+4), `chat.service.store-data.spec.ts` (+1, sửa 3), `rag.store-data.spec.ts` (thẻ theo danh sách mục) |
| Hướng dẫn test | v1.3: dòng "Typed product questions" ở mục 4 |

## 3. Kết quả test (local)

| Bộ | Kết quả |
|---|---|
| Typecheck API | xanh |
| Unit mới / sửa | `product-family.util` 12, `rag.named-variant` 24, `product-live.service` 17, `chat.service.store-data` 7, `rag.store-data` 31: xanh |
| Chat + product + knowledge | 92 bộ, 960 / 960 |
| Toàn bộ unit API (trước E6) | 3.175 / 3.178. 3 ca đỏ chỉ trên Windows như RPT-261126 (`embed-loader`, `board-attachment`, `heic-conversion`) |
| Khởi động API thật | `Nest application successfully started` (`ProductLiveService` nhận repository `ProductCache`, không lỗi DI) |
| Truy vấn mới trên MySQL local | `kb.external_key IN (…)` và đọc danh mục (2.384 dòng) chạy đúng |
| Luật trên danh mục thật (2.384 dòng) | TCR §2: câu Cosmic (đủ tên / "imPRESS Color Cosmic" / "Cosmic press on nails") → Cosmic; "Aphrodite nail polish" → Gel Pro; câu chỉ có tên họ, câu chính sách, "Is it in stock?", "pink nails", "red nails", "gold trimmer", "black lash glue" → không màu, không họ |

## 4. Triển khai

| Bước | Trạng thái |
|---|---|
| Re-sync đơn trước khi push | Không chạy (console Platforms 10:4x UTC: chỉ đồng bộ định kỳ) |
| Lần 1: commit + push | ✅ `b9081d28`, 10:41 UTC |
| Lần 1: CI `IVY CI/CD` | ✅ run 45984187741, xanh 10:46:46 UTC |
| Lần 1: máy chủ tự deploy | ✅ API production khởi động lại 10:49:02 UTC (`/api/v1/health` 502 trong 2 giây rồi 200) |
| Lần 1: smoke | 🟡 §5 — câu đủ tên đạt; câu ngắn chưa đạt → E6 |
| Lần 2 (E6): Re-sync đơn | Không chạy (10:55 UTC) |
| Lần 2: commit + push | ✅ `1d113bc8`, 10:56 UTC |
| Lần 2: CI `IVY CI/CD` | ✅ run 45986250485, xanh 11:01:59 UTC |
| Lần 2: máy chủ tự deploy | ✅ API production khởi động lại 11:03:03 UTC |
| Lần 2: smoke | ✅ §5 |

## 5. Smoke production

Khách vãng lai trên talk.ivyusa.com/widget (EN), sau deploy `b9081d28`:

| Câu hỏi | Thời gian | Kết quả |
|---|---|---|
| "KISS imPRESS Color Press On Nails - Cosmic 재고 있나요? 가격은 얼마예요?" (câu 3 của RPT-261126 §5) | 4,7 s | ✅ "… KISS imPRESS Color Press On Nails - Cosmic. It's in stock right now and available to buy online for $7.99 …". Thẻ **Cosmic** · In stock · $7.99 · link trang Cosmic (trước: thẻ Bubble Kiss) |
| "Is KISS imPRESS Color Press On Nails in stock?" (chỉ tên họ) | 6,7 s | ✅ Như trước: Bubble Kiss, Matte Brie, imPRESS Beloved — còn hàng, $7.99, 3 thẻ; màu khác thì chỉ nút Stock inquiry |
| "Is imPRESS Color Cosmic in stock?" rồi "How much is it?" | 4,1 s · 4,2 s | ❌ "can't confirm … Stock inquiry", không thẻ, không trích tài liệu nào: tài liệu `#847` không vào ngữ cảnh |

Nguyên nhân câu 3: không phải tài liệu chính sách chiếm chỗ (kiểm chỉ đọc: 0 / 12 tài liệu chính sách có "stock", "impress", "color", "cosmic"). Nhánh từ khoá giữ 8 tài liệu sản phẩm; "cosmic" chỉ xuất hiện một lần trong dòng `Variants:` của `#847`, thua các tài liệu imPRESS khác lặp nhiều "imPRESS", "color". Nhánh tên không bắt được vì câu chỉ có 3 / 7 chữ của tiêu đề. → **E6** (§1 mục 5).

Sau deploy `1d113bc8` (11:03 UTC):

| Câu hỏi | Thời gian | Kết quả |
|---|---|---|
| "Is imPRESS Color Cosmic in stock?" | 8,7 s (lượt đầu sau khởi động: đọc danh mục) | ✅ "Yes, the KISS imPRESS Color Press On Nails in Cosmic is on sale online and currently in stock. It's priced at $7.99 USD." Thẻ **Cosmic** · In stock · $7.99 |
| rồi "How much is it?" | 4,1 s | ✅ "It's $7.99 USD for the KISS imPRESS Color Press On Nails in Cosmic." Thẻ Cosmic (câu trước vẫn được dùng, E4) |
| "KISS imPRESS Color Press On Nails - Cosmic 재고 있나요? 가격은 얼마예요?" | 5,1 s | ✅ Như lần 1: Cosmic, $7.99, thẻ Cosmic |

Ảnh chụp (máy local, `docs/log` không vào git): `docs/log/2026-11-27/smoke-261127-*.png`.

## 6. Giới hạn còn lại

- Chỉ có tên màu, không có chữ nào của tên sản phẩm ("Is Cosmic in stock?"): chưa kéo được tài liệu họ; AI nói không xác nhận được và chỉ nút Stock inquiry (hướng dẫn test v1.3, mục 4 "Next").
- Màu phổ biến (pink, black, red…) chỉ được nhận khi tài liệu của họ đã có trong ngữ cảnh hoặc câu nêu gần đủ tên.
- Khách chỉ gõ "bubble": nhận Bubble Kiss (chữ "kiss" là tên hãng nên không phân biệt được với Bubble Pop).
