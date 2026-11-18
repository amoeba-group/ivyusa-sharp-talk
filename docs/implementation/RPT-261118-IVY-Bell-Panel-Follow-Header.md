# RPT-261118 — Kiểu chuông: khung bám theo header, có nút ✕ và nút ngôn ngữ (T17)

Kế hoạch: [PLN-261118](../plan/PLN-261118-IVY-Bell-Panel-Follow-Header.md), duyệt ngày 2026-11-18 (`1. ok 2. a 3. a`). Ca kiểm thử: ivy-docs TEST-CASES, mục T17. Cách cài: [GUIDE-261118](../guide/GUIDE-261118-IVY-Header-Bell-Install.md).

## 1. Thay đổi

Không có SQL, không đổi API, không thêm biến môi trường.

| Phần | File | Nội dung |
|---|---|---|
| Loader | `apps/widget/public/embed.js` | Ở kiểu chuông, mép trên của khung = mép dưới của thẻ `header` (hoặc `[role=banner]`) chứa chuông: desktop cộng 8px, điện thoại 0px. Đo lại khi mở, khi cuộn, đổi cỡ, xoay máy (một lần mỗi khung hình, thêm 30 khung hình sau sự kiện cuối để bắt kịp hiệu ứng của header dính). Header ra khỏi màn hình → khung từ 0. Dưới header còn chưa tới 360px → khung từ 0, cao kín cửa sổ. Khoá mới tuỳ chọn trong đoạn mã cài: `anchor` (CSS selector). Không có mốc → Top offset của console, như trước |
| Widget | `apps/widget/src/components/widget/WidgetPanel.tsx` | Kiểu chuông không còn ẩn nút ✕ và nút ngôn ngữ ở màn từ 640px trở lên. Nút ngôn ngữ theo thiết lập Header buttons của tenant |
| Console | `apps/web/src/i18n/locales/*/settings.json` (6 ngôn ngữ) | Chú thích dưới Top offset: chỉ dùng khi trang không có header để bám |
| Unit | `apps/widget/test/embed-dock-geometry.test.mjs` | 8 ca mới |
| E2E | `e2e/tests/17-header-bell.spec.ts` (mới), `e2e/package.json` | TC-17-01..07; `@T17` vào `test:ci` |

## 2. Khác kế hoạch

- **Điện thoại xoay ngang:** khung cao kín cửa sổ và phủ lên header, nhưng **không rộng kín** màn hình như wireframe: nó giữ dạng thẻ 380px ở bên phải. Lý do: bố cục điện thoại / thẻ được quyết định một lần khi tải trang (theo bề rộng dưới hay trên 640px), và máy xoay ngang rộng hơn 640px.
- **Chưa đối chiếu lại với Figma:** kết nối Figma hết lượt gọi trong ngày. Khoảng cách 8px là lựa chọn của chủ dự án (câu 2a), không phải số đo từ thiết kế. SPEC Q-17 giữ ghi chú này.

## 3. Kiểm thử

| Loại | Kết quả (local, 2026-11-18) |
|---|---|
| Unit loader + widget (`apps/widget`, `node --test`) | 129 / 129 |
| E2E `test:ci` (desktop + mobile) | 140 / 140, gồm 8 lượt T17 |
| Typecheck monorepo | sạch (9 / 9) |
| Build `@sharptalk/widget` | sạch |
| `i18n:check` | 6 ngôn ngữ đủ khoá |

**Trước khi sửa**, trên bản Preview của theme nháp `Ivyusa Talk Staging` (18 thiết bị giả lập: 9 iOS/iPadOS bằng WebKit, 9 Android bằng Chromium): 12 điện thoại dọc đạt; iPad Mini và iPad Pro 11 khung đè header 32px; iPhone 15 và Galaxy S24 xoay ngang khung chỉ cao 162–179px; mọi máy từ 640px trở lên không có ✕.

**Sau khi deploy** (cùng link Preview, 2026-11-18), 18 thiết bị giả lập:

| Nhóm | Kết quả |
|---|---|
| 12 điện thoại dọc | Khung sát dưới header (175px), tới đáy màn hình, có ✕, đóng được |
| iPad Mini, iPad Pro 11, iPad gen 7 | Khung ở 216px = dưới header 208 + 8; không còn đè; có ✕ |
| Galaxy Tab S4, Tab S9 | Khung ở 183px = dưới header 175 + 8; có ✕ |
| iPhone 15, Galaxy S24 xoay ngang | Khung từ 0, cao 343 / 360px (trước: 162 / 179); có ✕ |

Cuộn trang khi khung đang mở (header thật của ivyusa.com):

| Thiết bị | Đầu trang | Sau khi cuộn | Cuộn về |
|---|---|---|---|
| Desktop 1440×900 | header 171 → khung 179 | header 91 → khung 99 | 179 |
| iPhone 15 (WebKit) | header 175 → khung 175, cao 484 | header ẩn → khung 0, cao 659 (kín) | 175 |
| Pixel 7 | header 175 → khung 175, cao 664 | header ẩn → khung 0, cao 839 (kín) | 175 |
| iPad Pro 11 (WebKit) | header 208 → khung 216 | header ẩn → khung 0 | 216 |

Ở lượt chạy đầu, ngay lúc server vừa khởi động lại, iPad Mini và iPad Pro 11 hiện khung mặc định 3 tab; chạy lại thì đúng bản IVY 2 tab. Nhiều khả năng do API chưa sẵn sàng ở thời điểm đó; chưa xác minh.

Chưa kiểm trên thiết bị thật: việc của chủ dự án trước khi Publish theme.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit / CI | `564615dd` · IVY CI/CD run `44248374124` xanh (2026-11-18) |
| Server `talkaibotprd01` | ✅ loader mới được phục vụ từ 06:09 UTC ngày 2026-11-18 (`/widget/embed.js` có `dockAnchor`) |
| Ma trận 18 thiết bị trên Preview sau deploy | ✅ xem mục 3 |
| Theme đang chạy của ivyusa.com | Chưa cài chuông; theme nháp `Ivyusa Talk Staging` đã cài |
