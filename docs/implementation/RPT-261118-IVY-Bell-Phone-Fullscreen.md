# RPT-261118 — Kiểu chuông trên điện thoại: khung kín màn hình, chừa thanh menu dưới

Kế hoạch: [PLN-261118-IVY-Bell-Phone-Fullscreen](../plan/PLN-261118-IVY-Bell-Phone-Fullscreen.md), duyệt ngày 2026-11-18 (`1. ok 2. a 3. a`). Thiết kế: Figma `3050:24` (ảnh PNG do chủ dự án gửi). Ca kiểm thử: ivy-docs TEST-CASES, mục T17. Tiếp nối [RPT T17](RPT-261118-IVY-Bell-Panel-Follow-Header.md).

## 1. Thay đổi

Không có SQL, không đổi API, không đổi console, không đổi phần widget bên trong khung.

| Phần | File | Nội dung |
|---|---|---|
| Loader | `apps/widget/public/embed.js` | **Điện thoại (< 640px), kiểu chuông:** khung bắt đầu từ 0, không còn nằm dưới header. **Thanh menu dưới:** khoá mới `bottomBar` (CSS selector) trong đoạn mã cài; loader đo thanh đó mỗi lần đo lại, và nếu nó đang hiện ở đáy cửa sổ thì khung dừng ở mép trên của nó (điện thoại, thẻ trên máy tính bảng nhỏ, xoay ngang). **Bàn phím ảo:** trên điện thoại, khi `visualViewport` thấp hơn cửa sổ quá 120px và không phải đang phóng to, khung lấy đúng hộp còn nhìn thấy (`offsetTop`, `height`); bàn phím đóng thì trở lại. Tắt bằng `keyboardFit: false` |
| Unit | `apps/widget/test/embed-dock-geometry.test.mjs` | 9 ca mới, 2 ca cũ viết lại theo thiết kế |
| E2E | `e2e/tests/17-header-bell.spec.ts` | Trang thử có thanh menu 67px (ẩn từ 768px như theme). TC-17-06, 07 viết lại; thêm TC-17-08 |

Số đo dùng để thiết kế (bản Preview của theme nháp, 2026-11-18): `nav.mobile-nav` cố định ở đáy, cao 67px, `z-index: 29`, hiện dưới 768px, không ẩn khi cuộn, không cộng `safe-area-inset-bottom`; trang không khai báo `viewport-fit=cover`. Ảnh chụp production trên iPhone (Safari) do chủ dự án gửi cho thấy cùng thanh menu, nằm ngay trên thanh công cụ của Safari.

## 2. Việc của chủ dự án trên theme

Thêm một dòng vào đoạn mã trong `layout/theme.liquid` (GUIDE-261118 mục 4):

```liquid
    trigger: "#st-bell",
    bottomBar: ".mobile-nav"
```

Chưa có dòng này: trên điện thoại khung đã đi từ đỉnh màn hình, nhưng vẫn đè thanh menu.

## 3. Kiểm thử

| Loại | Kết quả (local, 2026-11-18) |
|---|---|
| Unit loader + widget (`node --test`) | 137 / 137 |
| E2E `test:ci` (desktop + mobile) | 141 / 141, gồm 9 lượt T17 |

**Trên bản Preview sau deploy** (theme nháp đã có `bottomBar`, 18 thiết bị giả lập, 2026-11-18):

| Nhóm | Kết quả |
|---|---|
| 12 điện thoại dọc (6 iPhone bằng WebKit, 6 Android bằng Chromium) | Khung từ 0 tới đúng mép trên thanh menu (ví dụ iPhone 15: 0 → 592 trên màn 659, thanh menu 592–659); có ✕; ô nhập của Chat kết thúc trên thanh menu 32px |
| iPhone 15 xoay ngang 734×343 | Khung 0 → 276, thanh menu 276–343 |
| Galaxy S24 xoay ngang 780×360 | Theme không hiện thanh menu (≥ 768px); khung 0 → 360 |
| Galaxy Tab S4, Tab S9 (640–712px) | Thẻ từ 183 (dưới header + 8) tới 863; thanh menu ở 957 / 1071, không chạm |
| iPad Mini, iPad Pro 11 | Thẻ từ 216 (dưới header 208 + 8); không có thanh menu |

Ghi chú: trên iPad giả lập bằng WebKit, khung mở sau khi chạm chuông 2,5–4 giây ở lần chạm đầu (khung talk chỉ được tải khi chạm chuông lần đầu). Hai lần đo đầu của tôi đọc kết quả ở giây thứ 4 nên thấy khung "chưa mở"; theo dõi từng mốc thì cả 4 lượt đều mở đúng chỗ. Độ trễ này có từ trước, không do thay đổi này; trên máy thật có thể khác.

**Không kiểm được bằng máy:** hành vi bàn phím ảo trên thiết bị thật. Giả lập không có bàn phím; phần này chỉ có test đơn vị cho phép tính. Chủ dự án cần thử trên một iPhone (Safari) và một máy Android (Chrome): gõ tin nhắn, đóng bàn phím, cuộn cho thanh địa chỉ co lại, xoay máy.

**Không đo được từ thiết kế:** chỉ có ảnh PNG của frame (kết nối Figma hết lượt gọi), nên px, màu và cỡ chữ bên trong khung không được đối chiếu lại; chỉ vị trí và kích thước khung được làm theo ảnh.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit / CI | `4b367fee` · IVY CI/CD run `44261500605` xanh (2026-11-18) |
| Server `talkaibotprd01` | ✅ loader mới được phục vụ từ 07:53 UTC ngày 2026-11-18 |
| Dòng `bottomBar` trên theme nháp | ✅ chủ dự án đã thêm (2026-11-18) |
| Kiểm lại trên Preview sau khi có dòng `bottomBar` | ✅ xem mục 3 |
| Thử trên máy thật | ⏳ chủ dự án |
