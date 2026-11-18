# GUIDE-261118 — Cài widget lên ivyusa.com theo kiểu chuông trên header

Dành cho: người sửa theme Shopify của ivyusa.com, và quản trị console (tài khoản Master của tenant ivyusa).

Thiết kế (Figma `1006:2431`) mở khung talk bằng **biểu tượng chuông trên header**, cạnh giỏ hàng, có chấm đỏ ghi số chưa đọc. Không có nút tròn nổi ở góc phải dưới. Trong hệ thống, kiểu này gọi là **trigger mode**. Không cần sửa code; chỉ cần hai việc, **theo đúng thứ tự**:

| # | Việc | Ai làm | Ở đâu |
|---|---|---|---|
| 1 | Thêm chuông vào header và dán đoạn mã widget | Người sửa theme | Shopify admin → Online Store → Themes |
| 2 | Chuyển Launcher mode sang kiểu chuông | Master | `talk.ivyusa.com` → Tenant Settings → Widget |

> ⚠️ **Làm 1 trước, 2 sau.** Làm ngược thì không hỏng (widget tự quay về nút tròn khi không tìm thấy chuông), nhưng trông như chưa chuyển được.

Bản hướng dẫn cũ cho store thử trên staging: [GUIDE-260920](GUIDE-260920-Ivyusa-Custom-Widget-Apply.md) (tiếng Hàn, theme Dawn). Bản này dành cho production và theme thật.

## 1. Hiện trạng ivyusa.com (đo ngày 2026-11-18)

| Mục | Giá trị |
|---|---|
| Theme | `IVYUSA - Ceramide (Original)`, nền Hyper 1.3.1 |
| Đoạn mã widget | **Chưa có** |
| Chuông trên header | **Chưa có** |
| Nhóm biểu tượng bên phải header | `div.header__buttons`, có 2 con: `a.account-button`, `a.cart-drawer-button` |
| Header trên desktop (1440px) | Cao **91px**. Ở đầu trang nằm từ 80px tới **171px** (phía trên còn dải logo thương hiệu và thanh thông báo); khi cuộn thì dính ở 0 tới **91px** |
| Header trên điện thoại (390px) | Cao 110px; **ẩn đi khi cuộn xuống** |
| `https://ivyusa.com/apps/ivy/identity` | Trả **404** (xem mục 7) |

## 2. Làm trên bản sao của theme

Không sửa thẳng theme đang chạy.

1. Shopify admin → **Online Store → Themes**.
2. Ở theme đang dùng: **… → Duplicate**.
3. Ở bản sao: **… → Edit code**. Làm mục 3 và 4 trên bản sao này.
4. Xem thử bằng **Preview** của bản sao. Đạt hết mục 6 thì mới **Publish**.

## 3. Thêm chuông vào header

Trong trình sửa code của theme, tìm chuỗi `cart-drawer-button` để ra file vẽ header (thường là `sections/header.liquid` hoặc một snippet nó gọi). Tìm thẻ `<a … class="cart-drawer-button …"> … </a>` và dán đoạn sau **ngay sau thẻ đóng `</a>` của nó**, để chuông đứng cuối như trong thiết kế (tài khoản, giỏ hàng, chuông):

```liquid
<button id="st-bell" type="button" aria-label="Notifications">
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
       stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-2 8-2 8h16s-2-1-2-8"/>
    <path d="M13.7 20a2 2 0 0 1-3.4 0"/>
  </svg>
  <span data-sharptalk-badge style="display:none"></span>
</button>
<style>
  #st-bell{position:relative;display:inline-flex;align-items:center;justify-content:center;
    width:24px;height:24px;padding:0;border:0;background:none;
    color:currentColor;cursor:pointer}
  #st-bell [data-sharptalk-badge]{position:absolute;top:-6px;right:-8px;min-width:16px;height:16px;
    padding:0 4px;border-radius:8px;background:#E02B2B;color:#fff;font:600 10px/16px sans-serif;
    text-align:center}
</style>
```

- `id="st-bell"` là tên widget sẽ tìm. Đổi tên được, nhưng phải đổi giống hệt ở mục 4 và mục 5.
- `data-sharptalk-badge` là chỗ widget ghi số chưa đọc. Số bằng 0 thì chấm tự ẩn; quá 99 hiện `99+`.
- Chuông không cần `margin`: nhóm biểu tượng của theme đã tự cách nhau 16px (điện thoại) / 24px (desktop). Bản đầu của hướng dẫn này có `margin-left:12px`, làm chuông cách giỏ hàng xa hơn các biểu tượng khác; đã bỏ ngày 2026-11-18.
- Thẻ giỏ hàng trên desktop rộng 48px, trên điện thoại 24px. Kiểm chuông ở cả hai cỡ màn.

