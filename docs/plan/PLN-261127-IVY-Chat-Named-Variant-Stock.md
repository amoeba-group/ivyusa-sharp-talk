# PLN-261127 — Câu hỏi về một màu bán thành sản phẩm riêng: đọc đúng tồn kho, đúng thẻ

| | |
|---|---|
| Nguồn | [RPT-261126 §6](../implementation/RPT-261126-IVY-Chat-Typed-Product-Questions.md) (giới hạn D4), smoke production 2026-11-26 câu 3 |
| Trạng thái | ✅ **Chủ dự án duyệt 2026-11-27:** "ok làm tiếp phần màu Cosmic, deploy ngay" |
| Nhánh | `deploy/talk-ivyusa` (push = deploy production) |
| Migration | Không có SQL. Đọc bảng `products_cache` đã có |

## 1. Vấn đề

Cửa hàng bán nhiều màu thành **sản phẩm riêng**: "KISS imPRESS Color Press On Nails - Cosmic", "… - Bubble Kiss", … (production: 12 màu, mỗi màu một handle). Bản đồng bộ danh mục gộp cả họ vào **một** tài liệu kiến thức, đứng tên màu đại diện (`#847`, "… - Bubble Kiss", các màu khác nằm trong dòng `Variants:`).

Vì vậy hỏi "KISS imPRESS Color Press On Nails - Cosmic 재고 있나요?" thì PLN-261126 đọc tồn kho của **Bubble Kiss** (handle của tài liệu), AI nói không xác nhận được Cosmic, còn thẻ lại hiện **Bubble Kiss**.

Danh mục local (2.384 dòng): 96 họ có nhiều thành viên, 502 dòng; 580 tiêu đề có phần đuôi biến thể.

## 2. Thiết kế

Nguồn tên: `products_cache` của tenant (sản phẩm storefront, `active`), chỉ `handle` + `title`. Cache 5 phút trong `ProductLiveService.catalogue()`. Họ được tính **đúng như bản đồng bộ danh mục**: phần trước dấu ` - ` (hàm chuyển sang `product/product-family.util.ts`, `catalog-sync` dùng chung, không đổi hành vi).

**Chữ gọi tên một màu** = các chữ ở phần đuôi trừ chữ đã có trong tên họ:

| Tiêu đề | Chữ gọi tên |
|---|---|
| … Press On Nails - Cosmic | `cosmic` |
| … Press On Nails - Bubble Kiss | `bubble` (`kiss` là tên hãng) |
| RED by KISS … Cap - Red | không có (`red` là tên hãng) → không bao giờ "được gọi" |
| … - Do It | không có (chỉ toàn chữ đệm) |

Một thành viên **được gọi tên** khi **mọi** chữ gọi tên của nó có trong câu của khách.

| # | Quy tắc | Lý do |
|---|---|---|
| E1 | Khi một mục sản phẩm trong CONTEXT có thành viên được gọi tên, cửa hàng đọc **thành viên đó** thay cho màu đại diện; dòng STORE_DATA mang số của mục đó | Câu hỏi là về màu khách gọi |
| E2 | Thẻ của mục đó là **màu được gọi** (D1–D3 giữ nguyên: theo CITED, ≤ 3, hết hàng vẫn có thẻ, không bán online thì không thẻ) | Sửa lỗi thẻ Bubble Kiss |
| E3 | Hai thành viên cùng khớp mà chữ của một bên nằm trọn trong bên kia ("Bubble Kiss" ⊂ "Bubble Pop" khi khách gõ "bubble pop") thì giữ bên cụ thể hơn. Hơn 3 thành viên khớp = chữ của khách không đủ cụ thể → như hôm nay | Tránh đọc nhầm màu |
| E4 | Câu khách gõ **trước** (chỉ lời khách, không lấy lời AI) dùng khi câu hiện tại không gọi tên màu nào: "Cosmic còn không?" → "Giá bao nhiêu?" vẫn là Cosmic | Lời AI liệt kê nhiều màu, dễ khớp nhầm |
| E5 | Câu nêu **đủ tên** một màu (≥ 75 % chữ của tiêu đề, như nhánh tên của FIX-261126): tài liệu của họ đó được đưa vào CONTEXT dù tên màu đại diện khác xa | "Gold Finger Trendy Nails - …" có tên họ ngắn, tài liệu đại diện có thể không lọt top |
| E6 | *(Thêm sau smoke production lần 1, cùng phạm vi đã duyệt.)* Câu có **tên màu hiếm** (chữ chỉ có trong ≤ 3 tiêu đề của danh mục: cosmic 1, aphrodite 2; pink 32, black 100 không tính) **và một chữ của tên họ** ("impress", "press", "nails"…): cũng kéo tài liệu họ vào như E5 | "Is imPRESS Color Cosmic in stock?" không tìm ra tài liệu họ: nhánh từ khoá chỉ thấy "cosmic" một lần trong dòng `Variants:`, thua các tài liệu lặp nhiều "imPRESS", "color". Chỉ có tên màu ("Is Cosmic in stock?") vẫn chưa tìm ra |

