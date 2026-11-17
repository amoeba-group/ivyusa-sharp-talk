# RPT-261117 — IVY T16 · Deploy talk.ivyusa.com & smoke production

Kế hoạch: [PLN-261116-IVY-T16](../plan/PLN-261116-IVY-T16-Deploy-Smoke.md), duyệt ngày 2026-11-17 (`1. ok 2. a 3. b 4. a`). Task: ivy-docs/TASKS.md T16.

**Trạng thái: ✅ deploy đã xác minh trên server; smoke production TC-16-01..03 xanh 3/3 (2026-11-17).**

## 1. Thay đổi

Không có code, không có SQL. Chỉ tài liệu:

| File | Nội dung |
|---|---|
| `README.md` §8, `SPEC.md` §12.1 / §12.2 / §14, `CLAUDE.md` §6, `CONFIG.md` §7 | BUG-005: ghi đúng hai production đang chạy (`sharptalk.amoeba.site`, `talk.ivyusa.com`); bộ template `docker/production/` chưa dùng |
| ivy-docs (TASKS, BUGS), PLN, RPT T15 | Trạng thái |

## 2. Xác minh trên server (2a)

Chủ dự án chạy trên `talkaibotprd01` (SSM, user `appops`, `/docker/apps/talktalk`) ngày 2026-11-17 và gửi ảnh màn hình.

| Kiểm tra | Kết quả |
|---|---|
| `git log --oneline -1` | `6cd25fe8` (HEAD = `origin/deploy/talk-ivyusa`) |
| `ivy-autodeploy.sh --status` → `deployed` | `3b0263e8`, 2026-11-16T05:24:49Z |
| `--status` → `last` | 2026-11-17T03:52:01Z, `6cd25fe8` fast-forward, không deploy (không đổi file chạy từ `3b0263e8`) |
| `~/ivy-autodeploy.log` | `8f264e88` và `1a9bc75f`: "not deployable: run failure" (đúng: CI đỏ thì không deploy). `3b0263e8`: "deploying … over 6bf9fcfc" → "deployed" (log `~/sharptalk-deploy-20261116-052402-3b0263e8.log`). `0ded01c5`, `6cd25fe8`: fast-forward, không deploy |
| `docker ps` | `sharptalk_widget`, `sharptalk_web`: Up 23 hours — khớp lần deploy 2026-11-16 05:24 UTC. `sharptalk_api`: Up 3 days (healthy). `nginx`, `rabbitmq`, `redis`, `qdrant`: Up 2 weeks. `mysql`: Up 2 weeks (healthy) |

**Kết luận:** production đang chạy code của `3b0263e8` = T15 + sửa BUG-031. Từ `6bf9fcfc` tới đó chỉ đổi `apps/widget`, nên container API không dựng lại là đúng.

**Chưa kiểm:** dòng `successfully started` trong boot log của API (API không khởi động lại trong lần deploy này; container báo healthy) và HTTP status từ ngoài (xem §3).

## 3. Smoke production (3b) — ✅ 3/3

Chạy trên máy dev ngày 2026-11-17 (khoảng 04:40 UTC), theo yêu cầu của chủ dự án.

| TC | Kết quả |
|---|---|
| TC-16-01 health 200, `status: ok` | ✅ (905ms). Chủ dự án cũng mở bằng Chrome: `status: ok`, 04:30:15 UTC |
| TC-16-02 `/widget/` 200, `/widget/embed.js` 200 + content-type javascript | ✅ (1.3s) |
| TC-16-03 bấm launcher → dialog "Support widget" | ✅ (6.6s) |

**Chủ dự án kiểm tay bằng Chrome (ảnh màn hình, 2026-11-17):** `/widget/embed.js` hiện mã nguồn loader; `/widget/?shop=ivyusa.myshopify.com` mở được panel và tab Chat.

