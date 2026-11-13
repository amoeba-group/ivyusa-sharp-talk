# RPT-261113 — IVY T12 · Affiliate và đánh giá khi kết thúc chat (CSAT)

Kế hoạch: [PLN-261113-IVY-T12](../plan/PLN-261113-IVY-T12-Affiliate-CSAT.md), duyệt ngày 2026-11-13. Task: ivy-docs/TASKS.md T12. SPEC: SCR-IVY-14, G-19, G-20, BR-12, BR-13, Q-12. Lỗi: BUG-024 (phần Affiliate, đóng), BUG-025 (mới, đóng).

**Quyết định của chủ dự án (2026-11-13, `1. ok 2. a 3. a 4. a`):**
1. Duyệt kế hoạch.
2. **Apply now** mở form liên hệ của T11, nội dung điền sẵn. Đơn vào tab Inquiries và mail tới `hello@ivyusa.com`.
3. Thêm nút thứ 8 **"💼 Affiliate"** cuối menu IVY (thiết kế có kịch bản nhưng không vẽ lối vào).
4. Câu chữ 3 bước theo thiết kế: **IVY Beauty**, duyệt **1–3 business days**, hoa hồng **10%**.

Figma MCP hết lượt gọi; mình đối chiếu theo chữ trong SPEC SCR-IVY-14 (đã chép từ thiết kế).

## 1. Thay đổi

**Không có SQL.**

| Phần | File | Nội dung |
|---|---|---|
| API | `chat/scenario-scripts.ts` | Kịch bản `affiliate` (câu chung, không tên shop, không %) và `affiliate_details` (Learn more), đủ 6 ngôn ngữ. Chip điều khiển mới `affiliate_apply`. Nút Action `affiliate` chạy kịch bản `affiliate` (`SCRIPT_BY_BUTTON_ACTION`), nên console hiện nó là "Menu button" |
| API | `database/seed.runner.ts` | IVY: nút thứ 8 💼 Affiliate; câu chữ `affiliate` của IVY ở cả 6 ngôn ngữ (KO đúng chữ thiết kế). Chỉ áp dụng cho DB mới |
| API | `ai-engine/ai-config.service.scenario-copy.spec.ts` | Kịch bản affiliate đi từ nút; mọi chip của kịch bản có sẵn đều dẫn tới đâu đó; câu trả lời có đúng 3 dòng bước ở mọi ngôn ngữ |
| Widget | `lib/script-steps.ts` (mới) + `test/script-steps.test.mjs` | Tách câu trả lời kịch bản: câu mở đầu · các dòng `1. **Tên** — mô tả` · câu kết. Cần ít nhất 2 dòng liền nhau |
| Widget | `chat/MessageBubble.tsx` | Câu trả lời **kịch bản** (tin có chip) có danh sách bước → bong bóng + thẻ bước nền tím nhạt (`data-testid="script-steps"`) + bong bóng. Câu trả lời của AI / nhân viên giữ nguyên |
| Widget | `chat/ChatTab.tsx` | Affiliate → `scenario('affiliate')`. Chip `end_chat` → kết thúc ngay (**BUG-025**); `affiliate_apply` → form liên hệ insert (`purpose: 'affiliate'`). Đánh giá: câu hỏi → thẻ → cảm ơn → khối "The chat has ended" (chờ tới khi khách chọn hoặc Skip). Skip nhớ theo cuộc chat. Ẩn chip sau khi chat kết thúc. Bỏ ô `inline === 'affiliate'` |
| Widget | `chat/CsatCard.tsx` | Chế độ `rating`: tiêu đề + 4 mặt (lưu 1·3·4·5) là nút có nhãn + Skip, `data-testid="csat-card"`. Bỏ trạng thái "đã đóng" nội bộ (ChatTab giữ). Chế độ `survey` giữ 5 mặt |
| Widget | `chat/ContactForm.tsx` | `asked` (bong bóng khách "Apply now"), `lead` (câu dẫn riêng), `defaults.message` (điền sẵn) |
| Widget | `chat/reply-chips.ts` + test | `END_CHAT_ID`, `AFFILIATE_APPLY_ID`; Start over chèn **trước** End |
| Widget | `chat/AffiliateCard.tsx` (xoá), `services/miscService.ts`, `lib/types.ts` | Bỏ thẻ cũ và lời gọi `/affiliate/apply`, `/affiliate/status` (API giữ nguyên) |
| Widget | `i18n/locales/*.ts` ×6 | `csatPrompt`, `csatTitle` (thay `csatQuestion`), `csatThanks`, `csatDismiss` = Skip, `csatLevel` (4 mặt theo thiết kế: Dissatisfied · Neutral · Satisfied · Very satisfied; KO 불만족 · 보통 · 만족 · 매우 만족), `endedTitle` "The chat has ended" / KO 상담이 종료되었습니다, `endedThanks`, `contact.form.affiliateLead` / `affiliateMessage`. Bỏ khối `affiliate.*` cũ |
| Console | `ai-settings/ScenarioReplyEditor.tsx`, `aiSetting.json` ×6 | `affiliate_apply` trong danh sách chip; dòng gợi ý "Numbered lines show as step cards in the widget…" |
| E2E | `12-affiliate-csat.spec.ts` | Consent thật (kịch bản chạy trên API thật). TC-12-01..04 + **TC-12-05** (Apply now: form điền sẵn, `POST /inquiries`) + **TC-12-06** (Learn more nằm dưới các bước; chip Apply now · Start over · End) |
| E2E | `fixtures/ivy-data.ts`, `fixtures/mock-api.ts`, `08-chat-home.spec.ts`, `package.json` | Menu mock 8 nút; End và đánh giá đi API thật nhưng vẫn được ghi lại (mock cũ để cuộc chat thật còn mở, lần poll 5 giây sau làm thẻ đánh giá biến mất); bỏ mock `/affiliate/*`. TC-08-02 đếm theo fixture (7 + Affiliate). `@T12` vào `test:ci` |
| Docs | ivy-docs (TASKS, TEST-CASES, BUGS, SPEC), GUIDE CI §7, [GUIDE-261113-IVY-Affiliate-Config](../guide/GUIDE-261113-IVY-Affiliate-Config.md) (mới), PLN | |

