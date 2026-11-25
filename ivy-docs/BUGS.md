# IVY USA · TalkTalk Widget — BUGS

> Sổ theo dõi lỗi của đợt IVY widget. Lỗi sửa xong cần ghi kèm commit SHA. Lỗi có giá trị phòng ngừa thì viết thêm `docs/bug-fix/FIX-{YYMMDD}-{Topic}.md` theo quy trình bug-fix của CLAUDE.md (root cause → fix tối thiểu → prevention).
> Khác biệt thiết kế ↔ code **không** ghi ở đây; chúng nằm ở [SPEC.md §10](SPEC.md) (G-xx) và [TASKS.md](TASKS.md).

**Mức độ:** 🔴 High · 🟠 Medium · 🟡 Low  **Trạng thái:** Open · Workaround · Fixed · Won't fix · Need info

| ID | Tiêu đề | Khu vực | Mức | Trạng thái | Task |
|---|---|---|---|---|---|
| BUG-001 | Widget local gọi `localhost:5174/api/v1` → 404, không tạo được session | Env / Docs | 🟠 | Workaround (local) · docs Open | T00 |
| BUG-002 | `nest start --watch` trên Windows tự restart liên tục khi không có file nào đổi | Env | 🟠 | Workaround | T00 |
| BUG-003 | `POST /session/ensure` bị gọi 2 lần khi mở widget lần đầu → 2 session | Widget | 🟡 | Dev only: bản build gọi 1 lần (kiểm 2026-11-12, T10). Test consent thật dùng `acceptConsent()` | T01 · T10 |
| BUG-004 | talk.ivyusa.com trả 403 (AWS ELB) cho curl / Node; trình duyệt cùng máy vào được. `npm run test:prod` dừng ở bước kiểm tra đầu | Infra / Access · E2E harness | 🟠 | Fixed harness (2026-11-17): `test:prod` không còn bước kiểm tra bằng Node, chạy nguyên bản 3/3. Việc production trả 403 cho client không phải trình duyệt: giữ nguyên, chưa hỏi quản trị AWS | T16 |
| BUG-005 | Tài liệu nói production "chưa deploy", nhưng talk.ivyusa.com đã chạy production | Docs | 🟡 | Fixed (T16, 2026-11-17): README, SPEC, CLAUDE, CONFIG. `CHECKLIST.md` của IVY chờ kết quả xác minh server | T16 |
| BUG-006 | `npm install` ở root viết lại `package-lock.json` (npm 10.9.2) | Tooling | 🟡 | Workaround | — |
| BUG-007 | `npm audit`: 64 lỗ hổng (4 critical, 26 high) | Security | 🟠 | Open (cần phân loại) | — |
| BUG-008 | `scripts/manual-screenshots.mjs` trỏ widget sang :5175 (cổng PWA) | Tooling | 🟡 | Open | — |
| BUG-009 | Lưu review thất bại bị nuốt lỗi, shopper không được báo gì | Widget | 🟠 | Fixed (T06) | T06 |
| BUG-010 | Điện thoại/email hỗ trợ của IVY hard-code trong cả 6 locale → hiện cho **mọi tenant** | Widget / Multi-tenant | 🟠 | Fixed (T11, 2026-11-13) | T11 |
| BUG-011 | Pill trạng thái hiển thị text server **chưa dịch**, màu đoán theo chữ | Widget / i18n | 🟡 | Fixed: feed thông báo (T02), thẻ giao hàng (T03), Order Detail (T04), chip Review (T06), thẻ đơn trong chat + danh sách đơn + feed inquiry (T09) | T02 · T03 · T04 · T06 · T09 |
| BUG-012 | `radius:check` và `check-migrations --check` báo đỏ trên Windows dù CI (Linux) xanh | Tooling | 🟡 | Open (CI không ảnh hưởng) | T00-d |
| BUG-014 | E2E chập chờn: "apiResponse.json: Response has been disposed" làm fail test đã pass | E2E harness | 🟡 | Fixed (T01) | T01 |
| BUG-015 | Feed thông báo hiện mỗi sự kiện **tới 5 lần** (1 dòng cho mỗi kênh in_app/email/sms/web_push/push) và badge đếm cả 5 | API | 🟠 | Fixed (T02) | T02 |
| BUG-016 | Fixture e2e "hôm qua" = 26 giờ trước → TC-02-02 đỏ từ 00:00–02:00 giờ New York | E2E harness | 🟡 | Fixed (T02) | T02 |
| BUG-017 | TC-03-05 đọc URL của tab mới trước khi tab điều hướng → luôn nhận chuỗi rỗng (TC-05-04 cùng lỗi) | E2E harness | 🟡 | Fixed (T03, T05, T06) | T03 · T05 · T06 |
| BUG-018 | TC-01-06 đo độ rộng panel ngay khi mở → đỏ 11/15 khi chạy song song (panel mở ở 404px trước khi theme 380px về) | E2E harness · Widget | 🟡 | Fixed test (T03). Chớp 404→380px khi mở rất sớm: Open, mức thấp | T01 · T03 |
| BUG-025 | Chip **End** (`end_chat`) báo "Sorry, that didn't go through": widget gửi nó lên server như một kịch bản không tồn tại | Widget | 🟡 | Fixed (T12, 2026-11-13) | T12 |
| BUG-024 | Khung trả lời trong chat (My Orders, Contact, Affiliate…) nằm ở **một ô cố định cuối luồng**, nên tin nhắn gửi sau hiện **phía trên** nó | Widget | 🟡 | Fixed cho My Orders + Start over (T09), Product Help (T10), Contact (T11), Affiliate (T12). Còn Callback | T09 · T11 · T12 |
| BUG-022 | Lưu nút trả lời nhanh trong console **làm mất câu hỏi** (`message`) của nút "Send a message": `sanitize()` dựng lại nút mà không có trường này, nên nút luôn gửi nhãn thay câu đã nhập | API | 🟠 | Fixed (T08) | T08 |
| BUG-023 | Lần đầu mở Chat (khách đã đăng nhập, chưa có theme cache): menu nút vẽ **kiểu mặc định** (lưới 2 cột xanh) rồi mới đổi sang kiểu của tenant khi session/ensure về | Widget | 🟡 | Fixed (T08) | T08 |
| BUG-026 | Đổi ngôn ngữ lúc đang xem thẻ giao hàng: chữ 4 bước **giữ ngôn ngữ cũ** (tới 1 phút), cả ở Order Detail | Widget / i18n | 🟡 | Fixed (T14, 2026-11-13) | T14 |
| BUG-027 | Hàng chip thông báo che chip cuối ở 380px: ES "Reseña" bị cắt nửa, VI "Đánh giá" bị che hẳn | Widget / i18n | 🟡 | Fixed (T14, 2026-11-13) | T14 |
| BUG-028 | Tiếng Hàn xuống dòng **giữa một từ**: "도와드릴 / 까요?", "요청에 / 만", "유지됩니 / 다." | Widget / i18n | 🟡 | Fixed (T14, 2026-11-13) | T13 · T14 |
| BUG-029 | Bấm Tab thì focus **thoát khỏi panel** ra trang phía sau, dù panel là hộp thoại modal (`aria-modal`) | Widget / a11y | 🟡 | Fixed (T15, 2026-11-13) | T15 |
| BUG-030 | Trang widget **mở thẳng** trên điện thoại (`talk.ivyusa.com/widget/`) hiện thẻ 370×600 lệch trái, không như khách thấy trên ivyusa.com | Widget | 🟡 | Fixed (T15, 2026-11-13) | T15 |
| BUG-045 | Yêu cầu review N ngày sau khi giao (PRD v1 N-05) **được tạo nhưng không hiện ở đâu** và không tăng số chưa đọc: widget một thanh không có chip cho loại `review`, badge bỏ loại này (BUG-042) | API · Widget | 🟠 | Fixed code (2026-11-25, [FIX-261125](../docs/bug-fix/FIX-261125-IVY-Review-Request-Not-Shown.md), TC-06-06): dòng sản phẩm được nhắc tới đứng đầu chip Review, tô sáng + chấm đỏ; badge đếm yêu cầu gắn sản phẩm; Write Review / gửi review → đã đọc | PRD v1 |
| BUG-044 | Nhân viên trả lời trong console, **chuông trên website sáng nhưng mở chat không thấy tin**: tin nằm ở phiên chat khác của cùng khách | API · Widget · Console | 🔴 | Fixed, deploy 2026-11-19 10:05 UTC (`b0ff7e1a`, [FIX](../docs/bug-fix/FIX-261119-Staff-Reply-Not-Seen-By-Shopper.md), TC-08-09..10); chờ chủ dự án thử | T08 |
| BUG-043 | Đánh giá xong rồi **tải lại hay chuyển trang**: thẻ đánh giá biến mất, khách không còn thấy mình đã chọn mặt nào | Widget | 🟡 | Fixed code (2026-11-19, TC-12-07) | T12 |
| BUG-042 | Số của tab Notifications đếm cả loại thông báo **không chip nào hiện** (`issue`, `review`) → có thể không bao giờ mất | API | 🟡 | Fixed code (2026-11-19, phòng ngừa: chưa thấy trên production) | T01 |
| BUG-041 | Nhân viên trả lời → **số chưa đọc hiện ở tab Notifications** (nơi không có dòng nào để đọc) và **không bao giờ mất**; tab Chat không có số | API · Widget | 🔴 | Fixed code (2026-11-19); chờ chủ dự án thử lại | T01 |
| BUG-040 | Thẻ Contact Support / My Orders **vẫn mất khi chuyển trang** với khách đã đăng nhập: lần lưu "rỗng" lúc trang mới tải đã xoá bản ghi sắp khôi phục | Widget | 🟠 | Fixed code (2026-11-19); chờ chủ dự án thử lại | T11 |
| BUG-039 | Test `thread.service.spec.ts` **tự đỏ từ 2026-11-19** (ghi cứng ngày, code có giới hạn 30 ngày) → chặn cổng deploy | API · Test | 🟠 | Fixed (2026-11-19) | — |
| BUG-038 | Bấm nút có kịch bản ("Delivery inquiry"): **bong bóng tự đổi** thành câu soạn sẵn ("How long does shipping take?") sau vài giây | API · Widget | 🟠 | Fixed code (2026-11-19) | T08 |
| BUG-037 | Khách đã đăng nhập (nhận diện bằng chữ ký từ theme) **mất đoạn chat mỗi lần chuyển trang** | API · Widget | 🔴 | Fixed code (2026-11-18); chờ chủ dự án thử lại | — |
| BUG-036 | iPhone: chạm vào ô nhập của widget thì **cả trang bị phóng to** và không thu lại (ô nhập chữ ~11px, iOS phóng to khi dưới 16px) | Widget | 🔴 | Fixed code (2026-11-18, [FIX](../docs/bug-fix/FIX-261118-Widget-iOS-Zoom-On-Focus.md)); chờ chủ dự án thử lại trên máy thật | T15 |
| BUG-035 | Đơn đã **Delivered bị kéo về In Transit** ở lượt đồng bộ kế tiếp: `upsertOrder` gán lại trạng thái theo `fulfillment_status` chung của đơn mỗi lần chạy | API | 🟠 | Fixed code (2026-11-18, [RPT](../docs/implementation/RPT-261118-Shopify-Sync-Fulfillment-Delivery.md)) | — |
| BUG-034 | **Webhook Shopify không tới được production** (load balancer chặn client không phải trình duyệt, như BUG-004) → không đơn nào Delivered, không có mã vận đơn, không có thông báo giao hàng, không đơn nào viết được review | Infra · API | 🔴 | Workaround code (2026-11-18): lịch đồng bộ tự đọc thông tin giao hàng. Load balancer giữ nguyên. Production cần Re-sync sau deploy | — |
| BUG-033 | Đồng bộ Shopify **dừng ở 500 đơn** rồi dời con trỏ qua phần chưa đọc: production có 500 / 181.188 đơn, bấm Sync now lại không thêm. Khách có hơn 100 đơn nhận 100 đơn cũ nhất khi đăng nhập | API | 🔴 | Fixed code (2026-11-17, [FIX](../docs/bug-fix/FIX-261117-Shopify-Sync-Stops-At-500.md)); production cần bấm Re-sync recent orders sau deploy | — |
| BUG-032 | Popup trong console (ví dụ Tenant Settings → Platforms → Shopify connection): lớp nền mờ **hở 32px ở mép trên**, thấy một dải trang không bị làm mờ | Console | 🟡 | Fixed (2026-11-17) | — |
| BUG-031 | Ô nhập chat không co lại được: khi font mặc định rộng (runner Linux của CI), nút **Send** bị đẩy ra ngoài mép panel 390px → TC-15-06 ×6 đỏ trên CI, xanh ở local | Widget | 🟠 | Fixed (2026-11-16) | T15 |
| BUG-021 | Chữ cam `#FF6900` trên nền trắng chỉ đạt 2.89:1 (cần 4.5:1): câu "Your order is on the way!" ở thẻ giao hàng (T03). T06 đã dùng `warning-ink #C94F00` (4.56:1) cho "Write Review" | Widget / a11y | 🟡 | Fixed (2026-11-17): câu này và dòng "notice updated" của banner đồng ý dùng `warning-ink`; TC-03-03 kiểm màu | T15 |
| BUG-020 | Test T04 khớp chữ ở **tab bị ẩn**: Order Detail vẫn gắn trong tab Notifications khi đã sang Chat (TC-04-04), câu AI disclosure trong tab Chat có "the United States" (TC-04-03) → strict mode violation | E2E harness | 🟡 | Fixed (T04) | T04 |
| BUG-019 | TC-02-04 đọc danh sách thời gian bằng `allInnerTexts()` trước khi dòng hiện → "Expected > 0, Received 0" khi chạy toàn bộ desktop; TC-03-03/04 có cùng kiểu đọc `data-state` | E2E harness | 🟡 | Fixed (T07) | T02 · T03 · T07 |
| BUG-013 | Repo **public**: cài đặt PR từ fork chỉ duyệt người đóng góp lần đầu; `env/backend/.env.development` (secret dev) và IP/SSH user staging nằm trong repo công khai | Security | 🟠 | Need info | T00-e |

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
- **Kiểm ngày 2026-11-12 (T10):**
  - Bản build (`vite preview`) gọi **1 lần**, 4/4 lượt. Dev server gọi **2 lần**, 3/3 lượt.
  - Kết luận: do StrictMode, **không xảy ra trên production**.
