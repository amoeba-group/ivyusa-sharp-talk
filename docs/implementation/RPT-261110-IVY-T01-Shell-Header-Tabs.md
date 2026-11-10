# RPT-261110 — IVY T01 · Shell panel, header "Hi, {firstName}", 2 tab

Kế hoạch: [PLN-261110-IVY-T01](../plan/PLN-261110-IVY-T01-Shell-Header-Tabs.md) (đã duyệt 2026-11-10) · Task: ivy-docs/TASKS.md T01 · SPEC SCR-IVY-01..03, G-01..G-03.

## 1. Thay đổi

| File | Nội dung |
|---|---|
| `apps/widget/src/lib/copy.ts` | Thêm `firstNameOf(name)` (lấy từ đầu tiên) và `greetingFor(template, name)` (thay `{firstName}` rồi `{name}`) |
| `apps/widget/src/components/widget/WidgetPanel.tsx` | Tiêu đề khi khách đã nhận diện dùng `greetingFor`. Mặc định `Hi, {{name}}` giữ nguyên |
| `apps/widget/test/header-greeting.test.mjs` (mới) | 5 test: first name, CJK/rỗng, `{firstName}`, `{name}` không đổi (tenant khác), kết hợp/lặp |
| `packages/types/src/api/widget.types.ts` | Comment `headerGreeting`: `{name}` / `{firstName}` |
| `apps/web/src/i18n/locales/{en,es,ko,vi,ja,zh}/settings.json` | `headerGreetingHint` giải thích `{firstName}` |
| `apps/api/src/database/seed.runner.ts` | `IVY_WIDGET_PRESET`: 2 tab, `design {radius:'lg', panel 380×600}`, greeting `{firstName}` ở 6 ngôn ngữ. **Chỉ áp khi tạo mới tenant** |
| `e2e/tests/01-shell-header.spec.ts` | **TC-01-08 ×11**: storefront giả nhúng `embed.js` thật; đo panel trên PC, laptop, tablet, điện thoại, điện thoại xoay ngang |
| `e2e/package.json` | `test:ci` thêm `@T01` |
| `e2e/fixtures/mock-api.ts` | BUG-014: route handler bỏ qua lỗi teardown (`Response has been disposed`…) thay vì làm fail test đã pass |
| `ivy-docs/{TASKS,TEST-CASES}.md`, `docs/guide/GUIDE-261110-IVY-CICD.md` §7, PLN | Trạng thái, kết quả. Ghi chú cho T08: bong bóng chào trong Chat vẫn dùng họ tên đầy đủ |

Không có thay đổi API, DB hay migration.

## 2. Kiểm thử (local, 2026-11-10)

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit`: api, widget, types, e2e | sạch |
| `node --test apps/widget/test/*.mjs` | 64/64 (5 test mới) |
| `npm run i18n:check` | đủ 6 ngôn ngữ |
| `@T01` TC-01-01..07 | **7/7** (baseline 4/7) |
| `@devices` TC-01-08 ×11 | **11/11**. Bảng kích thước: ivy-docs/TEST-CASES.md §T01 (PC/tablet 380×600, điện thoại nhỏ toàn màn hình, điện thoại lớn bottom-sheet 680, xoay ngang 380×370) |
| Toàn bộ desktop | 37 pass / 48 fail. Ca đỏ là các task chưa làm. 2 ca vốn xanh bị fail do lỗi chập chờn của harness (BUG-014) |
| Sau khi sửa BUG-014 (`e2e/fixtures/mock-api.ts`): mọi ca vốn xanh + T01, `--repeat-each=2` | **78/78** (39 ca: 25 ca baseline desktop + 14 ca mới của T01). Không có regression |
| Cổng CI mới `@smoke\|@T00\|@T01\|@T13` trên GitHub ([run 42757271526](https://github.com/amoeba-group/ivyusa-sharp-talk/actions/runs/42757271526), DB seed mới) | **28/28** (preset seed cho đúng 2 tab, 380px, "Hi, Kiho"); verify ✅ |

Đã kiểm tra bằng mắt qua ảnh chụp: laptop 1366×768, iPhone 15, điện thoại xoay ngang.

## 3. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Commit | `b50304f6` trên `deploy/talk-ivyusa` |
| CI | ✅ run 42757271526, xong khoảng 04:44Z |
| Server `talkaibotprd01` | ✅ **Lần deploy thật đầu tiên do cron chạy**: bắt đầu 04:44:02Z, xong **04:45:34Z** (log `/home/appops/sharptalk-deploy-20261110-044402-b50304f6.log`).<br>• `deploy-self-hosted.sh` in `Deployed.`, tức đã qua kiểm tra health, widget 200, console 200 và boot log.<br>• Tạo lại: `sharptalk_api` (healthy), `sharptalk_web`, `sharptalk_widget`.<br>• Giữ nguyên: mysql, redis, rabbitmq, qdrant, nginx (*Up 10 days*).<br>• Mốc `deployed` = `b50304f6`. |
| Cấu hình production (PLN §5) | ⏳ Chủ dự án làm trong console **sau khi** code mới chạy: tab, Corners Large, width 380, greeting `{firstName}` ở 6 ngôn ngữ |
| SQL / migration | Không có |
