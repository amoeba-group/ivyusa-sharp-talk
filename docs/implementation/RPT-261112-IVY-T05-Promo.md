# RPT-261112 — IVY T05 · Notifications: Promo (coupon / sự kiện, mã coupon, link)

Kế hoạch: [PLN-261112-IVY-T05](../plan/PLN-261112-IVY-T05-Promo.md), duyệt ngày 2026-11-12. Task: ivy-docs/TASKS.md T05. SPEC: SCR-IVY-07, G-09, Q-16.

**Quyết định của chủ dự án (2026-11-12):**
1. Duyệt kế hoạch.
2. Loại và mã coupon **lưu trong campaign**. Thông báo chỉ ghi nó thuộc campaign nào. Hai trường này **khoá sau khi gửi**.
3. Một campaign có một mã, mọi khách nhận cùng mã. Coupon riêng cho từng khách tách thành task sau.

## 1. Thay đổi

### Dùng chung (`packages/types`, không có migration)

| File | Nội dung |
|---|---|
| `common/promo.ts` (mới) | `PROMO_KIND` (`event` / `coupon`), `isValidCouponCode()` (1–32 ký tự `[A-Za-z0-9_-]`), `promoFromContent()`. Không phụ thuộc gì, để widget và console import thẳng file nguồn |
| `common/enum.types.ts` | `NOTIFICATION_REF.CAMPAIGN = 'campaign'` |
| `api/widget.types.ts` | `NotificationResponse.kind?`, `couponCode?` |

### API

| File | Nội dung |
|---|---|
| `campaign/campaign.service.ts` | • Tạo / sửa / gửi: kiểm tra `content.kind` và `content.couponCode` (trim; event thì bỏ mã).<br>• Đã gửi (`sentAt` có giá trị) thì đổi loại / mã → **E5159**. Đổi `status` về draft cũng không mở khoá.<br>• Khi gửi: mã coupon đi qua `ModerationService` cùng tiêu đề và nội dung. Bị chặn hoặc bị che → không gửi, audit `coupon_code_moderated`.<br>• Mỗi thông báo ghi `refType 'campaign'` + `refId` |
| `notification/notification-promo.service.ts` (mới) | Khi trả danh sách: tra campaign theo lô (1 truy vấn khoá chính), chỉ campaign **cùng tenant** với dòng. Trả `kind` + `couponCode` |
| `notification/notification.controller.ts`, `.mapper.ts`, `.module.ts` | Gắn loại + mã vào response. Module đọc entity `Campaign` (chỉ đọc) |
| `global/constant/error-code.constant.ts` | **E5158** `CAMPAIGN_PROMO_INVALID`, **E5159** `CAMPAIGN_PROMO_LOCKED` |

### Widget

| File | Nội dung |
|---|---|
| `lib/promo.ts` (mới) | `promoKind()`: loại từ API, thông báo cũ thì đoán theo link. `safeLink()`: chỉ `https`. `copyText()`: clipboard, có cách dự phòng |
| `notifications/NotificationIcon.tsx`, `tailwind.config.js` | Coupon: quà trên nền navy `#1A2E6B`. Sự kiện: lấp lánh trên nền magenta `#E91E8C`. `data-testid="promo-icon"` |
| `notifications/NotificationsTab.tsx` (`Row`) | • `promo-item` + `data-kind` bọc icon + nội dung.<br>• Tiêu đề promo xuống tối đa 2 dòng.<br>• Ô mã `coupon-code` + nút **Copy code**, có toast thành công / lỗi.<br>• Bấm thẻ có link → `<a target="_blank">`, đánh dấu đã đọc.<br>• Đang chọn: không có Copy, không có link |
| `i18n/locales/*.ts` ×6 | `copyCode`, `codeCopied`, `copyFailed` |

### Console

| File | Nội dung |
|---|---|
| `domain/campaigns/CampaignsPage.tsx` | • Ô **Type** (Event / Coupon, mặc định Event).<br>• Ô **Coupon code** (chỉ khi Coupon; tối đa 32 ký tự). Mã sai → chữ đỏ và Save mờ.<br>• Campaign đã gửi: 2 ô mờ, kèm "Can't be changed after sending" |
| `campaigns.service.ts`, `campaigns.hooks.ts` | Kiểu `kind` / `couponCode` / `sentAt`. Lỗi E5158 / E5159 hiện theo ngôn ngữ console, không hiện câu tiếng Anh của API |
| `i18n/locales/*/campaigns.json` ×6 | 8 chữ mới |

### Test và tài liệu