- **Hậu quả ở dev (thấy khi làm T10):**
  - Trace của TC-10-04: 3 lần `ensure` không token → 3 phiên. Khách bấm Accept ở phiên `MeNGu…`. Lời `ensure` chậm hơn về sau, widget đổi sang phiên `DFEys…` (chưa đồng ý). Server từ chối kịch bản ("We cannot process chat messages until you accept…"), mà banner không hiện lại.
  - Test dùng consent thật chuyển sang `acceptConsent()`: chờ mạng yên rồi mới bấm Accept.
- **Còn mở (mức thấp):** widget vẫn nhận token của lời `ensure` về sau dù đã có consent ở token trước. Chỉ gây hại khi có 2 lời gọi song song, nên hiện chỉ ở dev.

## BUG-004 · talk.ivyusa.com 403
- **Hiện tượng:** `curl -I https://talk.ivyusa.com/` (cả `/widget/`, `/api/v1/health`, `/ivyusa`, `/admin/login`; HTTP lẫn HTTPS) → `403 Forbidden`, `Server: awselb/2.0`. DNS: 32.201.31.106, 52.4.26.102. Thời điểm: 2026-11-09 16:10 ICT.
- **Nhận định:** chặn ở ALB listener rule/WAF theo IP nguồn, không phải ở ứng dụng.
- **Ảnh hưởng:** không chạy được T16 (smoke production) từ máy này; không kiểm được BUG-003 trên production.
- **Cần (nhận định cũ, 2026-11-09):** thêm IP văn phòng/VPN vào allowlist, hoặc chạy `npm run test:prod` từ mạng đã được phép.
- **Cập nhật 2026-11-17 (T16):** nhận định "chặn theo IP" **không khớp** với những gì đo được trên máy dev (Windows, không proxy, không VPN, một đường mạng):
  - Chrome của chủ dự án: `/api/v1/health` → 200 `status: ok`.
  - Cùng lúc, cùng máy: `curl` và `fetch` của Node → 403 ở `/api/v1/health`, `/widget/`, `/widget/embed.js`.
  - Playwright Chromium (project `prod`, cấu hình sẵn của repo): TC-16-01..03 đều 200 / xanh.
  - Vậy load balancer (hoặc WAF trước nó) từ chối **client không phải trình duyệt**. Thuộc tính nào bị xét (User-Agent hay thứ khác) thì chưa biết; có thêm luật theo IP hay không cũng chưa biết.
