# TCR-261118 — Lịch đồng bộ Shopify tự lấy thông tin giao hàng

Kế hoạch: [PLN-261118](../plan/PLN-261118-Shopify-Sync-Fulfillment-Delivery.md) (`1. ok 2. a 3. a`). Báo cáo: [RPT-261118](../implementation/RPT-261118-Shopify-Sync-Fulfillment-Delivery.md).

## 1. Unit — API (Jest)

`apps/api/src/domain/order/shopify-sync.shipment.spec.ts` (31 ca)

**Gộp các kiện của một đơn (`summarizeFulfillments`)**

| # | Ca | Kỳ vọng |
|---|---|---|
| F-01 | Payload không có kiện (`undefined`, `null`, `[]`) | `null` = "không nói gì", không phải "chưa giao" |
| F-02 | Kiện đã huỷ / lỗi | bỏ qua; chỉ còn kiện huỷ → `null` |
| F-03 | Quy đổi `shipment_status` (7 giá trị) | `delivered` → delivered; `in_transit`, `out_for_delivery`, `attempted_delivery` → in_transit; còn lại → shipped |
| F-04 | Đơn nhiều kiện | delivered chỉ khi mọi kiện đã giao; một kiện đang đi → in_transit |
| F-05 | Mã vận đơn | lấy từ kiện đổi gần nhất **có** mã; thời điểm đổi = kiện mới nhất |

**Ghi vào cache (`upsertOrder`)**

| # | Ca | Kỳ vọng |
|---|---|---|
| U-01 | Kiện đã giao | đơn `Delivered`; dòng `fulfillments` có tenant, trạng thái, mã, hãng, link |
| U-02 | Kiện đang đi | đơn `In Transit`, fulfillment `in_transit` |
| U-03 | Đơn đang Delivered, payload **không** có kiện | giữ `Delivered`, không ghi `fulfillments` (lỗi cũ: bị kéo về In Transit) |
| U-04 | Đơn đang Delivered, kiện báo đang đi | theo cửa hàng: `In Transit` |
| U-05 | Đơn giao một phần | giữ `Preparing` |

**Thông báo "Shipping update"**

| # | Ca | Kỳ vọng |
|---|---|---|
| N-01 | Trạng thái đổi, trong 48 giờ | gửi 1 thông báo, đúng tenant / khách / đơn / nội dung |
| N-02 | Kiện thấy lần đầu, trong 48 giờ | gửi |
| N-03 | Đọc lại cùng trạng thái | không gửi, không ghi DB |
| N-04 | Thay đổi cũ hơn 48 giờ | ghi `fulfillments`, không gửi |
| N-05 | Cửa hàng không ghi thời điểm đổi | không gửi |
| N-06 | Đơn không có khách | ghi `fulfillments`, không gửi |
| N-07 | Chỉ đổi mã vận đơn | cập nhật mã, không gửi |

**Truy vấn Shopify (`ShopifyAdminClient`)**

| # | Ca | Kỳ vọng |
|---|---|---|
| Q-01 | Bình thường | truy vấn có `fulfillments(first: 5)`; kết quả mang tên trường như webhook |
| Q-02 | Cửa hàng từ chối: không có quyền / quá hạn mức chi phí / trường không tồn tại (3 ca) | hỏi lại **không** có kiện, giữ nguyên bậc dòng hàng; đơn vẫn về |
| Q-03 | Đã bị từ chối | trong 1 giờ không hỏi lại kiện |
| Q-04 | Lỗi đường truyền (HTTP 502) | không thử lại, báo lỗi như cũ |
| Q-05 | Cửa hàng lỗi cả khi không hỏi kiện (bị giới hạn tốc độ) | không đổ cho kiện: lần sau vẫn hỏi kiện |
| Q-06 | Từ chối một trường dòng hàng | hạ bậc dòng hàng, **vẫn** hỏi kiện |

## 2. Kết quả (local, 2026-11-18)

| Loại | Kết quả |
|---|---|
| `src/domain/order` | 15 suite xanh |
| Toàn bộ API | 287 / 290 suite xanh; 3 suite đỏ là 3 suite vốn đỏ trên Windows (`heic-conversion`, `board-attachment.service`, `embed-loader`), không liên quan |
| Typecheck monorepo | sạch (9 / 9) |
| Khởi động API thật (bản build mới, cổng 3011) | `Nest application successfully started` |

## 3. Chưa kiểm được ở local

Local không có token của cửa hàng thật, nên **truy vấn mới chưa chạy với Shopify thật** trước khi deploy. Hai điều chỉ production trả lời được, cách kiểm ở RPT §3:

1. Shopify chấp nhận truy vấn có `fulfillments` (nếu không: log `Shipment details unavailable`, đơn vẫn về như cũ).
2. PLN §2.5: Shopify có đổi `updated_at` của đơn khi kiện được giao không (log `Delivery check`).
