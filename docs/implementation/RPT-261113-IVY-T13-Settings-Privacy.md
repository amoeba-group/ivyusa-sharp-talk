# RPT-261113 — IVY T13 · Màn Settings / Privacy

Kế hoạch: [PLN-261113-IVY-T13](../plan/PLN-261113-IVY-T13-Settings-Privacy.md), duyệt ngày 2026-11-13. Task: ivy-docs/TASKS.md T13. SPEC: SCR-IVY-15, G-21, BR-18, Q-09.

**Quyết định của chủ dự án (2026-11-13, `1. ok 2. a 3. a`)**, kèm ảnh thiết kế EN `1004:1367`:
1. Duyệt kế hoạch.
2. Thanh đầu: **a**, thanh màu brand "← Settings".
3. Câu dưới toggle marketing: **a**, giữ đúng chữ thiết kế.

**Ảnh khác lựa chọn 2a.** Ảnh `1004:1367` giữ thanh đầu **trắng** "Hi, Kiho" (🌐 · ⚙ · ✕), có "← Back" trong nội dung và không có tiêu đề màn. Theo quy tắc PLN §7-4 ("ảnh khác §4 thì làm theo ảnh"), mình **giữ thanh đầu trắng** và không làm 2a. Nếu chủ dự án vẫn muốn thanh màu brand "← Settings", việc đó là một thay đổi nhỏ riêng. Ảnh KO `1004:1447` chưa có, nên chữ KO giữ bản dịch hiện có.

## 1. Thay đổi

**Không có SQL, không đổi API.**

| Phần | File | Nội dung |
|---|---|---|
| Widget | `settings/PreferencesPanel.tsx` | Cỡ chữ và khoảng cách theo ảnh: lề 24px, tiêu đề khối 16px semibold, dòng 14px, ghi chú 12px (line-height 20px), 28px giữa các khối, "← Back" 14px. Nút "Withdraw consent" **viền đỏ** (trước: viền xám), bo `st-md` (IVY 11px). Toggle **44×24**, `role="switch"` + `aria-checked` + tên của dòng (trước: nút 36×20 không tên). Bỏ icon trước dòng CCPA. Download / Delete 14px xám đậm, gạch chân |
| Widget | `widget/WidgetPanel.tsx` | Khi mở Settings: đường kẻ mảnh dưới thanh đầu (như ảnh). Nút ⚙ bỏ ô nền xám, trạng thái mở nói bằng `aria-pressed`. Vòng focus của ⚙ chỉ hiện khi dùng bàn phím (`focus-visible`), nên bấm chuột không để lại vòng xanh |
| Widget | `i18n/locales/*.ts` ×6 | `privacy.consent.withdrawHint` theo thiết kế: "If you withdraw, chat and AI processing stops immediately." (KO: 철회하면 채팅과 AI 처리가 즉시 중단됩니다.) |
| E2E | `13-settings.spec.ts` | **TC-13-05:** viền nút rút consent cùng màu đỏ với chữ; câu "stops immediately"; thanh đầu vẫn "Hi, Kiho", ⚙ `aria-pressed=true`. **TC-13-06:** 2 `switch` có tên, `aria-checked`, 44×24; bấm marketing → `PUT … {opt_out: true}` → "Preference saved." |
| Docs | ivy-docs (TASKS, TEST-CASES, SPEC G-21 / Q-09 / SCR-IVY-15), GUIDE CI §7, PLN | |

**Khác kế hoạch:**
- **Thanh đầu giữ trắng "Hi, Kiho"** theo ảnh, không làm 2a (ở trên). Vì vậy "← Back" vẫn nằm trong nội dung, nút 🌐 / ⚙ vẫn hiện. TC-13-05 kiểm thanh đầu giữ lời chào, không kiểm thanh "Settings".
- **Thêm** đường kẻ dưới thanh đầu và bỏ ô nền quanh ⚙ cho giống ảnh. PLN không ghi hai việc này.
- **Toggle có tên cho trình đọc màn hình** (`switch`). PLN chỉ nói về kích thước; đây là lỗi a11y tìm thấy khi sửa.

**Chưa làm (để T14):** tiếng Hàn đôi khi xuống dòng giữa chữ (ví dụ "요청에 / 만"). Đó là cách trình duyệt ngắt chữ Hàn mặc định. Sửa bằng `word-break: keep-all` cho riêng tiếng Hàn; nếu áp chung thì tiếng Nhật và tiếng Trung (không có dấu cách) sẽ không xuống dòng được.

## 2. Kiểm thử (local, 2026-11-13)

| Loại | Kết quả |
|---|---|
| Typecheck widget | sạch |
| Build widget | `vite build` OK |
| Unit widget | 112/112 |
| i18n | `npm run i18n:check`: đủ 6 ngôn ngữ |
| E2E T13 | 6/6; lặp ×3: 18/18 |
| E2E `@T01|@T13|@T15` | 27/27 (T01 có nút Back trong Settings, T15 có focus / Esc) |
| E2E toàn bộ desktop | **110 / 110** xanh |
| Ảnh chụp | EN khớp `1004:1367`: thanh đầu trắng + đường kẻ, Back 14px, tiêu đề 16px, nút viền đỏ bo ~11px, toggle 44×24, không icon trước CCPA, link dữ liệu 14px. KO cùng bố cục |