- **Hệ quả:** `e2e/global-setup.ts` kiểm tra bằng `fetch` của Node nên luôn nhận 403, và `npm run test:prod` dừng trước khi chạy test nào — trên mọi máy, không riêng máy dev. Thông báo lỗi của nó ("run from an allowlisted network") chỉ sai hướng.
- **Đã làm (2026-11-17, chủ dự án đồng ý):** `e2e/global-setup.ts` bỏ qua bước kiểm tra bằng Node khi `E2E_TARGET=prod`; câu gợi ý sai đã bỏ. `npm run test:prod` chạy nguyên bản trên máy dev: **3 passed**.
- **Đề xuất gốc:** với `E2E_TARGET=prod`, bỏ bước kiểm tra bằng Node (TC-16-01 đã kiểm health bằng trình duyệt), và sửa câu gợi ý. Nên hỏi người quản trị AWS của IVY luật chặn này là chủ ý hay không trước khi đổi.

## BUG-005 · Tài liệu lệch thực tế deploy
- `/SPEC.md §12` và README §8 ghi production "not yet deployed / host TBD". Trong khi đó [RPT-261030](../docs/implementation/RPT-261030-Console-UX-Refresh.md) ghi production **talk.ivyusa.com** (EC2 `talkaibotprd01`) đã deploy `ff9bb663` ngày 2026-10-30. `deploy/profiles/SharpTalk-USA-IVY/CHECKLIST.md` cũng chưa tick host/domain.
- **Fix (T16, 2026-11-17):** `README.md` §8, `SPEC.md` §12.1 / §12.2 / §14, `CLAUDE.md` §6 và `CONFIG.md` §7 ghi production đang chạy. Lưu ý khi sửa: repo có **hai** production — `sharptalk.amoeba.site` (nhánh `production`, từ 2026-09-14) và `talk.ivyusa.com` của IVY (nhánh `deploy/talk-ivyusa`); thứ chưa dùng chỉ là bộ template `docker/production/` cho host riêng. `CHECKLIST.md` tick sau khi có kết quả xác minh server.
- **Đề xuất (gốc):** cập nhật 3 chỗ trên ở T16 (CLAUDE.md §7: "khi giá trị vận hành đổi thì cập nhật CLAUDE/SPEC/CONFIG ngay").

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
- **Fix (T06):** toast lỗi (đóng thủ công), form giữ số sao + nội dung để gửi lại. Bị bộ lọc nội dung chặn (E4002) → câu chỉ rõ phải bỏ gì. Thành công → màn "Thanks" (thay toast, vì kết quả hiện ngay). TC-06-03..05.
- **Phòng ngừa:** không bao giờ `catch {}` rỗng quanh một lần lưu của khách: luôn `showToast({ tone: 'error' })` với câu theo mã lỗi.

## BUG-010 · Liên hệ hỗ trợ hard-code cho mọi tenant
- `apps/widget/src/i18n/locales/{en,es,ja,ko,vi,zh}.ts`: `contact.phone: '1588-0000'`, `contact.email: 'help@ivy.com'`, được `ContactCard.tsx:40-41` đọc ra. Hệ quả: tenant khác cũng hiển thị số/email của IVY.
- **Fix (T11):** lấy kênh liên hệ từ cấu hình tenant; locale chỉ giữ nhãn.
- **Đã sửa (2026-11-13):** `widgetCopy.supportEmail` / `supportPhone` / `contactLiveChat`, sửa ở console → Settings → Widget → Contact Support. 6 file ngôn ngữ không còn `1588-0000` / `help@ivy.com`. `contactChannels()` chỉ trả kênh tenant đã điền; không điền gì → thẻ live chat. TC-11-01, TC-11-07.
- **Phòng ngừa:** giá trị của một tenant (số, email, tên cửa hàng, giờ mở cửa) không bao giờ nằm trong file ngôn ngữ — file ngôn ngữ dùng chung cho mọi tenant.

## BUG-011 · Pill trạng thái chưa dịch
- `apps/widget/src/components/ui/Badge.tsx` (43-52) đoán màu theo text; text là `statusBadge` / `statusUi` từ server, thường là tiếng Anh. Vì vậy UI tiếng Hàn vẫn hiện "In Transit".
- **Fix (T02):** map theo mã trạng thái → key i18n + màu cố định (SPEC §4).
- **Đã sửa (2026-11-11):**
  - `noticeStatus()` (`packages/types/src/common/order-status.ts`) khớp **chính xác** 6 chữ `ORDER_STATUS_UI` sang mã: `confirmed`, `in_transit`, `delivered`, `review`, `pending_payment`, `cancel_requested`.
  - `StatusPill.tsx` dùng mã đó để lấy nhãn `notifications.status.*` (6 ngôn ngữ) và màu. Chữ lạ thì hiện nguyên văn, màu trung tính, `data-status="other"`.
  - Phạm vi: feed thông báo. `toneForStatus` (đoán theo chữ) vẫn còn ở danh sách đơn và feed inquiry, sẽ xử lý ở T03/T09 khi làm lại các màn đó.
- **T03 (2026-11-11):** thẻ giao hàng (chip Delivery) dùng `StatusPill` với mã lấy từ bước tracking (`deliveryCardStatus`), nên pill, stepper và câu trạng thái luôn khớp nhau. Còn lại `toneForStatus` ở `OrderList.tsx` và `IssueFeed`: xử lý ở T09.

## BUG-015 · Feed thông báo lặp mỗi sự kiện theo số kênh
- **Hiện tượng:**
  - `notify()` luôn ghi 1 dòng `in_app`, rồi ghi **thêm 1 dòng cho mỗi kênh ngoài** đã gửi (email/sms/web_push/push) làm bản ghi giao nhận. Các dòng này cùng khách, cùng nội dung.
  - `list()` và `unreadCount()` không lọc theo kênh. Vì vậy 1 cập nhật giao hàng (loại giao dịch, mặc định cho phép mọi kênh) hiện **5 dòng giống nhau** trong widget và app, và badge **+5**.
- **Phát hiện:** khi làm T02, nếu không sửa, chip Order sẽ lặp mỗi dòng "In Transit" 5 lần.
- **Fix:** `scopedWhere` lọc `channel = 'in_app'` (`notification.service.ts`, `FEED_CHANNEL`). Dòng `in_app` luôn được ghi nên không mất sự kiện nào. Các dòng kênh ngoài vẫn được giữ làm bản ghi giao nhận (push dispatch, thống kê).
- **Ảnh hưởng production:** badge của khách sẽ **giảm** về đúng số sự kiện chưa đọc (trước đây bị nhân theo số kênh). App mobile dùng cùng API nên cũng hết lặp.
- **Phòng ngừa:** feed hiển thị phải luôn chọn đúng một kênh. Jest: "the feed and the badge read only in_app rows".

## BUG-016 · Fixture e2e "hôm qua" phụ thuộc giờ chạy
- Thông báo 505 và đơn IVY-39880 dùng `ago(DAY + 2 * HOUR)`. Suite chạy với `timezoneId: 'America/New_York'`, nên từ 00:00 đến 02:00 giờ New York (05:00–07:00 UTC, tức giữa trưa ở Việt Nam) thời điểm đó rơi vào **2 ngày trước**. Khi đó nhóm "Yesterday's" biến mất và TC-02-02 đỏ, ~8% số lần chạy, kể cả trên CI.
- **Fix:** `yesterday()` = đúng 24 giờ trước, luôn nằm trong ngày hôm qua (trừ ngày đổi giờ DST).

## BUG-017 · TC-03-05 đọc URL tab mới quá sớm
- **Hiện tượng:** sau khi bấm Track Order, test lấy `(await popup).url()` và nhận `""`. Tab mới đã mở, nhưng lúc sự kiện `popup` bắn ra thì tab chưa điều hướng tới `ups.com`. Lỗi xảy ra mỗi lần chạy, kể cả khi app mở đúng link.
- **Fix:** giả lập `https://www.ups.com/**` ở mức context để CI không phụ thuộc mạng ngoài, rồi `waitForURL(/ups\.com\/track/, { waitUntil: 'commit' })` trước khi kiểm tra URL (có `tracknum`). Lặp ×3: 15/15.
- **Phòng ngừa:** với tab mới hoặc điều hướng, luôn chờ `waitForURL` / `waitForLoadState`. Không đọc `url()` ngay sau sự kiện `popup`.
- **Lặp lại ở T05:** TC-05-04 có đúng lỗi này, sửa cùng cách (giả lập `https://ivyusa.com/**`).

