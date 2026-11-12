# PLN-261112 — IVY T06 · Notifications: Review (chữ theo thiết kế, báo lỗi khi lưu review)

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-12** và đã làm, xem [RPT-261112-T06](../implementation/RPT-261112-IVY-T06-Review.md). Trả lời §7: (1) ok; (2) **a**, giữ cách mở review hiện tại |
| Task | [ivy-docs/TASKS.md T06](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-08 · G-10 · BR-10 · Q-06 · **BUG-009** |
| Figma | Master `992:192`, `1008:2191` (EN), `1006:5936`. Figma MCP vẫn hết lượt gọi; dựa vào SPEC SCR-IVY-08 |
| TC | TC-06-01..03 ([e2e/tests/06-review.spec.ts](../../e2e/tests/06-review.spec.ts)), baseline **0/3** |
| Migration | **Không có** |
| Deploy | Push → CI → server tự deploy. Chỉ đổi `apps/widget` |

## 1. Hiện trạng → mục tiêu

Chip **Review** liệt kê sản phẩm khách đã nhận (`ReviewItemList`, PLN-260923). Bấm "Write a review" thì:
- dòng có link sản phẩm → mở trang sản phẩm trên ivyusa.com ở tab mới (Q-06);
- dòng không có link → mở form review ngay trong widget (`ReviewForm`).

| | Thiết kế / SPEC | Code hiện tại |
|---|---|---|
| Pill | Tím **Review** theo mã (BR-06), `status-pill` | `Badge` cũ; test không tìm thấy `status-pill` |
| Nút | ⭐ **Write Review**, chữ **cam** | "Write a review", chữ xanh, kèm icon ↗ |
| Thời gian | Như các dòng thông báo (BR-05: "4 days ago", "Yesterday"…) | `Intl` tự do ("4 days ago" / "last week") |
| **Lưu review lỗi** (BUG-009) | Báo lỗi cho khách (CLAUDE.md §2) | `catch { /* ignore */ }`: nút trở lại bình thường, **không báo gì**. Khách tưởng đã gửi |
| TC-06-03 | Kiểm tra form lỗi | Dữ liệu mẫu có link sản phẩm, nên test luôn bị **bỏ qua** (skip) và không bao giờ chạm tới form |

## 2. Quyết định thiết kế

**D1 — Dòng review theo SCR-IVY-08.**
- Mã đơn, pill tím **Review** (`StatusPill`, giống T02/T03).
- "Rose Hip Facial Oil 30ml · $55.00".
- Nút ⭐ **Write Review** chữ cam.
- Thời gian theo BR-05, dùng chung hàm với feed thông báo.
- Bỏ icon ↗ cho giống thiết kế; link vẫn mở tab mới như T03 "Track Order".
- Dòng đã review: giữ "✓ Reviewed" xám như hiện tại.

**D2 — Chữ "Write Review"** ở 6 ngôn ngữ, dùng chung một key ở mọi chỗ có nút này:
- chip Review;
- Order Detail (sản phẩm đã giao);
- dòng thông báo review.

Chỉ EN đổi ("Write a review" → "Write Review"); KO 리뷰 작성 và các ngôn ngữ khác giữ nguyên.

**D3 — Lưu review có phản hồi** (hết BUG-009).
- Lỗi → toast lỗi (`role="alert"`, đóng tay, dùng toast của T07). Form **giữ nguyên** số sao và nội dung để khách bấm gửi lại.
  - Bị bộ lọc nội dung chặn (E4002) → "Your review couldn't be posted. Remove contact details or offensive words and try again."
  - Lỗi khác → "Couldn't save your review. Please try again."
- Thành công → màn "Thanks for your review!" như hiện tại. Kết quả hiện ngay nên không cần toast thêm (CLAUDE.md §2 cho phép miễn).
- Gắn `ToastHost` ở 2 chỗ form xuất hiện: màn review riêng (từ chip Review) và trong Order Detail. Hiện 2 chỗ này không có chỗ hiện toast.

**D4 — Giữ nguyên cách mở review** (Q-06):
- có link sản phẩm → trang sản phẩm ivyusa.com;
- không có link → form trong widget.

Link có thể trỏ thẳng tới mục review của trang nếu đặt **mẫu link review** trong console → Widget design (`reviewLinkTemplate`). Đây là cấu hình, không cần sửa code.

**D5 — Sửa TC-06-03** để luôn chạm tới form: test dùng một dòng review **không có link sản phẩm**, thay vì bỏ qua khi có tab mới.

## 3. Wireframe (chip Review, 380px)

```
├──────────────────────────────────────┤
│ (Order)(Delivery)(Promo)[Review]     │
├──────────────────────────────────────┤
│ (🖼) IVY-39875 [Review]               │  ← pill tím (StatusPill)
│      Rose Hip Facial Oil 30ml · $55.00│
│      ⭐ Write Review          4 days ago│  ← chữ cam; thời gian theo BR-05
├──────────────────────────────────────┤

Form trong widget (dòng không có link):
│ Write a review                       │
│ Your rating   ★ ★ ★ ★ ★              │
│ ┌──────────────────────────────────┐ │
│ │ Share your experience…           │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────┐┌──────┐ │
│ │      Submit review       ││ Back │ │
│ └──────────────────────────┘└──────┘ │
│ ┌──────────────────────────────────┐ │
│ │ ⚠ Couldn't save your review.     │✕│ ← toast lỗi, đóng tay; số sao + chữ giữ nguyên
│ │   Please try again.              │ │
│ └──────────────────────────────────┘ │
```

## 4. Thay đổi

| File | Nội dung |
|---|---|
| `apps/widget/src/components/orders/ReviewItemList.tsx` | `StatusPill status="review"`; nút cam "Write Review"; bỏ ↗; thời gian BR-05 |
| `apps/widget/src/components/orders/ReviewForm.tsx` | Bắt lỗi → toast theo mã lỗi; giữ trạng thái form |
| `apps/widget/src/components/notifications/NotificationsTab.tsx`, `orders/OrderDetail.tsx` | Gắn `ToastHost` cạnh form review; nút "Write Review" màu cam ở dòng thông báo / Order Detail |
| `apps/widget/src/lib/format.ts` hoặc `lib/notice-time` | Hàm thời gian BR-05 dùng chung (hiện nằm trong `NotificationsTab`) |
| `apps/widget/src/i18n/locales/*.ts` ×6 | EN `writeReview` → "Write Review"; `review.saveFailed`, `review.blocked` (6 ngôn ngữ) |
| `e2e/tests/06-review.spec.ts`, `e2e/fixtures/mock-api.ts` | TC-06-03 dùng dòng không có link (D5); thêm TC-06-04: lỗi xong bấm gửi lại thì thành công; TC-06-05: bị chặn (E4002) thì báo đúng câu |
| Unit widget | Chọn câu báo lỗi theo mã |
| `e2e/package.json` | Thêm `@T06` vào `test:ci` khi xanh hết |

## 5. Ảnh hưởng phụ

- **Có hiệu lực ngay sau deploy:**
  - Layout 3 tab hiện tại: chip Review ở tab **Orders**.
  - Khi tab Orders tắt: chip Review ở tab **Notifications**.
- Chữ "Write Review" đổi ở cả Order Detail và dòng thông báo review, vì 3 chỗ dùng chung key.
- Không đổi API, không có SQL. Cách mở trang review giữ nguyên.

## 6. Kiểm thử

- `tsc` widget / e2e; `node --test apps/widget/test/*.mjs`; `i18n:check`; `radius:check` (container Linux); `vite build`.
- `@T06` xanh hết, lặp ×3; cổng CI mới ×2; toàn bộ desktop so với 72 / 22.
- Thử thật với API local: gửi review cho dòng không có link → lưu được; nội dung có email / số điện thoại → kết quả moderation đúng như API trả.
- Ảnh chụp EN / KO / VI: chip Review, form, toast lỗi.

## 7. Xin bạn xác nhận

1. **Duyệt kế hoạch này?** Duyệt thì mình sửa code, test, rồi push. Push là production tự cập nhật.
2. **Bấm "Write Review" mở đâu?**
   - **a (khuyến nghị):** giữ như hiện tại: có link sản phẩm thì mở trang sản phẩm ivyusa.com ở tab mới, không có thì mở form trong widget. Review nằm trên trang của cửa hàng, nơi khách khác đọc được.
   - **b:** luôn mở form trong widget. Review lưu ở SharpTalk; muốn hiện trên ivyusa.com thì cần đồng bộ thêm, ngoài phạm vi T06.

Trả lời ví dụ: `1. ok  2. a`
