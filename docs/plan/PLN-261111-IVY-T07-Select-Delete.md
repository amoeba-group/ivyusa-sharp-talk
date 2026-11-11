# PLN-261111 — IVY T07 · Chọn & xoá thông báo

| | |
|---|---|
| Trạng thái | 🟨 **Chờ duyệt.** Chưa sửa code. Câu hỏi ở §7 |
| Task | [ivy-docs/TASKS.md T07](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-09 · G-11 · BR-09 · Q-03 (vào chế độ chọn bằng nút "Select" ở hàng chip, đã có) |
| Figma | Master `992:526`, `1006:2814` (EN), `1006:2698` (KO). Chưa mở được vì Figma MCP hết lượt gọi (gói Starter); dựa vào SPEC SCR-IVY-09 + §4 và ảnh màn hiện tại |
| TC | TC-07-01..03 ([e2e/tests/07-select-delete.spec.ts](../../e2e/tests/07-select-delete.spec.ts)), baseline 1/3. Test **fail nếu xuất hiện hộp thoại `confirm/alert` của trình duyệt** |
| Migration | **Không có** |
| Deploy | Push → CI → server tự deploy. Đổi `apps/widget`; đổi `apps/api` nếu chọn §7-2a |

## 1. Hiện trạng → mục tiêu

Chế độ chọn đã có từ PLN-260916 P3: nút "Select" ở hàng chip, ô tròn ở mỗi dòng, 2 nút ở đáy panel. T07 chỉnh cho đúng thiết kế và quy tắc phản hồi của repo.

| | Thiết kế / quy tắc | Code hiện tại |
|---|---|---|
| Nút xoá đã chọn | **"Delete Selected Notifications"** (KO 선택 알림 삭제), nền xanh | "Delete selected (1)" |
| Nút xoá tất cả | **"Delete All Notifications"** (KO 전체 알림 삭제), viền xanh | "Delete all notifications" |
| Xác nhận xoá tất cả | Trong panel (TC-07-02) | `window.confirm` của trình duyệt: hộp xám, không dịch theo widget, không đúng thiết kế |
| Ô chọn | Tròn ✓: **xám** = chưa chọn, xanh = đã chọn | Chưa chọn: tròn trắng viền xám, không thấy dấu ✓ |
| Phản hồi | Toast thành công (tự tắt) / lỗi (tự đóng tay), CLAUDE.md §2 | **Không có gì.** Xoá xong danh sách chỉ ngắn lại; lỗi thì im lặng. Widget chưa có toast |
| Tên ô chọn cho trình đọc màn hình | Theo dòng ("Select IVY-39891") | Mọi ô đều tên "Select" |
| Phạm vi "Delete All" | Xem §7-2 | Xoá **mọi** thông báo của khách, ở mọi chip. Ví dụ: đang ở chip Promo bấm "Delete All" thì thông báo đơn hàng ở chip Order cũng mất |

## 2. Quyết định thiết kế

**D1 — Chữ theo thiết kế, 6 ngôn ngữ.**
- "Delete Selected Notifications" và "Delete All Notifications"; KO 선택 알림 삭제 / 전체 알림 삭제.
- Bỏ số đếm trong nút cho giống thiết kế. Khi chưa chọn dòng nào, nút xoá đã chọn bị mờ.

**D2 — Xác nhận "Delete All" ngay trong panel**, thay `window.confirm`.
- Vùng nút ở đáy panel đổi thành hộp xác nhận (`role="alertdialog"`): câu hỏi, câu "không hoàn tác được", nút **Cancel** và **Delete**.
- Focus mặc định ở **Cancel**, là lựa chọn an toàn. Phím Esc chỉ đóng hộp xác nhận, không đóng cả widget.
- "Delete Selected" không cần xác nhận: khách đã tự tick từng dòng (giống thiết kế).

**D3 — Toast dùng chung cho cả widget** (T06 sẽ dùng lại cho lỗi lưu review, BUG-009).
- Nằm trong panel, ngay trên vùng nút đáy.
- Thành công: `role="status"`, tự tắt sau khoảng 3 giây. Ví dụ "2 notifications deleted".
- Lỗi: `role="alert"`, có nút đóng, **không** tự tắt: "Couldn't delete notifications. Please try again." Khi lỗi, chế độ chọn và các dòng đã tick được giữ nguyên để khách thử lại.

**D4 — Ô chọn theo thiết kế.**
- Tròn 20px có dấu ✓: chưa chọn = nền xám, ✓ trắng; đã chọn = nền xanh.
- Tên đọc cho trình đọc màn hình theo dòng: "Select IVY-39891".
- Chạm vào bất kỳ đâu trên dòng cũng chọn/bỏ chọn (đã có từ T02).

**D5 — Không đổi:**
- Nút "Select" vẫn ở hàng chip, chỉ hiện ở chip có danh sách thông báo (Order, Promo).
- Xoá là xoá mềm, chỉ xoá dòng của chính khách (API đã kiểm tra quyền sở hữu).
- Thông báo đơn hàng đã xoá **không** bị tạo lại (B2 của T02 đã tính cả dòng đã xoá).

## 3. Wireframe (chip Order, 380px)

**a) Chế độ chọn, đã tick 1 dòng**
```
├──────────────────────────────────────┤
│ (Order)[Delivery](Promo)(Review) Cancel│
├──────────────────────────────────────┤
│ Today's                              │
│ (📦) IVY-39891 [Confirmed]       (✓) │  ← xanh = đã chọn
│      Hydrating Face Mask + 2 items   │
│      Just now                        │
│ (📦) IVY-39641 [In Transit]      (✓) │  ← xám = chưa chọn
│      Vitamin C Serum Set             │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │  Delete Selected Notifications   │ │  ← nền xanh; mờ khi chưa chọn
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │    Delete All Notifications      │ │  ← viền xanh
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**b) Bấm "Delete All Notifications" → xác nhận trong panel**
```
├──────────────────────────────────────┤
│ Delete all notifications?            │
│ Only the notifications in "Order"    │  ← dòng này theo §7-2
│ are deleted. This cannot be undone.  │
│ ┌───────────────┐ ┌────────────────┐ │
│ │    Cancel     │ │     Delete     │ │  ← focus ở Cancel
│ └───────────────┘ └────────────────┘ │
└──────────────────────────────────────┘
```

**c) Sau khi xoá**
```
│      ┌──────────────────────────┐    │
│      │ ✓ 2 notifications deleted│    │  ← tự tắt sau ~3 giây
│      └──────────────────────────┘    │
├──────────────────────────────────────┤
│              View more               │  ← đã thoát chế độ chọn
└──────────────────────────────────────┘