## 4. Dán đoạn mã widget

Mở `layout/theme.liquid`, dán ngay **trước** `</body>`:

```liquid
<!-- SharpTalk widget — IVY, header bell -->
<script>
  window.SHARPTALK_WIDGET_CONFIG = {
    shop: "ivyusa.myshopify.com",
    widgetUrl: "https://talk.ivyusa.com/widget",
    trigger: "#st-bell",
    bottomBar: ".mobile-nav"
  };
</script>
<script src="https://talk.ivyusa.com/widget/embed.js" defer></script>
```

- `shop` phải là **đúng** tên miền tenant đang dùng trên `talk.ivyusa.com`: `ivyusa.myshopify.com`. **Không** dùng `{{ shop.permanent_domain }}`: với cửa hàng này Shopify trả `chillhouse-wholesale.myshopify.com`, và production trả lỗi `E5005 Unknown shop domain` cho tên đó (kiểm ngày 2026-11-18).
- `bottomBar` là thanh menu dưới của theme trên điện thoại (`nav.mobile-nav`: Home · Shorts · My Bag · Beautizen · Round Table · My Ivy). Có dòng này thì khung talk dừng ở mép trên thanh menu; thiếu thì khung đè lên nó. Nếu theme đổi tên lớp của thanh menu, sửa giá trị này theo.
- Cả hai địa chỉ phải có `/widget`. Thiếu thì trang vẫn tải "thành công" nhưng không có widget.
- Nếu trong theme đã có khối `IVY_WIDGET_CONFIG` cũ thì xoá nó, không để hai khối cùng lúc.

## 4b. Nhận diện khách đã đăng nhập (để widget chào tên và hiện đơn hàng)

Thiếu bước này, widget coi mọi người là khách vãng lai: tiêu đề ghi tên cửa hàng, và Notifications / My Orders hiện màn "Verify your identity".

Đường App Proxy của Shopify không dùng được cho ivyusa.com (đã thử ngày 2026-11-18: Shopify không kết nối được tới `talk.ivyusa.com`, trả 504 sau 60 giây). Thay vào đó theme tự ký danh tính của khách:

1. Console → **Tenant Settings → Widget → Embed & SDK → Sign-in integration → Generate**. Khoá (`shtk_…`) chỉ hiện **một lần**; chép lại. Không gửi khoá qua chat hay email.
2. Trong `layout/theme.liquid`, dán khối sau **ngay trên** khối `SHARPTALK_WIDGET_CONFIG` của mục 4, thay `KHOÁ_BÍ_MẬT` bằng khoá vừa tạo:

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

- Khối này chỉ chạy khi khách đã đăng nhập. Khoá nằm trong mã Liquid và **không** xuất hiện trong trang gửi tới trình duyệt; người có quyền sửa theme thì đọc được nó.
- Chữ ký được tạo mới ở mỗi lần tải trang và có hạn **24 giờ**. Khách không thấy gì khác; một cặp (mã khách, chữ ký) bị chép ra ngoài thì hết dùng được sau một ngày.
- **Regenerate** trong console làm mọi chữ ký cũ mất hiệu lực ngay: phải thay khoá trong theme cùng lúc, nếu không khách lại thành vãng lai.
- `name` chỉ dùng để chào "Hi, {tên}" khi hệ thống chưa lấy được tên từ Shopify; email và đơn hàng luôn lấy từ Shopify theo mã khách đã ký.

**Kiểm:** đăng nhập ivyusa.com trên bản Preview, mở khung talk → tiêu đề "Hi, {tên}", tab Notifications không còn màn Verify, My Orders hiện đơn (lần đầu có thể trống vài giây trong lúc đơn được lấy về). Nếu vẫn là vãng lai: mở F12 → Network, tìm yêu cầu `embed/identify`; mã 401 nghĩa là khoá trong theme không khớp khoá trong console, hoặc đồng hồ ký lệch quá 24 giờ.

**App "Ivyusa Talk Proxy"** (cài lúc thử App Proxy) nên gỡ: khi nó còn, mỗi lần tải trang widget chờ thêm tối đa 5 giây cho một câu trả lời không bao giờ tới.

## 5. Chuyển kiểu mở trên console

Chỉ làm sau khi đã thấy chuông trên bản Preview.

`https://talk.ivyusa.com` → đăng nhập Master → **Tenant Settings → Widget** → thẻ **Widget theme**:

| Ô | Giá trị |
|---|---|
| **Launcher mode** | *Storefront header trigger — your own element (e.g. a bell icon) opens the widget, docked under the header* |
| **Trigger selector** | `#st-bell` |
| **Top offset (px)** | Xem bảng dưới |

Bấm **Save**, chờ thông báo lưu thành công.

