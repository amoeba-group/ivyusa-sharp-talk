# RPT-261118 — Lịch đồng bộ Shopify tự lấy thông tin giao hàng

Kế hoạch: [PLN-261118](../plan/PLN-261118-Shopify-Sync-Fulfillment-Delivery.md), duyệt ngày 2026-11-18 (`1. ok 2. a 3. a`). Kiểm thử: [TCR-261118](../test/TCR-261118-Shopify-Sync-Fulfillment-Delivery.md). Lỗi liên quan: ivy-docs BUG-034, BUG-035.

## 1. Thay đổi

Không có SQL, không đổi giao diện, không thêm biến môi trường.

| Phần | File | Nội dung |
|---|---|---|
| Truy vấn Shopify | `apps/api/src/domain/order/shopify-admin.client.ts` | Truy vấn `orders` lấy thêm `fulfillments(first: 5)`: trạng thái, `displayStatus`, thời điểm đổi, thời điểm giao, mã vận đơn / hãng / link. Kết quả mang tên trường như webhook (`shipment_status`, `tracking_number`…). Cửa hàng từ chối phần này (thiếu quyền, quá hạn mức chi phí, trường không tồn tại) → hỏi lại không có nó, 1 giờ sau mới thử lại; đơn vẫn về |
| Gộp kiện | `apps/api/src/domain/order/shopify-shipment.ts` (mới) | Các kiện của một đơn → một trạng thái + một bộ thông tin theo dõi. Bỏ kiện huỷ / lỗi. Delivered chỉ khi mọi kiện đã giao |
| Ghi cache | `apps/api/src/domain/order/shopify-sync.service.ts` | `upsertOrder` ghi dòng `fulfillments` và đặt trạng thái đơn theo kiện. Payload không nói gì về kiện thì **không** hạ đơn Delivered về In Transit (BUG-035) |
| Thông báo | cùng file | "Shipping update" chỉ gửi khi trạng thái thật sự đổi, thay đổi trong 48 giờ gần nhất, và đơn có khách |
| Đo PLN §2.5 | cùng file | Mỗi lượt đồng bộ có đọc kiện đã giao ghi một dòng log `Delivery check` |
| Test | `shopify-sync.shipment.spec.ts` (mới, 31 ca) | |

**Áp cho mọi đường đọc đơn**, không riêng lịch 30 phút: Sync now, Re-sync recent orders, lấy đơn khi khách đăng nhập, tra đơn vãng lai, Look up on Shopify. Webhook đơn (`orders/updated`) nếu sau này tới được cũng đi qua cùng chỗ.

Kênh thông báo: hiện chỉ thông báo trong widget là thật; email / SMS / web push trong `NotificationService` vẫn là bản ghi giả, push cần thiết bị đã đăng ký.

## 2. Khác kế hoạch

- **Bước kiểm PLN §2.5 chưa làm trước khi viết code.** Local không có token của cửa hàng thật, production chưa có code đọc kiện. Thay vào đó code ghi log `Delivery check` để đo trên production sau deploy (mục 3). Bước "soát lại đơn đang giao" **chưa viết**; có cần hay không tuỳ kết quả đo.
- Thêm một tình huống từ chối so với kế hoạch: trường không tồn tại ở phiên bản API. Lý do: truy vấn mới chưa chạy được với Shopify thật trước khi deploy, và một lỗi truy vấn không được phép làm hỏng việc đồng bộ đơn.

## 3. Việc phải làm sau deploy

1. **Truy vấn có được Shopify chấp nhận không.** Trên server:
   `docker logs sharptalk_api --since 40m 2>&1 | grep -E "Shipment details unavailable|Delivery check"`
   - Có `Delivery check …` → đang đọc được kiện.
   - Có `Shipment details unavailable (…)` → Shopify từ chối; nội dung trong ngoặc cho biết vì sao. Đơn vẫn về như trước.
2. **Sửa dữ liệu cũ:** console → Platforms → **Re-sync recent orders**, một lần. Trong lúc chạy không push commit làm API khởi động lại.
3. **Đo PLN §2.5** sau khi chạy lại xong: dòng `Delivery check tenant=…: N delivered parcel(s) read, M delivered after the order's last update`.
   - M bằng 0 hoặc rất nhỏ so với N → Shopify có đổi `updated_at` khi giao; không cần làm gì thêm.
   - M lớn → đơn giao xong không lọt vào lượt đồng bộ; cần viết bước "soát lại đơn đang giao" (PLN §2.5, đã duyệt 3a).
   - ⚠️ (bổ sung 2026-11-25) Hai quy tắc trên chỉ đúng với lượt **đọc lại toàn bộ**. Lượt 30 phút chỉ đọc đơn có `updated_at` vừa đổi: nếu giao hàng không đổi `updated_at`, đơn đó không được đọc nên không có trong log, và M ở lượt 30 phút luôn gần 0. Ở lượt 30 phút, xem **N** trong giờ giao hàng ở Mỹ (§5).
4. **Kiểm trên console:** lấy mẫu lại 5 trang Orders, phải thấy Delivered; đơn In Transit phải có mã vận đơn ở Order Detail của widget.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit / CI | `f92e0659` · IVY CI/CD run `44236718563` xanh (2026-11-18 04:25 UTC) |
| Server `talkaibotprd01` | ✅ Có trong mọi bản deploy sau 2026-11-18 (API đang chạy bản `f4faad2f`, 2026-11-25) |
| Re-sync trên production | 🟡 Không có ghi nhận ngày. Production có 47.961 dòng `fulfillments`, mà chỉ code này ghi bảng đó (webhook không tới) → đã có ít nhất một lượt đọc lại toàn bộ sau 2026-11-18. Ngày: truy vấn C ở §5 |
| Kết quả đo PLN §2.5 | 🟡 Lần 1 (2026-11-25): Shopify cho đọc kiện; chưa kết luận được về `updated_at` (§5) |

