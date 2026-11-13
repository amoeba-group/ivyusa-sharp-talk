# PLN-261113 — IVY T15 · Điện thoại & trợ năng

| | |
|---|---|
| Trạng thái | ⏳ **Chờ duyệt** |
| Task | [ivy-docs/TASKS.md T15](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-01 · NFR-02 · NFR-03 · NFR-04 · G-23 · G-24 |
| TC | TC-15-01..04 ([e2e/tests/15-responsive-a11y.spec.ts](../../e2e/tests/15-responsive-a11y.spec.ts)): TC-15-02..04 **xanh**, TC-15-01 **đỏ**. Thêm TC-15-05..06 (§5) |
| Migration | **Không có SQL**, không đổi API |
| Deploy | Test xanh → push → CI → server tự deploy. Chỉ đổi `apps/widget` (cả loader `embed.js`) |

## 1. Khảo sát (local, 2026-11-13)

| Mục | Kết quả |
|---|---|
| Điện thoại 390×844 **qua `embed.js`** (cách widget chạy trên ivyusa.com), 6 ngôn ngữ | Không chữ nào tràn hay bị che, ở Thông báo (4 chip), Chat và Settings. Panel **390×680 nằm ở đáy màn hình** (bottom sheet); 164px phía trên vẫn là trang shop |
| TC-01-08 (11 kích thước màn hình, qua `embed.js`) | Xanh: |
| | - PC / tablet: 380×600 |
| | - điện thoại thấp (≤ 680px): kín màn hình |
| | - điện thoại cao (844, 915px): bottom sheet 680px |
| | - xoay ngang: 380×370 |
| | T01 đã ghi nhận như vậy, dù PLN T01 tưởng điện thoại "toàn màn hình như hiện nay" |
| Mở **thẳng trang widget** trên điện thoại (`talk.ivyusa.com/widget/?shop=…`, trang bạn đang dùng để thử) | Panel 370×600, **lệch trái**, không phủ màn hình → TC-15-01 đỏ. Lý do: trang này không qua `embed.js`, nên không ai báo cho widget "đây là điện thoại" (`?compact=1`) |
| Bàn phím | Tab đi qua 14 nút trong panel, rồi **thoát ra trang phía sau** (link Shop, Add to cart…). Panel tự nhận là hộp thoại modal (`aria-modal`), nên focus phải ở lại bên trong (NFR-02). Esc đóng panel: ✓. Phím mũi tên chuyển tab: ✓ |
| ARIA | Tab có `aria-selected` ✓, chip có `aria-pressed` ✓, badge "4 unread" ✓, panel là `dialog` ✓ (TC-15-04 xanh) |
| Console | Không lỗi khi đi qua mọi tab, chip, Settings (TC-15-02 xanh) |
| Vuốt trái để xoá (T07 để lại) | Chưa có. BR-09 ghi "tuỳ chọn" |

## 2. Quyết định thiết kế

**D1 — Điện thoại màn cao:** toàn màn hình hay giữ bottom sheet, theo §7-2.

**D2 — Trang widget mở thẳng, trên màn hẹp hơn 640px, hiện giống điện thoại.**
- Mở thẳng nghĩa là không qua `embed.js`.
- Bố cục giống hệt khách thấy trên ivyusa.com.
- Dùng chung ngưỡng 640px với `embed.js`. Xoay máy thì đổi theo.

**D3 — Focus không thoát khỏi panel.**
- Tab ở nút cuối → về nút đầu. Shift+Tab ở nút đầu → về nút cuối.
- Chỉ áp khi panel đang mở. Thứ tự Tab bên trong giữ nguyên.
- Muốn quay ra trang shop: đóng panel (✕ hoặc Esc).

**D4 — Vuốt trái để xoá:** theo §7-3.

## 3. Wireframe (điện thoại 390×844)

**D1 + D2, nếu chọn 2a:**

```
Hiện tại (qua embed.js)            Sau T15 (2a)
┌────────────────────────┐         ┌────────────────────────┐
│ trang ivyusa.com       │         │ Hi, Kiho    🌐 EN  ⚙ ✕ │
│ (164px còn thấy)       │         │ Notifications │ Chat   │
├────────────────────────┤         ├────────────────────────┤
│ Hi, Kiho    🌐 EN  ⚙ ✕ │         │ [Order] [Delivery] …   │
│ Notifications │ Chat   │         │ …                      │
├────────────────────────┤         │                        │
│ [Order] [Delivery] …   │         │   (cả màn hình 844px)  │
│ …   (panel 680px)      │         │                        │
└────────────────────────┘         └────────────────────────┘

Trang widget mở thẳng (D2)
Hiện tại: thẻ 370×600 lệch trái     Sau: giống cột phải (2a) hoặc cột trái (2b)
```

- ✕ vẫn ở góc trên bên phải, Esc vẫn đóng panel.
- Màn Settings có thanh "← Settings" (T13 2a) như trên máy tính.

**D3:** không đổi gì trên màn hình.

**D4, nếu chọn 3b:**

```
│ ⬚ IVY-39891 [Confirmed]           │   vuốt ←   │ 39891 [Confirmed]  │ 🗑 Xoá │
│   Hydrating Face Mask + 2 items   │            │ Mask + 2 items     │ (đỏ)  │
```

## 4. Thay đổi

| Phần | File | Nội dung |
|---|---|---|
| Widget | `public/embed.js` | D1 (nếu 2a): khi là điện thoại (`compact`, màn < 640px), khung cao **bằng màn hình** (`100dvh`, máy cũ `100vh`) thay vì tối đa 680px |
| Widget | `widget/WidgetPanel.tsx` | **D2:** không qua `embed.js` và màn < 640px → bố cục điện thoại; theo dõi khi xoay máy. **D3:** giữ focus trong panel |
| Widget | `notifications/NotificationsTab.tsx` | D4 (nếu 3b): vuốt dòng sang trái hiện nút xoá; vẫn có chế độ Chọn cho người không vuốt được |
| E2E | `01-shell-header.spec.ts` | TC-01-08: kỳ vọng mới cho điện thoại cao, theo D1 |
| E2E | `15-responsive-a11y.spec.ts` | TC-15-01 xanh (D2). TC-15-05: Tab ×40 và Shift+Tab đều ở trong panel (D3). TC-15-06 ×6: điện thoại 390×844 qua `embed.js`, không chữ tràn hay bị che. (3b) TC-15-07: vuốt xoá. Thêm `@T15` vào `test:ci` |
| Docs | ivy-docs (TASKS, TEST-CASES, SPEC NFR-02 / NFR-03 / G-24, BUGS), GUIDE CI §7, RPT | |

## 5. Test case mới

| TC | Kiểm tra | Kỳ vọng |
|---|---|---|
| TC-15-01 (sửa) | Trang mở thẳng trên điện thoại (Pixel 7) | Panel rộng ≥ 95% màn hình, sát mép trái |
| TC-15-05 | Bàn phím | Tab 40 lần: focus luôn trong panel. Shift+Tab từ nút đầu: về nút cuối, vẫn trong panel |
| TC-15-06 ×6 | Điện thoại 390×844 qua `embed.js`, 6 ngôn ngữ | Thông báo, 4 chip, Chat, Settings: không phần tử nào tràn khỏi panel, không chữ bị che. Nếu 2a: panel 390×844 |
| TC-15-07 | Vuốt xoá (chỉ khi chọn 3b) | Vuốt dòng sang trái → nút xoá → bấm → dòng mất + toast "đã xoá" |

## 6. Ảnh hưởng phụ

- **Khách trên điện thoại (nếu 2a):** panel phủ cả màn hình, không còn thấy trang shop phía trên khi đang mở. ✕ đóng như cũ.
- **Người dùng bàn phím:** Tab chỉ đi vòng trong panel. Muốn ra trang shop thì đóng panel trước.
- **Bạn thử trên điện thoại** qua `talk.ivyusa.com/widget/`: thấy đúng như khách sẽ thấy trên ivyusa.com.
- **Code dùng chung:** `embed.js` là loader của mọi tenant, nên D1 (nếu 2a) áp cho mọi tenant trên điện thoại.
- Không SQL, không cấu hình production.

## 7. Xin bạn xác nhận

1. **Duyệt kế hoạch này?** Duyệt thì mình làm, test xanh rồi push.
2. **Điện thoại màn cao** (cao hơn 680px, ví dụ iPhone 15 / Pixel 7):
   - **a (khuyến nghị, theo SPEC NFR-03):** panel toàn màn hình.
   - **b:** giữ bottom sheet cao 680px như hiện nay; phần trên vẫn thấy trang shop.
3. **Vuốt trái để xoá thông báo:**
   - **a (khuyến nghị):** chưa làm. Chế độ Chọn + "Delete Selected" đã dùng được trên điện thoại, và BR-09 ghi là tuỳ chọn.
   - **b:** làm. Vuốt một dòng sang trái hiện nút xoá màu đỏ.

Trả lời ví dụ: `1. ok  2. a  3. a`