**Khác kế hoạch:**
- **Thẻ "Your inquiry" và bong bóng xác nhận** của Apply now dùng đúng chữ của form liên hệ T11 ("Our support team will review your inquiry…"). Không viết câu riêng cho đơn affiliate.
- **Chip của tin nhắn cuối và hàng chip gợi ý được ẩn** sau khi chat kết thúc, kể cả khi nhân viên kết thúc. PLN chỉ nói ẩn chip; hàng gợi ý ẩn theo cho nhất quán.
- **Câu cảm ơn và câu hỏi của widget** chỉ hiện khi thẻ đánh giá xuất hiện **sau** khi chat kết thúc. Khi chính sách đóng chat của tenant xin đánh giá lúc chat còn mở (PLN-261026), server đã tự nói câu hỏi / cảm ơn, nên widget không nói lặp.

## 2. Kiểm thử (local, 2026-11-13)

| Loại | Kết quả |
|---|---|
| Typecheck | widget, API, console: sạch |
| Build | `vite build` widget, console: OK |
| Unit widget | 112/112 (thêm 6: `script-steps` 5, Start over trước End 1) |
| Unit API | chat + ai-engine + inquiry: 448/448 |
| i18n | `npm run i18n:check`: đủ 6 ngôn ngữ |
| E2E T12 | 6/6; lặp ×3: 18/18 |
| E2E cổng CI mới (có `@T12`) ×2 | 196/196 |
| E2E toàn bộ desktop | **108 / 108** xanh (trước T12: 102 / 106, 4 ca đỏ đều thuộc T12) |
| Ảnh chụp | KO khớp chữ thiết kế SCR-IVY-14: thẻ bước, chip 지금 신청하기 · 더 알아보기 · 처음으로 · 종료, thẻ 상담 만족도를 선택해주세요 với 4 mặt + 건너뛰기, 소중한 의견 감사합니다 → 상담이 종료되었습니다. EN tương ứng. Apply now: form điền sẵn |

## 3. Ghi chú cho production

- **Không có SQL.** Push → CI xanh → server tự deploy.
- Sau deploy, chủ dự án làm [GUIDE-261113-IVY-Affiliate-Config](../guide/GUIDE-261113-IVY-Affiliate-Config.md): §1 nút thứ 8, §2 câu chữ IVY ở 6 ngôn ngữ (khoảng 10 phút). Chưa làm thì khách chưa thấy nút; nếu nút có mà chưa sửa câu thì câu trả lời là câu chung (không có "IVY Beauty", "10%").
- **Mọi khách, ngay sau deploy:** thẻ đánh giá 4 mặt + Skip; câu kết thúc "The chat has ended"; khối kết thúc nằm dưới thẻ đánh giá.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit | `d85127fd` trên `deploy/talk-ivyusa`, push 2026-11-13 (`cf5f53ad..d85127fd`) |
| CI | ✅ run 43367464469, xong 04:48:33Z: verify ✅, e2e gate ✅ (có `@T12`), deploy-gate ✅ |
| Server `talkaibotprd01` | ⏳ **Chưa xác nhận.** Cron deploy vài phút sau khi CI xanh. Máy dev bị ELB trả 403, nên không tự kiểm tra được. Chủ dự án kiểm tra bằng `tail -n 3 ~/ivy-autodeploy.log`: tìm `d85127fd deployed` |
| Cấu hình production | ⏳ Chủ dự án làm [GUIDE-261113-IVY-Affiliate-Config](../guide/GUIDE-261113-IVY-Affiliate-Config.md): §1 nút 💼 Affiliate, §2 câu chữ IVY ở 6 ngôn ngữ |
