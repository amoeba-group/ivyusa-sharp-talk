# PLN-261117 — Tự dọn đơn hàng cũ khỏi bộ nhớ đệm

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-17** (`1. ok 2. a 3. a`) và đã làm, deploy ở trạng thái **tắt** — [RPT-261117](../implementation/RPT-261117-Order-Cache-Purge.md). Trước khi bật: RPT §3 (tổng của khách cộng từ cache) |
| Nguồn | Mục 4 của phương án B3 trong [PLN-261117-Orders-Search-And-Sync-Backfill](PLN-261117-Orders-Search-And-Sync-Backfill.md), đã duyệt về nguyên tắc ("dọn sau 180 ngày") nhưng chưa làm (RPT §2-3). Chủ dự án đồng ý làm tiếp ngày 2026-11-17 |
| Phạm vi | `apps/api` (lịch purge sẵn có). **Không có thay đổi giao diện** |
| Migration | Không có SQL |

## 1. Vì sao cần

Từ khi kết nối Shopify, webhook đưa **mọi đơn mới** của cửa hàng về `orders_cache`. Không dọn thì bảng lớn dần tới đúng cỡ cửa hàng (hiện 181.188 đơn cả đời), tức quay lại chỗ "sao chép cả cửa hàng" mà B3 muốn tránh: dữ liệu cá nhân giữ không thời hạn, backup lớn dần.

Đơn bị dọn không mất: nó vẫn ở Shopify, và các đường "lấy theo nhu cầu" (khách đăng nhập, tra đơn vãng lai, console **Look up on Shopify**) lấy lại được.

## 2. Khảo sát: cái gì đang trỏ vào một đơn trong cache

| Bảng | Liên kết | Xoá đơn thì sao |
|---|---|---|
| `order_items` | `order_id` (bắt buộc) | Phải xoá theo |
| `fulfillments` | `order_id` (bắt buộc) | Phải xoá theo |
| `inquiries` | `order_id` (tuỳ chọn) | Inquiry là hồ sơ hỗ trợ: **giữ đơn** khi còn inquiry trỏ tới |
| `notifications` | `ref_type = 'order'` + `ref_id` | Chạm thông báo mở Order Detail. Lịch purge sẵn có đã xoá thông báo quá `CONVERSATION_LOG_RETENTION_DAYS` (365 ngày). **Giữ đơn** khi còn thông báo trỏ tới |
| `notifications` | `ref_type = 'order_item'` | Như trên, qua `order_items` |
| `reviews` | theo sản phẩm / dòng hàng | Review đã gửi là dữ liệu riêng, không phụ thuộc đơn còn trong cache. Cần đọc kỹ entity khi làm (§5) |
| `cjm_events` | chỉ ghi mã đơn trong payload | Không ảnh hưởng |

## 3. Thiết kế

Thêm một bước vào `RetentionService.purgeExpired()` (đang chạy mỗi `RETENTION_PURGE_INTERVAL_HOURS`, mặc định 24 giờ, có ghi audit):

**Một đơn bị xoá khỏi cache khi cả 4 điều đúng:**
1. Ngày đặt (`ordered_at`, không có thì `created_at`) cũ hơn **N ngày**.
2. Lần cập nhật cuối trong cache (`updated_at`) cũng cũ hơn N ngày — đơn vừa đổi trạng thái hay vừa được ai đó tra thì ở lại.
3. Không có `inquiries` nào trỏ tới.
4. Không có `notifications` nào trỏ tới (đơn hoặc dòng hàng của nó).

Xoá theo lô (ví dụ 500 đơn / lô) trong transaction: `fulfillments` → `order_items` → `orders_cache`. Kết quả cộng vào bản ghi audit của lượt purge (`orders: n`).

**Cấu hình:** `ORDER_CACHE_RETENTION_DAYS` — mặc định **180**; `0` = tắt bước này. Thêm vào template env (`env:check`).

**Không xoá khách hàng.** Bản ghi khách (`customers`) theo chính sách riêng (DSAR / retention đã có); việc này chỉ dọn đơn.

## 4. Ảnh hưởng phụ

- **Khách đăng nhập** có đơn cũ đã bị dọn: lần đăng nhập sau hệ thống lấy lại tối đa 100 đơn gần nhất của họ từ Shopify (cần `read_all_orders` cho đơn quá 60 ngày).
- **Màn Orders của console** không còn đơn quá 180 ngày, trừ đơn có inquiry / thông báo. Tìm mã đơn cũ → **Look up on Shopify**.
- **Thống kê trên Dashboard / Statistics** tính trên đơn trong cache sẽ chỉ phản ánh 180 ngày gần nhất. Cần xác nhận không màn nào cần số liệu cả đời (§5).
- **Đa tenant:** áp cho mọi tenant của bản cài; tắt bằng `ORDER_CACHE_RETENTION_DAYS=0`.
- Xoá là **không hoàn tác trong DB**; hoàn tác = lấy lại từ Shopify.

## 5. Việc phải kiểm khi làm (chưa đọc hết code)

- Entity `reviews` và mọi truy vấn JOIN từ review / thông báo sang `orders_cache` (đơn bị dọn không được làm màn nào lỗi).
- Dashboard / Statistics / Customers ("Orders", "Total spent" của khách) đọc từ đâu: nếu cộng từ `orders_cache` thì số của khách cũ sẽ giảm sau khi dọn — khi đó cần lưu sẵn tổng trên bản ghi khách **trước** khi xoá, hoặc đổi nguồn.
- Đường đọc Order Detail khi đơn không còn: trả "không tìm thấy" gọn gàng.

Nếu mục thứ hai cho thấy cần lưu tổng trên bản ghi khách thì sẽ có thay đổi schema → quay lại xin duyệt kèm mục Migration.

## 6. Kiểm thử

Unit cho `RetentionService`: đơn cũ không ràng buộc → xoá cùng dòng hàng và fulfillment; đơn cũ có inquiry → giữ; có thông báo → giữ; đơn cũ nhưng vừa cập nhật → giữ; đơn mới → giữ; `0` → không chạy; chỉ trong đúng tenant (purge chạy toàn bảng, nhưng điều kiện ràng buộc phải so cùng tenant). Chạy thử trên DB local có dữ liệu seed.

## 7. Xin bạn xác nhận

1. **Duyệt kế hoạch này?**
2. **Số ngày giữ:** **a (khuyến nghị)** 180 · **b** 365 (bằng hạn giữ hội thoại) · **c** số khác (ghi rõ).
3. **Bật ngay sau deploy hay để tắt trước:** **a (khuyến nghị)** deploy với mặc định **tắt** (`0`), bạn bật khi đã xem báo cáo "sẽ xoá bao nhiêu đơn" của lượt chạy thử · **b** bật luôn 180 ngày.

Trả lời ví dụ: `1. ok  2. a  3. a`