│ ┌──────────────────────────────────┐ │
│ │ ⚠ Couldn't delete notifications. │✕│  ← lỗi: đóng tay, vẫn ở chế độ chọn
│ │   Please try again.              │ │
│ └──────────────────────────────────┘ │
```

## 4. Thay đổi

| File | Nội dung |
|---|---|
| `apps/widget/src/store/toastStore.ts` (mới) | Hàng đợi toast (zustand, như `widgetStore`): `showToast({ tone, message })`, tự tắt với tone success |
| `apps/widget/src/components/ui/ToastHost.tsx` (mới) | Vẽ toast trong panel: `role="status"` / `role="alert"`, nút đóng cho lỗi |
| `apps/widget/src/components/widget/WidgetPanel.tsx` | Gắn `ToastHost` |
| `apps/widget/src/components/notifications/NotificationsTab.tsx` | Nút theo D1, hộp xác nhận D2 (bỏ `window.confirm`), toast D3, ô chọn D4 |
| `apps/widget/src/components/notifications/tab-chips.ts` | (nếu §7-2a) `deleteAllFilter(chip)`: chip nào xoá những loại nào |
| `apps/widget/src/i18n/locales/*.ts` ×6 | Chữ nút, hộp xác nhận, toast, tên ô chọn |
| `apps/api/.../notification/dto/request/notification.request.ts`, `notification.service.ts` | (nếu §7-2a) `DELETE /notifications` nhận thêm `categories` / `scope` khi `all: true`, và chỉ xoá dòng kênh `in_app`. Client cũ chỉ gửi `{ all: true }` vẫn chạy |
| `e2e/fixtures/mock-api.ts` | (nếu §7-2a) mock xoá theo `categories` |
| Unit / Jest | `deleteAllFilter`; API: xoá theo loại, không đụng chip khác, không đụng dòng của khách khác |
| `e2e/package.json` | Thêm `@T07` vào `test:ci` khi 3/3 xanh |

## 5. Ảnh hưởng phụ

- **Có hiệu lực ngay trên production**, không cần chờ cấu hình T01:
  - Hiện IVY đang ở layout 3 tab: chế độ chọn nằm ở tab **Notifications** (chip All / Event).
  - Sau khi tắt tab Orders: chế độ chọn nằm ở chip **Order** và **Promo**.
- Nếu chọn §7-2a, ở layout 3 tab hiện tại:
  - "Delete All" ở chip All chỉ xoá thông báo của tab Notifications, không xoá thông báo đơn hàng. Trước đây nó xoá cả hai.
  - "Delete All" ở chip Event chỉ xoá Event.
- App mobile dùng chung `DELETE /notifications`: request cũ `{ all: true }` vẫn chạy, chỉ khác là không đánh dấu xoá các bản ghi giao nhận email/SMS/push. Các bản ghi này vốn không hiển thị (BUG-015).
- Toast là thành phần mới, chỉ hiện khi có thông báo. Không đổi bố cục khi không có toast.
- Không có SQL, không gửi push hay email.

## 6. Kiểm thử

- `tsc` api / widget / web / e2e; Jest API notification; `node --test apps/widget/test/*.mjs`; `i18n:check`; `radius:check` (container Linux).
- `@T07` **3/3**, lặp ×3; cổng CI mới ×2; toàn bộ desktop so với 55/30.
- Thêm kiểm tra thủ công: lỗi xoá (API trả 500) → toast lỗi, vẫn ở chế độ chọn; Esc trong hộp xác nhận không đóng widget.
- Ảnh chụp EN / KO / VI: chế độ chọn, hộp xác nhận, toast.

## 7. Xin bạn xác nhận

1. **Duyệt kế hoạch này?** Duyệt thì mình sửa code, test, rồi push. Push là production tự cập nhật.
2. **"Delete All Notifications" xoá những gì?**
   - **a (khuyến nghị):** chỉ xoá thông báo **của chip đang xem**: đang ở chip Order thì xoá thông báo đơn hàng, đang ở Promo thì xoá khuyến mãi. Cần sửa nhỏ ở API, không có SQL.
   - **b:** giữ như hiện tại: xoá **mọi** thông báo của khách ở mọi chip, dù đang đứng ở chip nào. Không sửa API.
3. **Vuốt trái để xoá trên điện thoại** (thiết kế ghi là tuỳ chọn):
   - **a (khuyến nghị):** chưa làm ở T07; ghi lại để cân nhắc ở T15 (responsive). Chọn + xoá vẫn dùng được trên điện thoại.
   - **b:** làm luôn trong T07. Phải xử lý cử chỉ vuốt, và thêm test trên mobile.

Trả lời ví dụ: `1. ok  2. a  3. a`
