# RPT-261112 — IVY T09 · Kịch bản My Orders + chip "Start over"

Kế hoạch: [PLN-261112-IVY-T09](../plan/PLN-261112-IVY-T09-My-Orders.md), duyệt ngày 2026-11-12. Task: ivy-docs/TASKS.md T09. SPEC: SCR-IVY-11, G-15, BR-12. Bug: phần còn lại của BUG-011, và BUG-024 (phát hiện thêm).

**Quyết định của chủ dự án (2026-11-12):**
1. Duyệt kế hoạch.
2. **Track delivery** → tab Notifications, chip Delivery (thẻ giao hàng thật).
3. **Start over** → menu 7 nút hiện lại ở cuối cuộc chat; tin nhắn cũ giữ nguyên.
4. Chủ dự án gửi ảnh Figma `1006:5530` để đối chiếu.

## 1. Thay đổi (chỉ `apps/widget`, không có migration)

| File | Nội dung |
|---|---|
| `chat/InlineOrderCard.tsx` | **Thẻ đơn** là nút → mở Order Detail; `StatusPill` (BUG-011).<br>**Câu trả lời My Orders** theo thiết kế:<br>• bong bóng khách "My Orders";<br>• câu dẫn;<br>• tối đa 3 thẻ, thụt vào;<br>• "Do you need anything else?" + chip Track delivery · Cancel order · Start over;<br>• không có đơn → chỉ còn Start over.<br>Khung chat cuộn tới thẻ khi danh sách tải xong |
| `chat/ChatTab.tsx` | • **Thread insert** (BUG-024): câu trả lời My Orders và menu của Start over gắn vào vị trí trong luồng; tin nhắn sau hiện bên dưới.<br>• Order Detail mở đè lên chat, Back về đúng chỗ; Contact trong Order Detail gửi câu hỏi vào cuộc chat này.<br>• Chip Start over thêm vào mọi câu trả lời kịch bản có chip.<br>• Track delivery chuyển tab sang chip Delivery; tenant không có chip này thì chạy kịch bản giao hàng.<br>• Luồng "đăng nhập rồi xem đơn" đi qua insert |
| `chat/reply-chips.ts` | `withStartOver()`, `orderAnswerChips()` và id `start_over`, `track_delivery`, `cancel_order` |
| `chat/ChatChip.tsx` (mới) | Chip trắng dùng chung cho chip gợi ý trong chat |
| `orders/OrderList.tsx` | `StatusPill` theo mã. Hàng không có trạng thái UI mới dùng cách cũ (BUG-011) |
| `notifications/NotificationsTab.tsx` (`IssueFeed`) | Màu pill inquiry cố định theo 5 trạng thái (BUG-011) |
| `i18n/locales/*.ts` ×6 | `chat.startOver`, `chat.startOverLead`, `chat.orderAnswer.{followUp, trackDelivery, cancelOrder}`. KO theo thiết kế: 처음으로 · 배송 조회 · 주문 취소 · 더 도움이 필요하신가요? |

**Khác kế hoạch:**
- **BUG-024 (thêm):** khung trả lời trong chat nằm ở ô cố định cuối luồng, nên "Cancel order" sẽ hiện **phía trên** thẻ đơn. T09 chuyển My Orders và Start over sang kiểu gắn vị trí. Contact và Affiliate để T11 / T12.
- **Bong bóng khách "My Orders"** (thấy trong ảnh thiết kế) được thêm vào; PLN chưa ghi.
- **Câu "chưa có đơn"** trước đây hiện nguyên `{{days}}`; giờ truyền đúng số ngày.

### Test và tài liệu

| File | Nội dung |
|---|---|
| `apps/widget/test/reply-chips.test.mjs` | +3 ca |
| `e2e/tests/09-my-orders.spec.ts` | TC-09-01 kiểm thêm bong bóng khách. Thêm:<br>• TC-09-05: Start over ở kịch bản khác (consent bấm thật);<br>• TC-09-06: Back từ Order Detail;<br>• TC-09-07: Track delivery |
| `e2e/package.json` | `test:ci` thêm `@T09` |
| `ivy-docs/{TASKS,TEST-CASES,BUGS,SPEC}.md`, GUIDE CI §7, PLN | Trạng thái, kết quả. BUG-011 đóng; BUG-024 mới; G-15 ✅. TEST-CASES ghi chú về consent trong test chạy kịch bản thật |

## 2. Kiểm thử (local, 2026-11-12)

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit` widget, e2e | sạch |
| `vite build` widget | OK |
| `node --test apps/widget/test/*.mjs` | **104/104** |
| `npm run i18n:check` | đủ 6 ngôn ngữ |
| `radius:check` (container Linux) | sạch |
| `@T09` | **7/7** (baseline 1/4); lặp ×3 với 2 worker: 21/21 |
| Cổng CI mới (thêm `@T09`), `--repeat-each=2` | **154/154** |
| Toàn bộ desktop | **88 pass / 12 fail** (trước T09: 82 / 15). Mọi ca đỏ thuộc T10–T12 chưa làm |

**Ảnh chụp 380px (KO / EN):** khớp ảnh thiết kế:
- bong bóng khách xanh bên phải;
- thẻ đơn thụt vào, pill 주문확인 / 배송중 / 배송완료;
- "더 도움이 필요하신가요?" + 3 chip;
- sau Start over: "What else can I help you with?" + menu.

**Ghi chú test:** lần đầu TC-09-05 đỏ, vì mock chỉ đặt consent "đã đồng ý" cho widget. Server vẫn từ chối kịch bản nên không có chip. Test giờ bấm Accept consent thật. Không phải lỗi code; đã ghi trong TEST-CASES.

## 3. Ghi chú cho production

- **Có hiệu lực ngay sau deploy:**
  - chip Start over ở các câu trả lời kịch bản (Exchange & Refund, Delivery inquiry…);
  - pill theo mã ở danh sách đơn và feed inquiry;
  - khung trả lời My Orders đúng thứ tự.
- **Nút My Orders trên màn đầu** tuỳ cấu hình T08 (GUIDE-261112-IVY-Chat-Home-Config §3). Nếu tắt nút, khách vẫn vào My Orders qua chip "My orders" hiện sau câu trả lời AI.
- **Track delivery:**
  - Layout 3 tab hiện tại: sang tab **Orders** → chip Delivery.
  - Khi tab Orders tắt: tab **Notifications** → chip Delivery.
- Không đổi API, không có SQL, không gửi push / email / SMS.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Commit | `4e486a76` trên `deploy/talk-ivyusa` |
| CI | ✅ run 43184638826, xong 08:42:07Z: verify ✅, e2e gate ✅ (có `@T09`), deploy-gate ✅ |
| Server `talkaibotprd01` | ⏳ **Chưa xác nhận.** Cron deploy vài phút sau khi CI xanh. Máy dev bị ELB trả 403, nên không tự kiểm tra được. Chủ dự án kiểm tra bằng `tail -n 30 ~/ivy-autodeploy.log`: tìm `Deployed.` cho `4e486a76` |
| SQL / migration | Không có |
