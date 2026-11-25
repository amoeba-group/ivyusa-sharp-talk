# PLN-261125 — Gợi ý sản phẩm 2 chế độ (PRD v1 A-01…A-04, giai đoạn 2)

| | |
|---|---|
| Trạng thái | Chi tiết của giai đoạn 2 trong [PLN-261125-IVY-PRD-v1-Alignment](PLN-261125-IVY-PRD-v1-Alignment.md) §3. Bản tổng đã duyệt 2026-11-25 ("làm càng sớm càng tốt"), nên làm ngay |
| Migration | `sql/261125-prd-v1-phase2-recommended-products.sql` (1 bảng mới) — chạy **trước** khi push |
| Chờ IVY | Tiêu chí AI Auto (PRD slide 24 ý 1). Tạm dùng **đề xuất của chính PRD**: mặc định AI Auto, 30 ngày, tối đa 10 sản phẩm chọn tay. Trọng số bán 0,7 / review 0,3 |

## 1. Dữ liệu có sẵn (đã kiểm)

| Cần | Lấy từ | Ghi chú |
|---|---|---|
| Danh sách sản phẩm của danh mục, thứ tự bán chạy | Shopify Admin GraphQL `collectionByIdentifier → products(sortKey: BEST_SELLING)` | Đang chạy cho Product Help (T10). Chỉ cần quyền `read_products`, IVY đã cấp |
| Còn hàng | `ProductVariant.availableForSale` | Cùng truy vấn, cùng quyền. Còn hàng = có ít nhất 1 biến thể bán được |
| Ẩn / không bán online | `status = ACTIVE` và `onlineStoreUrl` | Đã lọc sẵn |
| Bán 30 ngày | `order_items.product_id` × `orders_cache` 30 ngày gần nhất | Đồng bộ đơn Shopify đã có. `product_id` = id số của Shopify, khớp `legacyResourceId` |
| Điểm review | `reviews.rating` (form review trong widget, T06) qua `order_items` | Yotpo ở giai đoạn 4 |
| Tìm sản phẩm cho admin | `products(query: …)` | Cùng quyền |

Không cần đồng bộ toàn bộ catalog. Đọc trực tiếp từ cửa hàng, cache 15 phút, như T10.

## 2. Cách chọn sản phẩm (PRD slide 15–16)

```
Danh mục (1 trong 11) + Loại (Popular / Recommended / New)
  → cấu hình của admin cho cặp đó
     ├─ Admin Selected, còn trong thời hạn, có sản phẩm
     │    → sản phẩm admin chọn, đúng thứ tự, bỏ hết hàng / ẩn
     │    → hết sạch? → lấp bằng AI Auto (đề xuất của PRD)   [mode = admin_fallback]
     └─ AI Auto (mặc định, hoặc Admin Selected đã hết hạn)
          → ứng viên = sản phẩm bán chạy của collection (≤ 50), còn hàng, đang bán
          → điểm = 0,7 × bán 30 ngày (chuẩn hoá) + 0,3 × điểm review (chuẩn hoá)
          → không ai có dữ liệu bán / review → giữ thứ tự bán chạy của Shopify  [mode = auto_bestseller]
  → tối đa 3 thẻ sản phẩm (ảnh · giá · link), mỗi sản phẩm một lần
  → không còn gì → link trang danh mục (như hiện tại)
```

Chế độ đã dùng được trả trong API (`mode`) và ghi log. Giai đoạn 3 ghi vào log AI, khi AI viết lời giới thiệu.

## 3. Thay đổi

### 3.1 SQL

```sql
CREATE TABLE IF NOT EXISTS product_recommendations (
  id               BIGINT       NOT NULL AUTO_INCREMENT,
  tenant_id        BIGINT       NOT NULL,
  category_handle  VARCHAR(255) NOT NULL,           -- collection handle của nút Product Help
  rec_type         VARCHAR(16)  NOT NULL,           -- popular | recommended | new
  mode             VARCHAR(16)  NOT NULL DEFAULT 'auto',  -- auto | admin
  product_handles  JSON         NULL,               -- thứ tự hiển thị, ≤ 10
  starts_at        DATETIME     NULL,
  ends_at          DATETIME     NULL,               -- hết hạn → AI Auto
  updated_by       BIGINT       NULL,
  created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_prod_rec (tenant_id, category_handle, rec_type)
);
```

Không có dòng = AI Auto. Gỡ ra: `DROP TABLE`; code cũ không đọc bảng này.

### 3.2 API

| Endpoint | Quyền | Việc |
|---|---|---|
| `GET /products/popular?category=` (có sẵn) | Public (widget) | Dùng bộ chọn mục 2 cho loại `popular`; tối đa 3 thẻ; thêm `mode` |
| `GET /admin/recommended-products` | `AI_SETTINGS_MANAGE` | Danh mục của tenant + mọi cấu hình + 20 thay đổi gần nhất |
| `PUT /admin/recommended-products` | `AI_SETTINGS_MANAGE` | Lưu 1 cấu hình. Kiểm tra: danh mục có trong nút Product Help, loại hợp lệ, ≤ 10 handle, ngày bắt đầu ≤ ngày kết thúc. Ghi audit `product_recommendation.updated` (ai, trước / sau). Xoá cache |
| `GET /admin/recommended-products/search?q=` | `AI_SETTINGS_MANAGE` | Tìm sản phẩm trên Shopify (≤ 10): tên, ảnh, giá, còn hàng |
| `GET /admin/recommended-products/preview?category=&type=` | `AI_SETTINGS_MANAGE` | 3 sản phẩm khách sẽ thấy lúc này, kèm `mode` |

Lỗi: `E5167` cấu hình không hợp lệ.

### 3.3 Console — AI Settings → mục **Recommended Products**

Theo wireframe PRD slide 18 và PLN tổng §3:

- chọn danh mục / loại;
- AI Auto / Admin Selected;
- thời hạn;
- danh sách chọn (lên / xuống / bỏ, tối đa 10, có nhãn còn hàng / hết hàng);
- ô tìm sản phẩm;
- **Preview** "khách đang thấy";
- lịch sử thay đổi.

Lưu báo toast. 6 ngôn ngữ.

### 3.4 Widget

Không đổi giao diện. Popular products của Product inquiry hiện **tối đa 3** thẻ (PRD: "up to 3 product cards"), đúng danh mục đã chọn, bỏ hàng hết.

## 4. Ảnh hưởng phụ

- Popular products từ 5 thẻ còn 3.
- Thêm `variants.availableForSale`, `legacyResourceId` vào truy vấn bán chạy. Vẫn quyền `read_products`.
- Khi Shopify lỗi hoặc chậm, giữ nguyên cách cũ: báo không có, link trang danh mục.
- Đọc bán 30 ngày là 1 truy vấn SQL có chỉ mục (`orders_cache.tenant_id`, `order_items.order_id`), cache 15 phút cùng kết quả.

## 5. Kiểm thử

- **Unit, bộ chọn:**
  - Admin Selected trong hạn → đúng thứ tự, bỏ hết hàng;
  - hết hạn → Auto;
  - hết sạch hàng → lấp Auto;
  - Auto có dữ liệu → xếp theo điểm;
  - không dữ liệu → thứ tự Shopify;
  - tối đa 3, không trùng.
- **Unit, lưu:**
  - danh mục lạ / loại lạ / > 10 / ngày ngược → E5167;
  - audit có trước / sau.
- **E2E widget:** Popular products ≤ 3 thẻ.
- **Console trên máy:** lưu, preview, lịch sử.
