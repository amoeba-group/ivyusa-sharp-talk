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
| BUG-011 | Pill trạng thái hiển thị text server **chưa dịch**, màu đoán theo chữ | Widget / i18n | 🟡 | Fixed: feed thông báo (T02), thẻ giao hàng (T03), Order Detail (T04). Còn: danh sách đơn, feed inquiry (T09) | T02 · T03 · T04 · T09 |
| BUG-012 | `radius:check` và `check-migrations --check` báo đỏ trên Windows dù CI (Linux) xanh | Tooling | 🟡 | Open (CI không ảnh hưởng) | T00-d |
| BUG-014 | E2E chập chờn: "apiResponse.json: Response has been disposed" làm fail test đã pass | E2E harness | 🟡 | Fixed (T01) | T01 |
| BUG-015 | Feed thông báo hiện mỗi sự kiện **tới 5 lần** (1 dòng cho mỗi kênh in_app/email/sms/web_push/push) và badge đếm cả 5 | API | 🟠 | Fixed (T02) | T02 |
| BUG-016 | Fixture e2e "hôm qua" = 26 giờ trước → TC-02-02 đỏ từ 00:00–02:00 giờ New York | E2E harness | 🟡 | Fixed (T02) | T02 |
| BUG-017 | TC-03-05 đọc URL của tab mới trước khi tab điều hướng → luôn nhận chuỗi rỗng (TC-05-04 cùng lỗi) | E2E harness | 🟡 | Fixed (T03, T05) | T03 · T05 |
| BUG-018 | TC-01-06 đo độ rộng panel ngay khi mở → đỏ 11/15 khi chạy song song (panel mở ở 404px trước khi theme 380px về) | E2E harness · Widget | 🟡 | Fixed test (T03). Chớp 404→380px khi mở rất sớm: Open, mức thấp | T01 · T03 |
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

## BUG-020 · Test khớp chữ ở tab bị ẩn
- **Hiện tượng:** TC-04-04 đỏ "strict mode violation… resolved to 2 elements": `#IVY-39891` ở Order Detail và tin nhắn chat. Màn vẫn chạy đúng (đã chuyển sang Chat và gửi câu hỏi). TC-04-03 cũng vậy với "United States": dòng địa chỉ và câu "…AI service provider in the United States…" trong tab Chat.
- **Nguyên nhân:** tab đã mở thì vẫn được gắn trong trang, chỉ bị ẩn (`WidgetPanel`, để giữ cuộc chat). Strict mode của Playwright đếm cả phần tử bị ẩn, và `getByText` mặc định so khớp một phần chuỗi.
- **Fix:** TC-04-04 tìm trong `getByRole('tabpanel')`, tức chỉ tab đang hiện. TC-04-03 dùng `exact: true`. T04 ×3: 21/21.
- **Phòng ngừa:** chữ có thể xuất hiện ở tab khác thì thu phạm vi vào tab đang hiện, hoặc so khớp chính xác.

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
