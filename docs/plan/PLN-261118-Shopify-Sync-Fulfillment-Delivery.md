# PLN-261118 — Lịch đồng bộ Shopify tự lấy thông tin giao hàng

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-18** (`1. ok 2. a 3. a`) và đã làm — [RPT-261118](../implementation/RPT-261118-Shopify-Sync-Fulfillment-Delivery.md). Bước kiểm §2.5 chuyển sang sau deploy (RPT §3) |
| Nguồn | Chủ dự án chọn "cách B" ngày 2026-11-18, sau khi kiểm tra cho thấy webhook của Shopify không tới được production |
| Phạm vi | `apps/api` (đồng bộ Shopify). **Không có thay đổi giao diện**: console và widget đã có sẵn trạng thái Delivered, mã vận đơn và thông báo giao hàng, chỉ đang thiếu dữ liệu |
| Migration | Không có SQL |

## 1. Hiện trạng (kiểm trên production 2026-11-18)

**Webhook không tới được server.**
- Bấm Register webhooks: `Registered 0, already present 4, failed 0`, tức Shopify đã nhận đăng ký cả 4 webhook.
- Log của `sharptalk_nginx` trong 60 phút không có yêu cầu nào tới `/api/v1/webhooks/shopify/*`, trong khi vẫn ghi đủ truy cập của trình duyệt và health check.
- `SHOPIFY_APP_URL` đúng (`https://talk.ivyusa.com`).
- Kết luận: load balancer AWS chặn client không phải trình duyệt (ivy-docs BUG-004), nên chặn luôn Shopify. Chủ dự án không đi theo hướng xin AWS mở đường.

**Lịch 30 phút chỉ lấy đơn và dòng hàng.** Ba thứ sau chỉ được ghi bởi webhook `fulfillments/*` (`ShopifyWebhookService.handleFulfillment` → `OrderService.applyFulfillment`):

| Thiếu | Hệ quả khách thấy |
|---|---|
| Trạng thái Delivered | Đơn đã nhận vẫn ghi "In Transit". Lấy mẫu 100 đơn ở 5 trang (đặt từ tháng 8 tới 18/11): chỉ có Confirmed và In Transit |
| Bản ghi `fulfillments` (mã vận đơn, hãng, link theo dõi) | Order Detail không có thông tin theo dõi |
| Thông báo "Shipping update" | Tab Notifications của widget không có thông báo giao hàng |
| (kéo theo) Danh sách đơn được viết review | `reviewItemsForSession` chỉ nhận đơn Delivered, nên không đơn nào đủ điều kiện |

**Lỗi sẵn có, lộ ra khi đọc code:** `upsertOrder` gán lại trạng thái mỗi lần chạy theo `fulfillment_status` của đơn (`fulfilled` → In Transit). Kể cả khi webhook hoạt động, một đơn đã Delivered sẽ bị kéo về In Transit ở lượt đồng bộ kế tiếp.

## 2. Thiết kế

### 2.1 Lấy fulfillment ngay trong truy vấn đơn
Thêm vào truy vấn `orders` của `shopify-admin.client.ts` (API 2026-01, đã đối chiếu tài liệu Shopify; các trường này đọc được bằng `read_orders`, quyền app đang có):

```graphql
fulfillments(first: 5) {
  status            # SUCCESS / CANCELLED / ...
  displayStatus     # IN_TRANSIT / OUT_FOR_DELIVERY / DELIVERED / ...
  updatedAt
  deliveredAt
  trackingInfo(first: 1) { number company url }
}
```

Trường này đi theo cơ chế "bậc" sẵn có của truy vấn: nếu store từ chối trường hoặc truy vấn vượt hạn mức chi phí, lượt đó lùi về truy vấn không có fulfillment thay vì hỏng cả lượt đồng bộ.

### 2.2 Quy đổi trạng thái
Bỏ qua fulfillment đã huỷ. Trên các fulfillment còn lại:

| Shopify `displayStatus` | Trạng thái fulfillment | Trạng thái đơn |
|---|---|---|
| `DELIVERED` (ở **mọi** fulfillment của đơn) | delivered | Delivered |
| `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `ATTEMPTED_DELIVERY` | in_transit | In Transit |
| Còn lại | shipped | In Transit |

Đơn nhiều kiện: bảng `fulfillments` giữ một dòng cho mỗi đơn như hiện tại. Mã vận đơn lấy từ kiện cập nhật gần nhất; đơn chỉ Delivered khi mọi kiện đã giao.

### 2.3 Ghi vào cache
Trong `upsertOrder`, khi payload có fulfillment:
- tạo hoặc cập nhật dòng `fulfillments` (trạng thái, mã vận đơn, hãng, link);
- trạng thái đơn tính từ fulfillment thay vì từ `fulfillment_status` chung.

Sửa luôn lỗi ở mục 1: payload **không** mang fulfillment (webhook đơn, hoặc lượt đã lùi bậc) thì không được hạ một đơn Delivered về In Transit.

### 2.4 Thông báo cho khách
`applyFulfillment` hiện gửi thông báo ở mỗi lần gọi. Đường đồng bộ đọc lại cùng một đơn nhiều lần (mỗi lượt lùi lại một khoảng chồng lấn), nên cần luật riêng. Chỉ gửi "Shipping update" khi **cả ba** điều đúng:
1. trạng thái fulfillment thật sự đổi so với dòng đang lưu (hoặc dòng mới);
2. thay đổi phía Shopify (`updatedAt` của fulfillment) xảy ra trong 48 giờ gần nhất;
3. đơn có khách (`customer_id`).

Điều 2 giữ cho lần chạy lại toàn bộ (mục 4) im lặng: 44.900 đơn cũ được sửa trạng thái mà không ai nhận thông báo về đơn giao từ tháng trước.

### 2.5 Điểm chưa chắc, phải kiểm trước khi viết phần còn lại
**Khi hãng vận chuyển báo "đã giao", Shopify có đổi `updated_at` của đơn không?** Lịch đồng bộ lọc theo `updated_at` của đơn; nếu Shopify không đổi nó thì đơn chuyển sang Delivered sẽ không bao giờ lọt vào lượt đồng bộ.

Cách kiểm (chỉ đọc, trên production qua nút **Look up on Shopify** hoặc trên local với token của store thử): lấy vài đơn đã giao, so `updatedAt` của đơn với `deliveredAt` của fulfillment.

- Nếu `updatedAt` ≥ `deliveredAt`: thiết kế trên là đủ.
- Nếu không: thêm một bước "soát lại đơn đang giao" vào mỗi lượt đồng bộ. Bước này hỏi lại Shopify các đơn trong cache đang In Transit và đặt trong 45 ngày gần nhất, theo lô 50 đơn, tối đa 500 đơn mỗi lượt, đơn lâu chưa soát đi trước. Khi đó tôi sẽ báo lại con số ước lượng số lần gọi Shopify trước khi làm.

## 3. Việc không làm
- Không đổi giao diện console hay widget.
- Không đổi schema.
- Không gỡ webhook: đường webhook giữ nguyên, nếu sau này AWS mở đường thì hai đường cùng chạy được (cùng ghi một dòng, luật thông báo ở 2.4 chặn gửi trùng).
- Không đổi chu kỳ 30 phút (`SHOPIFY_SYNC_INTERVAL_MIN`).

## 4. Triển khai và sửa dữ liệu cũ
1. Push code (CI xanh thì production tự deploy, API khởi động lại).
2. Sau khi deploy xong, bấm **Re-sync recent orders** một lần để đọc lại đơn 60 ngày gần nhất kèm fulfillment. Lần trước việc này đọc 44.289 đơn và chạy nền trong thời gian dài, nên cần để máy chủ yên trong lúc đó.
3. Trong lúc chạy lại: không push commit nào làm API khởi động lại.

Đơn trong cache nhưng không đổi gì trong 60 ngày (chủ yếu là đơn được tra thủ công) không được sửa bởi bước 2; chúng được sửa khi có người tra lại hoặc khi khách đăng nhập.

## 5. Ảnh hưởng phụ
- **Độ trễ:** thông tin giao hàng tới chậm tối đa 30 phút so với Shopify.
- **Hạn mức Shopify:** mỗi trang đơn nặng hơn. Cần đo chi phí truy vấn thật ở bước kiểm 2.5; nếu chạm hạn mức thì giảm số đơn mỗi trang.
- **Review:** đơn Delivered trong 60 ngày sẽ xuất hiện trong danh sách "viết review" của khách ngay sau lần chạy lại. Đây là hành vi đúng thiết kế, nhưng là thay đổi khách nhìn thấy được.
- **Dashboard / thống kê theo trạng thái đơn:** số Delivered sẽ tăng từ 0 lên đúng thực tế.
- **Đa tenant:** áp cho mọi tenant Shopify của bản cài.

## 6. Kiểm thử
Unit (Jest), tối thiểu:
- quy đổi `displayStatus` → trạng thái, gồm đơn nhiều kiện và kiện đã huỷ;
- payload có fulfillment tạo / cập nhật dòng `fulfillments` và đặt đúng trạng thái đơn;
- payload không có fulfillment không hạ Delivered về In Transit;
- thông báo: gửi khi trạng thái đổi và mới; không gửi khi đọc lại, khi thay đổi cũ hơn 48 giờ, khi đơn không có khách;
- truy vấn lùi bậc khi store từ chối trường fulfillment.

Trên production sau khi chạy lại: lấy mẫu lại 5 trang như mục 1, phải thấy Delivered; mở một đơn In Transit, phải có mã vận đơn.

Tài liệu sau khi làm: TCR, RPT, và một mục mới trong `ivy-docs/BUGS.md` (webhook bị chặn ở load balancer; Delivered bị hạ về In Transit).

## 7. Cần chủ dự án quyết

1. **Duyệt hướng làm ở mục 2** (lấy fulfillment trong lịch 30 phút, không đổi giao diện, không đổi schema)?
2. **Thông báo giao hàng cho khách:**
   - a. Gửi như 2.4: chỉ cho thay đổi trong 48 giờ gần nhất, lần chạy lại dữ liệu cũ thì im lặng (khuyên dùng).
   - b. Không gửi thông báo nào từ đường đồng bộ, chỉ sửa trạng thái và mã vận đơn.
3. **Nếu bước kiểm 2.5 cho thấy cần "soát lại đơn đang giao":**
   - a. Làm luôn theo mô tả ở 2.5, báo con số sau (khuyên dùng).
   - b. Dừng lại, báo kết quả và xin duyệt riêng.
