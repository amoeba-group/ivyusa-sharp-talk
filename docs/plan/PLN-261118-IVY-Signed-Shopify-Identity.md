# PLN-261118 — Nhận diện khách Shopify đã đăng nhập bằng chữ ký từ theme (cách B)

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-18** (`1. ok 2. a`: chữ ký hết hạn sau 24 giờ) và đã làm — [RPT-261118](../implementation/RPT-261118-IVY-Signed-Shopify-Identity.md). Cách A đã thử cùng ngày và bị chặn (RPT §1) |
| Nguồn | Chủ dự án, 2026-11-18: widget hiện "Verify your identity" ở mọi nơi, không xem được đơn hàng của mình; chọn thử App Proxy trước (cách A), không được thì sang cách này |
| Phạm vi | `apps/api` (`domain/embed`, `domain/shopify-proxy`), tài liệu cài đặt, vài dòng Liquid trên theme. **Không có thay đổi giao diện**: màn "Verify your identity" tự biến mất khi widget nhận ra khách; không thêm màn hay ô nào |
| Migration | Không có SQL |

## 1. Hiện trạng

- Widget chỉ biết khách là ai qua **App Proxy** của Shopify: `ivyusa.com/apps/ivy/identity` → Shopify ký và chuyển tiếp tới `talk.ivyusa.com/api/v1/shopify/proxy/identity`. Trên production địa chỉ này trả **404**.
- App Proxy được khai báo trong cấu hình của app (file `shopify.app.toml` / Dev Dashboard), cần scope `write_app_proxy` (tài liệu Shopify, đã tra ngày 2026-11-18). App đang kết nối là **custom app tạo trong Shopify admin**: nó có scope `write_app_proxy` để tick, nhưng tôi không thấy chỗ nào để khai báo prefix / subpath / URL. Chờ chủ dự án xác nhận trang Configuration không có mục App proxy.
- Kể cả khi có App Proxy: yêu cầu đi từ máy chủ Shopify tới `talk.ivyusa.com`, nơi load balancer đang chặn client không phải trình duyệt (BUG-004, BUG-034). Chưa thử được.
- Hệ thống đã có sẵn đường thứ hai, **Sign-in integration** (console → Embed & SDK): trang chủ ký một `user id` bằng khoá bí mật của tenant, trình duyệt gửi thẳng tới `talk.ivyusa.com`. Nhưng đường này tạo một khách riêng theo `user id`, **không nối với khách Shopify và đơn hàng của họ**.

## 2. Thiết kế

Dùng đường Sign-in integration, và dạy nó hiểu khách Shopify.

### 2.1 Theme ký danh tính (Liquid chạy trên máy chủ Shopify)
Khi khách đã đăng nhập, theme dựng chuỗi `shopify:<mã khách>:<thời điểm>` và ký bằng HMAC-SHA256 với khoá của tenant, rồi đưa cho widget:

```liquid
{% if customer %}
  {%- assign st_issued = 'now' | date: '%s' -%}
  {%- assign st_user = 'shopify:' | append: customer.id | append: ':' | append: st_issued -%}
  <script>
    window.SharpTalk = window.SharpTalk || { q: [] };
    window.SharpTalk.q.push(['identify', {
      userId: {{ st_user | json }},
      hash: {{ st_user | hmac_sha256: 'KHOÁ_BÍ_MẬT' | json }},
      name: {{ customer.first_name | json }}
    }]);
  </script>
{% endif %}
```

Khoá nằm trong mã Liquid, không xuất hiện trong trang gửi tới trình duyệt. Người sửa được theme thì đọc được nó.