## BUG-018 · TC-01-06 đo panel trước khi theme về
- **Hiện tượng:** cổng CI chạy lặp ×2 có 1 lần đỏ: "Expected <= 382, Received 404". Chạy riêng TC-01-06 ×15 với 4 worker: **11/15 đỏ**. CI chạy 1 worker và có retry nên chưa lộ ra.
- **Nguyên nhân:** `.ivy-panel-desktop` dùng `var(--ivy-panel-w, 404px)` (`apps/widget/src/index.css`). Theme của tenant (380px) đặt biến này sau khi tải cấu hình. Test mở panel rồi đo **ngay**, nên khi API chậm nó đo trúng 404px mặc định. Không liên quan T03.
- **Fix (test):** `expect.poll` chờ độ rộng ≤ 382 rồi mới kiểm tra ≥ 378, giống TC-01-08. Sau fix: 15/15 với 4 worker.
- **Còn mở (mức thấp):** nếu khách mở widget trước khi cấu hình tenant về, panel có thể chớp từ 404px xuống 380px. Thực tế hiếm vì cấu hình tải ngay khi trang nạp. Có thể xử lý ở T15 bằng cách chờ theme rồi mới cho mở, hoặc đổi mặc định sang 380px.
- **Phòng ngừa:** mọi phép đo hình học phụ thuộc cấu hình tenant phải dùng `expect.poll` hoặc assertion tự chờ.

## BUG-029 · Focus thoát khỏi panel
- **Hiện tượng:** mở panel rồi bấm Tab. Sau 14 nút trong panel, focus chạy ra trang phía sau (link Shop, Add to cart…). Khi widget nằm trong khung của `embed.js`, focus rời khung sang trang shop.
- **Nguyên nhân:**
  - Panel là `role="dialog"` + `aria-modal="true"`, tức báo với trình đọc màn hình rằng phần còn lại của trang không dùng được.
  - Nhưng không có gì giữ focus lại trong panel (NFR-02).
- **Hiện tượng thứ 2 (gặp khi viết test):** focus đang ở nút Accept của banner đồng ý; banner biến mất (khách bấm Accept, hoặc trạng thái đồng ý vừa tải xong) → focus rơi ra `<body>`. Test Tab ×40 vì vậy đỏ ngẫu nhiên 2/20 lần.
- **Fix (T15):**
  - `keepFocusInside()` (`WidgetPanel.tsx`): Tab qua nút cuối → về nút đầu; Shift+Tab trước nút đầu → về nút cuối.
  - Bỏ qua tab đang ẩn và tab "roving" (`tabindex=-1`).
  - Muốn quay ra trang shop thì dùng ✕ hoặc Esc.
  - Nút đang có focus mà bị gỡ, bị tắt (nút của banner tắt trong lúc lưu) hoặc bị ẩn → focus về panel.
    - Chrome **không phát sự kiện nào** khi gỡ phần tử đang có focus, nên widget theo dõi DOM của panel (`MutationObserver`).
    - Khách tự bấm ra ngoài (nút cũ vẫn còn, vẫn bấm được) thì không giành lại focus.
  - TC-15-05 ×2.
- **Phòng ngừa:**
  - Phần tử khai báo `aria-modal` thì phải giữ focus. Test bàn phím phải bấm Tab qua hết các nút, không chỉ một lần.
  - Test focus phải chờ panel tải xong, và có ca riêng cho phần tử biến mất dưới focus.

## BUG-044 · Tin nhân viên trả lời không tới khung chat khách đang thấy
- **Phát hiện (2026-11-19, chủ dự án):** gửi 3 tin vào Session 10 của khách `cong11`; chuông trên website sáng nhưng khung chat hiện Session 11 (đã kết thúc) và không có 3 tin đó.
- **Nguyên nhân:**
  - Khách có 5 phiên chat (161, 162, 165, 166, 168); widget chỉ hiện cuộc mới nhất của phiên nó giữ (166), còn tin nằm ở phiên 165.
  - Thông báo gửi theo khách nên chuông vẫn sáng.
  - Thêm một lỗi tiềm ẩn: khi cuộc trò chuyện đổi, widget ghép tin mới vào lịch sử cuộc cũ.
- **Fix (duyệt `1. ok 2. a`):**
  - Chỉ trả lời được cuộc mới nhất của phiên (E5165); console có dải báo và nút **Open Session N**.
  - Trả lời cuộc đã kết thúc thì mở lại cuộc đó cho nhân viên trả lời.
  - Phiên vừa được trả lời thành phiên hiện tại của khách; widget hỏi lại khi mở chat hoặc khi có thông báo và chuyển sang phiên đó, đọc lại toàn bộ đoạn chat.

  Chi tiết: [FIX-261119](../docs/bug-fix/FIX-261119-Staff-Reply-Not-Seen-By-Shopper.md).
- **Phòng ngừa:** thao tác ghi tin cho khách phải chỉ ra được nơi khách thấy tin; thông báo và nội dung phải cùng phạm vi.

## BUG-043 · Thẻ đánh giá mất sau khi tải lại trang
- **Phát hiện (2026-11-19, chủ dự án hỏi "tại sao không để lại mức độ hài lòng với icons và actived icon đã chọn trong cuộc hội thoại"):** thẻ chỉ hiện khi server còn nhận đánh giá (`canRate`) hoặc khi khách vừa đánh giá trong lượt xem này (state React `ratedIn`). Tải lại hay chuyển trang thì state mất, còn `canRate` thành false vì đã có điểm, nên thẻ biến mất. Server vẫn trả `csatRating` mỗi lần đọc cuộc trò chuyện, nhưng widget bỏ qua giá trị này.
- **Fix:** `useChat` giữ `csatRating` từ server. Thẻ hiện lại ở dạng chỉ đọc: mặt đã chọn sáng, các mặt khác mờ, không bấm được, không còn Skip. Câu hỏi và lời cảm ơn không lặp lại; dấu "chat has ended" nằm dưới thẻ. Chế độ khảo sát hiện 5 mặt, mức đã chọn và lời cảm ơn. Điểm cũ của thẻ 5 mặt (giá trị 2) hiện trên thang 5 mặt. [PLN-261119](../docs/plan/PLN-261119-Console-LiveChat-Unread-And-Csat-Faces.md).
- **Phòng ngừa:** điều khách đã làm và đã thấy (đã chọn gì) phải đọc lại từ server, không chỉ giữ trong state của một lượt xem.

## BUG-042 · Số của tab Notifications có thể bị giữ bởi thông báo không chip nào hiện
- **Phát hiện (2026-11-19, rà soát theo yêu cầu của chủ dự án sau BUG-041):** với widget một tab danh sách (IVY), chỉ thông báo loại `payment`, `shipping` (chip Order) và `event` (chip Promo) có dòng để mở và đọc. Chip Delivery và Review là danh sách đơn hàng, không phải thông báo. Số chưa đọc lại đếm mọi loại trừ `chat`, nên một thông báo loại `issue` (trạng thái issue đổi) hay `review` sẽ làm số tăng mà không có cách đọc — cùng lỗi với BUG-041. Chưa thấy xảy ra trên production (IVY không dùng issue; `requestReview` chưa được gọi ở đâu), đây là sửa phòng ngừa.
- **Fix:** tenant một tab danh sách → số của tab (`feed`) chỉ đếm `payment`, `shipping`, `event`; số của chuông (không phạm vi) đếm thêm `chat`. Tenant hai tab danh sách không đổi (chip All của họ liệt kê mọi dòng). `SINGLE_BAR_FEED_CATEGORIES`, `notification.service.ts`.
- **Phòng ngừa:** con số chưa đọc chỉ được đếm thứ mà giao diện đó hiển thị được. Thêm chip hoặc loại thông báo mới: cập nhật `SINGLE_BAR_FEED_CATEGORIES` cùng lúc.

