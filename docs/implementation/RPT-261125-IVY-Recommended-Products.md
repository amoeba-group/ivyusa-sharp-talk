# RPT-261125 — Gợi ý sản phẩm 2 chế độ (PRD v1 A-01…A-04, giai đoạn 2)

| | |
|---|---|
| Kế hoạch | [PLN-261125-IVY-Recommended-Products](../plan/PLN-261125-IVY-Recommended-Products.md) (chi tiết của [PLN tổng](../plan/PLN-261125-IVY-PRD-v1-Alignment.md) §3, đã duyệt 2026-11-25) |
| Kiểm thử | [TCR-261125-IVY-Recommended-Products](../test/TCR-261125-IVY-Recommended-Products.md) |
| SQL | `sql/261125-prd-v1-phase2-recommended-products.sql` — **chạy trước khi push** |

## 1. Thay đổi

| Phần | Nội dung | File |
|---|---|---|
| Bảng | `product_recommendations`: tenant × danh mục × loại → chế độ, sản phẩm chọn (≤ 10, có thứ tự), thời hạn, người sửa | `entity/product-recommendation.entity.ts`, SQL |
| Bộ chọn | **Admin Selected:** chỉ trong thời hạn; đúng thứ tự; bỏ hết hàng / ẩn; nếu hết sạch thì AI Auto bù vào. **AI Auto:** 50 sản phẩm bán chạy của collection, điểm = 0,7 × bán 30 ngày + 0,3 × điểm review; không có dữ liệu thì theo thứ tự bán chạy của Shopify. Tối đa 3, không trùng. Chế độ đã dùng được trả về và ghi log | `product-recommendation.service.ts` |
| Dữ liệu cửa hàng | Truy vấn bán chạy đọc thêm `legacyResourceId` và `variants.availableForSale`. Thêm tìm theo handle và theo tên. Vẫn chỉ cần quyền `read_products` | `shopify-admin.client.ts` |
| Bán / review | Bán: `order_items` × `orders_cache` 30 ngày, bỏ đơn huỷ / hoàn. Review: `reviews` đã gửi | `product-recommendation.service.ts` |
| Widget | Popular products của Product inquiry dùng bộ chọn với loại `popular` → **tối đa 3 thẻ**, đúng danh mục, không hàng hết. Cache 15 phút như cũ, bị xoá khi admin lưu | `product-popular.service.ts`, `ProductHelp.tsx` (giới hạn 3 ở widget) |
| API quản trị | `GET/PUT /admin/recommended-products`, `/search`, `/preview`, quyền `AI_SETTINGS_MANAGE`. Lỗi **E5167**. Mọi lần lưu ghi audit (trước / sau) | `product-recommendation.controller.ts`, `dto/request/product-recommendation.request.ts`, `error-code.constant.ts` |
| Console | AI Settings → mục **Recommended products** (dưới Scenario buttons): danh mục, loại, AI Auto / Admin Selected, thời hạn, danh sách chọn (lên / xuống / bỏ, nhãn còn / hết hàng), tìm sản phẩm, "What customers see now", lịch sử thay đổi. 6 ngôn ngữ | `RecommendedProductsSection.tsx`, `recommended-products.service.ts`, `aiSetting.json` ×6 |

Chưa có trong giai đoạn này (giai đoạn 3, cần Bedrock):

- AI viết lời giới thiệu quanh 3 thẻ;
- câu hỏi tự do "gợi ý sản phẩm phổ biến" đi qua bộ chọn;
- loại Recommended / New trong chat.

Cấu hình cho 2 loại này lưu được ngay.

## 2. Kiểm thử

| Bộ | Kết quả |
|---|---|
| `product-recommendation.service.spec.ts` (mới) + `product-popular.service.spec.ts` (sửa) | 66 / 66 test của domain product |
| Toàn bộ API | 3007 / 3010 — 3 ca chỉ đỏ trên Windows. Một bộ PDF đỏ khi máy quá tải, chạy riêng thì qua |
| `packages/types`, `common`, widget | 224 / 60 / 150, xanh |
| Typecheck API · widget · console; `i18n:check`; manifest migration | Sạch |
| Máy local | SQL chạy 2 lần ok; API khởi động có 4 route mới; lưu / E5167 / lịch sử đúng; console hiện mục mới, không lỗi trang |

Preview và tìm sản phẩm với cửa hàng thật kiểm trên production, sau khi có SQL và bản mới.

## 3. Trạng thái triển khai

| Bước | Ai | Trạng thái |
|---|---|---|
| 1. Chạy `sql/261125-prd-v1-phase2-recommended-products.sql` trên DB production | Chủ dự án | ✅ 2026-11-25, bảng `product_recommendations` có trên production |
| 2. Push (sau khi bản giai đoạn 1 đã lên, 06:25 UTC) | Tôi | ✅ push cùng Stock inquiry; máy chủ chờ SQL bước 1 rồi deploy. **Live 06:35 UTC** (`09393722`) |
| 3. Kiểm chỉ đọc: preview vài danh mục, widget ≤ 3 thẻ | Tôi | ✅ preview các danh mục: chế độ AI Auto, 3 sản phẩm, 1–2 giây; tìm sản phẩm trong admin; tìm tồn kho trong widget |
| 4. Chọn sản phẩm cho danh mục muốn đẩy (khuyến mãi, hàng mới…) | Chủ dự án / IVY | ⏳ |
