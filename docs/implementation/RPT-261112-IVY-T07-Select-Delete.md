# RPT-261112 — IVY T07 · Chọn & xoá thông báo

Kế hoạch: [PLN-261111-IVY-T07](../plan/PLN-261111-IVY-T07-Select-Delete.md), duyệt ngày 2026-11-12. Task: ivy-docs/TASKS.md T07. SPEC: SCR-IVY-09, G-11, BR-09.

**Quyết định của chủ dự án (2026-11-12):**
1. Duyệt kế hoạch.
2. "Delete All Notifications" chỉ xoá thông báo **của chip đang xem**.
3. Vuốt trái để xoá: chưa làm ở T07, để T15 cân nhắc.

## 1. Thay đổi

### API (không có migration)

| File | Nội dung |
|---|---|
| `notification/dto/request/notification.request.ts` | `DeleteNotificationsRequest` nhận thêm `categories` (chỉ các loại có thật, không nhận `'all'`) và `scope` (`order` / `notice`) |
| `notification/notification.service.ts` | `remove()` với `all`:<br>• có `categories` → chỉ xoá các loại đó;<br>• có `scope` → cùng nửa feed mà `list()` đọc;<br>• không có gì → cả feed, như trước.<br>Chỉ xoá dòng kênh `in_app`, là các dòng feed hiển thị. Xoá theo id không đổi |
| `notification/notification.controller.ts` | Truyền `categories` / `scope` vào service; `scope` lạ bị bỏ qua giống `GET /notifications` |

Client cũ gửi `{ all: true }` vẫn chạy (app mobile dùng chung endpoint).

### Widget

| File | Nội dung |
|---|---|
| `lib/toast.ts` (mới) | Hàng đợi toast dùng chung (`zustand/vanilla`): thành công tự tắt sau 3 giây, lỗi chờ khách đóng, tối đa 3 toast, cùng một câu không hiện 2 lần |
| `components/ui/ToastHost.tsx` (mới) | Vẽ toast: `role="status"` (pill tối, dấu ✓ xanh) / `role="alert"` (thẻ trắng viền đỏ, nút Close) |
| `notifications/NotificationsTab.tsx` | • Nút theo thiết kế, bỏ số đếm.<br>• Hộp xác nhận "Delete All" trong panel (`role="alertdialog"`), thay `window.confirm`: focus ở Cancel, Esc chỉ đóng hộp xác nhận, đóng xong focus về nút "Delete All".<br>• Toast kết quả. Khi lỗi, các dòng đã tick được giữ nguyên.<br>• Ô chọn ✓ xám / xanh, tên theo dòng.<br>• Đổi chip thì thoát chế độ chọn.<br>• Gắn `ToastHost` ngay trên vùng nút đáy |
| `notifications/tab-chips.ts` | `deleteAllFilter(chip, scope)`:<br>• Order → payment + shipping;<br>• Promo / Event → `event`;<br>• All → `scope` của tab, hoặc cả feed |
| `services/notificationService.ts`, `hooks/useNotifications.ts` | Gửi `categories` / `scope` kèm `all` |
| `i18n/locales/*.ts` ×6 | Chữ nút, hộp xác nhận, toast, tên ô chọn. Bỏ `deleteAllConfirm` (của `window.confirm`) |

**Chữ mới (EN):**
- Nút: "Delete Selected Notifications" · "Delete All Notifications".
- Hộp xác nhận: "Delete all notifications?" · "Only the notifications in “Order” are deleted. This cannot be undone." · Cancel / Delete.
- Toast: "3 notifications deleted" · "Couldn't delete notifications. Please try again."
- KO: 선택 알림 삭제 · 전체 알림 삭제.

**Hai điểm khác kế hoạch:**
- **`ToastHost` được gắn trong `NotificationsTab`**, không phải `WidgetPanel`. Gắn ở `WidgetPanel` thì toast phải nằm ở một vị trí cố định, và lúc lỗi sẽ che nút "Delete Selected" mà khách cần bấm lại. Gắn trong vùng danh sách thì toast luôn nằm ngay trên vùng nút đáy, như wireframe c. Hàng đợi vẫn dùng chung: T05/T06 gắn thêm `ToastHost` ở màn của mình.
- **Thêm: đổi chip thì thoát chế độ chọn.** Trước đây, nếu tick dòng ở chip Order rồi chuyển sang Promo, các dòng Order vẫn được tick dù đang bị ẩn. Bấm "Delete Selected" lúc đó sẽ xoá cả chúng.

### Test và tài liệu