## 5. Kết quả đo trên production

### Lần 1 — 2026-11-25, khoảng 14:00 UTC (chủ dự án chạy lệnh chỉ đọc)

Container API chạy từ deploy `f4faad2f` (khoảng 09:00 UTC), tức khoảng 10 lượt đồng bộ. Dòng `Delivery check` chỉ in khi lượt đó đọc được ít nhất một kiện đã giao:

| Lượt (UTC) | N: kiện đã giao đọc được | M: giao sau lần đổi cuối của đơn |
|---|---|---|
| 10:29 | 1 | 0 |
| 10:59 | 2 | 0 |
| 11:29 | 1 | 0 |
| 12:29 | 1 | 0 |

Không có dòng `Shipment details unavailable`.

Bảng `fulfillments` (tenant 1):

| Trạng thái | Số dòng | Có `delivered_at` | `delivered_at` trong 24 giờ | Đã xử lý yêu cầu review |
|---|---|---|---|---|
| delivered | 11.370 | 3 | 1 | 0 |
| in_transit | 1.126 | 0 | — | 0 |
| shipped | 35.465 | 0 | — | 0 |

Ngày giao đã ghi: 2026-11-25 ×1, 2026-11-23 ×2.

Đọc kết quả:

1. **Shopify cho đọc kiện hàng.** Không có dòng từ chối.
2. **Chưa trả lời được PLN §2.5.** M = 0 ở lượt 30 phút không chứng minh gì (§3 bước 3). N nhỏ cũng chưa nói được gì: các lượt này rơi vào 05:00–10:00 sáng giờ miền Đông nước Mỹ, lúc hãng vận chuyển gần như chưa giao.
3. **74 % kiện ở `shipped`.** Lúc đọc, Shopify chưa có trạng thái vận chuyển cho kiện (`displayStatus` không phải in transit / out for delivery / delivered). Widget hiện các đơn này là In Transit. Hai khả năng:
   - hãng vận chuyển không gửi trạng thái về Shopify → kiện không bao giờ thành Delivered;
   - dữ liệu cũ: kiện đi tiếp sau lần đọc cuối mà đơn không đổi `updated_at`, nên không được đọc lại.
4. **N-05.** Mới 3 đơn có ngày giao, chưa đơn nào tới hạn. Yêu cầu review tự động đầu tiên vào khoảng 2026-11-30. Đợt IVY test từ 2026-11-27 sẽ không thấy yêu cầu tự động nào; mục 42 của hướng dẫn test chỉ kiểm cài đặt nên không lệch.

### Lần 2 — cần làm

**A–C. Truy vấn chỉ đọc** (`docker exec -i sharptalk_mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'`, câu lệnh qua stdin):

```sql
-- A. Theo hãng vận chuyển
SELECT COALESCE(NULLIF(carrier, ''), '(none)') AS carrier_name,
       SUM(status = 'shipped') AS shipped, SUM(status = 'in_transit') AS in_transit,
       SUM(status = 'delivered') AS delivered
  FROM fulfillments GROUP BY carrier_name ORDER BY COUNT(*) DESC LIMIT 12;
-- B. Theo tuần đặt hàng (ngày thứ Hai của tuần)
SELECT DATE_SUB(DATE(o.ordered_at), INTERVAL WEEKDAY(o.ordered_at) DAY) AS order_week,
       SUM(f.status = 'shipped') AS shipped, SUM(f.status = 'in_transit') AS in_transit,
       SUM(f.status = 'delivered') AS delivered
  FROM fulfillments f JOIN orders_cache o ON o.id = f.order_id
 GROUP BY order_week ORDER BY order_week DESC LIMIT 12;
-- C. Theo ngày dòng được ghi lần cuối (một lượt đọc lại toàn bộ hiện thành một ngày rất lớn)
SELECT DATE(updated_at) AS written_on,
       SUM(status = 'shipped') AS shipped, SUM(status = 'in_transit') AS in_transit,
       SUM(status = 'delivered') AS delivered
  FROM fulfillments GROUP BY written_on ORDER BY written_on DESC LIMIT 12;
```

Cách đọc:

- `in_transit` / `shipped` còn nhiều ở đơn đặt từ 3 tuần trước trở về trước, cùng hãng với các đơn đã Delivered → dữ liệu cũ → cần bước "soát lại đơn đang giao" (PLN §2.5, đã duyệt 3a).
- `shipped` dồn vào những hãng không có đơn Delivered nào → hãng không gửi trạng thái về Shopify. Đồng bộ không sửa được; báo IVY.

**D. Log ban ngày ở Mỹ:** chạy lại lệnh log ở §3 bước 1 (bỏ `--since 40m`, thêm `| tail -n 60`) vào sáng 2026-11-26 giờ Việt Nam, khi chưa có deploy nào dựng lại API. Nếu giao hàng làm đổi `updated_at`, các lượt từ khoảng 14:00 UTC phải đọc được nhiều kiện đã giao mỗi lượt. Nếu vẫn chỉ 0–2 kiện thì giao hàng không làm đổi đơn.
