# RPT-261118 — Màn Chat của IVY theo đúng thiết kế: bỏ nút đính kèm, bỏ dòng dưới ô nhập, chữ trắng trên nền xanh

Kế hoạch: [PLN-261118-IVY-Chat-Composer-Match-Design](../plan/PLN-261118-IVY-Chat-Composer-Match-Design.md), duyệt ngày 2026-11-18 (`1. ok 2. a 3. a 4. a`). Chủ dự án xác nhận màu bong bóng trong Figma là `#2B7FFF`, trùng màu thương hiệu đang đặt.

## 1. Thay đổi

Không có SQL. Ba tuỳ chọn mới nằm trong JSON thiết kế widget sẵn có; mặc định giữ nguyên hành vi cũ cho mọi tenant.

| Tuỳ chọn (Custom widget) | Giá trị mới | Tác dụng |
|---|---|---|
| Attach button icon | `none` | Không vẽ nút đính kèm và ô chọn file |
| AI disclosure placement | `hidden` | Không vẽ dòng công bố AI ở cả hai vị trí; liên kết End chat mất theo |
| Text on brand colour (mới) | `auto` (mặc định) · `white` | `white`: chữ trên nền màu thương hiệu là trắng, **miễn là** trắng đạt từ 3:1 trở lên trên màu đó; dưới 3:1 thì bị bỏ qua và dùng quy tắc tự động. `#2B7FFF`: 3,7:1, được áp dụng. Vàng `#FFD400`: 1,4:1, bị bỏ qua |

| Phần | File |
|---|---|
| Kiểu dữ liệu, bộ chuẩn hoá, màu chữ | `packages/types/src/common/widget-theme.ts` (`ATTACH_ICON.NONE`, `DISCLOSURE_PLACEMENT.HIDDEN`, `ON_BRAND`, `brandForeground`) |
| API | `tenant.request.ts` (`on_brand`), `tenant.service.ts`, `widget-design.service.ts` (xuất / nhập thiết kế) |
| Seed | `seed.runner.ts`: tenant ivyusa mới có sẵn ba giá trị |
| Console | `WidgetDesignsCard.tsx`, `settings.service.ts`, `locales/*/settings.json` (7 khoá mới + 1 chú thích sửa, 6 ngôn ngữ) |
| Widget | `ChatTab.tsx` |
| Test | `widget-theme.spec.ts` (4 ca), `e2e/tests/08-chat-home.spec.ts` (TC-08-07, TC-08-08) |

Ngoài code: hướng dẫn cài chuông bỏ `margin-left:12px` (chuông cách giỏ hàng 28 / 36px thay vì 16 / 24px như các biểu tượng khác; đo trên bản Preview).

## 2. Điều chủ dự án đã được báo trước khi chọn

- **Dòng công bố AI** được SPEC ghi là "bắt buộc pháp lý" (Q-13, G-14). Sau khi bỏ, AI vẫn được nêu ở khung đồng ý lần đầu và ở Settings; trong lúc chat không còn dòng nhắc. Chủ dự án chọn bỏ (2a).
- **Chữ trắng trên `#2B7FFF` là 3,7:1**, dưới mức 4,5:1 của WCAG AA. Chủ dự án chọn theo thiết kế (3a).
- **Không còn gửi ảnh / file qua chat** (4a). Còn form Contact Support.

Khách kết thúc chat bằng nút End trong kịch bản, hoặc nút ✕ của khung.

## 3. Kiểm thử (local, 2026-11-18)

| Loại | Kết quả |
|---|---|
| `packages/types` `widget-theme.spec.ts` | 62 / 62 |
| API `src/domain/tenant`, `src/database` | 15 suite / 112 test |
| Widget `node --test` | 137 / 137 |
| E2E `test:ci` | 143 / 143 (TC-08-07, TC-08-08 mới) |
| Typecheck monorepo · `i18n:check` | sạch · đủ 6 ngôn ngữ |

Tenant local được đặt ba giá trị bằng tay (seed không ghi đè tenant đã có); CI seed DB mới nên nhận từ seed.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit / CI | ⏳ |
| Server `talkaibotprd01` | ⏳ (build lại `api`, `web`, `widget`) |
| Đặt ba tuỳ chọn cho tenant ivyusa trên production | ⏳ sau deploy, trong console |
| Kiểm trên bản Preview của theme nháp | ⏳ |
| Chủ dự án xoá `margin-left:12px` trên theme nháp | ⏳ |