### 2.2 API (`EmbedService.identify`)
Sau khi chữ ký đúng, nếu `user id` có dạng `shopify:<số>:<thời điểm>` **và** tenant đã kết nối Shopify:
1. **Hạn dùng:** thời điểm ký không cũ quá 24 giờ và không ở tương lai quá 5 phút; ngoài khoảng đó → từ chối như chữ ký sai. Một cặp (id, chữ ký) bị lộ không dùng được mãi.
2. **Nối với khách Shopify:** đúng các bước đường App Proxy đang làm (`findOrCreateByShopifyId` → gắn nền tảng Shopify → lấy tên / email từ Admin API khi thiếu → kéo đơn hàng của khách về cache). Phần này tách khỏi `ShopifyProxyService` thành một hàm dùng chung, để hai đường không lệch nhau.
3. **Gắn phiên hiện tại** vào khách đó, mức `verified`, như mọi lần identify có chữ ký.
4. Khách đã yêu cầu xoá dữ liệu (`findOrCreateByShopifyId` trả rỗng): giữ là khách vãng lai, như đường App Proxy.
5. `name` do theme gửi không nằm trong chữ ký: chỉ dùng để hiển thị "Hi, {tên}" khi hệ thống chưa có tên; không ghi đè tên lấy từ Shopify. Email không nhận từ trình duyệt.

`user id` không có tiền tố `shopify:` → hành vi cũ, không đổi (các tenant khác).

### 2.3 Không đổi
- Widget và loader: `SharpTalk.q.push(['identify', …])` đã có sẵn.
- Đường App Proxy: giữ nguyên; nếu sau này bật được thì hai đường cùng chạy.
- Nút **Sign in** trong màn Verify: đã đưa khách tới trang đăng nhập của cửa hàng rồi quay lại; khi quay lại, theme ký và widget nhận ra khách.

## 3. Việc của chủ dự án sau deploy

1. Console → Tenant Settings → Widget → **Embed & SDK → Sign-in integration → Generate**. Khoá chỉ hiện một lần; chép lại.
2. Dán khối Liquid ở 2.1 vào `layout/theme.liquid` của theme nháp, **ngay trên** khối `SHARPTALK_WIDGET_CONFIG`, thay `KHOÁ_BÍ_MẬT` bằng khoá vừa tạo.
3. Đăng nhập ivyusa.com trên bản Preview, mở khung talk: tiêu đề "Hi, {tên}", tab Notifications không còn màn Verify, My Orders hiện đơn.

Khoá không gửi qua chat. Đổi khoá (Regenerate) làm mọi chữ ký cũ mất hiệu lực ngay, phải cập nhật theme cùng lúc.

## 4. Ảnh hưởng phụ và rủi ro

- **Ai sửa được theme thì đọc được khoá**, và có khoá thì ký được danh tính của bất kỳ khách nào (xem đơn của họ trong widget). Cùng mức tin cậy với việc họ đã có quyền quản trị cửa hàng, nhưng cần biết.
- **Cặp (id, chữ ký)** nằm trong trang của chính khách đó, hết hạn sau 24 giờ.
- **Tên và email của khách** lấy từ Admin API cần app được đọc dữ liệu khách hàng (`read_customers`; với một số trường Shopify còn đòi Protected customer data). Nếu Shopify từ chối: khách vẫn được nhận diện và thấy đơn; tiêu đề dùng tên do theme gửi.
- **Đơn hàng của khách** được kéo về khi nhận diện lần đầu (tối đa 100 đơn gần nhất, đã có từ trước); lần mở đầu tiên có thể thấy danh sách trống vài giây.
- Không ảnh hưởng tenant khác.

## 5. Kiểm thử

- **Unit (`embed.service.spec.ts`, `shopify-proxy`):** chữ ký đúng + `shopify:` + tenant có Shopify → phiên `verified`, gắn đúng khách Shopify, có gọi kéo đơn; chữ ký sai → từ chối; quá 24 giờ / ở tương lai → từ chối; tenant không kết nối Shopify → hành vi cũ; khách đã xoá dữ liệu → vẫn là khách vãng lai; `name` chỉ lấp chỗ trống; `user id` thường không đổi hành vi; đường App Proxy cho kết quả như trước.
- **E2E:** một ca qua trang thử có `identify` đã ký (khoá của tenant test): tiêu đề "Hi, …", không có màn Verify ở Notifications.
- **Production:** bước 3 ở mục 3, trên bản Preview.

## 6. Cần chủ dự án quyết

1. **Duyệt hướng làm?** (Kèm xác nhận trang Configuration của app không có mục App proxy; nếu có thì thử cách A trước.)
2. **Hạn dùng của chữ ký:**
   - a. 24 giờ (khuyên dùng).
   - b. Không hết hạn (đơn giản hơn cho theme, nhưng một cặp bị lộ dùng được tới khi đổi khoá).