## BUG-041 · Nhân viên trả lời: số chưa đọc hiện ở tab Notifications và không bao giờ mất
- **Hiện tượng (chủ dự án, bản Preview, 2026-11-19):** trả lời 2 tin từ live chat của console → chuông và tab **Notifications** hiện "2", tab Chat không có số. Mở Notifications: "No notifications yet.", số 2 vẫn còn.
- **Nguyên nhân:** mỗi câu trả lời của nhân viên tạo một thông báo loại `chat` (`AgentService.notifyCustomerOfReply`). Số chưa đọc của tab Notifications đếm **mọi** loại, nhưng danh sách chỉ có các chip Order / Delivery / Promo / Review, không chip nào liệt kê loại `chat`. Không có dòng để chạm thì không có cách đánh dấu đã đọc. Số của tab Chat thì chỉ đếm tin tới trong lúc trang đang mở.
- **Fix:** phạm vi đếm mới — `feed` (mọi loại trừ `chat`) cho tab Notifications, `chat` cho tab Chat; `notice` cũng bỏ `chat`. Đếm không phạm vi (chuông trên trang cửa hàng) vẫn gồm tất cả. `POST /notifications/read-chat`: mở tab Chat là đã đọc. `notification.service.ts`, `useTabBar.ts`. TC-01-09, TC-01-10.
- **Phòng ngừa:** thứ gì làm tăng một con số chưa đọc thì phải có đúng một chỗ để người dùng đọc nó ở cùng tab đó; thêm loại thông báo mới phải trả lời được "nó hiện ở chip nào".

## BUG-040 · Thẻ Contact Support vẫn mất sau khi chuyển trang (bản đầu của PLN-261119)
- **Hiện tượng (chủ dự án, bản Preview, 2026-11-19):** sau khi deploy `5504ed3e`, bấm Contact Support, chuyển trang, mở lại: không thấy thẻ. Hai phần còn lại của PLN-261119 chạy đúng.
- **Nguyên nhân:** ở trang mới, widget biết phiên trước rồi mới biết cuộc trò chuyện (khách đã đăng nhập: phiên của trang → phiên được dùng lại → `conversationId`). Trong khoảng đó nó chưa có thẻ nào, và hiệu ứng lưu chạy với danh sách rỗng; `saveThreadInserts` coi "rỗng" là "xoá", nên **xoá đúng bản ghi sắp được khôi phục**. Khi `conversationId` tới thì không còn gì để đọc.
- **Vì sao test không bắt:** TC-11-07 chạy widget đứng riêng, nơi phiên và cuộc trò chuyện không đổi sau khi tải lại; chuỗi "phiên trước, cuộc trò chuyện sau" chỉ có ở bản nhúng với khách đã đăng nhập.
- **Fix:** lưu danh sách rỗng không ghi và không xoá gì; chỉ `clearThreadInserts` (chat kết thúc) mới xoá. Test đơn vị dựng lại đúng chuỗi của trang mới (`thread-inserts.test.mjs`).
- **Chưa kiểm được ở local:** tình huống thật cần khách đăng nhập trên cửa hàng Shopify; chờ chủ dự án thử lại.
- **Phòng ngừa:** hàm lưu không được vừa là hàm xoá; "chưa có gì để lưu" và "đã bỏ hết" là hai việc khác nhau và phải có hai lời gọi khác nhau.

## BUG-038 · Bong bóng của khách tự đổi chữ sau khi bấm nút có kịch bản
- **Hiện tượng (chủ dự án, 2026-11-19):** bấm "Delivery inquiry" → bong bóng ghi "Delivery inquiry", vài giây sau thành "How long does shipping take?".
- **Nguyên nhân:** widget vẽ ngay tên nút; `ScenarioService.handle` lưu `script.utterance` (câu soạn sẵn của kịch bản) làm lời của khách. `useChat` đồng bộ lại với server sau mỗi lượt và thay bong bóng tạm bằng bản đã lưu.
- **Fix:** widget gửi `label`; server lưu tên nút đã bấm, câu soạn sẵn chỉ là dự phòng. [RPT](../docs/implementation/RPT-261119-IVY-Chat-Continuity-And-References.md).
- **Phòng ngừa:** cái được vẽ ngay và cái được lưu phải là cùng một chuỗi; nếu server tự chọn nội dung thì widget phải lấy nội dung đó từ câu trả lời, không tự đoán.

## BUG-039 · Test tự đỏ theo ngày: `thread.service.spec.ts`
- **Hiện tượng (2026-11-19):** `previousExcerpt › formats the last turns…` đỏ mà không ai sửa gì; cổng `verify` của CI sẽ đỏ theo và chặn mọi lần deploy.
- **Nguyên nhân:** test ghi cứng `createdAt: new Date('2026-10-20T03:00:00Z')`, còn code bỏ đoạn trích cũ hơn 30 ngày (`EXCERPT_MAX_AGE_MS`). Đúng 30 ngày sau, hàm trả `undefined`.
- **Fix:** ngày tương đối (10 ngày trước lúc chạy).
- **Phòng ngừa:** test của code có so sánh với "bây giờ" phải dựng mốc thời gian từ `Date.now()` hoặc dùng đồng hồ giả, không ghi ngày lịch. Trong `apps/api/src` còn khoảng 80 chỗ `new Date('2026-…')` trong các file spec; chưa rà hết.

## BUG-037 · Khách đã đăng nhập mất đoạn chat khi chuyển trang
- **Hiện tượng (chủ dự án, bản Preview, 2026-11-18):** sau khi bật nhận diện bằng chữ ký từ theme, gửi một tin trong Chat, chuyển sang trang khác của cửa hàng, mở lại khung talk: đoạn chat trống.
- **Nguyên nhân:** mỗi lần tải trang, widget nhúng mở một phiên **mới** (bản nhúng không dùng lại token đã lưu) rồi gọi identify; identify **gắn chính phiên mới đó** vào khách. Hội thoại treo theo phiên, nên đoạn chat nằm lại ở phiên của trang trước. Đường App Proxy không bị vì nó trả về phiên gần nhất của khách (`findOrCreateForCustomer`).
- **Fix:** với mã khách của nền tảng (Shopify) đã ký, identify trả về **phiên gần nhất của khách** (cùng cửa sổ dùng lại 24 giờ như App Proxy) thay vì gắn phiên của trang; widget nhận token trong câu trả lời và mọi truy vấn (chat, đơn, thông báo) đi theo token đó. Đồng ý (consent) lấy theo phiên được dùng lại. `embed.service.ts`, `useEmbedCommands.ts`; 3 ca mới trong `embed.service.spec.ts`.
- **Giới hạn:** khách không dùng widget quá 24 giờ thì bắt đầu phiên mới, đoạn chat cũ không tự hiện (hành vi sẵn có của đường App Proxy). Phiên của trang (vài giây tuổi, chưa có tin nhắn) bị bỏ lại.
- **Phòng ngừa:** hai đường nhận diện cùng một loại khách phải kết thúc ở cùng một phiên; khi thêm đường mới, đối chiếu với đường cũ cả phần "phiên nào được trả về", không chỉ phần "khách nào".

## BUG-036 · iPhone tự phóng to trang khi chạm vào ô nhập
- **Hiện tượng (máy thật, 2026-11-18):** chạm "Ask Anything" trên iPhone → cả trang phóng to, ⚙ và ✕ ra ngoài mép phải, ô nhập và thanh menu dưới không còn thấy; đóng bàn phím vẫn phóng to.
- **Nguyên nhân:** iOS Safari phóng to trang khi ô đang chọn có chữ dưới 16px. Ô nhập của widget là ~11,4px (gốc 13px của IVY × `text-sm`).
- **Fix:** ô nhập / textarea / select là 16px trên thiết bị cảm ứng và trên iOS (`apps/widget/src/index.css`). [FIX](../docs/bug-fix/FIX-261118-Widget-iOS-Zoom-On-Focus.md). TC-15-07.
- **Phòng ngừa:** giả lập không có hành vi này; thay đổi chạm tới ô nhập hoặc bố cục điện thoại cần thử trên iPhone thật.

## BUG-034 · Webhook Shopify không tới được production
- **Hiện tượng (2026-11-18):** đơn mới về theo từng đợt cách nhau đúng 30 phút (lịch `SHOPIFY_SYNC_INTERVAL_MIN`), không về trong vài giây. Lấy mẫu 100 đơn ở 5 trang của console Orders (đặt từ tháng 8 tới 18/11): chỉ có Confirmed và In Transit, không đơn nào Delivered.
- **Đã loại trừ:**
  - Đăng ký webhook: `Registered 0, already present 4, failed 0`.
  - Địa chỉ: `SHOPIFY_APP_URL=https://talk.ivyusa.com`.
  - nginx không ghi log: trong 60 phút `sharptalk_nginx` ghi đủ truy cập của trình duyệt và `ELB-HealthChecker`, nhưng **không** có yêu cầu nào tới `/api/v1/webhooks/shopify/*`.
