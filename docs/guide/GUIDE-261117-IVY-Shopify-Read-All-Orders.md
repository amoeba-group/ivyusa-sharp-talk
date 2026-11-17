# GUIDE-261117 — Cho phép đọc đơn cũ hơn 60 ngày (`read_all_orders`)

Dành cho: chủ dự án / người quản lý app Shopify của IVY. Kèm [PLN-261117](../plan/PLN-261117-Orders-Search-And-Sync-Backfill.md) (câu 4: chọn **b**).

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

Quyền này phải **xin Shopify** rồi mới thêm được vào app; không tự bật trong console SharpTalk.

1. Mở trang hướng dẫn chính thức: <https://shopify.dev/docs/api/usage/access-scopes#orders-permissions> và làm theo mục *Orders permissions* cho đúng loại app đang dùng.
2. Khi Shopify hỏi lý do, nêu đúng việc dùng: *hiển thị cho khách hàng lịch sử đơn của chính họ trong widget hỗ trợ, và để nhân viên hỗ trợ tra một đơn cũ khi khách hỏi*. Shopify ghi rõ họ hạn chế quyền với app không có lý do chính đáng.
3. Sau khi được chấp thuận: thêm `read_all_orders` vào danh sách quyền của app (bên cạnh `read_orders`, `read_customers`, `read_fulfillments`, `read_products`), rồi **cài lại / cấp quyền lại** app cho cửa hàng để token nhận quyền mới.
4. Nếu token thay đổi sau khi cấp lại: dán token mới vào console → Tenant Settings → Platforms → Shopify → **Save** → **Test connection**.

Mình chưa xác minh được từng nút bấm ở bước 1 và 3 cho loại app IVY đang dùng (app tạo trong trang admin của cửa hàng). Nếu màn hình khác với hướng dẫn của Shopify, chụp lại để cùng xem.

## 3. Kiểm tra sau khi có quyền

1. Console → **Orders** → gõ mã của một đơn **cũ hơn 60 ngày** → "No orders match …" → bấm **Look up on Shopify**.
   - Thấy "Order fetched from the store." và đơn hiện trong bảng: quyền đã có hiệu lực.
   - Thấy "The store has no order …": token chưa có quyền (làm lại bước 3–4).
2. Không cần deploy lại, không cần SQL, không cần đổi cấu hình server.

## 4. Không bắt buộc đổi

- `SHOPIFY_INITIAL_SYNC_DAYS` (mặc định 60) có thể giữ nguyên: đơn cũ được lấy về khi có người hỏi tới, không cần sao chép sẵn.
- Mỗi khách đăng nhập được lấy tối đa 100 đơn gần nhất của họ. Muốn nhiều hơn thì báo để chỉnh trần này trong code.
