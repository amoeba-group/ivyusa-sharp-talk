# TCR-261125 — Gợi ý sản phẩm 2 chế độ (PRD v1 A-01…A-04)

Kế hoạch: [PLN-261125-IVY-Recommended-Products](../plan/PLN-261125-IVY-Recommended-Products.md).

## 1. Unit — API (`product-recommendation.service.spec.ts`)

| Ca | Kỳ vọng | Kết quả |
|---|---|---|
| Chế độ đang áp dụng | Admin Selected chỉ khi có sản phẩm **và** đang trong thời hạn; chưa tới ngày bắt đầu / quá ngày kết thúc → AI Auto | ✅ |
| `pickAdmin` | Giữ thứ tự admin; bỏ hết hàng, handle không có, handle lặp | ✅ |
| `rankAuto` không dữ liệu | Thứ tự bán chạy của Shopify; bỏ hết hàng và trùng; `usedData=false` | ✅ |
| `rankAuto` có dữ liệu | 0,7 × bán (chuẩn hoá) + 0,3 × review/5; hoà thì giữ thứ tự Shopify. Ví dụ b (0,7) > c (0,44) > a (0,14) | ✅ |
| Hết hàng bán chạy nhất | Không bao giờ được gợi ý | ✅ |
| `handlesQuery` | `handle:a OR handle:b`; bỏ chuỗi không phải handle (chặn chèn cú pháp tìm kiếm) | ✅ |
| Admin Selected trong hạn | Đúng thứ tự, tối đa 3; không đọc collection | ✅ |
| Mọi sản phẩm admin chọn hết hàng | AI Auto bù vào, `mode=admin_fallback` | ✅ |
| AI Auto | Có bán → `auto`, xếp theo điểm; không dữ liệu → `auto_bestseller` | ✅ |
| Collection không có trên cửa hàng | `available=false` (widget hiện link trang danh mục) | ✅ |
| Lưu | Chuẩn hoá handle (chữ thường, bỏ trùng), ngày → đầu / cuối ngày UTC, `updatedBy`, audit `product_recommendation.updated` có trước / sau, xoá cache popular | ✅ |
| Lưu bị từ chối (E5167) | Danh mục không có trên nút Product help, loại lạ, chế độ lạ, > 10 sản phẩm, handle có dấu cách, ngày kết thúc trước ngày bắt đầu, ngày không đọc được | ✅ |
| Bán 30 ngày | SQL có `INTERVAL 30 DAY`, bỏ đơn `cancelled` / `refunded`, tham số đúng tenant | ✅ |
| Client Shopify (`product-popular.service.spec.ts`, sửa) | Thẻ có thêm `productId`, `available`. Không có danh sách biến thể → coi là còn bán | ✅ |

## 2. Tích hợp trên máy (API thật + console, không có kết nối Shopify)

| Ca | Kết quả |
|---|---|
| SQL `261125-prd-v1-phase2-recommended-products.sql` chạy 2 lần | Không lỗi; bảng `product_recommendations` đúng cột, khoá `uq_prod_rec` |
| API khởi động | `successfully started`; 4 route `admin/recommended-products` (GET, PUT, search, preview) |
| `GET /admin/recommended-products` | 200, 11 danh mục của IVY |
| `PUT` Admin Selected 2 sản phẩm, 2026-11-20 ~ 2026-12-31 | 200; `endsAt` = 23:59:59 ngày cuối |
| `PUT` danh mục lạ | 400 E5167 |
| Preview khi không có kết nối Shopify | `available=false` → console hiện câu "Nothing to show…" |
| Lịch sử | Hiện người sửa và chế độ sau khi lưu |
| Console | Mục hiện dưới Scenario buttons; chọn danh mục / loại / chế độ / thời hạn; không lỗi trang |

## 3. Chưa kiểm được trên máy (cần cửa hàng thật)

Phải đợi production có bảng (SQL) và bản mới. Sau đó tôi kiểm **chỉ đọc**, trong tab mới:

- Preview của vài danh mục;
- `GET /products/popular` của widget ra ≤ 3 thẻ, có `mode`;
- tìm sản phẩm.

Không lưu cấu hình trên production nếu chủ dự án chưa cho phép.
