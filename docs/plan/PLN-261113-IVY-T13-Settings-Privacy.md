# PLN-261113 — IVY T13 · Màn Settings / Privacy

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-13** (`1. ok 2. a 3. a` + ảnh EN `1004:1367`) và đã làm — [RPT-261113](../implementation/RPT-261113-IVY-T13-Settings-Privacy.md). Ảnh giữ thanh đầu trắng nên lúc đầu **không** làm 2a (§7-4: làm theo ảnh). **2026-11-13: chủ dự án chọn "làm 2a" → đã làm** (RPT §5) |
| Task | [ivy-docs/TASKS.md T13](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-15 · G-21 · BR-18 · Q-09 |
| Figma | `1004:1367` (EN), `1004:1447` (KO). Figma MCP hết lượt gọi; kế hoạch dựa vào chữ trong SPEC. **Cần ảnh 2 frame này** để khớp khoảng cách và chữ KO (link ở §7) |
| TC | TC-13-01..04 ([e2e/tests/13-settings.spec.ts](../../e2e/tests/13-settings.spec.ts)) **đã xanh 4/4** từ trước. T13 chỉ còn rà giao diện và câu chữ |
| Migration | **Không có SQL**, không đổi API |
| Deploy | Test xanh → push → CI → server tự deploy. Chỉ đổi `apps/widget` |

## 1. Hiện trạng → mục tiêu

Ảnh hiện tại chụp ở local ngày 2026-11-13 (EN và KO), so với chữ thiết kế trong SPEC SCR-IVY-15:

| | Thiết kế (SPEC SCR-IVY-15) | Hiện tại |
|---|---|---|
| Đầu màn | Có tiêu đề màn; Q-09: thanh đầu màn Settings **màu xanh**, khác các màn khác | Thanh đầu vẫn "Hi, Kiho" và nút ⚙ sáng lên; "← Back" nằm trong nội dung. **Không có tiêu đề "Settings"** (G-21) |
| Nút rút consent | Nút **viền đỏ** "Withdraw consent" | Viền **xám**, chữ đỏ |
| Câu dưới nút | "If you withdraw, chat and AI processing **stops immediately**." | "If you withdraw, chat and AI processing **stop until you consent again**." |
| Marketing | "Marketing messages" · toggle "Do not send me marketing messages" · "Order and delivery updates are sent regardless — this covers promotions, coupons and review requests." | Đúng chữ |
| Privacy & your data | Toggle CCPA · "Turns off email, SMS and web-push messaging for your account. In-app notices stay on." · ⬇ Download my data (JSON) · 🗑 Delete my data | Đúng chữ |

## 2. Phát hiện khi khảo sát

1. **Test T13 đã xanh 4/4** (consent, rút consent, công cụ dữ liệu, khách vãng lai). Không có lỗi chức năng, chỉ còn khác giao diện.
2. **Toggle marketing có nghĩa ngược:** bật = **không** nhận marketing.
   - Nó chỉ chặn marketing qua **email, SMS, push**. Thông báo Promo và Review trong app (T05/T06) **luôn hiện**, server không đưa kênh in-app qua bộ lọc này.
   - Khách chưa từng chọn: server mặc định **không gửi** marketing qua email/SMS/push, nên toggle hiện **bật**. Muốn nhận thì khách tắt nó đi.
   - Đơn hàng và giao hàng luôn được gửi.
3. **Màn Settings không có tiêu đề.** Thanh đầu giữ nguyên lời chào, nên khách không biết mình đang ở màn nào (G-21).

## 3. Quyết định thiết kế

**D1 — Thanh đầu màn Settings** (G-21, Q-09): theo §7-2.

**D2 — Đối chiếu câu chữ và khoảng cách** (theo thiết kế):
- Nút "Withdraw consent" **viền đỏ**, chữ đỏ.
- Câu dưới nút theo thiết kế: "If you withdraw, chat and AI processing stops immediately." (6 ngôn ngữ; KO theo ảnh `1004:1447`).
- Khoảng cách, cỡ chữ, đường kẻ giữa các khối: chỉnh theo ảnh bạn gửi. Không đổi thứ tự khối.

**D3 — Toggle marketing:** giữ chữ thiết kế, không đổi cách hoạt động (§7-3).

## 4. Wireframe

**Hiện tại:**

```
┌────────────────────────────────────────┐
│ Hi, Kiho                    🌐EN  ⚙  ✕ │ ← thanh trắng, ⚙ sáng
│ ← Back                                 │
│ 🛡 Chat & AI consent                   │
│ Consent given                          │
│ On Nov 12, 2026 · Notice version 2026-07│
│ ( Withdraw consent )                   │ ← viền xám
│ If you withdraw, chat and AI processing│
│ stop until you consent again.          │
│ ────────────────────────────────────── │
│ Marketing messages                     │
│ Do not send me marketing messages  ( ) │
│ ...                                    │
```

**Sau T13 (nếu §7-2a):**

```
┌────────────────────────────────────────┐
│ ←  Settings                          ✕ │ ← nền màu brand (IVY: xanh), chữ trắng
├────────────────────────────────────────┤
│ 🛡 Chat & AI consent                   │
│ Consent given                          │
│ On Nov 12, 2026 · Notice version 2026-07│
│ ( Withdraw consent )                   │ ← viền đỏ
│ If you withdraw, chat and AI processing│
│ stops immediately.                     │
│ ────────────────────────────────────── │
│ Marketing messages                     │
│ Do not send me marketing messages  (●) │
│ Order and delivery updates are sent    │
│ regardless — this covers promotions,   │
│ coupons and review requests.           │
│ ────────────────────────────────────── │
│ Privacy & your data                    │
│ ⦸ CCPA: Do not sell or share my     ( ) │
│   personal information                 │
│ Turns off email, SMS and web-push …    │
│ ⬇ Download my data (JSON)              │
│ 🗑 Delete my data                      │
└────────────────────────────────────────┘
```

- Bấm ← (hoặc Esc như cũ) thì quay về tab đang mở. ✕ vẫn đóng widget.
- Trong màn Settings, nút 🌐 và ⚙ ẩn đi (thanh đầu đã nói "Settings" và có ←).
- Khách vãng lai: cùng thanh đầu; nội dung vẫn là khối consent + ô đăng nhập như hiện nay.

## 5. Thay đổi

| Phần | File | Nội dung |
|---|---|---|
| Widget | `widget/WidgetPanel.tsx` | Khi mở Settings: thanh đầu "← Settings" (§7-2), ẩn 🌐 / ⚙, giữ ✕ |
| Widget | `settings/PreferencesPanel.tsx` | Bỏ "← Back" trong nội dung (đã lên thanh đầu); nút Withdraw viền đỏ; khoảng cách theo ảnh |
| Widget | `i18n/locales/*.ts` ×6 | `privacy.consent.withdrawHint` theo thiết kế. Tiêu đề dùng key `settings` có sẵn |
| E2E | `13-settings.spec.ts`, `01-shell-header.spec.ts` | Thêm **TC-13-05** (thanh đầu "Settings", nút ← quay lại tab) và **TC-13-06** (nút Withdraw viền đỏ). Sửa TC-01 đang bấm "Back" nếu tên nút đổi |
| Docs | ivy-docs (TASKS, TEST-CASES, SPEC G-21 / Q-09), RPT | |

## 6. Ảnh hưởng phụ

- **Mọi khách, ngay sau deploy:** mở Settings thấy thanh đầu "Settings" (màu brand nếu §7-2a), không còn lời chào và nút 🌐 / ⚙ ở màn này.
- Câu dưới nút rút consent đổi theo thiết kế.
- Không đổi dữ liệu, API, cách hoạt động của consent / marketing / CCPA. Không SQL, không cấu hình production.

## 7. Xin bạn xác nhận

1. **Duyệt kế hoạch này?** Duyệt thì mình làm, test xanh rồi push.
2. **Thanh đầu màn Settings:**
   - **a (khuyến nghị, theo Q-09):** nền **màu brand** của tenant (IVY: xanh), chữ trắng "← Settings", nút ✕.
   - **b:** giữ thanh trắng như các màn khác, chỉ đổi chữ thành "← Settings".
3. **Câu hướng dẫn dưới toggle marketing:**
   - **a (khuyến nghị):** giữ đúng chữ thiết kế.
   - **b:** thêm "by email, SMS and push" cho rõ là thông báo trong app vẫn hiện (§2-2).
4. **Ảnh thiết kế:** gửi giúp ảnh [1004:1367 (EN)](https://www.figma.com/design/fviVlvtkuHYU0Agre1daTr/?node-id=1004-1367) và [1004:1447 (KO)](https://www.figma.com/design/fviVlvtkuHYU0Agre1daTr/?node-id=1004-1447). Mình chỉnh khoảng cách và chữ KO theo ảnh. Nếu ảnh khác §4, mình làm theo ảnh và ghi lại trong báo cáo.

Trả lời ví dụ: `1. ok  2. a  3. a` + 2 ảnh
