# RPT-261113 — IVY T11 · Contact Support và form liên hệ

Kế hoạch: [PLN-261112-IVY-T11](../plan/PLN-261112-IVY-T11-Contact-Form.md), duyệt ngày 2026-11-12. Task: ivy-docs/TASKS.md T11. SPEC: SCR-IVY-13, G-17, G-18, BR-14, BR-15, Q-08, Q-15. Lỗi: BUG-010 (đóng), BUG-024 (phần Contact).

**Quyết định của chủ dự án (2026-11-12, `1. ok 2. a 3. a 4. a`):**
1. Duyệt kế hoạch.
2. Email hỗ trợ của IVY: **hello@ivyusa.com**.
3. Contact Support của IVY chỉ có **thẻ email**, đúng thiết kế.
4. Team được báo bằng **mail tới email hỗ trợ, Reply-To là email khách**. Console có thêm chỗ xem inquiry.

Ảnh 3 frame `1006:5650`, `1006:6529`, `1006:6597` do chủ dự án gửi; mình đối chiếu theo các ảnh đó.

## 1. Thay đổi

**Migration:** `sql/261112-inquiry-contact-form.sql` thêm 4 cột nullable vào `inquiries`. **Phải chạy trên production trước khi push** ([GUIDE §1](../guide/GUIDE-261113-IVY-Contact-Support-Config.md)).

| Phần | File | Nội dung |
|---|---|---|
| SQL | `sql/261112-inquiry-contact-form.sql`, `sql/artefacts.tsv` | `contact_name VARBINARY(512)`, `contact_email VARBINARY(512)`, `message VARBINARY(8192)`, `language VARCHAR(8)`. Có câu rollback. Manifest cập nhật, để script deploy trên server nhận ra SQL chưa chạy |
| Types | `common/inquiry.ts` (mới), `api/widget.types.ts` | Luật form dùng chung cho widget và API: `inquiryProblems()`, `normalizeInquiry()`, `isEmailAddress()`. `contactChannels()`: kênh nào hiện. `SessionResponse.customerEmail`, `WidgetCopy.supportEmail / supportPhone / contactLiveChat`, `InquiryCreatedResponse` |
| API | `inquiry/*` (entity, DTO, service, mapper, controller, module) | `POST /inquiries {name, email, message, conversation_id?}`. Thứ tự kiểm: consent, luật form, tối đa 5 / phiên / giờ (Redis), email đã xin xoá. Khách vãng lai được tạo lead **chỉ từ email**, để tên khách gõ không đè tên đã có. Chỉ gắn cuộc chat của chính phiên đó. Audit `inquiry.created`, không ghi PII. Mail tới email hỗ trợ (Reply-To = khách), chạy nền, không làm chậm câu trả lời; không có SMTP thì ghi log một lần. Admin: danh sách (email che, nội dung rút gọn, lọc trạng thái), `GET /admin/inquiries/:id` (đầy đủ, audit `inquiry.viewed`), `PATCH` answered / open (audit) |
| API | `global/constant/error-code.constant.ts` | E5160 `INQUIRY_INVALID`, E5161 `INQUIRY_LIMIT`, E5162 `INQUIRY_NOT_FOUND`, E5163 `SUPPORT_CONTACT_INVALID` |
| API | `infrastructure/external/mailer.service.ts` | `MailMessage.replyTo` |
| API | `privacy/privacy.service.ts` | Xoá dữ liệu: gỡ liên kết **và xoá** tên / email / nội dung của inquiry. DSAR: xuất 4 trường mới |
| API | `session/*`, `embed/embed.controller.ts` | `customerContactEmail()`: chỉ email của chính khách của phiên (khách đã gắn với phiên, hoặc email host truyền cho phiên claimed). Trả trong `ensure` và `identify` |
| API | `tenant/*` | `widget_copy` thêm 3 trường. Email viết thường; email / số sai → 400 E5163. Tenant chưa từng cấu hình thì JSON không đổi |
| API | `database/seed.runner.ts` | IVY: `supportEmail: 'hello@ivyusa.com'`. Chỉ áp dụng cho DB mới; production nhập ở console (GUIDE §2) |
| Widget | `chat/ContactCard.tsx` (viết lại) | `ContactAnswer`: bong bóng khách, câu hỏi bot, một thẻ cho mỗi kênh tenant đã cấu hình (📧 email mở form · 📞 `tel:` · 💬 chat với nhân viên), chip Start over. Thẻ đã chọn viền xanh |
| Widget | `chat/ContactForm.tsx` (mới) | Form Name · Email · Message theo `1006:6529`. Lỗi dưới từng ô, không gọi API. Gửi lỗi → toast theo mã lỗi, giữ nội dung. Gửi xong → thẻ tối "YOUR INQUIRY" + bong bóng xác nhận theo `1006:6597` |
| Widget | `chat/ChatTab.tsx` | 2 loại insert mới, `contact` và `contactForm`, gắn đúng vị trí trong luồng (BUG-024); bỏ ô `inline === 'contact'`. Post-action `open_contact` cũng đi đường này. `ToastHost` trong khung chat |
| Widget | `store`, `hooks/useSession*`, `useEmbedCommands`, `PreferencesPanel`, `services/inquiryService.ts`, `lib/types.ts` | Lưu `customerEmail` để điền sẵn; xoá khi đăng xuất / xoá dữ liệu |
| Widget | `i18n/locales/*.ts` ×6 | Bỏ `1588-0000`, `help@ivy.com`, giờ làm việc viết cứng (**BUG-010**). Câu chữ mới cho kênh, form, lỗi, thẻ đã gửi. KO theo thiết kế: 고객센터 연결 방법을 선택해주세요 · 이메일 문의 · 24시간 접수 · 1영업일 내 회신 |
| Console | `settings/ContactSupportCard.tsx` (mới), `SettingsWidgetPage.tsx`, `settings.service.ts`, `settings.hooks.ts` | Settings → Widget → khối **Contact Support**: email, số điện thoại, tick live chat. Email / số sai báo đỏ và khoá nút Save |
| Console | `alerts/InquiriesTab.tsx`, `inquiries.service.ts`, `inquiries.hooks.ts` (mới), `AlertsPage.tsx` | Tab **Inquiries** (có badge số chưa trả lời), lọc trạng thái, hộp chi tiết: **Reply by email** (`mailto:` có tiêu đề và trích nội dung), **Mark answered** / **Open again**, toast |
| Console | `i18n/locales/*/settings.json`, `livechat.json` ×6 | `contactSupport.*`, `alarmCenter.tab_inquiries`, `inquiry.*` |

