# RPT-261112 — IVY T10 · Kịch bản Product Help: danh mục, sản phẩm phổ biến

Kế hoạch: [PLN-261112-IVY-T10](../plan/PLN-261112-IVY-T10-Product-Help.md), duyệt ngày 2026-11-12. Task: ivy-docs/TASKS.md T10. SPEC: SCR-IVY-12, G-16, BR-17, Q-04.

**Quyết định của chủ dự án (2026-11-12):**
1. Duyệt kế hoạch.
2. Chủ đề trước, đúng frame `1006:5588`. Chip **Popular products** mở 11 danh mục.
3. Exchange / Return và Cancel order theo chính sách thật trên ivyusa.com (10 ngày; huỷ đơn qua email hello@ivyusa.com).
4. Restock alert giữ là câu hỏi cho AI. Báo hàng về thật để task riêng.

## 1. Thay đổi (không có migration)

| Phần | File | Nội dung |
|---|---|---|
| Types | `common/product-category.ts` (mới), `api/widget.types.ts` | `collectionHandleFrom()`: đọc handle từ handle trần hoặc URL cửa hàng. `collectionUrl()`. Nút có `categories`; kiểu `PopularProductsResponse` |
| API | `ai-engine/ai-config.service.ts`, entity, DTO | `sanitize()` giữ `categories` cho nút Product help (bài học BUG-022): chuẩn hoá handle, bỏ dòng hỏng / trùng, tối đa 20. Widget nhận tên theo ngôn ngữ phiên |
| API | `order/shopify-admin.client.ts` | `fetchCollectionBestSellers()`: GraphQL `collectionByIdentifier` + `sortKey: BEST_SELLING`. Chỉ lấy sản phẩm ACTIVE có trên cửa hàng online |
| API | `product/product-popular.service.ts` (mới), controller, module | `GET /products/popular?category=`. Chỉ nhận collection đã cấu hình (endpoint public). Kết quả đúng nhớ 15 phút, lỗi nhớ 60 giây. Quá 4 giây thì trả `available: false` + link collection |
| API | `chat/scenario-scripts.ts` | `track_delivery` thành id chip hợp lệ, để copy tenant mang được chip "Track delivery" của thiết kế |
| API | `database/seed.runner.ts` | IVY: 11 danh mục; copy `return_exchange` (10 ngày + chip Track delivery · Cancel order) và `cancel_order` (email hello@ivyusa.com) |
| Widget | `chat/ProductHelp.tsx` (mới) | 3 bước: menu chủ đề, chọn danh mục, sản phẩm phổ biến (thẻ ảnh / tên / hãng / giá, mở trang sản phẩm ở tab mới, link "See all … on ivyusa.com") |
| Widget | `chat/ChatTab.tsx` | 3 loại insert mới gắn vị trí trong luồng (kiểu BUG-024). Hàng chip vẫn hiện, nhớ chip đã chọn. Exchange / Return gửi nhãn chip làm bong bóng khách |
| Widget | `chat/ScenarioMenu.tsx` | Bỏ menu con đổi chỗ; Product inquiry đi qua `onScenario` như các nút khác |
| Widget | `chat/ChatChip.tsx`, `chat/reply-chips.ts` | Prop `selected` (viền xanh + `aria-pressed`). Hàm thuần `productHelpChips()` / `categoryChips()` |
| Widget | `services/productService.ts`, `hooks/usePopularProducts.ts` (mới), locales ×6 | Gọi API mới. Câu chữ mới; KO theo thiết kế: 어떤 도움이 필요하신가요?… · 제품 사용법 · 성분 문의 · 교환 / 반품 · 재입고 알림 · 인기상품 |
| Console | `ai-settings/ProductCategoriesEditor.tsx` (mới), `AiSettingsPage.tsx`, i18n ×6 | Bảng danh mục dưới nút Product help: tên theo tab ngôn ngữ, collection (dán URL được). Dòng hỏng báo đỏ và chặn lưu (toast lỗi) |
| Console | `AiSettingsPage.tsx`, `ScenarioReplyEditor.tsx` | Nút Product help giờ có mô tả đúng; trước đây ghi nhầm "nhãn được gửi như tin nhắn chat". Thêm `track_delivery` vào danh sách id chip |

**Khác kế hoạch:**
- **Chưa gọi thử Shopify thật ở local.** Local không có token Shopify Admin (`integration_credentials` trống), nên không làm được bước PLN §7 "gọi thử `/products/popular` với Shopify của IVY".
  - Đã đối chiếu câu GraphQL với tài liệu Admin API 2026-01 trên shopify.dev: `collectionByIdentifier`, `ProductCollectionSortKeys.BEST_SELLING`, `featuredMedia`, `onlineStoreUrl`, `priceRangeV2`.
  - Phần đọc kết quả có unit test với dữ liệu giả.
  - Lần gọi thật đầu tiên sẽ là trên production; xem GUIDE §5 nếu báo "couldn't load".
