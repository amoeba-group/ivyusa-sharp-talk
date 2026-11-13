# RPT-261113 — IVY T15 · Điện thoại & trợ năng

Kế hoạch: [PLN-261113-IVY-T15](../plan/PLN-261113-IVY-T15-Responsive-A11y.md), duyệt ngày 2026-11-13 (`1. ok 2. a 3. a`). Task: ivy-docs/TASKS.md T15. SPEC: SCR-IVY-01, NFR-02, NFR-03, NFR-04, G-23, G-24.

**Quyết định của chủ dự án:**
- **2a:** điện thoại màn cao cũng phủ kín màn hình.
- **3a:** chưa làm vuốt trái để xoá; trên điện thoại vẫn xoá bằng Chọn → "Delete Selected".

## 1. Thay đổi

**Không có SQL, không đổi API, không cần cấu hình.**

| Phần | File | Nội dung |
|---|---|---|
| Loader | `apps/widget/public/embed.js` | **D1:** loader quyết định "điện thoại" (`COMPACT`: màn < 640px) một lần, cùng lúc gắn `?compact=1`. Điện thoại: khung mở `100vw × 100dvh` (máy không có dvh: `100vh`). Có thanh đầu của shop (trigger mode): `calc(100dvh − offset)`. Trước đây điện thoại cao chỉ có khung tối đa 680px. Ô mở lần đầu, khi widget chưa báo kích thước, cũng tính ngay |
| Widget | `hooks/useStandalonePhone.ts` (mới), `widget/WidgetPanel.tsx` | **D2:** trang widget mở thẳng (không `?embed=1`, không app) trên màn < 640px → bố cục điện thoại; theo `matchMedia`, nên xoay máy thì đổi theo. Trong khung của loader không dùng chiều rộng của chính nó (FIX-260920) |
| Widget | `widget/WidgetPanel.tsx` | **D3:** `keepFocusInside()`: Tab qua nút cuối → về nút đầu; Shift+Tab trước nút đầu → về nút cuối. Bỏ qua tab đang ẩn và tab "roving" (`tabindex=-1`). Ra trang shop: ✕ hoặc Esc. Nút đang có focus mà bị gỡ / tắt / ẩn (ví dụ Accept của banner đồng ý) → focus về panel; Chrome không phát sự kiện nào cho việc này, nên widget theo dõi DOM của panel (`MutationObserver`). Khách tự bấm ra ngoài thì không giành lại |
| Unit | `apps/widget/test/embed-dock-geometry.test.mjs` | +5 ca: điện thoại kín màn (dvh, không dvh), lần mở đầu, điện thoại có thanh đầu shop, ≥ 640px không đổi |
| E2E | `01-shell-header.spec.ts` | TC-01-08: điện thoại < 640px giờ kỳ vọng kín màn hình (trước: bottom sheet 680) |
| E2E | `15-responsive-a11y.spec.ts` | TC-15-05 ×2 (Tab ×40, Shift+Tab, vòng lại nút đầu; bấm Accept bằng bàn phím → focus vẫn trong panel), TC-15-06 ×6 (điện thoại 390×844 qua `embed.js`, 6 ngôn ngữ: panel 390×844, không gì tràn / bị cắt ở 4 chip, Chat, Settings) |
| CI | `e2e/package.json` | `test:ci` thêm `@T15` và **project `mobile`**, để TC-15-01 (chỉ chạy trên mobile) vào cổng |
| Docs | ivy-docs (TASKS, TEST-CASES, SPEC, BUGS-029..030), GUIDE CI §7, PLN | |

**Khác kế hoạch:**
- Thêm project `mobile` vào `test:ci`. PLN chỉ ghi "thêm `@T15`", nhưng TC-15-01 chỉ chạy trên mobile, nên thiếu bước này thì nó không vào cổng.
- **Thêm sửa lỗi focus rơi ra ngoài khi nút biến mất.**
  - Chạy cổng CI ở local, TC-15-05 đỏ ngẫu nhiên: 1 lần; lặp 20 lần thì 2 lần đỏ.
  - Nguyên nhân: banner đồng ý biến mất đúng lúc nút Accept của nó đang có focus, nên focus rơi ra `<body>`.
  - Lỗi này cũng xảy ra với khách dùng bàn phím khi họ bấm Accept, nên mình sửa trong widget và thêm ca test riêng (TC-15-05 thứ 2). Không chỉ sửa test.

## 2. Kiểm thử (local, 2026-11-13)

| Loại | Kết quả |
|---|---|
| Typecheck / build widget | sạch / OK |
| Unit widget | **121/121** (thêm 5 ca loader) |
| E2E T15 + T01 (desktop + mobile) | **29/29** (trước khi thêm ca banner; sau đó cả cổng ở dưới) |
| Thử ngược | Gỡ phần sửa (widget + loader, giữ test) → đúng **8 ca đỏ**: TC-15-01 (380px), TC-15-05 (focus ra ngoài), TC-15-06 ×6 (cao 680). Ca banner: gỡ phần sửa → **3/3 đỏ**. Trả code lại → xanh |
| Lặp TC-15-05 ×2 | 20 lần mỗi ca, 4 luồng song song: **40/40** |
| `npm run test:ci` (desktop + mobile) | **132 / 132, chạy 2 lần (131 desktop + 1 mobile)** |
| E2E toàn bộ (desktop + mobile) | **132 / 132 — cổng CI giờ gồm mọi test desktop và mobile** |

## 3. Ghi chú cho production

- Không có SQL, không cần cấu hình. Push → CI xanh → server tự deploy (`embed.js` là file tĩnh của widget, đi cùng bản build).
- **Khách trên điện thoại (màn < 640px):**
  - panel phủ kín màn hình, kể cả iPhone 15 / Pixel 7 (trước: cao 680px, thấy trang shop ở trên);
  - ✕ và Esc đóng như cũ.
- **Người dùng bàn phím:** Tab chỉ đi vòng trong panel khi panel mở.
- **`talk.ivyusa.com/widget/` mở trên điện thoại:** thấy đúng bố cục điện thoại như trên ivyusa.com.
- **Cache của loader** (`docker/self-hosted/nginx*.conf`):
  - `/widget/embed.js` có `no-cache`, nên trình duyệt luôn hỏi lại server và nhận bản mới ngay.
  - `/widget/v1/embed.js` được cache tối đa 5 phút. Trang cài theo đường này có thể còn khung 680px thêm tối đa 5 phút. Không lỗi gì, chỉ là bố cục cũ.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit | ⏳ (điền sau khi push) |
| CI | ⏳ |
| Server `talkaibotprd01` | ⏳ |
| Cấu hình production | Không cần |
