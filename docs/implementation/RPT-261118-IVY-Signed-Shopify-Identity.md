# RPT-261118 — Nhận diện khách Shopify đã đăng nhập bằng chữ ký từ theme

Kế hoạch: [PLN-261118-IVY-Signed-Shopify-Identity](../plan/PLN-261118-IVY-Signed-Shopify-Identity.md), duyệt ngày 2026-11-18 (`1. ok 2. a`). Cách cài: [GUIDE-261118](../guide/GUIDE-261118-IVY-Header-Bell-Install.md) mục 4b.

## 1. Cách A (App Proxy) đã thử và vì sao dừng

| Bước | Kết quả (2026-11-18) |
|---|---|
| Custom app tạo trong Shopify admin (`Ivyusa Talk`) | Có scope `write_app_proxy` để tick, nhưng trang Configuration chỉ có Admin API integration và Storefront API integration: không có chỗ khai báo proxy |
| App mới từ Dev Dashboard (`Ivyusa Talk Proxy`, tổ chức KISS PRODUCTS INC) | Form phiên bản có mục App proxy: prefix `apps`, subpath `ivy`, URL `https://talk.ivyusa.com/api/v1/shopify/proxy`. Phát hành và cài lên cửa hàng thành công; trang app ghi App Proxy URL `https://ivyusa.com/apps/ivy` |
| Mở `https://ivyusa.com/apps/ivy/identity` | Trước khi cài: 404 ngay. Sau khi cài: treo 60 giây rồi **504 "Request timed out"** (máy chủ Cloudflare của Shopify) |

Kết luận: Shopify chuyển tiếp nhưng không kết nối được tới `talk.ivyusa.com`. Nếu yêu cầu tới được API thì có trả lời ngay kể cả khi chưa đặt `SHOPIFY_API_SECRET`. Cùng họ với BUG-034 (webhook không tới). Chưa xem log nginx của server để xác nhận lần cuối.

Một điểm phát hiện kèm, chưa cần xử lý vì cách A dừng: `findTenantByShop` so khớp chính xác tên miền, mà trang ivyusa.com khai `Shopify.shop = chillhouse-wholesale.myshopify.com` trong khi tenant đăng ký `ivyusa.myshopify.com`. Nếu sau này App Proxy hoặc webhook thông đường, cần xử lý chỗ này.

## 2. Thay đổi (cách B)

Không có SQL, không đổi giao diện, không đổi widget hay loader.

| Phần | File | Nội dung |
|---|---|---|
| Identify | `apps/api/src/domain/embed/embed.service.ts` | Sau khi chữ ký đúng: `user id` dạng `<nền tảng>:<mã khách>:<thời điểm>` có nền tảng đã đăng ký thì đi đường nền tảng. Từ chối (E5048, như mọi lỗi identify) khi: chữ ký cũ hơn 24 giờ, ở tương lai quá 5 phút, tenant không kết nối nền tảng đó, hoặc khách đã yêu cầu xoá dữ liệu. `name` không ký chỉ lấp chỗ trống; không nhận email từ trình duyệt |
| Nối khách Shopify | `apps/api/src/domain/shopify-proxy/shopify-proxy.service.ts` | Tách `linkCustomer()` dùng chung cho App Proxy và identify: tìm / tạo khách theo mã Shopify, gắn nền tảng, lấy hồ sơ khi thiếu, kéo đơn hàng. Đăng ký bộ phân giải `shopify` vào `EmbedService` khi module khởi động |
| Module | `shopify-proxy.module.ts` | Import `EmbedModule` (một chiều; `EmbedModule` không import ngược, tránh vòng qua `TenantModule`) |
| Test | `embed.service.spec.ts` (9 ca mới), `shopify-proxy.service.spec.ts` (mới, 4 ca) | |

Chuỗi được ký: `shopify:<customer.id>:<epoch giây>`, HMAC-SHA256 hex với khoá Sign-in integration của tenant. Thời điểm nằm trong chuỗi ký nên không sửa được.

## 3. Khác kế hoạch

- **Chưa có ca E2E.** Đường này cần tenant có kết nối Shopify thật (token) để bộ phân giải chạy; tenant local / CI không có, và ở đó identify bị từ chối đúng như thiết kế. Kiểm cuối cùng nằm ở bản Preview của production (mục 5).
- `user id` có dạng nền tảng nhưng tenant không kết nối nền tảng đó → **từ chối**, không rơi về đường host. Lý do: thời điểm làm mỗi lần tải trang ra một `user id` khác, rơi về đường host sẽ tạo một khách mới cho mỗi lượt xem trang.

## 4. Kiểm thử (local, 2026-11-18)

| Loại | Kết quả |
|---|---|
| `src/domain/embed` | `embed.service.spec.ts` xanh (9 ca mới: gắn đúng khách Shopify, id bị sửa, 23 giờ / 25 giờ, tương lai, khách đã xoá, tenant không kết nối, tên chỉ lấp chỗ trống, id thường không đổi hành vi, chưa đăng ký bộ phân giải) |
| `src/domain/shopify-proxy` | 4 / 4 |
| Toàn bộ API | 288 / 291 suite; 3 suite đỏ là 3 suite vốn đỏ trên Windows |
| Typecheck · build · khởi động API thật (cổng 3011) | sạch · `Nest application successfully started` |

## 5. Việc sau deploy (chủ dự án) và điều cần xem

1. Tạo khoá trong console, dán khối Liquid vào theme nháp (GUIDE mục 4b).
2. Gỡ app `Ivyusa Talk Proxy`: khi nó còn, widget chờ tối đa 5 giây ở mỗi lần tải trang cho câu trả lời proxy không tới.
3. Trên bản Preview, đã đăng nhập: tiêu đề "Hi, {tên}"; Notifications không còn màn Verify; My Orders có đơn.
4. **Đã xem (chủ dự án, 2026-11-18): đoạn chat mất khi chuyển trang → BUG-037, đã sửa** — identify trả về phiên gần nhất của khách thay vì gắn phiên mới của trang; widget nhận token đó. Chờ thử lại sau deploy. Ghi chú cũ: Mỗi lần tải trang widget mở một phiên mới rồi gắn vào khách; đường App Proxy thì dùng lại phiên gần nhất của khách. Việc giữ đoạn chat trên đường identify phụ thuộc thiết lập tiếp nối hội thoại của tenant, chưa kiểm trên IVY.

## 6. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit / CI | `8ae16ee9` · IVY CI/CD run `44279395410` xanh (2026-11-18 09:52 UTC) |
| Server `talkaibotprd01` | ✅ bản mới chạy: identify có chữ ký trả về khách Shopify (xem dòng dưới) |
| Khoá + Liquid trên theme nháp | ✅ chủ dự án đã tạo khoá và dán khối Liquid (2026-11-18) |
| Kiểm trên Preview (mục 5) | ✅ một phần — ảnh của chủ dự án, tài khoản thử đã đăng nhập: tiêu đề "Hi, cong11"; Notifications hiện 4 chip, "No notifications yet.", không còn màn Verify; Chat → My orders trả "No orders in the last 30 days." ⏳ Chưa kiểm: tài khoản có đơn; giữ đoạn chat khi chuyển trang; đã gỡ app proxy hay chưa |
