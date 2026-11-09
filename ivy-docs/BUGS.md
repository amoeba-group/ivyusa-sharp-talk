# IVY USA · TalkTalk Widget — BUGS

> Sổ theo dõi lỗi của đợt IVY widget. Lỗi sửa xong cần ghi kèm commit SHA. Lỗi có giá trị phòng ngừa thì viết thêm `docs/bug-fix/FIX-{YYMMDD}-{Topic}.md` theo quy trình bug-fix của CLAUDE.md (root cause → fix tối thiểu → prevention).
> Khác biệt thiết kế ↔ code **không** ghi ở đây; chúng nằm ở [SPEC.md §10](SPEC.md) (G-xx) và [TASKS.md](TASKS.md).

**Mức độ:** 🔴 High · 🟠 Medium · 🟡 Low  **Trạng thái:** Open · Workaround · Fixed · Won't fix · Need info

| ID | Tiêu đề | Khu vực | Mức | Trạng thái | Task |
|---|---|---|---|---|---|
| BUG-001 | Widget local gọi `localhost:5174/api/v1` → 404, không tạo được session | Env / Docs | 🟠 | Workaround (local) · docs Open | T00 |
| BUG-002 | `nest start --watch` trên Windows tự restart liên tục khi không có file nào đổi | Env | 🟠 | Workaround | T00 |
| BUG-003 | `POST /session/ensure` bị gọi 2 lần khi mở widget lần đầu → 2 session | Widget | 🟡 | Need info (prod?) | T01 |
| BUG-004 | talk.ivyusa.com trả 403 (AWS ELB) cho mọi đường dẫn từ máy dev | Infra / Access | 🔴 | Open | T16 |
| BUG-005 | Tài liệu nói production "chưa deploy", nhưng talk.ivyusa.com đã chạy production | Docs | 🟡 | Open | T16 |
| BUG-006 | `npm install` ở root viết lại `package-lock.json` (npm 10.9.2) | Tooling | 🟡 | Workaround | — |
| BUG-007 | `npm audit`: 64 lỗ hổng (4 critical, 26 high) | Security | 🟠 | Open (cần phân loại) | — |
| BUG-008 | `scripts/manual-screenshots.mjs` trỏ widget sang :5175 (cổng PWA) | Tooling | 🟡 | Open | — |
| BUG-009 | Lưu review thất bại bị nuốt lỗi, shopper không được báo gì | Widget | 🟠 | Open | T06 |
| BUG-010 | Điện thoại/email hỗ trợ của IVY hard-code trong cả 6 locale → hiện cho **mọi tenant** | Widget / Multi-tenant | 🟠 | Open | T11 |
| BUG-011 | Pill trạng thái hiển thị text server **chưa dịch**, màu đoán theo chữ | Widget / i18n | 🟡 | Open | T02 |

---

## BUG-001 · Widget local gọi sai API → 404
- **Hiện tượng:** mở http://localhost:5174 → `POST http://localhost:5174/api/v1/session/ensure` 404 → banner consent báo "We could not save your choice", nút Retry.
- **Nguyên nhân:** `apps/widget/src/lib/api-client.ts` chọn API base theo thứ tự `__SHOPTALK_CONFIG__` → `VITE_API_BASE_URL` → **same-origin**. Local thiếu `apps/widget/.env`, nên rơi vào same-origin. Vite :5174 không proxy `/api`. README "Quick start" không có bước copy `.env`.
- **Workaround (đã làm ở máy này):** `cp apps/widget/.env.example apps/widget/.env`. Vite tự restart và session trả 201.
- **Đề xuất fix:** thêm bước này vào README §6 + CLAUDE.md §5, **hoặc** thêm `server.proxy['/api'] → http://localhost:3000` vào `apps/widget/vite.config.ts` để chạy được mà không cần `.env`.

## BUG-002 · API dev restart "ảo" trên Windows
- **Hiện tượng:** log có 45 lần "File change detected. Starting incremental compilation…" trong khoảng 16:14–16:21, kéo theo nhiều lần "Nest application successfully started". Trong lúc restart, request bị `ERR_CONNECTION_REFUSED` (đã bắt được 1 lần ở `/session/consent`).
- **Bằng chứng:** `find apps/api packages -newer …` không thấy file nào bị sửa. Các lần restart trùng khung giờ một tiến trình khác đọc hàng loạt file trong `apps/api/src`, và dừng ngay khi tiến trình đó dừng. Nhiều khả năng do `fs.watch` của Windows bắn sự kiện khi file chỉ bị đọc.
- **Ảnh hưởng:** E2E thỉnh thoảng lỗi ngẫu nhiên (flaky) khi chạy song song với IDE/agent đang quét code.
- **Workaround:** khi chạy E2E dài, dùng API không watch: `npm run build -w @sharptalk/api && node apps/api/dist/main.js`.
- **Đề xuất:** cân nhắc `"watchOptions": { "watchFile": "useFsEventsOnParentDirectory" }` trong `apps/api/tsconfig.json` hoặc `nest start --watch --preserveWatchOutput` và kiểm lại.

## BUG-003 · `session/ensure` gọi 2 lần
- **Hiện tượng:** mỗi lần mở widget lần đầu có 2 request `POST /session/ensure`, mỗi cái trả **token khác nhau**. `session/opened` và `session/consent` dùng token thứ nhất.
- **Nghi vấn:** `React.StrictMode` (`apps/widget/src/main.tsx:33`) chạy effect 2 lần ở dev. Nếu bản build production cũng gọi 2 lần thì mỗi khách tạo 2 session, làm phồng analytics và gây rủi ro lệch token.
- **Cần làm:** kiểm trên bản build (`vite build && vite preview`) hoặc trên production. Nếu vẫn gọi 2 lần, dedupe bằng một promise dùng chung trong `useSession`.

