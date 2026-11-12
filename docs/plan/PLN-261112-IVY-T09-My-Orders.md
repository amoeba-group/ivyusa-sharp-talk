# PLN-261112 — IVY T09 · Kịch bản My Orders + chip "Start over"

| | |
|---|---|
| Trạng thái | 🟨 **Chờ duyệt.** Chưa sửa code. Câu hỏi ở §7 |
| Task | [ivy-docs/TASKS.md T09](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-11 · G-15 · BR-12 · phần còn lại của **BUG-011** (danh sách đơn, feed inquiry) |
| Figma | `1006:5530`. Figma MCP vẫn hết lượt gọi; dựa vào SPEC. Nếu tiện, gửi ảnh frame này như T04 / T08 |
| TC | TC-09-01..04 ([e2e/tests/09-my-orders.spec.ts](../../e2e/tests/09-my-orders.spec.ts)), baseline **1/4** (01 xanh) |
| Migration | **Không có** |
| Deploy | Push → CI → server tự deploy. Chỉ đổi `apps/widget` |

## 1. Hiện trạng → mục tiêu

Nút **My Orders** trả lời ngay trong luồng chat: một câu dẫn và tối đa 3 thẻ đơn gần đây (`InlineOrdersAnswer`, PLN-260817 W-5).

| | Thiết kế SCR-IVY-11 / BR-12 | Hiện tại |
|---|---|---|
| Câu dẫn + thẻ đơn | "주문 내역을 조회해드릴게요! 최근 주문입니다 👇" + thẻ (mã, pill, tóm tắt) | Có ✅ (TC-09-01 xanh) |
| Bấm thẻ đơn | Mở **Order Detail** | Thẻ **không bấm được** (cố ý từ W-5, để không rời luồng chat) |
| Pill trên thẻ | Theo mã trạng thái | `Badge` hiện chữ server chưa dịch, màu đoán theo chữ (**BUG-011**) |
| Sau thẻ | "더 도움이 필요하신가요?" + chip **배송 조회 · 주문 취소 · 처음으로** (Track delivery · Cancel order · Start over) | Không có gì |
| **Start over** (처음으로) | **Mọi kịch bản** có chip này, quay về menu đầu (BR-12) | Không có ở đâu |
| Danh sách đơn (tab Orders / chip Order), feed inquiry | Pill theo mã | `Badge` + đoán màu theo chữ (phần còn lại của BUG-011) |

## 2. Quyết định thiết kế

**D1 — Thẻ đơn trong chat bấm được → Order Detail** (TC-09-03).
- Order Detail của T04 mở **ngay trong tab Chat**, đè lên luồng chat; nút ← quay lại đúng chỗ đang chat.
- Luồng chat vẫn còn nguyên (không unmount).
- Trong Order Detail, hàng **Contact** gửi "I have a question about order #…" vào chính cuộc chat này.

**D2 — Sau thẻ đơn, bot hỏi tiếp và có 3 chip.**
- Câu "Do you need anything else?" (KO 더 도움이 필요하신가요?), rồi 3 chip:
  - **Track delivery** (배송 조회): xem §7-2.
  - **Cancel order** (주문 취소): chạy kịch bản `cancel_order` có sẵn (hướng dẫn huỷ đơn, đã có 6 ngôn ngữ).
  - **Start over** (처음으로): D3.
- Chip giống các chip gợi ý khác trong chat: chip trắng nhỏ, wrap.

**D3 — Chip "Start over" dùng chung** (BR-12).
- Có ở: cuối mọi câu trả lời kịch bản có chip (Cancel / Refund, Delivery inquiry…), sau câu trả lời My Orders, và các màn kịch bản sau này (T10–T12 dùng lại).
- Do widget tự thêm, không phải sửa từng kịch bản ở API.
- Bấm vào → xem §7-3.

**D4 — Pill theo mã ở mọi chỗ còn lại** (hết BUG-011).
- Thẻ đơn trong chat và danh sách đơn: `StatusPill` như T02 / T03 / T04 / T06.
- Feed inquiry: bảng màu cố định theo 5 trạng thái có thật, thay vì đoán theo chữ:

| Trạng thái | Màu |
|---|---|
| received | xám |
| in_progress | cam |
| resolved | xanh lá |
| rejected | đỏ |
| closed | xám đậm |

## 3. Wireframe (tab Chat, 380px)

```
│ (🤖) Here are your recent orders 👇   │
│   ┌──────────────────────────────┐   │
│   │ IVY-39891          [Confirmed]│   │  ← bấm → Order Detail (D1)
│   │ Hydrating Face Mask + 2 items │   │
│   └──────────────────────────────┘   │
│   ┌──────────────────────────────┐   │
│   │ IVY-39641         [In Transit]│   │
│   │ Vitamin C Serum Set           │   │
│   └──────────────────────────────┘   │
│ (🤖) Do you need anything else?       │
│ ( Track delivery ) ( Cancel order )  │
│ ( Start over )                       │  ← chip dùng chung (D3)
├──────────────────────────────────────┤

Bấm "Start over" (theo §7-3a):
│ (🤖) What else can I help you with?   │
│ ( 💰 Payment check ) ( 🚚 Delivery inquiry ) │  ← menu 7 nút hiện lại ở cuối
│ ( 📦 Stock inquiry ) ( 😊 Exchange & Refund ) │
│ …                                    │
```

## 4. Thay đổi

| File | Nội dung |
|---|---|
| `chat/InlineOrderCard.tsx` | Thẻ là nút → `onOpenOrder(id)`; `StatusPill`; câu "Do you need anything else?" + 3 chip (D2) |
| `chat/ChatTab.tsx` | Mở Order Detail đè luồng chat (D1); thêm chip Start over vào chip của câu trả lời kịch bản; Start over (D3, §7-3) |
| `chat/reply-chips.ts` | Hàm thuần: ghép chip của câu trả lời + Start over, không lặp; có unit test |
| `orders/OrderList.tsx` | `StatusPill` (BUG-011) |
| `notifications/NotificationsTab.tsx` (`IssueFeed`) | Màu cố định theo trạng thái inquiry (BUG-011) |
| `i18n/locales/*.ts` ×6 | "Do you need anything else?", "Track delivery", "Cancel order", "Start over", "What else can I help you with?" |
| `e2e/tests/09-my-orders.spec.ts` | Thêm TC-09-05: Start over có ở câu trả lời kịch bản khác (Cancel / Refund); TC-09-06: Back từ Order Detail về đúng cuộc chat |
| `e2e/package.json` | Thêm `@T09` vào `test:ci` khi xanh hết |

## 5. Ảnh hưởng phụ

- **Có hiệu lực ngay sau deploy**, cho mọi tenant có nút My Orders hoặc dùng kịch bản có chip:
  - chip Start over xuất hiện ở các câu trả lời kịch bản;
  - thẻ đơn trong chat bấm được.
- **Với IVY:** nút My Orders chỉ hiện nếu chủ dự án giữ nó bật (GUIDE T08 §3). Tắt thì kịch bản này vẫn vào được qua chip gợi ý "My orders" sau câu trả lời AI (đã có).
- Pill danh sách đơn đổi từ chữ server sang chữ đã dịch theo mã. Ví dụ "Paid" → "Confirmed", như Order Detail ở T04.
- Không đổi API, không có SQL, không gửi push / email / SMS.

## 6. Kiểm thử

- `tsc` widget / e2e; `node --test apps/widget/test/*.mjs`; `i18n:check`; `radius:check` (container Linux); `vite build`.
- `@T09` xanh hết, lặp ×3; cổng CI mới ×2; toàn bộ desktop so với 82 / 15.
- Ảnh chụp EN / KO: câu trả lời My Orders + chip; Start over; Order Detail mở từ chat.

## 7. Xin bạn xác nhận

1. **Duyệt kế hoạch này?** Duyệt thì mình sửa code, test, rồi push. Push là production tự cập nhật.
2. **Chip "Track delivery" làm gì?**
   - **a (khuyến nghị):** chuyển sang tab Notifications → chip **Delivery**: thẻ giao hàng thật của khách (stepper 4 bước + Track Order, T03). Tab Chat vẫn giữ nguyên cuộc chat.
   - **b:** trả lời ngay trong chat bằng kịch bản giao hàng (như nút 🚚 Delivery inquiry): chính sách / thời gian giao chung, không phải tình trạng đơn của khách.
3. **Bấm "Start over" thì sao?**
   - **a (khuyến nghị):** bot nói "What else can I help you with?" và **menu 7 nút hiện lại ở cuối** cuộc chat. Tin nhắn cũ vẫn còn phía trên.
   - **b:** xoá màn chat về như lúc mới mở (lời chào + menu). Tin nhắn cũ ẩn khỏi màn hình, nhưng vẫn còn trong lịch sử.

Trả lời ví dụ: `1. ok  2. a  3. a`
