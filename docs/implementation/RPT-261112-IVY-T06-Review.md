# RPT-261112 — IVY T06 · Notifications: Review (chữ theo thiết kế, báo lỗi khi lưu review)

Kế hoạch: [PLN-261112-IVY-T06](../plan/PLN-261112-IVY-T06-Review.md), duyệt ngày 2026-11-12. Task: ivy-docs/TASKS.md T06. SPEC: SCR-IVY-08, G-10, BR-10, Q-06. Bug: **BUG-009**.

**Quyết định của chủ dự án (2026-11-12):**
1. Duyệt kế hoạch.
2. Giữ cách mở review hiện tại: có link sản phẩm thì mở trang ivyusa.com; không có link thì mở form trong widget.

## 1. Thay đổi (chỉ `apps/widget`, không có migration)

| File | Nội dung |
|---|---|
| `orders/ReviewItemList.tsx` | • Pill tím **Review** (`StatusPill status="review"`).<br>• ⭐ **Write Review** chữ cam, bỏ icon ↗.<br>• Thời gian theo BR-05 ("4 days ago" / "4일 전"), thay `Intl` tự do |
| `orders/ReviewForm.tsx` | Lưu lỗi → toast lỗi theo mã; form giữ số sao và nội dung (hết BUG-009). Thành công → màn "Thanks" như cũ |
| `lib/review-error.ts` (mới) | `reviewErrorKey()`: E4002 (bộ lọc nội dung chặn) → `review.blocked`; lỗi khác → `review.saveFailed` |
| `lib/notice-time-text.ts` (mới) | Hàm thời gian BR-05, chuyển từ `NotificationsTab` ra để chip Review dùng chung |
| `notifications/NotificationsTab.tsx` | `ToastHost` cạnh màn review riêng; nút "Write Review" của dòng thông báo màu cam |
| `orders/OrderDetail.tsx` | `ToastHost` trên vùng cuộn (form review ở đây cũng báo lỗi được); nút "Write Review" màu cam |
| `tailwind.config.js` | `warning.ink` `#C94F00`: cùng màu cam nhưng đậm hơn, đạt 4.56:1 cho chữ. `#FF6900` của thiết kế chỉ đạt 2.89:1, vẫn dùng cho ngôi sao |
| `i18n/locales/*.ts` ×6 | EN `writeReview` → "Write Review"; `review.saveFailed`, `review.blocked` cho 6 ngôn ngữ |

**Chữ mới (EN):**
- "Couldn't save your review. Please try again."
- "Your review couldn't be posted. Remove contact details or offensive words and try again."

**Khác kế hoạch:** màu cam của "Write Review" dùng sắc đậm `#C94F00` thay vì `#FF6900`, để đủ tương phản. Các chỗ khác đang dùng `#FF6900` cho chữ ghi ở BUG-021 (T15).

### Test và tài liệu

| File | Nội dung |
|---|---|
| `apps/widget/test/review-error.test.mjs` (mới) | 2 ca |
| `e2e/tests/06-review.spec.ts` | • TC-06-02: chờ tab mới điều hướng (BUG-017).<br>• TC-06-03: dùng dòng không có link để luôn mở form; kiểm form còn giữ nội dung. Trước đây test luôn bị skip.<br>• Thêm TC-06-04 (gửi lại sau lỗi), TC-06-05 (bị chặn E4002) |
| `e2e/package.json` | `test:ci` thêm `@T06` |
| `ivy-docs/{TASKS,TEST-CASES,BUGS,SPEC}.md`, GUIDE §7, PLN | Trạng thái, kết quả. BUG-009 Fixed; BUG-011, BUG-017 thêm T06; BUG-021 mới; G-10 ✅ |

## 2. Kiểm thử (local, 2026-11-12)

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit` widget, e2e | sạch |
| `vite build` widget | OK |
| `node --test apps/widget/test/*.mjs` | **101/101** |
| `npm run i18n:check` | đủ 6 ngôn ngữ |
| `radius:check` (container Linux) | sạch |
| `@T06` | **5/5** (baseline 0/3); lặp ×3 với 2 worker: 15/15 |
| Cổng CI mới `@smoke\|@T00\|@T01\|@T02\|@T03\|@T04\|@T05\|@T06\|@T07\|@T13`, `--repeat-each=2` | **130/130** |
| Toàn bộ desktop | **77 pass / 19 fail** (trước T06: 72 / 22). Mọi ca đỏ thuộc T08–T12 chưa làm |

**Tích hợp local (API thật):**
- Dòng "IVY Repair Serum" không có link, nên mở form.
- `POST /reviews` → 201; dòng chuyển "đã review". Đã xoá review thử.

**Ảnh chụp 380px:**
- EN / KO / VI chip Review: pill tím, ⭐ cam, "4 days ago" / "4일 전".
- EN form khi lỗi: toast đỏ ở đáy, form vẫn giữ 4 sao và nội dung.

## 3. Ghi chú cho production

- **Có hiệu lực ngay sau deploy:**
  - Layout 3 tab hiện tại: chip Review ở tab **Orders**.
  - Khi tab Orders tắt: chip Review ở tab **Notifications**.
- Chữ "Write Review" đổi ở cả Order Detail và dòng thông báo review.
- **Cần kiểm tra (không do T06):**
  - Ở local, nội dung review có email vẫn được lưu nguyên, vì tenant local chỉ có 2 luật lọc và không có luật che email.
  - Luật che email / số điện thoại / số thẻ mặc định nằm trong `apps/api/src/domain/moderation/moderation.defaults.ts`, và được nạp vào DB bằng `sql/260808-seed-default-moderation.sql`.
  - Nên kiểm tra bảng `content_filter_rules` của tenant IVY trên production có các luật `mask` này. Review là nội dung công khai.
- Không đổi API, không có SQL, không gửi push / email / SMS.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Commit | ⏳ điền sau khi push lên `deploy/talk-ivyusa` |
| CI | ⏳ |
| Server `talkaibotprd01` | ⏳ Chủ dự án kiểm tra bằng `tail -n 30 ~/ivy-autodeploy.log` |
| SQL / migration | Không có |
