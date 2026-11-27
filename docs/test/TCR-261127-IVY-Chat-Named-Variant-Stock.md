# TCR-261127 — Câu hỏi về một màu bán thành sản phẩm riêng

| | |
|---|---|
| Kế hoạch | [PLN-261127](../plan/PLN-261127-IVY-Chat-Named-Variant-Stock.md) (E1–E5) |
| Trước đó | [TCR-261126](TCR-261126-IVY-Chat-Typed-Product-Questions.md) — các ca D1–D6 giữ nguyên, phải xanh |
| Báo cáo | [RPT-261127](../implementation/RPT-261127-IVY-Chat-Named-Variant-Stock.md) |

Dữ liệu test lấy từ production: họ "KISS imPRESS Color Press On Nails" 12 màu (tài liệu kiến thức `#847` đứng tên Bubble Kiss), họ "… Matte" 4 màu.

## 1. Unit (API)

### 1.1 `product-family.util.spec.ts` (mới, 12 ca)

| Ca | Kỳ vọng |
|---|---|
| `productFamilyKey`: Cosmic, Bubble Kiss, "Press-On Nails – Solid Color Shades…" (gạch ngang dài, "Press-On") | Cùng họ `kiss impress color press on nails` (như production gộp) |
| `productFamilyKey`: "… Matte - Brie" | Họ khác |
| `productFamilyKey`: không có dấu gạch | Cả tiêu đề (tiêu đề trùng nhau vẫn gộp); "2-in-1" không phải dấu tách |
| `variantWords`: Cosmic · Bubble Kiss · "-  Beet Snacks" (2 dấu cách) · "Under the Pecan Tree" | `cosmic` · `bubble` (kiss là tên hãng) · `beet snacks` · 4 chữ |
| `variantWords`: không có đuôi · "RED by KISS … Cap - Red" · "- Do It" · "- For You" | `null` |
| `questionWords` | Chữ / số mọi ngôn ngữ, chữ thường |

### 1.2 `rag.named-variant.spec.ts` (mới, 24 ca — 19 + 5 ca E6 thêm sau smoke lần 1)

| Ca | Kỳ vọng |
|---|---|
| `namedMembers`: "Is imPRESS Color Cosmic in stock?" · câu Hàn có đủ tên | Cosmic |
| `namedMembers`: "Bubble Pop" · "Bubble Kiss" (E3) | Đúng màu đó; Bubble Kiss không bị nhận khi khách gõ "Bubble Pop" |
| `namedMembers`: "Cosmic or Pearlfection" | Cả hai |
| `namedMembers`: chỉ tên họ · 4 màu cùng lúc | Không màu nào |
| `namedFamilies` (E5): đủ tên Cosmic | Họ imPRESS Color |
| `namedFamilies` (E6): "Is imPRESS Color Cosmic in stock?" · "Do you have the Cosmic press on nails?" | Họ imPRESS Color (cosmic hiếm + một chữ của tên họ) |
| `namedFamilies`: chỉ "Is Cosmic in stock?" · chỉ tên họ · sản phẩm một màu | Không |
| `namedFamilies` (E6): màu phổ biến ("pink" trong 5 tiêu đề) cạnh chữ của tên họ | Không |
| `namedFamilies` (E5): màu phổ biến nhưng nêu đủ tên ("Gold Finger Glam Nails … pink") | Có |
| `namedFamilies`: một màu nêu đủ tên + một màu hiếm | Họ nêu đủ tên đứng trước |
| `namedFamilyHandles`: câu hiện tại không gọi tên, câu trước có | Mọi handle của họ |
| `storeItemsFor` (E1): tài liệu #847 + câu Cosmic | Mục [1] đọc Cosmic (`named`), sản phẩm khác giữ nguyên, tài liệu chính sách không đọc |
| `storeItemsFor`: không gọi tên màu · không có danh mục | Như cũ (Bubble Kiss) |
| `storeItemsFor` (E4): "How much is it?" sau câu Cosmic | Vẫn Cosmic |
| `storeItemsFor`: sản phẩm của tài liệu đã rời danh mục | Tìm họ theo tiêu đề, vẫn ra Cosmic |
| `answer()` câu Cosmic | Cửa hàng đọc Cosmic **đầu tiên**, không đọc Bubble Kiss; dòng STORE_DATA Cosmic mang số của tài liệu #847; có câu quy tắc màu được gọi; thẻ Cosmic |
| `answer()` Cosmic hết hàng | Thẻ Cosmic, `inStock: false` (D2) |
| `answer()` E5: "Gold Finger Trendy Nails - Blue" (tài liệu đứng tên "Pink Lemonade Swirl", nhánh từ khoá và nhánh tên đều bỏ sót) | Tài liệu họ được lấy theo `external_key`, thành mục [1]; đọc và thẻ màu Blue |
| `answer()` "Is imPRESS Color Cosmic in stock?" — nhánh từ khoá và nhánh tên đều bỏ sót tài liệu họ (lỗi smoke lần 1) | E6 lấy tài liệu họ, mục [1]; đọc Cosmic đầu tiên; dòng STORE_DATA Cosmic số [1]; thẻ Cosmic |
| `answer()` chỉ tên họ | Không lấy thêm theo `external_key`; đọc Bubble Kiss; không câu quy tắc mới |
| `answer()` danh mục lỗi | Như cũ, cảnh báo trong log |
| `answer()` không gọi tên màu | Prompt **giống hệt** khi không truyền danh mục |

