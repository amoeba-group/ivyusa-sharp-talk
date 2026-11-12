# RPT-261112 — IVY T08 · Chat home (lời chào IVY, 7 nút trả lời nhanh có emoji, ô nhập)

Kế hoạch: [PLN-261112-IVY-T08](../plan/PLN-261112-IVY-T08-Chat-Home.md), duyệt ngày 2026-11-12. Task: ivy-docs/TASKS.md T08. SPEC: SCR-IVY-10, G-12, G-13, G-14, BR-11, Q-07, Q-13, Q-14.

**Quyết định của chủ dự án (2026-11-12):**
1. Duyệt kế hoạch.
2. Placeholder "Ask Anything" là **trường mới của tenant**; tenant khác giữ "Type a message…".
3. Cấu hình production nhập **trong console** theo hướng dẫn: [GUIDE-261112-IVY-Chat-Home-Config](../guide/GUIDE-261112-IVY-Chat-Home-Config.md).
4. Chủ dự án gửi ảnh thiết kế (KO) để đối chiếu.

## 1. Thay đổi (không có migration: `emoji` nằm trong cột JSON `scenario_buttons` có sẵn)

### Dùng chung và API

| File | Nội dung |
|---|---|
| `packages/types/src/api/widget.types.ts` | `ScenarioButtonResponse.emoji?`, `WidgetCopy.composerPlaceholder?` |
| `ai-engine/ai-config.service.ts`, `entity/tenant-ai-config.entity.ts`, `dto/request/ai-config.request.ts` | Lưu và trả `emoji` (cắt khoảng trắng, tối đa 16 đơn vị, cắt theo ký tự trọn vẹn). **BUG-022:** `sanitize()` giữ `message` của nút (tối đa 300) |
| `tenant/*` (entity, DTO, service, mapper, response), `session/session.service.ts` | `composerPlaceholder` trong widget copy, 6 ngôn ngữ, như các bag khác |
| `database/seed.runner.ts` | Preset IVY:<br>• lời chào 6 ngôn ngữ (`firstVisit` = `loginGreeting`);<br>• placeholder;<br>• `quickReplyStyle: card`;<br>• `disclosurePlacement: bottom`;<br>• 7 nút + emoji.<br>Chỉ áp cho DB mới (local / CI) |

### Widget

| File | Nội dung |
|---|---|
| `chat/ScenarioMenu.tsx` | Kiểu "card" = chip trắng, viền 1px, bo tròn, chữ 13px, emoji đầu (không có thì icon như cũ), wrap theo chữ; `data-testid="quick-replies"` |
| `chat/ChatTab.tsx` | Placeholder từ `widgetCopy.composerPlaceholder`, không có thì dùng i18n. Menu chỉ vẽ khi đã biết kiểu nút (BUG-023) |
| `store/widgetStore.ts`, `hooks/useSession.ts` | Cờ `tenantConfigLoaded`, bật khi session/ensure trả về hoặc lỗi |

### Console

| File | Nội dung |
|---|---|
| `ai-settings/AiSettingsPage.tsx`, `ai-settings.service.ts` | Ô **Emoji** trước ô Label của mỗi nút |
| `settings/SettingsPage.tsx`, `settings.service.ts` | Ô **Chat input placeholder** (6 ngôn ngữ) trong widget copy |
| `i18n/locales/*/aiSetting.json`, `settings.json` ×6 | Nhãn mới. Kiểu card đổi tên thành "White outlined chips (emoji or icon)" cho đúng hình mới |

### Test và tài liệu

| File | Nội dung |
|---|---|
| `apps/api/.../ai-config.service.scenario-emoji.spec.ts` (mới) | 4 ca: emoji + message được giữ, message dài, emoji / message trống, cắt emoji không vỡ ký tự, emoji có tông da |
| `apps/api/.../tenant.service.spec.ts` | +1 ca placeholder |
| `e2e/fixtures/ivy-data.ts`, `mock-api.ts` | Mock trả nhãn nút theo `language` như API (KO dùng nhãn thiết kế) |
| `e2e/tests/08-chat-home.spec.ts` | TC-08-03: KO ≥ 3 chip / hàng (như thiết kế), EN chip rộng theo chữ, đọc style bằng poll. Thêm TC-08-06 (lần vẽ đầu đã đúng kiểu) |
| `e2e/package.json` | `test:ci` thêm `@T08` |
| `docs/guide/GUIDE-261112-IVY-Chat-Home-Config.md` (mới) | Hướng dẫn nhập cấu hình production, có bảng giá trị để copy, phần kiểm tra và hoàn tác |
| `ivy-docs/{TASKS,TEST-CASES,BUGS,SPEC}.md`, GUIDE CI §7, PLN | Trạng thái, kết quả. BUG-022, BUG-023 (Fixed). SPEC: SCR-IVY-10, selector quick-reply ✅, G-12/13/14 ✅ |