## BUG-004 · talk.ivyusa.com 403
- **Hiện tượng:** `curl -I https://talk.ivyusa.com/` (cả `/widget/`, `/api/v1/health`, `/ivyusa`, `/admin/login`; HTTP lẫn HTTPS) → `403 Forbidden`, `Server: awselb/2.0`. DNS: 32.201.31.106, 52.4.26.102. Thời điểm: 2026-11-09 16:10 ICT.
- **Nhận định:** chặn ở ALB listener rule/WAF theo IP nguồn, không phải ở ứng dụng.
- **Ảnh hưởng:** không chạy được T16 (smoke production) từ máy này; không kiểm được BUG-003 trên production.
- **Cần:** thêm IP văn phòng/VPN vào allowlist, hoặc chạy `npm run test:prod` từ mạng đã được phép.

## BUG-005 · Tài liệu lệch thực tế deploy
- `/SPEC.md §12` và README §8 ghi production "not yet deployed / host TBD". Trong khi đó [RPT-261030](../docs/implementation/RPT-261030-Console-UX-Refresh.md) ghi production **talk.ivyusa.com** (EC2 `talkaibotprd01`) đã deploy `ff9bb663` ngày 2026-10-30. `deploy/profiles/SharpTalk-USA-IVY/CHECKLIST.md` cũng chưa tick host/domain.
- **Đề xuất:** cập nhật 3 chỗ trên ở T16 (CLAUDE.md §7: "khi giá trị vận hành đổi thì cập nhật CLAUDE/SPEC/CONFIG ngay").

## BUG-006 · Root lockfile bị viết lại
- `npm install` ở root với npm 10.9.2 xoá khoảng 675 dòng (các entry `peer`) trong `package-lock.json`. Nếu lỡ commit thì `npm ci` khi deploy dùng một cây phụ thuộc khác.
- **Workaround:** `git checkout -- package-lock.json` sau khi cài (đã làm). Không `git add -A`.
- **Đề xuất:** thống nhất phiên bản npm (`packageManager: npm@10.0.0` đã khai báo; bật corepack) hoặc dùng `npm ci` khi dựng môi trường.

## BUG-007 · Lỗ hổng phụ thuộc
- `npm install` báo 64 lỗ hổng (7 low, 27 moderate, 26 high, 4 critical).
- **Cần:** `npm audit --omit=dev` để tách lỗ hổng runtime khỏi dev-only, rồi lên kế hoạch nâng cấp. Không chạy `npm audit fix --force` trên nhánh deploy.

## BUG-008 · Script chụp màn hình trỏ sai cổng
- `scripts/manual-screenshots.mjs`: `const WID = 'http://localhost:5175'`. Đó là cổng PWA; widget dev chạy ở **5174**. Script cũng import `playwright` từ root, trong khi root chưa cài (chỉ có trong `e2e/`).

## BUG-009 · Lỗi lưu review bị nuốt
- `apps/widget/src/components/orders/ReviewForm.tsx:28`: `catch { /* ignore */ }`. Khi `POST /reviews` lỗi, nút trở lại bình thường mà không có thông báo. Điều này vi phạm quy tắc "UX feedback (MUST)" của CLAUDE.md §2.
- **Fix (T06):** toast lỗi (đóng thủ công) và toast thành công. Đã có TC-06-03.

## BUG-010 · Liên hệ hỗ trợ hard-code cho mọi tenant
- `apps/widget/src/i18n/locales/{en,es,ja,ko,vi,zh}.ts`: `contact.phone: '1588-0000'`, `contact.email: 'help@ivy.com'`, được `ContactCard.tsx:40-41` đọc ra. Hệ quả: tenant khác cũng hiển thị số/email của IVY.
- **Fix (T11):** lấy kênh liên hệ từ cấu hình tenant; locale chỉ giữ nhãn.

## BUG-011 · Pill trạng thái chưa dịch
- `apps/widget/src/components/ui/Badge.tsx` (43-52) đoán màu theo text; text là `statusBadge` / `statusUi` từ server, thường là tiếng Anh. Vì vậy UI tiếng Hàn vẫn hiện "In Transit".
- **Fix (T02):** map theo mã trạng thái → key i18n + màu cố định (SPEC §4).

---

## Design QA (gửi designer, không phải lỗi code)

| ID | Node | Vấn đề |
|---|---|---|
| DQ-01 | nhiều frame | "Today’s__", "Todays’__", "Yesterday’s__" là placeholder, cần chốt copy |
| DQ-02 | `1006:3046`, `1006:7499` | Nút ngôn ngữ ghi "KR", frame khác ghi "KO" (mã đúng: KO) |
| DQ-03 | `1006:3289` | "구독 해택" → **혜택** |
| DQ-04 | `1006:3046` … | "4월 전" (4 tháng trước?) cạnh "4일 전" / "4 Days ago", nhiều khả năng sai |
| DQ-05 | `993:2207` | 2 chip "??" sau 인기상품 chưa có nội dung |
| DQ-06 | `1006:7825` | Mục "Yesterday’s" lại có dòng "10mins ago" |
| DQ-07 | tên frame | "02.Pamyent", "03.Delievery" (chỉ là tên layer) |