**Thấy trong ảnh panel production — cấu hình tenant chưa nhập:** 3 tab (Thông báo · Đơn hàng · Trò chuyện), tiêu đề "ivyusa", lưới 2 cột 6 nút xanh không emoji, lời chào mặc định, ô nhập "Nhập tin nhắn…". Code T01–T15 đã ở trên server; giao diện theo thiết kế (2 tab, 7 chip trắng có emoji, lời chào IVY, "Ask Anything") chỉ hiện sau khi nhập cấu hình console theo các GUIDE của T01, T08, T10, T12.

**Cách chạy khác với `npm run test:prod`:**
- `npm run test:prod` nguyên bản dừng ở `global-setup.ts`: bước này gọi health và `/widget/` bằng `fetch` của Node và nhận 403 (chủ dự án chạy và gửi ảnh).
- Máy dev không có proxy hay VPN, và Chrome trên cùng máy nhận 200. Tức production từ chối client không phải trình duyệt, không phải chặn theo IP như BUG-004 từng ghi.
- 3 test được chạy bằng `playwright test` với project `prod` có sẵn (Chromium), qua một file cấu hình tạm chỉ bỏ `globalSetup`. File tạm đã xoá, không commit. Nội dung test không đổi; test chỉ đọc.
- Việc sửa `global-setup.ts` cho `test:prod` chạy được nguyên bản: chưa làm, ghi ở BUG-004.

## 3b. Cấu hình tenant `ivyusa` trên production (2026-11-17)

Nhập qua console `talk.ivyusa.com`, trong phiên đăng nhập Master của chủ dự án. Trước khi sửa đã lưu bản cấu hình cũ (các response GET của console) ở máy dev: `D:amoeba_localdevivy-prod-backup-20261117` (ngoài repo).

| Mục | Giá trị | Ai nhập | Kiểm lại |
|---|---|---|---|
| Custom widget "Ivyusa Talk": rộng 380 × 600, bo `lg`, chip trắng (`card`), dòng AI dưới ô nhập | T01, T08 | Chủ dự án | `GET /tenants/widget-theme` |
| Lời chào + placeholder, 6 ngôn ngữ | GUIDE Chat-Home §1 | Chủ dự án | `GET /tenants/widget-settings` |
| Tab: Notifications · Chat (bỏ Orders) | T01 | Claude (console) | server trả `tabs: [notifications, chat]` |
| Tiêu đề chào theo tên `Hi, {firstName}`…, 6 ngôn ngữ | PLN T01 §5 | Claude (console) | server trả đủ 6 |
| 8 nút trả lời nhanh theo thứ tự thiết kế, nhãn 6 ngôn ngữ; My Orders tắt | GUIDE Chat-Home §3, Affiliate §1 | Claude (console) | `GET /ai-config`: 9 nút, nút 9 `enabled: false` |
| 11 danh mục Product Help | GUIDE Product-Help §1 | Claude (console) | `GET /ai-config`: 11 mục |
| `cancel_order`, `return_exchange` (+ 2 chip), `affiliate` (+ câu của khách): 6 ngôn ngữ, chép nguyên văn từ GUIDE | GUIDE Product-Help §2–3, Affiliate §2 | Claude (console) | `GET /ai-config` → `scenarioOverrides` có 3 khoá, đủ 6 ngôn ngữ |

**Nhìn trên widget production (chỉ xem, không bấm Accept, không gửi tin):** EN và KO đều 2 tab, panel 380×600, 8 chip có emoji đúng thứ tự, placeholder "Ask Anything" / "무엇이든 물어보세요", dòng AI dưới ô nhập, lời chào IVY Beauty.

**Bấm thử các luồng trên production (2026-11-17, khách vãng lai, EN, có Accept consent; không bấm Apply now):** không có lỗi console hay lỗi API nào.