**Khác kế hoạch:**
- **Tên, email và nội dung đều được mã hoá.** PLN §5 ghi `contact_name VARCHAR(100)` và `message TEXT`; mình đổi sang `VARBINARY` mã hoá, giống tên và ghi chú của khách trong bảng `customers`. Cả 3 đều là dữ liệu cá nhân. Câu SQL gửi bạn chạy là bản đã đổi.
- **File SQL tên `261112-inquiry-contact-form.sql`**, theo cách đặt tên các file gần đây trong `sql/`; PLN ghi `migration_inquiry_contact_form.sql`.
- **Inquiries là một tab trong trang Alarm center** (`/live-chat/alerts?tab=inquiries`), cạnh "Callback requests", không phải mục menu mới trong nhóm Consult. Trang này không có trong menu bên trái: vào bằng chuông 🔔 → View all, hoặc mở thẳng URL. *(Sửa 2026-11-13: bản trước ghi nhầm "Live chat → Alerts", chủ dự án tìm theo đó không thấy.)*
  - Thêm một mục menu phải sửa danh mục menu, gói (plan) và ma trận quyền theo cấp bậc. Tab trong Alerts dùng lại đúng quyền của Live chat (nhãn Consult), như PLN muốn.
  - Danh sách hiện email đã che (`hy***@ivyent.com`). Email đầy đủ chỉ hiện khi mở một inquiry, và lần mở đó được ghi audit; đây là cách PLN D4 mô tả "đọc có ghi audit".
- **Tên được điền sẵn** cùng email khi khách đã đăng nhập, như PLN D2. Ảnh `1006:6529` để trống ô Name.
- **Giờ hiển thị và câu chữ:**
  - thẻ điện thoại không có dòng giờ làm việc (giờ cũ `Mon–Fri 10:00–18:00` cũng viết cứng);
  - thẻ chat ghi "Talk to our team right here in the chat".