| File | Nội dung |
|---|---|
| `packages/types/src/common/promo.spec.ts` (mới) | 4 ca |
| `apps/api/.../campaign/campaign.promo.spec.ts` (mới) | 9 ca: kiểm tra, khoá, moderation, `refType` |
| `apps/api/.../notification/notification-promo.service.spec.ts` (mới) | 4 ca: gắn đúng, không lộ tenant khác, không truy vấn thừa, response |
| `apps/widget/test/promo.test.mjs` (mới) | 4 ca: `promoKind`, `safeLink` |
| `e2e/tests/05-promo.spec.ts` | Sửa TC-05-04 (cùng kiểu BUG-017). Thêm TC-05-05 (thông báo cũ), TC-05-06 (copy lỗi), TC-05-07 (đang chọn). TC-05-03 kiểm thêm toast |
| `e2e/package.json` | `test:ci` thêm `@T05` |
| `ivy-docs/{TASKS,TEST-CASES,BUGS,SPEC}.md`, GUIDE §7, PLN | Trạng thái, kết quả, BUG-017 (thêm TC-05-04). SPEC: SCR-IVY-07, selector promo ✅, G-09 ✅, Q-16 chốt |

**Khác kế hoạch:** ô Type trong console là 2 nút radio như wireframe. Không có điểm nào khác.

## 2. Kiểm thử (local, 2026-11-12)

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit`: api, widget, web, types, e2e | sạch |
| `vite build` widget, web | OK |
| Jest API campaign + notification + order | 17 suite, **167/167** |
| Jest `packages/types` | **202/202** |
| `node --test apps/widget/test/*.mjs` | **99/99** |
| `npm run i18n:check` (widget + console) | đủ 6 ngôn ngữ |
| `radius:check` (container Linux) | sạch |
| `@T05` | **7/7** (baseline 0/4); lặp ×3 với 2 worker: 21/21 |
| Cổng CI mới `@smoke\|@T00\|@T01\|@T02\|@T03\|@T04\|@T05\|@T07\|@T13`, `--repeat-each=2` | **120/120** |
| Toàn bộ desktop | **72 pass / 22 fail** (trước T05: 65 / 26). Mọi ca đỏ thuộc T06, T08–T12 chưa làm |

**Tích hợp local (API + MySQL + RabbitMQ thật):**
- Mã ` SCHOOL20 ` → lưu thành `SCHOOL20`. Mã "TWO WORDS" → E5158.
- Gửi → thông báo `in_app` có `ref_type campaign`, `ref_id` của campaign.
- Feed widget (`GET /notifications?category=event`) trả `kind: coupon`, `couponCode: SCHOOL20`, kèm link.
- Sau khi gửi: đổi mã → E5159; chỉ sửa nội dung → OK, mã giữ nguyên.
- Sau đó đã xoá campaign và thông báo thử. Tài khoản `dev@amoeba.group` được tạm tắt cờ "phải đổi mật khẩu" để đăng nhập test, rồi **bật lại**. Còn lại 1 dòng audit `campaign.dispatched`; audit là nhật ký chỉ ghi thêm nên giữ nguyên.

**Ảnh chụp:**
- Widget EN / KO / VI chip Promo: coupon navy có mã IVY10 / SCHOOL20 + Copy code, sự kiện magenta, toast "Code copied" / "코드를 복사했습니다".
- Console: campaign đã gửi (Type, Coupon code mờ); campaign mới với mã sai (chữ đỏ, Save mờ).

**Lưu ý môi trường:** sau khi thêm màu vào `tailwind.config.js`, Vite dev ở local vẫn dùng cấu hình cũ cho tới khi khởi động lại `npm run dev`. Bản build (CI và production) không bị.

## 3. Ghi chú cho production

- **Có hiệu lực ngay sau deploy:**
  - Thông báo khuyến mãi cũ đổi sang màu thiết kế (đoán theo link như trước). Thẻ có link mở được link.
  - Mã coupon chỉ có ở campaign tạo hoặc gửi **sau** deploy, với Type = Coupon.
  - Layout 3 tab hiện tại: thẻ promo ở tab Notifications → chip **Event** / **All**. Khi tab Orders tắt: chip **Promo**.
- **Console:**
  - Màn Campaigns của mọi tenant có thêm 2 ô. Mặc định Event, nên campaign tạo như cũ vẫn chạy như cũ.
  - Campaign đã gửi không đổi được loại và mã nữa; các ô khác vẫn sửa được.
- **App mobile:** `kind` / `couponCode` là trường thêm vào. Thông báo campaign mới có `refType: 'campaign'`. Code app không nằm trong repo này: cần người làm app xác nhận app bỏ qua giá trị lạ.
- **Bảo mật:** campaign của tenant khác không bao giờ được tra. Link chỉ mở `https`. Mã coupon không phải dữ liệu cá nhân.
- Không có SQL, không có migration, không gửi push / email / SMS mới. Email / SMS không kèm mã coupon (kênh ngoài vẫn là giả lập).

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Commit | ⏳ điền sau khi push lên `deploy/talk-ivyusa` |
| CI | ⏳ |
| Server `talkaibotprd01` | ⏳ Cron sẽ deploy vài phút sau khi CI xanh. Máy dev bị ELB trả 403, nên không tự kiểm tra được. Chủ dự án kiểm tra bằng `tail -n 30 ~/ivy-autodeploy.log` |
| SQL / migration | Không có |
