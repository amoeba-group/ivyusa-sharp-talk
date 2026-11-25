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
| Re-sync trên production | ✅ 2026-11-18. Lúc đó không ghi lại; ngày suy ra từ §5 lần 2, bảng C (41.568 dòng ghi lần cuối ngày đó) |
| Kết quả đo PLN §2.5 | ✅ 2026-11-25 (§5): đơn UPS / USPS giao xong về qua lượt 30 phút → **không cần** bước "soát lại đơn đang giao". Phát hiện mới: kiện Amazon Logistics và kiện không có hãng không bao giờ có trạng thái (ivy-docs BUG-047) |

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

### Lần 2 — 2026-11-25 (chủ dự án chạy truy vấn A–C, chỉ đọc)

Truy vấn (`docker exec -i sharptalk_mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'`, câu lệnh qua stdin):

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

**A. Theo hãng vận chuyển**

| Hãng | shipped | in_transit | delivered |
|---|---|---|---|
| Amazon Logistics US | 25.184 | 0 | 0 |
| UPS | 222 | 1.079 | 11.008 |
| (không có hãng) | 10.047 | 1 | 179 |
| USPS | 12 | 46 | 183 |

**B. Theo tuần đặt hàng** (ngày thứ Hai của tuần)

| Tuần | shipped | in_transit | delivered |
|---|---|---|---|
| 2026-11-23 | 861 | 334 | 5 |
| 2026-11-16 | 3.857 | 729 | 920 |
| 2026-11-09 | 3.965 | 41 | 1.793 |
| 2026-11-02 | 3.291 | 2 | 1.276 |
| 2026-10-26 | 2.799 | 2 | 1.244 |
| 2026-10-19 | 2.658 | 2 | 1.574 |
| 2026-10-12 | 2.659 | 4 | 1.246 |
| 2026-10-05 | 2.932 | 2 | 1.076 |
| 2026-09-28 | 2.468 | 1 | 580 |
| 2026-09-21 | 2.412 | 2 | 768 |
| 2026-09-14 | 1.550 | 2 | 761 |
| 2026-09-07 | 923 | 2 | 32 |

**C. Theo ngày dòng được ghi lần cuối**

| Ngày | shipped | in_transit | delivered |
|---|---|---|---|
| 2026-11-25 | 97 | 320 | 35 |
| 2026-11-24 | 678 | 540 | 195 |
| 2026-11-23 | 1.084 | 121 | 128 |
| 2026-11-22 | 5 | 6 | 19 |
| 2026-11-21 | 444 | 8 | 343 |
| 2026-11-20 | 601 | 26 | 632 |
| 2026-11-19 | 612 | 49 | 450 |
| 2026-11-18 | 31.944 | 56 | 9.568 |

**Kết luận:**

1. **Re-sync chạy ngày 2026-11-18:** 41.568 dòng được ghi lần cuối ngày đó (bảng C).
2. **PLN §2.5: không cần bước "soát lại đơn đang giao".** Sau 2026-11-18, ngày nào cũng có đơn chuyển sang Delivered qua lượt 30 phút: 19–632 đơn mỗi ngày, thấp nhất vào Chủ nhật (bảng C). In Transit dồn vào 2 tuần gần nhất; các tuần cũ hơn chỉ còn 1–4 kiện (bảng B). Có 56 kiện In Transit không đổi từ 2026-11-18, có thể là kiện chậm hoặc bị hoàn; nếu cần thì kiểm vài đơn bằng Look up on Shopify.
3. **Kiện `shipped` không phải dữ liệu cũ.** Đó là kiện mà Shopify không có trạng thái: Amazon Logistics US có 25.184 kiện, không kiện nào In Transit hay Delivered; kiện không có hãng có 10.047. Cộng lại là 73 % số kiện. Với các đơn này, widget hiện In Transit mãi, không có thông báo Delivered, và N-05 không gửi yêu cầu review. Đồng bộ không sửa được vì Shopify không có dữ liệu. Theo dõi ở ivy-docs BUG-047.
4. Lần đo D (log ban ngày ở Mỹ) không cần nữa: bảng C đã trả lời câu hỏi.