**Khác kế hoạch:**
- **BUG-023 (thêm):** lần đầu vào, khách đã đăng nhập thấy menu kiểu mặc định rồi đổi sang chip trắng. TC-08-06 bắt được lỗi này: bỏ cơ chế chờ thì đỏ 6/6. Đã sửa.
- **BUG-022 (thêm):** phát hiện khi thêm `emoji` vào đúng hàm này; đã thử thật ở local trước khi sửa.
- **Đổi tên nhãn** "Icon cards" trong console thành "White outlined chips (emoji or icon)".

## 2. Kiểm thử (local, 2026-11-12)

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit`: api, widget, web, types, e2e | sạch |
| `vite build` widget, web | OK |
| Jest API (ai-engine, tenant, session, notification, order) | 49 suite, **493/493** |
| Jest `packages/types` | **202/202** |
| `node --test apps/widget/test/*.mjs` | **101/101** |
| `npm run i18n:check` (widget + console) | đủ 6 ngôn ngữ |
| `radius:check` (container Linux) | sạch |
| `@T08` | **6/6** (baseline 1/5); lặp ×4 với 3 worker: 24/24 |
| Cổng CI mới (thêm `@T08`), `--repeat-each=2` | **140/140** |
| Toàn bộ desktop | **82 pass / 15 fail** (trước T08: 77 / 19). Mọi ca đỏ thuộc T09–T12 chưa làm |

**Seed:** chạy vào DB tạm `db_t08_seedcheck`, ra đúng:
- lời chào KO, placeholder "Ask Anything";
- `card` + `bottom`;
- 7 nút (💰 … "Contact Support").

Sau đó đã xoá DB tạm.

**API thật (local):** nhập cấu hình IVY qua đúng các endpoint console dùng (`PATCH /tenants/widget-settings`, `PATCH /tenants/widget-theme`, `PUT /ai-config`), đọc lại đúng 6 ngôn ngữ.
- Trong lúc kiểm tra BUG-022, mình ghi đè cấu hình nút của tenant local trước khi có bản sao lưu dùng được (bản đọc ra bị lỗi bảng mã). Đã khôi phục đúng 6 nút mặc định của code (trùng id, thứ tự, nhãn EN với bản cũ). Sau đó tenant local nhận cấu hình IVY.
- Tài khoản `dev@amoeba.group` được tạm tắt cờ "phải đổi mật khẩu" để đăng nhập test, rồi bật lại.

**Ảnh chụp 380px (KO / EN / VI):** KO khớp ảnh thiết kế:
- 3 chip mỗi hàng;
- bong bóng chào xám, không avatar;
- ô nhập "무엇이든 물어보세요", dòng công bố AI dưới ô nhập.

## 3. Ghi chú cho production

- **Code có hiệu lực sau deploy, nhưng màn Chat của IVY chỉ đổi khi chủ dự án nhập cấu hình** theo [GUIDE-261112-IVY-Chat-Home-Config](../guide/GUIDE-261112-IVY-Chat-Home-Config.md), khoảng 15 phút.
  - Trước đó widget vẫn như hiện tại.
  - Riêng lỗi chớp kiểu menu (BUG-023) được sửa ngay.
- **Nút My Orders / Affiliate:** màn đầu trong thiết kế không có hai nút này. GUIDE nêu 2 lựa chọn (tắt cho đúng thiết kế, hoặc giữ sau 7 nút) cho tới khi T09 / T12 chốt.
- **Tenant khác:**
  - kiểu "chip" không đổi;
  - kiểu "card" đổi sang chip trắng tròn, vẫn có icon;
  - không đặt placeholder thì vẫn "Type a message…".
- **App mobile:** `emoji` là trường thêm vào.
- **BUG-022** có hiệu lực ngay: câu hỏi của nút "Send a message" không còn mất khi lưu.
- Không có SQL, không có migration, không gửi push / email / SMS.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Commit | ⏳ điền sau khi push lên `deploy/talk-ivyusa` |
| CI | ⏳ |
| Server `talkaibotprd01` | ⏳ Chủ dự án kiểm tra bằng `tail -n 30 ~/ivy-autodeploy.log` |
| SQL / migration | Không có |
| Cấu hình console | ⏳ Chủ dự án làm theo GUIDE sau khi deploy |