- **Thêm TC-11-07, TC-11-08** (ngoài 05, 06 của PLN): tenant không cấu hình gì, và gửi thật lên API.

### Test và tài liệu

| File | Nội dung |
|---|---|
| `packages/types/src/common/inquiry.spec.ts` | 7 ca |
| `apps/api/src/domain/inquiry/inquiry.service.spec.ts` | 9 ca |
| `tenant.service.spec.ts` | +2 ca (Contact Support) |
| `session.mapper.spec.ts` | +1 ca (`customerEmail`), sửa 1 ca |
| `e2e/tests/11-contact.spec.ts` | TC-11-01..04 bám thiết kế hơn. Thêm TC-11-05 (bật live chat), 06 (gửi lỗi), 07 (không cấu hình), 08 (API thật) |
| `e2e/fixtures/{ivy-data,mock-api}.ts` | `SUPPORT_EMAIL = hello@ivyusa.com`; phiên mock trả `customerEmail`; tuỳ chọn `contact` để vá kênh |
| `e2e/package.json` | `test:ci` thêm `@T11` |
| ivy-docs, GUIDE, PLN | TASKS / TEST-CASES / BUGS (BUG-010 đóng, BUG-024) / SPEC (G-17, G-18, Q-08, Q-15 ✅), GUIDE CI §7, [GUIDE-261113-IVY-Contact-Support-Config](../guide/GUIDE-261113-IVY-Contact-Support-Config.md) mới, PLN ✅ |