- **Nguyên nhân:** yêu cầu của Shopify bị chặn trước khi tới server. Load balancer trả 403 cho client không phải trình duyệt (BUG-004); luật nằm ở listener rule hay AWS WAF thì chưa biết.
- **Phát hiện kèm:** `SHOPIFY_WEBHOOK_SECRET` trên server để trống. Kể cả khi thông đường, API sẽ từ chối mọi webhook (fail closed). Chủ dự án đã điền ngày 2026-11-18; có hiệu lực từ lần API khởi động lại kế tiếp.
- **Hệ quả:** webhook `fulfillments/*` là nơi duy nhất ghi trạng thái Delivered, bản ghi `fulfillments` (mã vận đơn, hãng, link) và thông báo "Shipping update". Danh sách đơn được viết review chỉ nhận đơn Delivered, nên cũng trống.
- **Quyết định của chủ dự án (2026-11-18):** không xin AWS mở đường; lịch đồng bộ tự đọc thông tin giao hàng ([PLN-261118](../docs/plan/PLN-261118-Shopify-Sync-Fulfillment-Delivery.md)). Độ trễ tối đa 30 phút được chấp nhận.
- **Nếu sau này muốn webhook:** thêm ngoại lệ trên load balancer / WAF cho `POST /api/v1/webhooks/shopify/*` (yêu cầu được xác thực bằng HMAC của Shopify). Hai đường chạy song song được.
- **Phòng ngừa:** "kết nối thành công" và "đăng ký webhook thành công" không chứng minh webhook tới nơi. Sau khi nối một cửa hàng, kiểm log truy cập của nginx cho `/webhooks/shopify/`, hoặc xem đơn mới có về giữa hai lượt đồng bộ không.

## BUG-035 · Đơn Delivered bị kéo về In Transit
- **Nguyên nhân:** `ShopifySyncService.upsertOrder` gán `statusInternal` ở mỗi lần chạy từ `fulfillment_status` chung của đơn, mà giá trị này chỉ biết `fulfilled` (→ In Transit). Trạng thái Delivered do webhook fulfillment ghi sẽ bị ghi đè ở lượt đồng bộ hoặc webhook đơn kế tiếp.
- **Vì sao chưa ai thấy:** trên production chưa đơn nào Delivered (BUG-034). Lộ ra khi đọc code cho PLN-261118.
- **Fix:** trạng thái tính từ các kiện khi payload có; payload không nói gì về kiện thì không hạ một đơn đang Delivered. Test U-03, U-04 trong [TCR-261118](../docs/test/TCR-261118-Shopify-Sync-Fulfillment-Delivery.md).
- **Phòng ngừa:** khi hai nguồn cùng ghi một cột, nguồn biết ít hơn không được ghi đè nguồn biết nhiều hơn. "Payload không mang trường này" phải khác "trường này rỗng".


## BUG-030 · Trang widget mở thẳng trên điện thoại hiện kiểu máy tính
- **Hiện tượng:** mở `talk.ivyusa.com/widget/?shop=…` trên điện thoại (trang chủ dự án dùng để thử, vì widget chưa gắn lên ivyusa.com). Panel hiện thẻ 370×600 lệch trái, trong khi khách vào qua `embed.js` thì nhận bố cục điện thoại. TC-15-01 đỏ từ đầu.
- **Nguyên nhân:**
  - Bố cục điện thoại chỉ bật khi loader gắn `?compact=1`.
  - Mở thẳng thì không có loader, nên không ai báo "đây là điện thoại".
  - Widget cố ý không tự đo chiều rộng, vì trong khung của loader chiều rộng đó là của khung, không phải của trang (FIX-260920).
- **Fix (T15):**
  - `useStandalonePhone()`: chỉ khi **không** có `?embed=1` và không phải app, trang hẹp hơn 640px (cùng quy tắc với `embed.js`) thì dùng bố cục điện thoại.
  - Hook theo `matchMedia`, nên xoay máy thì bố cục đổi theo.
  - TC-15-01.
- **Phòng ngừa:** trang dùng để thử phải hiện giống trang khách thấy. Test thiết bị đi qua `embed.js` (TC-01-08, TC-15-06); TC-15-01 giữ cho trang mở thẳng.

## BUG-032 · Lớp nền của popup hở 32px ở mép trên
- **Hiện tượng:** chủ dự án mở Tenant Settings → Platforms → Shopify trên production: popup hiện đúng, nhưng lớp nền mờ phía sau không phủ hết chiều cao, còn một dải trắng ở trên cùng.
- **Nguyên nhân:**
  - `Modal` vẽ gốc của nó là `fixed inset-0`, ngay tại chỗ được gọi (không qua portal).
  - Trang Platforms đặt popup làm con của `<div class="space-y-8">`. Lớp `space-y-*` của Tailwind cho mọi phần tử con từ thứ hai trở đi `margin-top: 2rem`, kể cả gốc của popup.
  - Với hộp `fixed` có `top: 0; bottom: 0`, `margin-top` đẩy mép trên xuống: nền bắt đầu ở 32px, cao 868 / 900px.
  - Popup nào nằm trong cha `space-y-*` / `space-x-*` cũng bị; popup ở trang không dùng các lớp đó (ví dụ AI Engines của admin) thì không.
- **Fix:** `!m-0` trên gốc của `Modal` và `Drawer` (`apps/web/src/components`). Không đổi gì khác.
- **Kiểm (local, 2026-11-17):** đo gốc popup Shopify connection ở viewport 1440×900 — có fix: top 0, cao 900, margin 0; gỡ lớp `!m-0` trong DOM: top 32, cao 868, margin 32px. Typecheck và build `@sharptalk/web` sạch.
- **Phòng ngừa:** phần tử phủ màn hình (`fixed inset-0`) vẽ tại chỗ phải tự xoá margin, vì nó không biết cha mình dùng lớp giãn cách nào. E2E của IVY chỉ chạy widget, không có test cho console.

## BUG-031 · Nút Send bị đẩy ra ngoài panel trên điện thoại
- **Hiện tượng:** CI run `43407310275` (commit `8f264e88`, T15) đỏ ở `e2e gate`: TC-15-06 cả 6 ngôn ngữ, bước `chat`, báo `past the edge: <button> ""` + `<svg>` + `<path>`. Ở local cổng CI xanh 132/132 (RPT T15; chạy lại trên Windows ngày 2026-11-16 cũng xanh), nên commit được push và production **không** nhận bản T15 (`deploy-gate` bị bỏ qua).
- **Nguyên nhân:**
  - Hàng nhập của Chat là `flex`: nút đính kèm 36px · ô nhập `flex-1` · nút Send 40px. Ô nhập **không có `min-w-0`**.
  - `<input>` không co xuống dưới bề rộng tự nhiên của nó (20 ký tự trung bình của font đang dùng). Trên panel 390px còn 274px cho ô nhập; với font Latin bề rộng tự nhiên là 219px (đo trên Windows), tức chỉ dư 55px.
  - Font mặc định của runner Ubuntu có ký tự trung bình rộng hơn → bề rộng tự nhiên vượt 274px → hàng nhập rộng hơn panel → Send nằm ngoài mép phải.
  - Tab Chat chỉ có 2 nút chỉ-icon (đính kèm ở mép trái, Send ở mép phải), và các bước chip trước đó của cùng test đều xanh, nên phần tử bị báo là Send.
  - Khách thật cũng gặp: máy có font mặc định rộng (CJK), hoặc tenant đặt font rộng qua `--ivy-font-family`.