Không có kết nối Shopify, không phải câu hỏi sản phẩm, hoặc không đọc được danh mục → y như hôm nay.

**API**

1. `product/product-family.util.ts` (mới): `productFamilyKey`, `variantWords`, `questionWords`. `catalog-sync.service.ts` dùng `productFamilyKey` thay hàm riêng.
2. `ProductLiveService.catalogue(tenantId)` → `CatalogueEntry { handle, title, family, variant }`, cache 5 phút.
3. `RagService.answer`: tham số thứ 13 `catalogue`. Trước khi tìm: `namedFamilies` (E5, E6) → nhánh tên lấy thêm tài liệu của họ (`external_key` thuộc họ), cộng điểm như tiêu đề khớp. Sau `capContext`: `storeItemsFor` (E1, E3, E4) → handle màu được gọi đọc trước. `answerProductCards` nhận danh sách mục đó (E2). Quy tắc STORE_DATA thêm một câu: một dòng có thể là một màu / cỡ của mục mang số đó — màu khách gọi.
4. `ChatService` truyền `catalogue` cùng điều kiện với `storeLookup` (D5).

## 3. Wireframe (widget 380 px) — chỉ đổi **sản phẩm trên thẻ**, component giữ nguyên

AS-IS (smoke 2026-11-26):

```
│              ┌──────────────────────────┐ │
│              │ KISS imPRESS Color Press │ │
│              │ On Nails - Cosmic 재고   │ │
│              │ 있나요?                   │ │
│              └──────────────────────────┘ │
│ ┌──────────────────────────────────┐      │
│ │ I can't confirm the stock of the │      │  ← AI chỉ có dữ liệu Bubble Kiss
│ │ Cosmic shade here. Please use    │      │
│ │ Stock inquiry …                  │      │
│ └──────────────────────────────────┘      │
│ ┌──────┬──────────────────────────┐       │
│ │ img  │ … Nails - Bubble Kiss     │       │  ← sai màu
│ │      │ [In stock]  $x.xx         │       │
│ └──────┴──────────────────────────┘       │
```

TO-BE:

```
│ ┌──────────────────────────────────┐      │
│ │ Yes, KISS imPRESS Color Press On │      │  ← dữ liệu cửa hàng của Cosmic
│ │ Nails - Cosmic is in stock, $x.xx│      │
│ └──────────────────────────────────┘      │
│ ┌──────┬──────────────────────────┐       │
│ │ img  │ … Nails - Cosmic          │       │  ← đúng màu khách hỏi
│ │      │ [In stock]  $x.xx         │       │
│ └──────┴──────────────────────────┘       │
```

## 4. Ảnh hưởng phụ

| Chỗ | Ảnh hưởng | Xử lý |
|---|---|---|
| Độ trễ | +1 truy vấn `products_cache` (handle, title) mỗi 5 phút / tenant; so khớp trong bộ nhớ (~2.400 dòng) | Cache |
| Prompt | +1 câu trong quy tắc STORE_DATA | — |
| Câu hỏi không gọi tên màu | Không đổi: vẫn đọc sản phẩm đại diện | Unit test |
| `catalog-sync` | Chỉ chuyển hàm tách họ ra file chung | Test `catalog-sync.service.spec` phải xanh |
| Widget, console | Không đổi | e2e `test:ci` |

## 5. Kiểm thử

- **Unit:** `productFamilyKey` giống hệt bản cũ; `variantWords` (Cosmic, Bubble Kiss, RED by KISS, chữ đệm, không có đuôi, khoảng trắng đôi); `namedFamilies`; `namedMembers` (E3); `storeItemsFor` (E1, E4, không gọi tên); `answer()` với danh mục: đọc Cosmic, dòng STORE_DATA, thẻ Cosmic, tài liệu họ được kéo vào (E5); danh mục lỗi → như cũ; `ProductLiveService.catalogue` (lọc, cache); `ChatService` truyền danh mục.
- **Smoke production:** câu Cosmic của RPT-261126 §5; "Is imPRESS Color Cosmic in stock?"; một câu chỉ có tên họ (không màu) → như cũ.

## 6. Triển khai

Không SQL. Push = deploy, API khởi động lại. Kiểm Re-sync đơn trước khi push. Kết quả ghi vào RPT-261127.