### 1.3 `product-live.service.spec.ts` (thêm 4 ca)

| Ca | Kỳ vọng |
|---|---|
| `catalogue()` | Chỉ sản phẩm storefront đang bán (`tenantId`, `companyId IS NULL`, `active`), chỉ `handle`, `title`; handle chữ thường; dòng thiếu handle bị bỏ; có `family`, `variant` |
| Đọc lại trong 5 phút | 1 truy vấn mỗi tenant |
| Không kết nối Shopify | Danh sách rỗng, không truy vấn (tenant khác giữ nguyên hành vi) |
| Token không làm mới được lúc này | Vẫn đọc danh mục |

### 1.4 `chat.service.store-data.spec.ts` (thêm 1 ca, sửa 3 ca)

| Ca | Kỳ vọng |
|---|---|
| Câu hỏi sản phẩm | `rag.answer` nhận tham số thứ 13, gọi `ProductLiveService.catalogue(4)` |
| Intent khác · phân loại lỗi · không có `ProductLiveService` | Không có tham số thứ 13 |

### 1.5 Hồi quy

`rag.store-data.spec.ts` (thẻ dùng danh sách mục đọc cửa hàng), `catalog-sync.service.spec.ts` (hàm tách họ chuyển file) — phải xanh không đổi kỳ vọng.

## 2. Đo trên danh mục thật (offline, bản local 2.384 dòng)

| Câu | Màu được nhận |
|---|---|
| "KISS imPRESS Color Press On Nails - Cosmic 재고 있나요? …" | Cosmic; E5 kéo họ imPRESS Color |
| "Is imPRESS Color Cosmic in stock?" · "Do you have the Cosmic press on nails?" | Cosmic; E6 kéo họ imPRESS Color |
| "Do you have Aphrodite nail polish?" | E6 kéo họ Gel Pro Core Colors (màu Aphrodite) |
| "Is Cosmic in stock?" | Không (không có chữ nào của tên họ) — giới hạn còn lại |
| "Do you have pink nails?" · "Do you have red nails?" · "Is the gold trimmer in stock?" · "Is the black lash glue in stock?" | E6 không kéo họ nào (màu phổ biến) |
| "Is KISS imPRESS Color Press On Nails in stock?" · "What is your return policy?" · "Is it in stock? How much is it?" | Không |
| "Is the RED by KISS Satin Lined Baseball Cap in stock?" | Không (red là tên hãng) |
| "Do you have the I-ENVY lash glue in black?" | Black của keo I-ENVY |

## 3. Tình huống biên

| Tình huống | Kỳ vọng |
|---|---|
| Tenant không có Shopify | Không đọc danh mục, tìm kiếm và prompt như cũ |
| Không đọc được danh mục | Như PLN-261126 |
| Màu được gọi không còn bán online | Dòng "not on sale online", không thẻ (D3) |
| Hơn 3 màu được gọi trong một họ | Như cũ (đọc màu đại diện) |
| Khách chỉ gõ "bubble" | Nhận Bubble Kiss (chữ "kiss" là tên hãng nên không phân biệt được với Bubble Pop) — chấp nhận |

## 4. Smoke production (sau deploy)

| Ca | Kỳ vọng |
|---|---|
| "KISS imPRESS Color Press On Nails - Cosmic 재고 있나요? 가격은 얼마예요?" (câu 3 của RPT-261126 §5) | Trả lời về Cosmic (còn / hết, giá); thẻ **Cosmic** |
| "Is imPRESS Color Cosmic in stock?" + "How much is it?" | Như trên; câu sau vẫn là Cosmic (E4) |
| "Is KISS imPRESS Color Press On Nails in stock?" | Như trước (Bubble Kiss) |
