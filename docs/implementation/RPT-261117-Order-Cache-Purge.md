# RPT-261117 — Tự dọn đơn hàng cũ khỏi bộ nhớ đệm

Kế hoạch: [PLN-261117-Order-Cache-Purge](../plan/PLN-261117-Order-Cache-Purge.md), duyệt ngày 2026-11-17 (`1. ok 2. a 3. a`: 180 ngày, deploy ở trạng thái **tắt**).

## 1. Thay đổi

Không có SQL, không đổi giao diện. Hai biến môi trường tuỳ chọn; không đặt thì chạy ở chế độ **chỉ báo cáo**.

| Phần | File | Nội dung |
|---|---|---|
| Purge | `apps/api/src/domain/privacy/retention.service.ts` | Bước mới ở cuối `purgeExpired()` (chạy mỗi 24 giờ và qua `POST /privacy/retention/purge`): đếm đơn đủ điều kiện; **chỉ xoá khi** `ORDER_CACHE_PURGE_ENABLED=true` — theo lô 500, mỗi lô một transaction: `fulfillments` → `order_items` → `orders_cache` |
| Kết quả | cùng file | Thêm `orderCacheRetentionDays`, `orderCachePurgeEnabled`, `ordersEligible`, `orders` vào kết quả, dòng log và bản ghi audit `retention.purge` |
| Env | `docker/self-hosted/.env.self-hosted.example`, profile IVY, `env/backend/.env.development` | `ORDER_CACHE_RETENTION_DAYS=180`, `ORDER_CACHE_PURGE_ENABLED=false`; `env:check` xanh |
| Test | `retention.order-cache.spec.ts` (mới, 6 ca) | |

**Một đơn đủ điều kiện khi:** ngày đặt (không có thì ngày vào cache) quá 180 ngày **và** lần cập nhật cuối quá 180 ngày **và** không có inquiry trỏ tới **và** không có thông báo trỏ tới đơn hay dòng hàng của nó **và** không có đánh giá trên dòng hàng nào của nó.

Khác kế hoạch: thêm điều kiện **đánh giá** (PLN §5 ghi "cần đọc kỹ"): `reviews.order_item_id` trỏ vào dòng hàng, xoá dòng hàng sẽ làm đánh giá mồ côi.

## 2. Kiểm thử (local, 2026-11-17)

| Loại | Kết quả |
|---|---|
| Unit `src/domain/privacy` | 4 suite / 27 test xanh (6 ca mới: mặc định chỉ báo cáo; cửa sổ 180 ngày trên cả ngày đặt lẫn lần cập nhật; 4 điều kiện giữ; xoá theo lô đúng thứ tự; số ngày cấu hình; không có repo) |
| SQL trên MySQL 8.0 thật | 8 đơn dựng sẵn → chọn đúng 2: đơn cũ không ràng buộc, và đơn cũ không có ngày đặt. Giữ 6: có inquiry · có thông báo đơn · có thông báo dòng hàng · có đánh giá · vừa cập nhật · còn mới |
| Qua API thật, **tắt** (mặc định) | `ordersEligible: 2, orders: 0`; DB còn nguyên 8 đơn, 8 dòng hàng, 3 fulfillment |
| Qua API thật, **bật** | `ordersEligible: 2, orders: 2`; DB còn 6 đơn, 6 dòng hàng, 1 fulfillment (của đơn có đánh giá); 2 đơn seed khác không đổi |
| Typecheck API | sạch |

Dữ liệu dựng sẵn đã xoá khỏi DB local sau khi thử.

## 3. Phải quyết trước khi bật (đã kiểm theo PLN §5)

1. **Cột "Orders" và "Total spent" ở màn Customers được cộng từ `orders_cache`** (`customer.service.ts`, `SUM(o.total)`). Bật dọn thì số của khách cũ **giảm dần** theo các đơn bị dọn. Lưu ý: từ khi chỉ đồng bộ 60 ngày, hai cột này vốn đã không phải tổng cả đời, mà là tổng các đơn đang có trong cache.
   - Muốn giữ tổng cả đời: cần lưu sẵn tổng trên bản ghi khách trước khi xoá → **thay đổi schema**, cần kế hoạch và mục Migration riêng. Chưa làm.
2. **Dashboard / Statistics** đếm đơn từ `orders_cache` (`analytics.service.ts`): con số là "đơn đang có trong cache", sẽ giảm khi dọn.
3. `issue/external-ticket.service.ts` và `notification.service.ts` đọc đơn theo id / mã: đơn bị dọn thì không tìm thấy; thông báo trỏ tới đơn thì đơn đó không bị dọn (điều kiện giữ).

## 4. Cách xem số "sẽ xoá" và cách bật

- **Xem số:** mỗi lượt purge (24 giờ một lần, lượt đầu 5 phút sau khi API khởi động) ghi vào Audit Log hành động `retention.purge`; trong chi tiết có `ordersEligible`. Trên server: `docker logs sharptalk_api | grep 'Retention purge'` → `orders=0 (eligible=N, report only, 180d)`.
- **Bật:** thêm `ORDER_CACHE_PURGE_ENABLED=true` vào file env của server (`docker/self-hosted/.env.self-hosted`) rồi dựng lại container API. Tắt lại: đặt `false`.
- **Hoàn tác một đơn đã dọn:** console → Orders → tìm mã → **Look up on Shopify** (đơn quá 60 ngày cần quyền `read_all_orders`).

## 5. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit / CI | ⏳ |
| Server `talkaibotprd01` | ⏳ (build lại `api`); chạy ở chế độ chỉ báo cáo |
| Bật xoá trên production | ⏳ chủ dự án quyết sau khi xem `ordersEligible` và mục 3 |