## 2. Kiểm thử (local, 2026-11-13)

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit` api, widget, web, e2e | sạch |
| `vite build` widget, web; `nest build` api | OK |
| Boot API thật | `Nest application successfully started` sau khi đổi entity |
| SQL local | Chạy câu rollback, rồi chạy file SQL: đủ 4 cột. Chạy đúng lệnh production (GUIDE §1): đúng; chạy lại báo `Duplicate column`. `check-migrations --check`: manifest khớp; file T11 không còn thiếu |
| `npm run typecheck` (turbo, cả monorepo) | sạch |
| Unit API (toàn bộ) | 2839 / 2842. 3 ca đỏ có từ trước và chỉ đỏ trên Windows: `embed-loader` (CRLF), `board-attachment` (dấu `\` trong đường dẫn), `heic-conversion`. Không liên quan T11 |
| Unit types | 215 / 215 (inquiry 7 ca mới) |
| `node --test apps/widget/test/*.mjs` | 106 / 106 |
| `npm run i18n:check` | đủ 6 ngôn ngữ |
| `radius:check` (container Linux) | sạch |
| API thật (local), 17 bước | Lưu cấu hình (email sai → E5163); `ensure` có `supportEmail`, khách vãng lai không có `customerEmail`; chưa consent → 403; email sai → 400 E5160; tạo được; **DB không có bản rõ** của tên / email / nội dung; lần thứ 6 trong giờ → 429 E5161; danh sách che email; chi tiết đầy đủ + 1 dòng audit; Mark answered; id lạ → 404 E5162. Log: đúng một dòng "SMTP_HOST is not set", không có email hay nội dung |
| `@T11` | **8 / 8** (baseline 0 / 4); lặp ×3, 2 worker: 24 / 24 |
| Cổng CI mới (thêm `@T11`), `--repeat-each=2` | **184 / 184** |
| Toàn bộ desktop | **102 pass / 4 fail** (trước T11: 94 / 8). 4 ca đỏ đều là T12 chưa làm |
| Console (Playwright, local) | Khối Contact Support lưu được; tab Inquiries có badge; hộp chi tiết; `mailto:` đúng địa chỉ / tiêu đề / trích dẫn; toast "Marked answered." |

**Ảnh chụp 380px:**
- KO khớp `1006:5650`: 고객센터 연결 방법을 선택해주세요 · 📧 이메일 문의 · 24시간 접수 · 1영업일 내 회신 · hello@ivyusa.com · 처음으로.
- EN khớp `1006:6529`: nhãn NAME / EMAIL / MESSAGE, ô nền xám, nút đen Send Message. Báo lỗi dưới từng ô.
- EN khớp `1006:6597`: thẻ tối YOUR INQUIRY (Name / Email / Message), bong bóng in đậm câu thành công + dòng xám "Please check your inbox…". Thêm chip Start over (PLN §4).

## 3. Ghi chú cho production

- **Bắt buộc theo thứ tự:** chạy SQL (GUIDE §1) → push → CI → server tự deploy.
  - Nếu SQL chưa chạy, cron dừng ở `deploy-self-hosted.sh --check` (`waiting: deploy check failed`), production giữ code cũ, và lần cron sau tự thử lại.
- **Có hiệu lực ngay sau deploy, mọi tenant:**
  - số `1588-0000` và email `help@ivy.com` biến mất khỏi Contact Support;
  - Contact Support trả lời trong luồng chat.
- **IVY cần một bước trên console** (GUIDE §2): nhập `hello@ivyusa.com` vào Settings → Widget → Contact Support.
  - Trước khi nhập, nút Contact Support chỉ có thẻ "Chat with an agent".
- **Mail cho team chỉ đi khi server có `SMTP_HOST`** (GUIDE §3). Không có SMTP thì inquiry vẫn lưu và hiện ở console.
- **Dữ liệu mới:** tên, email, nội dung khách gửi, tất cả được mã hoá. Có trong xoá dữ liệu và DSAR.
- Không gửi push hay SMS.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL production | ✅ 2026-11-13, chủ dự án chạy [GUIDE §1](../guide/GUIDE-261113-IVY-Contact-Support-Config.md) **trước** khi push (`sql/261112-inquiry-contact-form.sql`, 4 cột trên `inquiries`) |
| Commit | `00ee3c0a` (code) + `79dce873` (GUIDE §1 từng bước) trên `deploy/talk-ivyusa`, push 2026-11-13 (`56059d35..79dce873`) |
| CI | ✅ run 43356138455, xong 03:04:47Z: verify ✅, e2e gate ✅ (có `@T11`), deploy-gate ✅ |
| Server `talkaibotprd01` | ✅ **Đã deploy** 2026-11-13 03:06Z, chủ dự án xác nhận bằng `~/ivy-autodeploy.log`: `deploying 79dce873 over 56059d35` → `79dce873 deployed` (log `sharptalk-deploy-20261113-030602-79dce873.log`). Không có dòng `waiting: deploy check failed`: lần kiểm tra trước deploy thấy đủ 4 cột SQL. Cùng log xác nhận các lần deploy T06–T10 (`a136b4ae` … `ab944c43`) đều `deployed` |
| Cấu hình production | • SMTP ✅ 2026-11-13: `SMTP_HOST` trống lúc deploy. Chủ dự án điền tài khoản gửi Office 365 của IVY (cùng tài khoản Odoo dùng), khởi động lại API theo [GUIDE §3.1](../guide/GUIDE-261113-IVY-Contact-Support-Config.md). Lần thử đầu `read ECONNRESET` (mạng chập chờn), lần sau `235 Authentication successful` → `SMTP OK`.<br>• Gửi form thử: chủ dự án gửi và bấm Mark answered trên console. ⏳ Chưa xác nhận mail tới `hello@ivyusa.com`.<br>• Email hỗ trợ trong console (§2): ⏳ chưa xác nhận |

## 5. Sửa sau deploy

| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-11-13 | Tài liệu: đường vào Inquiries là chuông 🔔 → View all → Alarm center, hoặc `/live-chat/alerts?tab=inquiries` | Bản trước ghi "Live chat → Alerts", không có trong menu; chủ dự án tìm không thấy |
| 2026-11-13 | Tab Inquiries mặc định lọc **All** (trước: Open); "All" đứng đầu ô lọc. `apps/web/src/domain/alerts/InquiriesTab.tsx` | Chủ dự án yêu cầu: bấm Mark answered thì tin biến mất khỏi danh sách mặc định, khó tìm lại. Số đỏ trên tab vẫn đếm tin Open. Kiểm tra: `tsc` + `vite build` web, Playwright trên console local (mặc định All: 10 dòng gồm 1 Answered; chọn Open: 9 dòng) |
