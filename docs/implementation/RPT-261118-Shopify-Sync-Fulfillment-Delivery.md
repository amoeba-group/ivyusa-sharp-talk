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
4. **Kiểm trên console:** lấy mẫu lại 5 trang Orders, phải thấy Delivered; đơn In Transit phải có mã vận đơn ở Order Detail của widget.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit / CI | ⏳ |
| Server `talkaibotprd01` | ⏳ (build lại `api`) |
| Re-sync trên production | ⏳ |
| Kết quả đo PLN §2.5 | ⏳ |
