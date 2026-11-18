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
    width:24px;height:24px;padding:0;margin-left:12px;border:0;background:none;
    color:currentColor;cursor:pointer}
  #st-bell [data-sharptalk-badge]{position:absolute;top:-6px;right:-8px;min-width:16px;height:16px;
    padding:0 4px;border-radius:8px;background:#E02B2B;color:#fff;font:600 10px/16px sans-serif;
    text-align:center}
</style>
```

- `id="st-bell"` là tên widget sẽ tìm. Đổi tên được, nhưng phải đổi giống hệt ở mục 4 và mục 5.
- `data-sharptalk-badge` là chỗ widget ghi số chưa đọc. Số bằng 0 thì chấm tự ẩn; quá 99 hiện `99+`.
- Kích thước, khoảng cách và màu chấm ở trên là điểm khởi đầu; chỉnh trong khối `<style>` cho khớp header thật. Tôi chưa xem được đoạn này chạy trên theme của IVY.
- Thẻ giỏ hàng trên desktop rộng 48px, trên điện thoại 24px. Kiểm chuông ở cả hai cỡ màn.

## 4. Dán đoạn mã widget

Mở `layout/theme.liquid`, dán ngay **trước** `</body>`:

```liquid
<!-- SharpTalk widget — IVY, header bell -->
<script>
  window.SHARPTALK_WIDGET_CONFIG = {
    shop: "ivyusa.myshopify.com",
    widgetUrl: "https://talk.ivyusa.com/widget",
    trigger: "#st-bell"
  };
</script>
<script src="https://talk.ivyusa.com/widget/embed.js" defer></script>
```

- `shop` phải là **đúng** tên miền tenant đang dùng trên `talk.ivyusa.com`: `ivyusa.myshopify.com`. **Không** dùng `{{ shop.permanent_domain }}`: với cửa hàng này Shopify trả `chillhouse-wholesale.myshopify.com`, và production trả lỗi `E5005 Unknown shop domain` cho tên đó (kiểm ngày 2026-11-18).
- Cả hai địa chỉ phải có `/widget`. Thiếu thì trang vẫn tải "thành công" nhưng không có widget.
- Nếu trong theme đã có khối `IVY_WIDGET_CONFIG` cũ thì xoá nó, không để hai khối cùng lúc.

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

**Chọn Top offset.** Panel được đặt cố định cách mép trên cửa sổ đúng số px này và **không đi theo header**. Header của ivyusa.com lại nằm ở hai vị trí khác nhau (bảng mục 1), nên phải chọn một trong hai:

| Giá trị | Ở đầu trang | Sau khi cuộn |
|---|---|---|
| **176** (khuyên dùng) | Panel nằm ngay dưới header | Panel cách header 85px |
| **96** | Panel **đè lên** nửa dưới header, che cả chuông | Panel nằm ngay dưới header |

Giá trị cho phép: 0 tới 240. **Áp dụng cho cả điện thoại**: ở đó panel rộng kín màn hình nhưng cũng bắt đầu từ đúng số px này, không phủ lên header (đo trên bản Preview ngày 2026-11-18, cửa sổ 390×844: panel từ 176px xuống đáy). Header điện thoại ở đầu trang kết thúc ở 176px nên 176 khít ở đó; khi cuộn xuống header ẩn đi và phía trên panel hở ra một dải trang.

## 6. Kiểm tra

Mở bản Preview, tải lại trang bỏ cache (Ctrl+Shift+R). Lần tải đầu có thể còn dùng thiết lập cũ đã lưu trong trình duyệt.

| # | Kiểm | Kết quả đúng |
|---|---|---|
| 1 | Góc phải dưới | Không có nút tròn |
| 2 | Bấm chuông | Panel 380px mở bên phải, dưới header |
| 3 | Chấm đỏ trên chuông | Bằng số chưa đọc trong widget; 0 thì ẩn |
| 4 | Bấm lại chuông, hoặc bấm ra ngoài panel | Panel đóng |
| 5 | Cuộn trang rồi bấm chuông | Panel vẫn mở đúng chỗ (theo bảng Top offset) |
| 6 | Điện thoại (hoặc cửa sổ hẹp hơn 640px) | Panel rộng kín màn hình, nằm dưới header, **có nút ✕** để đóng |
| 7 | Console của trình duyệt (F12) | Không có cảnh báo `launcher trigger "#st-bell" was not found` |
| 8 | Trang đăng nhập của cửa hàng | Widget không hiện (đúng thiết kế) |

Nếu vẫn thấy nút tròn: widget không tìm thấy chuông. Nó chờ khoảng 3,6 giây rồi quay về nút tròn. Kiểm lại tên `#st-bell` ở cả ba chỗ (mục 3, 4, 5).

## 7. Điều cần biết trước khi Publish

**Đã thử trên theme nháp `Ivyusa Talk Staging` ngày 2026-11-18** (link Preview, desktop 1440×900 và cửa sổ 390×844): chuông hiện cạnh giỏ hàng; bấm mở panel IVY (2 tab, lời chào, 8 nút) ở 176px; bấm lại chuông và bấm ra ngoài đều đóng; không có nút tròn; cửa sổ hẹp có nút ✕ và đóng được. Chưa thử trên điện thoại thật, và chưa thử với khách đã đăng nhập.

- **Trên desktop, panel mở từ chuông không có nút đổi ngôn ngữ và không có nút ✕.** Đó là hành vi hiện tại của trigger mode: đóng bằng cách bấm lại chuông hoặc bấm ra ngoài. Thiết kế header của panel (SCR-IVY-02) thì có cả hai nút. Chưa quyết theo bên nào: ivy-docs SPEC, G-26 và Q-17.
- **Khách đã đăng nhập ivyusa.com chưa được nhận ra tự động.** Widget hỏi `https://ivyusa.com/apps/ivy/identity` để biết khách là ai; địa chỉ này đang trả 404, tức App Proxy của app Shopify chưa được cấu hình. Cho tới khi có, khách thấy "Hi there" và phải xác minh (Verify your identity / Guest order lookup) mới xem được đơn. Đây là việc riêng, ngoài phạm vi bản hướng dẫn này.
- **Trên điện thoại, header ẩn khi cuộn xuống**, nên chuông cũng ẩn theo; khách phải cuộn lên để thấy chuông. Đây là hành vi của theme.
- **Bộ test tự động của IVY chạy kiểu nút tròn.** Kiểu chuông chưa có test trên widget IVY, nên mục 6 phải kiểm bằng tay.

## 8. Quay lại kiểu cũ

Console → **Tenant Settings → Widget → Widget theme → Launcher mode = Floating button (default)** → **Save**. Widget quay về nút tròn ngay; chuông trên header còn đó nhưng bấm không mở gì, có thể gỡ sau.

Gỡ hẳn widget: xoá khối ở mục 4 khỏi `layout/theme.liquid`.