## 3. Ghi chú cho production

- Không có SQL, không cần cấu hình. Push → CI xanh → server tự deploy.
- **Mọi khách, ngay sau deploy:** màn Settings chữ to hơn, lề rộng hơn, nút rút consent viền đỏ, toggle lớn hơn, câu "stops immediately". Cách hoạt động của consent / marketing / CCPA / tải và xoá dữ liệu không đổi.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit | `08c5c9ac` trên `deploy/talk-ivyusa`, push 2026-11-13 (`00c526cf..08c5c9ac`) |
| CI | ✅ run 43377337772, xong 06:18:47Z: verify ✅, e2e gate ✅ (có `@T13`), deploy-gate ✅ |
| Server `talkaibotprd01` | ✅ **Đã deploy**, cùng bản `8b553779` (T14) mà chủ dự án xác nhận ngày 2026-11-13. Code T13 nằm trong bản đó |
| Cấu hình production | Không cần |
| Câu hỏi mở | ~~Thanh đầu Settings: giữ trắng hay làm 2a~~ → chủ dự án chọn **làm 2a** (2026-11-13), xem §5 |

## 5. Bổ sung: thanh đầu 2a (2026-11-13)

Chủ dự án trả lời câu hỏi mở bằng **"làm 2a"**. Wireframe đã có sẵn ở PLN §4 ("← Settings"), và phương án §7-2a được duyệt từ đầu, nên không cần kế hoạch mới.

| Phần | File | Nội dung |
|---|---|---|
| Widget | `widget/WidgetPanel.tsx` | Khi mở Settings: thanh đầu là "← Settings" + ✕ trên nền brand; ẩn lời chào, 🌐 và ⚙. ← và **Esc** quay về tab; Esc lần nữa mới đóng panel. Focus vào ← khi mở, về lại ⚙ khi đóng. Nút ⚙ bỏ `aria-pressed`, vì nó không còn là nút bật / tắt |
| Widget | `settings/PreferencesPanel.tsx` | Bỏ "← Back" trong nội dung (đã lên thanh đầu); lề trên 24px |
| Theme | `packages/types/src/common/widget-theme.ts` | `brandBarColors()`: nền thanh là sắc đầu tiên trong 500 → 700 của brand mà chữ trắng đạt 4,5:1. IVY (#2B7FFF): 500 chỉ 3,8:1, 600 là 4,4:1, nên dùng **700** (`#0063FA`, 5,0:1). Brand quá nhạt thì giữ màu brand và dùng chữ đậm. Kết quả nằm ở 2 biến `--ivy-bar-bg` / `--ivy-bar-fg` |
| Widget | `index.css`, `lib/theme.ts` | Giá trị mặc định của 2 biến (widget chưa có theme) và class `.st-header-settings`; `theme.ts` xoá 2 biến khi đổi tenant |
| Test | `widget-theme.spec.ts` (+2), `13-settings.spec.ts` | Unit: IVY → 700 + chữ trắng; brand đủ đậm giữ nguyên; brand nhạt → chữ đậm; mọi brand thử đều ≥ 4,5:1. E2E **TC-13-07**. TC-13-05 bỏ phần kiểm thanh đầu cũ |

**Vì sao không dùng đúng màu brand:**
- PLN ghi "nền màu brand, chữ trắng". Nhưng chữ trắng trên chính #2B7FFF chỉ đạt 3,8:1, dưới chuẩn đọc AA (4,5:1).
- Hệ thống theme vì vậy tự đổi sang chữ đậm. Ảnh chụp lần đầu ra chữ tối trên nền xanh, khác thiết kế.
- Dùng sắc đậm hơn của chính màu brand thì giữ được chữ trắng như thiết kế (SPEC §4: xanh #2563EB, chữ trắng) mà vẫn đạt chuẩn.

**Kiểm thử:**
- Unit widget 116/116; theme 37/37; typecheck sạch.
- E2E `@T01|@T13|@T14|@T15` 48/48. Toàn bộ desktop **123/123**.
- Mobile: chỉ TC-15-01 đỏ, có từ trước, việc của T15.
- Ảnh chụp EN / KO / VI: nền xanh đậm, "← Settings" và ✕ màu trắng.

**Ảnh hưởng:**
- Mọi khách mở Settings thấy thanh màu brand "← Settings" thay cho lời chào. 🌐 và ⚙ chỉ hiện ở các tab.
- Esc trong Settings quay về tab, không đóng panel nữa.
- Tenant khác cũng nhận thay đổi này (code dùng chung).

| Deploy | Trạng thái |
|---|---|
| Commit | `4eaf37e5` trên `deploy/talk-ivyusa`, push 2026-11-13 09:02Z (`a20ca0d9..4eaf37e5`) |
| CI | ✅ run 43397967051, xong 09:06:29Z: verify ✅, e2e gate ✅ (có `@T13`), deploy-gate ✅ |
| Server | ⏳ **Chưa xác nhận.** Cron deploy vài phút sau khi CI xanh. Chủ dự án kiểm tra bằng `tail -n 3 ~/ivy-autodeploy.log`: tìm `4eaf37e5 deployed` |