| File | Nội dung |
|---|---|
| `apps/api/.../notification.service.spec.ts` | +5 ca: `all` chỉ xoá `in_app` của chính khách; theo `categories`; theo `scope`; `categories` thắng `scope`; xoá theo id không bị ảnh hưởng |
| `apps/api/.../dto/request/notification.request.spec.ts` (mới) | Body cũ hợp lệ; `categories` / `scope` hợp lệ; loại lạ, `'all'`, scope lạ bị từ chối |
| `apps/widget/test/tab-chips.test.mjs` | +3 ca `deleteAllFilter` |
| `apps/widget/test/toast.test.mjs` (mới) | 3 ca: tự tắt đúng 3 giây, lỗi không tự tắt, chống lặp + tối đa 3 |
| `e2e/tests/07-select-delete.spec.ts` | +4 ca:<br>• TC-07-04: phạm vi chip;<br>• TC-07-05: focus + Esc;<br>• TC-07-06: tên ô chọn;<br>• TC-07-07: xoá lỗi |
| `e2e/fixtures/mock-api.ts` | Mock xoá theo `categories` / `scope` như API |
| `e2e/tests/02-notifications-order.spec.ts`, `03-delivery.spec.ts` | Chờ DOM trước khi đọc danh sách (BUG-019) |
| `e2e/package.json` | `test:ci` thêm `@T07` |
| `ivy-docs/{TASKS,TEST-CASES,BUGS,SPEC}.md`, GUIDE §7, PLN | Trạng thái, kết quả, BUG-019. SPEC: SCR-IVY-09, selector T07 ✅ (xác nhận, toast), G-11 ✅ |

## 2. Kiểm thử (local, 2026-11-12)

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit`: api, widget, e2e | sạch (web và `packages/types` không đổi) |
| `vite build` widget | OK |
| Jest API order + notification | 13 suite, **137/137** |
| `node --test apps/widget/test/*.mjs` | **90/90** (+6 test mới) |
| `npm run i18n:check` | đủ 6 ngôn ngữ |
| `radius:check` (container Linux) | sạch |
| `@T07` | **7/7** (baseline 1/3); lặp ×3 với 2 worker: 21/21 |
| Cổng CI mới `@smoke\|@T00\|@T01\|@T02\|@T03\|@T07\|@T13`, `--repeat-each=2` | **92/92** |
| Toàn bộ desktop | **60 pass / 29 fail** (trước T07: 55 / 30, khi đó có 85 test). 28 ca đỏ thuộc T04–T12 chưa làm. Ca còn lại là TC-02-04 chập chờn (BUG-019), đã sửa; `@T02\|@T03` ×3 với 4 worker: 33/33 |
| API dev thật | `scope` / `categories` sai → 400 `E5003`; body đúng qua được bước kiểm tra |
| API + MySQL dev thật | `DELETE {all, categories:['event']}` → `deleted: 1`. Chỉ dòng event `in_app` của khách bị đánh dấu xoá. Dòng email cùng sự kiện, dòng của khách khác và thông báo đơn hàng còn nguyên. Đã xoá các dòng thử |

Ảnh chụp EN / KO / VI ở 380px:
- Chế độ chọn: ô xanh khi đã chọn, xám khi chưa.
- Hộp xác nhận, có tên chip: "Order" / ‘주문’.
- Toast "3 notifications deleted" / "Đã xóa 3 thông báo" ngay trên "View more".
- Sau khi xoá ở chip Order, badge giảm từ 2 xuống 1 (còn khuyến mãi chưa đọc).

## 3. Ghi chú cho production

- **Có hiệu lực ngay sau deploy**, không cần chờ cấu hình T01:
  - Trong lúc IVY còn bật tab Orders (layout 3 tab), chế độ chọn nằm ở tab **Notifications**, chip **All** / **Event**:
    - "Delete All" ở chip All chỉ xoá thông báo của tab Notifications, không xoá thông báo đơn hàng của tab Orders. Trước đây nó xoá cả hai.
    - "Delete All" ở chip Event chỉ xoá Event.
  - Khi tab Orders tắt, chế độ chọn nằm ở chip **Order** và **Promo**.
- `DELETE /notifications` với `all` giờ chỉ đánh dấu xoá các dòng `in_app`. Các bản ghi giao nhận email / SMS / push vốn không hiển thị (BUG-015), nên khách không thấy khác biệt.
- Không có SQL, không có migration, không gửi push / email / SMS.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Commit | ⏳ điền sau khi push lên `deploy/talk-ivyusa` |
| CI | ⏳ |
| Server `talkaibotprd01` | ⏳ Cron sẽ deploy vài phút sau khi CI xanh. Máy dev bị ELB trả 403, nên không tự kiểm tra được. Chủ dự án kiểm tra bằng `tail -n 30 ~/ivy-autodeploy.log` |
| SQL / migration | Không có |