- **Kiểm chứng ở local:** ép bề rộng tự nhiên của ô nhập lớn hơn chỗ trống (`size=60`) → Send ở x=610 trên panel 390 (đúng lỗi của CI). Thêm `min-w-0` → Send ở 378 với mọi `size`. Phần "font của runner rộng hơn" là **suy luận** từ cơ chế này; không tải được trace của CI (cần đăng nhập GitHub).
- **Fix:** `min-w-0` cho ô nhập (`ChatTab.tsx`, `.st-input`), giống ô email của `ContactEmailCard`. Không đổi gì với font Latin: ô nhập vẫn 274px.
- **Kết quả trên CI (commit `1a9bc75f`, run `43808679108`):** bước Chat hết đỏ ở mọi lượt đi tới đó, tức suy luận về font đúng. Nhưng run vẫn đỏ vì lỗi thứ hai, của chính test: TC-15-06 gọi `chips.count()` ngay sau khi bấm tab Notifications, không chờ hàng chip hiện → `Expected >= 4, Received 0` (ES, VI đỏ cả 2 lượt; EN, JA, ZH đỏ lượt đầu, xanh lượt lại). Run trước không lộ vì khi đó test dừng ở bước Chat với thời điểm khác. Sửa: chờ chip thứ 4 hiện rồi mới đếm (cùng kiểu BUG-019). Local: TC-15-06 ×6 lặp 4 lần, 24/24. CI: commit `3b0263e8`, run `43809373458` xanh 132/132.
- **Phòng ngừa:**
  - Mọi `<input>` / `<textarea>` là phần tử `flex-1` phải kèm `min-w-0`.
  - Test đo hình học xanh ở local chưa đủ: font của runner Linux khác macOS / Windows. Kết quả CI của chính commit đó mới là kết quả cuối; RPT chỉ ghi "xanh" sau khi run trên GitHub xanh.

## BUG-026 · Bước giao hàng giữ ngôn ngữ cũ
- **Hiện tượng:** khách xem chip Delivery rồi đổi ngôn ngữ (🌐). Cả panel sang ngôn ngữ mới, chỉ chữ dưới 4 bước vẫn giữ ngôn ngữ cũ. Order Detail cũng vậy.
- **Nguyên nhân:**
  - Chữ các bước lấy từ `TrackingResponse.steps`. Server dịch theo ngôn ngữ của phiên **lúc tải**.
  - Widget giữ kết quả 60 giây (`staleTime`), và khoá cache không có ngôn ngữ, nên đổi ngôn ngữ không làm tải lại.
  - Server chỉ biết ngôn ngữ mới qua `POST /session/language` gửi song song, nên kể cả tải lại ngay cũng có thể về chữ cũ.
- **Fix (T14):**
  - `deliveryStepLabels()` (`lib/delivery.ts`) dùng bảng `orders.trackingSteps` của widget (6 ngôn ngữ, giống `DELIVERY_STEPS_BY_LANG` của server) khi số bước khớp. Số bước khác thì giữ chữ server.
  - Áp cho thanh bước ngang (thẻ giao hàng, danh sách đơn) và thanh dọc (Order Detail).
  - Test: unit 4 ca, TC-14-05.
- **Phòng ngừa:** chữ giao diện mà widget tự dịch được thì lấy từ i18n của widget, không dùng chữ server đã dịch sẵn theo phiên. Nếu bắt buộc phải dùng chữ server, đưa ngôn ngữ vào khoá cache.

## BUG-027 · Hàng chip che chip cuối
- **Hiện tượng:** ở 380px, chip "Reseña" (ES) bị cắt nửa, chip "Đánh giá" (VI) bị che hẳn. Khách phải cuộn ngang mới thấy, mà không có dấu hiệu nào cho biết còn chip.
- **Nguyên nhân:**
  - Hàng chip là một thanh cuộn ngang (`overflow-x-auto`).
  - Chữ ES / VI dài hơn: VI cần 385px, chỉ có 307px.
  - Rút gọn chữ không đủ: "Đơn · Giao hàng · Ưu đãi · Đánh giá" vẫn thừa 0,6px.
- **Fix (T14, chủ dự án chọn 2a):**
  - Chip xuống hàng 2 khi không vừa (`flex-wrap`). Nút Chọn đứng cạnh, ở hàng đầu.
  - EN / KO / JA / ZH vẫn 1 hàng.
  - TC-14-07 ×6 kiểm mọi chip nằm trọn trong panel.
- **Phòng ngừa:** chữ có thể dài hơn ở ngôn ngữ khác thì không đặt trong thanh cuộn ngang ẩn. Test "nằm trọn trong khung" phải tự kiểm khung cắt, vì `toBeVisible` của Playwright không xét `overflow`.

## BUG-028 · Tiếng Hàn xuống dòng giữa từ
- **Hiện tượng:** 3 chỗ bị cắt giữa từ (ghi nhận ở T13, để T14 sửa):
  - "무엇을 도와드릴 / 까요?" ở lời chào Chat;
  - "리뷰 요청에 / 만" ở Settings;
  - "유지됩니 / 다." ở Settings.
- **Nguyên nhân:** theo mặc định (`word-break: normal`), trình duyệt được ngắt dòng tiếng Hàn sau bất kỳ âm tiết nào.
- **Fix (T14):**
  - `html:lang(ko) { word-break: keep-all; overflow-wrap: break-word; }` trong `index.css`.
  - Chỉ áp cho tiếng Hàn. Tiếng Nhật, tiếng Trung không có dấu cách, nên `keep-all` sẽ làm chúng không xuống dòng được.
  - Đường link hoặc email dài vẫn ngắt được nhờ `overflow-wrap`.
  - TC-14-04 đo từng từ, chạy ×3 ngôn ngữ.
- **Phòng ngừa:** quy tắc ngắt dòng theo ngôn ngữ đặt ở `:lang()`, không áp chung cho mọi ngôn ngữ. Widget luôn giữ `<html lang>` theo ngôn ngữ đang chọn.

## BUG-020 · Test khớp chữ ở tab bị ẩn
- **Hiện tượng:** TC-04-04 đỏ "strict mode violation… resolved to 2 elements": `#IVY-39891` ở Order Detail và tin nhắn chat. Màn vẫn chạy đúng (đã chuyển sang Chat và gửi câu hỏi). TC-04-03 cũng vậy với "United States": dòng địa chỉ và câu "…AI service provider in the United States…" trong tab Chat.
- **Nguyên nhân:** tab đã mở thì vẫn được gắn trong trang, chỉ bị ẩn (`WidgetPanel`, để giữ cuộc chat). Strict mode của Playwright đếm cả phần tử bị ẩn, và `getByText` mặc định so khớp một phần chuỗi.
- **Fix:** TC-04-04 tìm trong `getByRole('tabpanel')`, tức chỉ tab đang hiện. TC-04-03 dùng `exact: true`. T04 ×3: 21/21.
- **Phòng ngừa:** chữ có thể xuất hiện ở tab khác thì thu phạm vi vào tab đang hiện, hoặc so khớp chính xác.

## BUG-025 · Chip End báo "gửi thất bại"
- **Hiện tượng:** console cho đặt chip `end_chat` dưới một kịch bản (nó nằm trong danh sách id hợp lệ), nhưng bấm chip đó thì widget hiện "Sorry, that didn't go through. Please try again."
- **Nguyên nhân:** `handleQuickReply` không có nhánh cho `end_chat`, nên rơi vào nhánh mặc định `scenario('end_chat')`. Server không có kịch bản `end_chat`, widget không gửi kèm câu hỏi, nên `POST /chat/scenario` trả 404.
- **Fix (T12):** `end_chat` kết thúc cuộc chat ngay (không hỏi xác nhận, theo thiết kế 1006:6050) rồi hiện thẻ đánh giá. Hằng số `END_CHAT_ID` ở `reply-chips.ts`. TC-12-02..04.
- **Phòng ngừa:** mỗi id trong danh sách "chip điều khiển" của API (`CONTROL_FOLLOW_UP_IDS`) phải có nhánh xử lý trong widget. Unit test API kiểm mọi chip của kịch bản có sẵn đều dẫn tới đâu đó; khi thêm id điều khiển mới, thêm luôn nhánh và test e2e bấm vào nó.