Ở cùng trang, thẻ **Embed & SDK**, mục **Allowed domains**: thêm `https://ivyusa.com` và `https://www.ivyusa.com` nếu chưa có.

**Top offset** giờ chỉ là giá trị dự phòng. Từ 640px trở lên, khung tự bám theo thẻ `<header>` chứa chuông, cách mép dưới header 8px, và đi theo khi header dính, đổi cỡ hay ẩn. Trên điện thoại (dưới 640px), khung đi từ **đỉnh màn hình** xuống mép trên thanh menu dưới, đúng thiết kế `3050:24`. Top offset chỉ được dùng khi chuông không nằm trong thẻ `<header>` nào. Với ivyusa.com để 176 là được.

Nếu sau này header của theme không còn là thẻ `<header>`, thêm khoá `anchor: "<bộ chọn CSS của header>"` vào đoạn mã ở mục 4.

## 6. Kiểm tra

Mở bản Preview, tải lại trang bỏ cache (Ctrl+Shift+R). Lần tải đầu có thể còn dùng thiết lập cũ đã lưu trong trình duyệt.

| # | Kiểm | Kết quả đúng |
|---|---|---|
| 1 | Góc phải dưới | Không có nút tròn |
| 2 | Bấm chuông | Khung 380px mở bên phải, cách mép dưới header 8px; header khung có 🌐, ⚙, ✕ |
| 3 | Chấm đỏ trên chuông | Bằng số chưa đọc trong widget; 0 thì ẩn |
| 4 | Bấm ✕, bấm lại chuông, hoặc bấm ra ngoài khung | Khung đóng |
| 5 | Mở khung rồi cuộn trang | Khung đi theo header, luôn ngay dưới nó |
| 6 | Điện thoại dọc | Khung từ đỉnh màn hình (che header của trang) tới mép trên thanh menu dưới; thanh menu vẫn thấy và bấm được; ô nhập tin nằm trên thanh menu; có ✕ |
| 6b | Điện thoại, gõ tin nhắn | Bàn phím mở: header của khung và ô nhập đều còn thấy, ô nhập ngay trên bàn phím. Bàn phím đóng: khung trở lại như dòng 6. **Chỉ kiểm được trên máy thật** |
| 6c | Điện thoại xoay ngang; máy tính bảng nhỏ (640–767px) | Khung dạng thẻ bên phải, không đè thanh menu dưới |
| 7 | Console của trình duyệt (F12) | Không có cảnh báo `launcher trigger "#st-bell" was not found` |
| 8 | Trang đăng nhập của cửa hàng | Widget không hiện (đúng thiết kế) |

Nếu vẫn thấy nút tròn: widget không tìm thấy chuông. Nó chờ khoảng 3,6 giây rồi quay về nút tròn. Kiểm lại tên `#st-bell` ở cả ba chỗ (mục 3, 4, 5).

## 7. Điều cần biết trước khi Publish

**Đã thử trên theme nháp `Ivyusa Talk Staging` ngày 2026-11-18** (link Preview, desktop 1440×900 và cửa sổ 390×844): chuông hiện cạnh giỏ hàng; bấm mở panel IVY (2 tab, lời chào, 8 nút) ở 176px; bấm lại chuông và bấm ra ngoài đều đóng; không có nút tròn; cửa sổ hẹp có nút ✕ và đóng được. Chưa thử trên điện thoại thật, và chưa thử với khách đã đăng nhập.

- **Nhận diện khách đã đăng nhập** cần mục 4b. Chưa làm mục đó thì khách thấy tên cửa hàng ở tiêu đề và phải xác minh (Verify your identity / Guest order lookup) mới xem được đơn.
- **Trên điện thoại, header ẩn khi cuộn xuống**, nên chuông cũng ẩn theo; khách phải cuộn lên để thấy chuông. Đây là hành vi của theme. Khung đang mở không bị ảnh hưởng.
- **Bàn phím ảo:** khung tự co vừa phần màn hình còn thấy khi bàn phím mở. Nếu trên một dòng máy nào đó việc này gây giật hoặc sai vị trí, thêm `keyboardFit: false` vào đoạn mã ở mục 4 để tắt, rồi báo lại.
- **Test tự động** cho kiểu chuông (TC-17-01..07) chạy trên một trang dựng giống ivyusa.com, không chạy trên theme thật. Mục 6 vẫn phải kiểm bằng tay trên Preview, và trên điện thoại thật trước khi Publish.

## 8. Quay lại kiểu cũ

Console → **Tenant Settings → Widget → Widget theme → Launcher mode = Floating button (default)** → **Save**. Widget quay về nút tròn ngay; chuông trên header còn đó nhưng bấm không mở gì, có thể gỡ sau.

Gỡ hẳn widget: xoá khối ở mục 4 khỏi `layout/theme.liquid`.
