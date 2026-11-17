# RPT-261117 — Console Orders: tìm theo mã đơn · đồng bộ Shopify theo cửa sổ + lấy theo nhu cầu

Kế hoạch: [PLN-261117](../plan/PLN-261117-Orders-Search-And-Sync-Backfill.md), duyệt ngày 2026-11-17 (`1. ok 2. a 3. a 4. b`). Kiểm thử: [TCR-261117](../test/TCR-261117-Orders-Search-And-Sync-Backfill.md). Lỗi: ivy-docs BUG-033, [FIX-261117](../bug-fix/FIX-261117-Shopify-Sync-Stops-At-500.md).

## 1. Thay đổi

**Không có SQL. Thêm một biến môi trường tuỳ chọn** `SHOPIFY_INITIAL_SYNC_DAYS` (mặc định 60 — không đặt cũng chạy).

| Phần | File | Nội dung |
|---|---|---|
| A · API | `order/dto/request/order.request.ts`, `order.controller.ts`, `order.service.ts` | `GET /admin/orders?q=`: tìm "chứa" theo mã đơn trong đúng tenant; bỏ `#`; ký tự `%` `_` `\` khớp chính nó |
| A · Web | `orders/OrdersPage.tsx`, `orders.service.ts`, `orders.hooks.ts` | Ô tìm (dùng `SearchField` sẵn có), chờ 300ms, từ khoá trên URL `?q=`, trạng thái "No orders match …". Cột Date hiện **ngày đặt đơn** khi có |
| B3 · Đồng bộ | `order/shopify-sync.service.ts` | Lần đầu chỉ đọc đơn đổi trong **60 ngày**. Chạm trần một lô (20 trang = 1.000 đơn) mà còn đơn: con trỏ chỉ tiến tới **đơn cuối đã đọc**, phần còn lại đọc tiếp **ở nền** từng lô tới hết. Trước đây: dừng ở 500 và con trỏ nhảy tới "bây giờ" |
| B3 · Đồng bộ lại | `shopify-sync.controller.ts`, `tenant.service.ts`, `settings/ShopifyConfigModal.tsx` | `POST /tenants/me/shopify/resync` + nút **Re-sync recent orders**: xoá con trỏ rồi đọc lại cửa sổ 60 ngày. Thêm dòng giải thích dưới các nút |
| B3 · Lấy theo nhu cầu | `shopify-admin.client.ts`, `shopify-sync.service.ts`, `order.service.ts`, `order.controller.ts` | `lookupOrderByNumber`: lấy đúng một đơn theo mã. Dùng ở (1) console `POST /admin/orders/lookup` + nút **Look up on Shopify** (ghi audit `order.store_lookup`), (2) tra đơn vãng lai của widget khi cache không có — chỉ lưu khi đơn thuộc đúng email khách nhập |
| B3 · Khách đăng nhập | `shopify-sync.service.ts` | Lấy đơn của khách **mới nhất trước** (trước: cũ nhất trước, khách trên 100 đơn thiếu đơn mới) |
| Client Shopify | `shopify-admin.client.ts` | Query thêm `createdAt`, `updatedAt`, tham số `reverse`; bộ lọc `name:`. Đơn đồng bộ giờ có ngày đặt (trước chỉ đơn về qua webhook mới có) |
| Lỗi mới | `error-code.constant.ts` | `E5164 ORDER_STORE_LOOKUP_FAILED` |
| i18n | `apps/web/src/i18n/locales/*/orders.json`, `settings.json` | 9 + 3 khoá × 6 ngôn ngữ; `i18n:check` xanh |
| Env | `docker/self-hosted/.env.self-hosted.example`, profile IVY, `env/backend/.env.development` | `SHOPIFY_INITIAL_SYNC_DAYS=60`; `env:check` xanh |
| Docs | PLN, TCR, RPT, FIX, [GUIDE-261117 read_all_orders](../guide/GUIDE-261117-IVY-Shopify-Read-All-Orders.md), ivy-docs/BUGS.md | |

## 2. Khác kế hoạch

1. **Thứ tự đọc của lần đồng bộ đầu là "đổi cũ nhất trước", không phải "mới nhất trước" như PLN ghi.** Đọc theo thứ tự tăng dần thì một lô dừng giữa chừng biết chính xác mình dừng ở đâu, và lần sau đọc tiếp đúng chỗ đó mà không cần lưu thêm gì (không cần SQL). Bù lại, phần còn lại được đọc tiếp tự động ở nền, nên cả cửa sổ 60 ngày về đủ sau vài phút. Trong lúc đang đọc, màn Orders có thể chưa có các đơn mới nhất.
2. **Cửa sổ 60 ngày tính theo ngày đơn thay đổi gần nhất** (`updated_at`), không phải ngày đặt: một đơn đặt lâu hơn nhưng vừa đổi trạng thái cũng được lấy về.
3. **Chưa làm phần "dọn đơn quá 180 ngày" (mục 4 của B3).** Xoá đơn khỏi cache đụng tới thông báo, đánh giá và inquiry đang trỏ vào đơn đó; cần thiết kế và test riêng, và chưa có đơn nào tới hạn trong nhiều tháng tới. Để thành việc tiếp theo, cần chủ dự án duyệt riêng.
4. **Trần 100 đơn / khách khi đăng nhập giữ nguyên**; chỉ đổi thứ tự thành mới nhất trước.

## 3. Kiểm thử

| Loại | Kết quả |
|---|---|
| Typecheck cả monorepo | sạch |
| Unit API nhóm `order` | **14 suite / 120 test xanh** (20 ca mới) |
| Unit API cả bộ (Windows) | 285 / 288 suite; 3 suite đỏ có sẵn, không liên quan (TCR §1) |
| `i18n:check`, `env:check` | xanh |
| Boot API thật | `Nest application successfully started`, 3 route mới đã map |
| Console trên local | TCR §2: 7 / 7 |
| Với cửa hàng Shopify thật | **Chưa kiểm** — cần production (TCR §3) |

## 4. Việc sau deploy (chủ dự án, trên console production)

1. Tenant Settings → Platforms → Shopify → **Re-sync recent orders**. Chờ vài phút; dòng trạng thái đổi từ "…more remain, continuing in the background" sang "Synced N order(s) updated since …".
2. So số đơn ở màn Orders với số đơn 60 ngày gần nhất trong Shopify admin.
3. Orders → tìm một mã đơn có thật. Đơn ngoài 60 ngày chỉ lấy được sau khi app có `read_all_orders` ([GUIDE](../guide/GUIDE-261117-IVY-Shopify-Read-All-Orders.md)).

## 5. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit | `ecc9b416` (2026-11-17) |
| CI | ✅ run `44049635169`: verify (gồm toàn bộ test trên Linux) · e2e gate · deploy-gate |
| Server `talkaibotprd01` | ⏳ (build lại `api` và `web`) |
| Re-sync trên production | ⏳ chủ dự án |
| Quyền `read_all_orders` | ⏳ chủ dự án xin Shopify |