| Luồng | Kết quả |
|---|---|
| ✨ Product inquiry | ✅ "What do you need help with?" + chip Popular products · How to use · Ingredients · Exchange / Return · Restock alert · Start over |
| Popular products | ✅ 11 danh mục đúng thứ tự + Start over |
| Nails | ❌ "I couldn't load the popular Nails products right now." + link "See all Nails on ivyusa.myshopify.com". Nguyên nhân ở dưới |
| Exchange / Return | ✅ câu 10 ngày + chip Track delivery · Cancel order · Start over |
| Start over | ✅ menu 8 chip hiện lại ở cuối luồng |
| 💼 Affiliate | ✅ bong bóng "How to become an Affiliate?", câu IVY Beauty, 3 thẻ bước, chip Apply now · Learn more · Start over · End |
| Learn more | ✅ câu mặc định |
| End → Skip | ✅ câu hỏi + 4 mặt + Skip → "The chat has ended" |

**Knowledge (GUIDE Product-Help §4):** 11 tài liệu policy / faq / warranty trên production có nội dung đúng bằng bộ demo của seed. Đã **tắt (Deactivate, không xoá)** 6 bài trái chính sách thật: #2 Returns & Exchanges (7 ngày), #6 CS Policy — Returns (30 ngày, gently used, nhãn trả miễn phí), #7 CS Policy — Exchanges (30 ngày), #10 Final Sale (mỹ phẩm đã mở trả được trong 30 ngày), #4 và #8 Order Cancellation (huỷ trước khi chuẩn bị hàng). Bật lại: Knowledge → mở bài → Activate. Còn bật, **chưa đối chiếu với chính sách thật của IVY**: #1 Shipping & Delivery, #3 Warranty, #9 Refunds, #11 Damaged / Defective, #12 US Compliance Notes. Bản sao nội dung 11 bài: `D:\amoeba\_localdev\ivy-prod-backup-20261117\kb-docs`.

**Phát hiện — việc còn mở, cần chủ dự án:**
- **Tenant production chưa kết nối Shopify:** `GET /tenants/me/shopify` trả `credential.configured: false`, chưa từng sync. Vì vậy Popular products không tải được, Dashboard ghi 0 đơn, và các màn dựa vào đơn hàng thật (Order / Delivery, Order Detail, My Orders) chưa có dữ liệu. Cần cài / uỷ quyền app Shopify cho cửa hàng (console → Tenant Settings → Platforms).
- **Storefront URL trống** (`storefrontUrl: null`): link "See all …" trỏ về `ivyusa.myshopify.com` thay vì `ivyusa.com`.
- **AI engine là Built-in Stub** (`AI off (stub)`): câu hỏi gõ tự do chỉ nhận câu dự phòng. Engine Anthropic của nền tảng: `hasApiKey: false`, `selectable: false`. Cần System Admin cấp key và mở cho tenant, hoặc tenant tự thêm engine bằng key riêng (Tenant Settings → Basic → Add engine).
- `affiliate_details` (Learn more) giữ câu mặc định (GUIDE §3: tuỳ chọn). Apply now chưa bấm thử (sẽ gửi mail tới hello@ivyusa.com).

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Code đang chạy trên production | `3b0263e8` (deploy 2026-11-16 05:24 UTC, tự động) |
| Tip của nhánh | `6cd25fe8` (chỉ tài liệu), CI run `44012687424` xanh, server đã fast-forward |
| TC-16-01..03 | ✅ 3/3 (2026-11-17, xem §3) |
| `deploy/profiles/SharpTalk-USA-IVY/CHECKLIST.md` | Tick 3 mục đã có bằng chứng: host, domain, deploy + health. Các mục khác chưa kiểm nên để trống |
| BUG-004 | Open: `npm run test:prod` nguyên bản vẫn dừng ở bước kiểm tra đầu |
| Cấu hình production (T01, T02, T08, T10, T12) | ✅ nhập 2026-11-17, đã bấm thử (§3b). Còn mở: kết nối Shopify, Storefront URL, AI engine |
| Quyền PCD Address / Phone (T04) | ⏳ chủ dự án |