- **BUG-003 (có từ trước):** lần đầu TC-10-04 đỏ 1/21 lượt. Trace cho thấy dev server gọi `/session/ensure` 3 lần và đổi token sau khi đã bấm Accept.
  - Đã kiểm bản build: chỉ 1 lần gọi, nên **không ảnh hưởng production**.
  - Thêm helper `acceptConsent()` (chờ mạng yên rồi bấm), dùng cho TC-10-04 và TC-09-05.
- **Câu chữ EN:**
  - "Usage" → "How to use";
  - "Exchange · Return" → "Exchange / Return" (theo thiết kế);
  - "Back" → "Start over".

### Test và tài liệu

| File | Nội dung |
|---|---|
| `packages/types/src/common/product-category.spec.ts` | 5 ca |
| `ai-config.service.product-categories.spec.ts` | 4 ca |
| `product-popular.service.spec.ts` | 7 ca |
| `apps/widget/test/reply-chips.test.mjs` | +2 ca |
| `e2e/tests/10-product-help.spec.ts` | Viết lại theo thứ tự §8-2a. Thêm:<br>• TC-10-06: Shopify không trả lời;<br>• TC-10-07: chip đã chọn, "Other categories". |
| `e2e/fixtures/{ivy-data,mock-api,widget}.ts` | Danh mục trên nút, mock `/products/popular` (`popular: 'ok' \| 'unavailable'`), `acceptConsent()` |
| `e2e/tests/09-my-orders.spec.ts` | TC-09-05 dùng `acceptConsent()` |
| `e2e/package.json` | `test:ci` thêm `@T10` |
| ivy-docs, GUIDE, PLN | TASKS / TEST-CASES / BUGS (BUG-003) / SPEC (G-16 ✅, G-25 mới, Q-04 ✅), GUIDE CI §7, [GUIDE-261112-IVY-Product-Help-Config](../guide/GUIDE-261112-IVY-Product-Help-Config.md) mới |

## 2. Kiểm thử (local, 2026-11-12)

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit` api, widget, web, e2e | sạch |
| `vite build` widget, web; `nest build` api | OK |
| Boot API thật | `Nest application successfully started` sau khi đổi entity / DTO; route mới trả 401 khi thiếu token (đã có route) |
| Unit API (toàn bộ) | 2827 / 2830. 3 ca đỏ có từ trước và chỉ đỏ trên Windows: `embed-loader` (CRLF), `board-attachment` (dấu `\` trong đường dẫn), `heic-conversion`. Không liên quan T10 |
| Unit types | 5/5 |
| `node --test apps/widget/test/*.mjs` | **106/106** |
| `npm run i18n:check` | đủ 6 ngôn ngữ (widget + console) |
| `radius:check` (container Linux) | sạch |
| Lưu cấu hình qua API thật (local) | `PUT /ai-config` rồi đọc lại: đủ 11 danh mục, câu 10 ngày, chip `track_delivery` / `cancel_order` |
| `@T10` | **7/7** (baseline 1/5); lặp ×3 với 2 worker: 21/21 |
| TC-10-04 + TC-09-05 (consent thật) ×8 | 16/16 |
| Cổng CI mới (thêm `@T10`), `--repeat-each=2` | **168/168** |
| Toàn bộ desktop | **94 pass / 8 fail** (trước T10: 88 / 12). Mọi ca đỏ thuộc T11–T12 chưa làm |
| BUG-003 | Bản build: 1 lần `ensure` / lượt (4/4). Dev: 2 lần (3/3) |

**Ảnh chụp 380px:**
- KO khớp `1006:5588`: chip 교환 / 반품 viền xanh, bong bóng khách, câu 10일, rồi chip 배송 조회 · 주문 취소 · 처음으로.
- EN: "Here are our most popular Nails products 👇", 2 thẻ, link "See all Nails on ivyusa.com", chip Other categories · Start over.

## 3. Ghi chú cho production

- **Có hiệu lực ngay sau deploy:**
  - Product inquiry trả lời trong luồng chat, có bong bóng khách và câu dẫn;
  - chip How to use · Ingredients · Exchange / Return · Restock alert · Start over;
  - chip đã chọn viền xanh.
- **Chưa có cho tới khi bạn nhập cấu hình** theo [GUIDE-261112-IVY-Product-Help-Config](../guide/GUIDE-261112-IVY-Product-Help-Config.md):
  - **chip Popular products** (cần 11 danh mục, §1);
  - **câu 10 ngày** (§2–3). Trước đó, Exchange / Return trả lời bằng copy đang có trên production. Nếu production chưa từng sửa, đó là câu mặc định **30 ngày, "gently used", sai với IVY**. Nên làm §2–3 sớm.
- **KB:** nếu KB production có tài liệu "30 ngày", AI vẫn có thể nói sai khi khách gõ câu hỏi tự do (GUIDE §4).
- **Shopify:** chỉ đọc, tối đa khoảng 44 lần gọi mỗi giờ (11 danh mục × cache 15 phút). Cần quyền `read_products`; lỗi quyền hiện trong log API là `popular "…" unavailable (Access denied…)`.
- Không có SQL. Không gửi push / email / SMS.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Commit | (điền sau khi push) |
| CI | ⏳ |
| Server `talkaibotprd01` | ⏳ |
| SQL / migration | Không có |