## BUG-024 · Khung trả lời trong chat chen lên trên tin nhắn mới
- **Hiện tượng:** khung `inline` (My Orders, Contact, Affiliate, đăng nhập…) render **sau** danh sách tin nhắn, ở một ô duy nhất. Bấm My Orders rồi "Cancel order" thì câu trả lời huỷ đơn hiện **phía trên** thẻ đơn.
- **Fix (T09):** My Orders và menu của Start over là "thread insert" gắn với số tin nhắn lúc xuất hiện (`at`). Chúng render ngay sau tin nhắn thứ `at`, nên tin nhắn sau nằm bên dưới. Chip của insert chỉ hiện khi nó là thứ cuối cùng trong luồng.
- **T10:** Product Help (menu, danh mục, sản phẩm phổ biến) là insert.
- **T11:** Contact Support và form liên hệ là insert; form gửi xong thành thẻ "YOUR INQUIRY" ngay tại chỗ (`sent` lưu trên insert).
- **T12:** Affiliate thành kịch bản trên server: câu trả lời là một tin nhắn trong luồng, 3 bước vẽ thành thẻ ngay trong tin đó. "Apply now" mở form liên hệ dạng insert. Bỏ thẻ Affiliate cũ.
- **Còn:** Callback (form gọi lại khi hàng đợi lâu / ngoài giờ) vẫn dùng ô cũ.
- **Phòng ngừa:** thứ gì "nói" trong luồng chat phải có vị trí trong luồng, không phải một ô cố định cuối luồng.

## BUG-022 · Lưu nút làm mất câu hỏi của nút
- **Hiện tượng:** console → AI Settings → nút có Action "Send a message" có ô câu hỏi (PLN-261001). Nhập câu hỏi rồi Save thì câu hỏi biến mất. Đã thử thật ở local: `PUT /ai-config` có `message`, DB lưu nút **không có** `message`.
- **Nguyên nhân:** `AiConfigService.sanitize()` dựng lại từng nút chỉ với các trường nó liệt kê (`id, label, action, enabled, agentIds`). Chính chú thích trong hàm cũng ghi "anything not listed is silently dropped on save", nhưng `message` bị quên.
- **Fix (T08):** `sanitize()` giữ `message` (cắt khoảng trắng, tối đa 300 ký tự) và `emoji` mới. Jest `ai-config.service.scenario-emoji.spec.ts`.
- **Phòng ngừa:** thêm trường vào một kiểu được "dựng lại" thì phải thêm vào hàm dựng và có test "lưu xong đọc lại".

## BUG-023 · Menu Chat đổi kiểu sau lần vẽ đầu
- **Hiện tượng:** TC-08-03 có lúc đọc nền chip `rgb(219, 234, 254)` (pill xanh của kiểu mặc định) thay vì trắng. TC-08-06 xác nhận: bỏ cơ chế chờ thì **6/6** lần chip xuất hiện đầu tiên ở kiểu mặc định.
- **Nguyên nhân:** khách đã đăng nhập (luồng app proxy) nhận token trước khi session/ensure trả cấu hình tenant. Danh sách nút tải bằng token đó nên vẽ ngay, khi `widgetTheme` còn null.
- **Fix (T08):** store có cờ `tenantConfigLoaded`, bật khi session/ensure trả về hoặc lỗi. Menu chỉ vẽ khi cờ bật hoặc đã có theme cache từ lần trước.
- **Phòng ngừa:** phần UI có kiểu phụ thuộc cấu hình tenant thì chờ cấu hình (hoặc cache), đừng vẽ bằng mặc định rồi đổi.

## BUG-021 · Chữ cam không đủ tương phản
- **Hiện tượng:** cam thiết kế `#FF6900` trên nền trắng = 2.89:1, dưới chuẩn WCAG AA cho chữ thường (4.5:1). Màu này đang dùng làm chữ ở câu "Your order is on the way!" của thẻ giao hàng (T03, đậm 14px, chưa phải "chữ lớn").
- **Đã có:** token `warning-ink` `#C94F00` (4.56:1, vẫn là màu cam). T06 dùng nó cho "Write Review"; ngôi sao vẫn `#FF6900`.
- **Đề xuất (T15):** chuyển câu của T03 sang `text-warning-ink`; rà các chỗ khác dùng `text-warning` cho chữ.

## BUG-019 · Test đọc danh sách DOM không chờ
- **Hiện tượng:** khi chạy toàn bộ desktop lúc làm T07, TC-02-04 đỏ: "Expected: > 0, Received: 0". Ảnh lúc fail cho thấy dòng và thời gian ("Just now", "10mins ago") đã hiện, chỉ là sau lúc test đọc. Trong cổng CI ×2 nó vẫn xanh, nên đây là lỗi chập chờn theo tải máy, không do T07.
- **Nguyên nhân:** `locator.allInnerTexts()` và `evaluateAll()` **không tự chờ**: chúng đọc DOM ngay lúc gọi. TC-02-04 gọi ngay sau khi mở tab, trước khi feed tải xong. TC-03-03/04 có cùng rủi ro: pill có thể hiện theo trạng thái đơn trước khi dữ liệu tracking về, rồi test đọc `data-state` của các bước còn thiếu.
- **Fix:** TC-02-04 chờ `notif-time` đầu tiên hiện rồi mới đọc. TC-03-03/04 đọc `data-state` bằng `expect.poll`. Sau fix: `@T02|@T03` ×3 với 4 worker: 33/33.
- **Phòng ngừa:** trước `allInnerTexts()` / `allTextContents()` / `evaluateAll()` luôn có một assertion tự chờ (`toBeVisible`, `toHaveCount`), hoặc bọc trong `expect.poll`.

## BUG-012 · Kiểm tra CI báo đỏ trên Windows
- **`npm run radius:check`** crash với đường dẫn `D:\D:\…\apps\widget\src`. Nguyên nhân: `scripts/check-radius-tokens.mjs:26` dùng `new URL('..', import.meta.url).pathname`, trên Windows trả về `/D:/…`. Fix: `fileURLToPath(new URL('..', import.meta.url))`.
- **`node scripts/check-migrations.mjs --check`** báo manifest "out of date". Nguyên nhân: `core.autocrlf=true` khiến `sql/artefacts.tsv` trong working tree có CRLF, trong khi generator viết LF, mà phép so sánh là so chuỗi tuyệt đối. Trên Linux (CI) cả hai đều xanh: đã kiểm bằng `git -c core.autocrlf=false archive HEAD` chạy trong `node:20-alpine`.
- **Bẫy khi kiểm:** `git archive` cũng áp dụng `autocrlf`. Phải dùng `-c core.autocrlf=false` khi muốn tái hiện môi trường Linux.
- **Đề xuất:** sửa `pathname` → `fileURLToPath`; thêm `.gitattributes` `sql/artefacts.tsv text eol=lf` (hoặc so sánh sau khi bỏ `\r`).

## BUG-014 · E2E chập chờn do request còn dang dở khi test kết thúc
- **Hiện tượng (2026-11-10):** khi chạy cả bộ desktop, 2–3 ca vốn xanh (TC-09-01, TC-14-01 [ko], TC-15-03) fail với `apiResponse.json: Response has been disposed`. Chạy lại riêng thì 12/12 xanh.
- **Nguyên nhân:** widget gọi `session/ensure` 2 lần ở dev (StrictMode, BUG-003). Test kết thúc ngay sau lần thứ nhất, context bị đóng trong khi route handler của mock (`e2e/fixtures/mock-api.ts`) vẫn đang `await res.json()` cho lần thứ hai. Playwright quy lỗi đó cho test vừa pass.
- **Fix:** bọc handler; lỗi kiểu teardown (`disposed`/`closed`/`Target closed`/`Test ended`) thì bỏ qua, mọi lỗi khác vẫn làm test fail. Sau fix: 39 ca × 2 lần = 78/78 xanh.
- **Phòng ngừa:** route handler async của mock luôn phải chịu được việc context đóng giữa chừng. Cổng CI giờ có 18 ca dùng mock, nên lỗi chập chờn ở đây sẽ chặn deploy.

## BUG-013 · Repo public
- `GET /repos/amoeba-group/ivyusa-sharp-talk` → `visibility: public`, `fork: true`; fork PR approval = `first_time_contributors` (2026-11-10).
- **Hệ quả đã xử lý:** CD không dùng self-hosted runner hay SSH từ GitHub, mà để server tự kéo bản mới (PLN-261110-IVY-CICD §2).
- **Còn mở:**
  - Repo công khai `env/backend/.env.development` (secret dev, VAPID key) và tài liệu có IP/SSH user của staging.
  - Nên chuyển fork PR approval sang `all_external_contributors`: Settings → Actions → General.
  - Cân nhắc chuyển repo sang private. Nếu chuyển, CD vẫn chạy được nhưng server **bắt buộc** phải có token và deploy key để `git fetch`.
  - **Quyết định thuộc về chủ repo.**

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
