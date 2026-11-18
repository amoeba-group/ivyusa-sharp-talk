# GUIDE-261117 — Cho phép đọc đơn cũ hơn 60 ngày (`read_all_orders`)

Dành cho: chủ dự án / người quản lý app Shopify của IVY. Kèm [PLN-261117](../plan/PLN-261117-Orders-Search-And-Sync-Backfill.md) (câu 4: chọn **b**).

> **Kết quả kiểm tra 2026-11-18: với app IVY đang dùng thì KHÔNG cần làm gì.** Token của app tạo trong trang admin của cửa hàng đã đọc được đơn cũ hơn 60 ngày: console → Orders → **Look up on Shopify** lấy về `IVY-100000` (đặt 2026-06-16) và `IVY-50000` (đặt 2026-02-15), dù bảng chọn quyền của app không có `read_all_orders`. Phần dưới chỉ còn dùng khi đổi sang app loại khác (Dev Dashboard / Partner).

## 1. Vì sao cần

Shopify chỉ cho một app đọc đơn hàng của **60 ngày gần nhất**, trừ khi app được cấp thêm quyền `read_all_orders`. Đây là quy định của Shopify (tài liệu đối tượng `Order` của Admin API), không phải giới hạn của SharpTalk.

Chưa có quyền này thì:

| Việc | Kết quả |
|---|---|
| Khách đăng nhập widget xem đơn của mình | Chỉ thấy đơn trong 60 ngày gần nhất |
| Khách vãng lai tra đơn bằng mã + email | Đơn cũ hơn 60 ngày: "không tìm thấy" |
| Console → Orders → **Look up on Shopify** | Đơn cũ hơn 60 ngày: "The store has no order …" |
| Đồng bộ lần đầu / Re-sync recent orders | Không ảnh hưởng: vốn chỉ đọc 60 ngày |

## 2. Cách xin

Theo tài liệu Shopify (đọc ngày 2026-11-17: [Access scopes › Orders permissions](https://shopify.dev/docs/api/usage/access-scopes#orders-permissions), [Manage access scopes](https://shopify.dev/docs/apps/build/authentication-authorization/manage-access-scopes)). `read_all_orders` không tự cho quyền gì: nó phải đi **cùng** `read_orders` và chỉ mở rộng phạm vi thời gian.

Cách làm tuỳ app được tạo ở đâu:

**A — App tạo trong Dev Dashboard (`dev.shopify.com/dashboard`) dưới tổ chức của chính cửa hàng (merchant organization): không cần Shopify duyệt.**
1. Dev Dashboard → **Apps** → mở app.
2. Thêm `read_all_orders` vào danh sách quyền (access scopes) của app, bên cạnh `read_orders`.
3. Phát hành phiên bản mới của app (Release / deploy).
4. Mở app trong trang admin của cửa hàng và chấp thuận quyền mới khi được hỏi.

**B — App tạo dưới tổ chức Partner: phải xin Shopify trước.**
1. Dev Dashboard → **Apps** → mở app → **Settings** → **Access requests**.
2. Cạnh **Read all orders**, bấm **Request access**.
3. Mô tả app và lý do cần quyền (xem câu gợi ý bên dưới) → **Request access**.
4. Sau khi được duyệt: thêm `read_all_orders` vào quyền của app và phát hành phiên bản mới. Thêm trước khi được duyệt thì bước phát hành sẽ báo lỗi.
5. Chủ cửa hàng chấp thuận quyền mới khi mở app.

**C — App tạo ngay trong trang admin của cửa hàng** (Settings → Apps and sales channels → Develop apps): tài liệu trên không nêu cách xin `read_all_orders` cho loại này, chỉ dẫn sang trang riêng về đổi quyền của app loại cũ (mình chưa đọc trang đó). Thử: mở app → **Configuration** → *Admin API integration* → **Edit** → tìm `read_all_orders` trong danh sách. Có thì tick, **Save**, rồi cài lại app nếu được yêu cầu. Không có thì cần tạo app theo cách A.

Câu gợi ý cho lý do: *"The app shows shoppers their own order history inside our support chat widget and lets support agents look up an older order when a customer asks about it."*

Sau khi quyền có hiệu lực, nếu token thay đổi: dán token mới vào console → Tenant Settings → Platforms → Shopify → **Save** → **Test connection**.

## 3. Kiểm tra sau khi có quyền

1. Console → **Orders** → gõ mã của một đơn **cũ hơn 60 ngày** → "No orders match …" → bấm **Look up on Shopify**.
   - Thấy "Order fetched from the store." và đơn hiện trong bảng: quyền đã có hiệu lực.
   - Thấy "The store has no order …": token chưa có quyền (làm lại bước 3–4).
2. Không cần deploy lại, không cần SQL, không cần đổi cấu hình server.

## 4. Không bắt buộc đổi

- `SHOPIFY_INITIAL_SYNC_DAYS` (mặc định 60) có thể giữ nguyên: đơn cũ được lấy về khi có người hỏi tới, không cần sao chép sẵn.
- Mỗi khách đăng nhập được lấy tối đa 100 đơn gần nhất của họ. Muốn nhiều hơn thì báo để chỉnh trần này trong code.
