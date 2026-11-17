# TCR-261117 — Console Orders: tìm theo mã đơn · đồng bộ Shopify theo cửa sổ + lấy theo nhu cầu

Kế hoạch: [PLN-261117](../plan/PLN-261117-Orders-Search-And-Sync-Backfill.md) (`1. ok 2. a 3. a 4. b`). Báo cáo: [RPT-261117](../implementation/RPT-261117-Orders-Search-And-Sync-Backfill.md).

## 1. Unit — API (Jest)

`apps/api/src/domain/order/order.service.search-lookup.spec.ts` (11 ca)

| # | Ca | Kỳ vọng |
|---|---|---|
| S-01 | `listAll` không có `q` | `where` chỉ có `tenantId`, như cũ |
| S-02 | `q = "  #3989 "` | `LIKE %3989%` trong đúng `tenantId`; bỏ `#` và khoảng trắng |
| S-03 | `q = "%_\"` | ký tự đại diện được escape (`%\%\_\\%`), không khớp mọi đơn |
| S-04 | `q = " # "` | coi như không tìm |
| L-01 | `lookupFromStore` có đơn | trả `found: 1` + dòng danh sách |
| L-02 | cửa hàng không có đơn | `found: 0, items: []` |
| L-03 | không hỏi được cửa hàng | lỗi `E5164`, không phải "không tìm thấy" |
| G-01 | tra đơn vãng lai, đơn đã có trong cache | không gọi cửa hàng |
| G-02 | cache không có | gọi cửa hàng với đúng mã + email, đọc lại, gắn phiên; `#` khách gõ không nằm trong mã lưu |
| G-03 | cửa hàng không có đơn cho email đó | `E5001`, phiên không bị gắn |
| G-04 | cửa hàng lỗi | vẫn `E5001` — khách không biết thêm gì |

`apps/api/src/domain/order/shopify-sync.backfill.spec.ts` (9 ca)

| # | Ca | Kỳ vọng |
|---|---|---|
| B-01 | Đồng bộ lần đầu | chỉ hỏi đơn đổi trong 60 ngày; con trỏ = lúc bắt đầu chạy |
| B-02 | Chạm trần 20 trang, còn đơn | con trỏ = thời điểm của đơn cuối đã đọc (không phải "bây giờ"); `more: true`; bấm lại trong lúc đang chạy nền không mở thêm luồng; chạy nền đọc tiếp **đúng** từ điểm dừng tới hết; sau đó đồng bộ lại được |
| B-03 | Một lô không tiến được (quá nhiều đơn đổi cùng một thời điểm) | con trỏ giữ nguyên, không lặp vô hạn |
| B-04 | `resyncRecent` | xoá con trỏ **trước** khi đọc |
| B-05 | Khách đăng nhập | hỏi đơn của khách đó, **mới nhất trước** |
| B-06 | `lookupOrderByNumber(" #1001 ")` | chỉ lưu đơn `1001`, không lưu `10010` |
| B-07 | có `email` | đơn của email khác không được lưu; đúng email (khác hoa thường) thì lưu |
| B-08 | cửa hàng giấu email của đơn | không trao cho khách vãng lai |
| B-09 | tenant chưa kết nối cửa hàng | trả rỗng, không gọi ra ngoài |

`shopify-sync.service.spec.ts`: sửa 1 kỳ vọng chữ (`first sync, last 60 days`).

**Kết quả (2026-11-17, Windows):** nhóm `src/domain/order` **14 suite / 120 test xanh**. Cả bộ API: 285 / 288 suite — 3 suite đỏ (`heic-conversion`, `board-attachment.service`, `embed-loader`) **đỏ cả khi chưa có thay đổi này** (kiểm bằng `git stash`), là lỗi riêng trên Windows; CI Linux là kết quả cuối.

## 2. Tay — console trên local (Playwright, `localhost:5173`)

| # | Thao tác | Kết quả |
|---|---|---|
| M-01 | Gõ `#IVY-100` | URL thành `/orders?q=%23IVY-100`; API nhận `q`; còn đúng các đơn khớp |
| M-02 | Tải lại trang | ô tìm và kết quả giữ nguyên |
| M-03 | Gõ `ZZ-99999` | "No orders match "ZZ-99999"." + khung "Only recent orders are kept here…" + nút **Look up on Shopify** |
| M-04 | Bấm **Look up on Shopify** (tenant local chưa nối Shopify) | `POST /admin/orders/lookup` 201; toast "The store has no order "ZZ-99999"." |
| M-05 | Gõ `%` | không khớp đơn nào; không hiện nút tra (không phải mã đơn hợp lệ) |
| M-06 | Bấm ✕ | URL về `/orders`, hiện lại mọi đơn |
| M-07 | Tenant Settings → Platforms → Shopify | có nút **Re-sync recent orders** (mờ khi chưa có token) và dòng giải thích |

Boot thật: `Nest application successfully started`; route mới `GET /admin/orders`, `POST /admin/orders/lookup`, `POST /tenants/me/shopify/resync` đã map.

## 3. Chưa kiểm được ở local (cần cửa hàng thật — kiểm sau deploy)

- Đồng bộ thật với Shopify: số đơn sau **Re-sync recent orders** so với Shopify admin (60 ngày).
- **Look up on Shopify** với một mã đơn có thật; tra đơn vãng lai trên widget với đơn ngoài cache.
- Cột ngày của đơn lấy từ Shopify (`createdAt`) hiện đúng ngày đặt.
- Hạn mức API của Shopify khi đọc nhiều lô liên tiếp.
