# PLN-261111 — IVY T03 · Notifications: Delivery (thẻ giao hàng, stepper 4 bước, Track Order)

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-11** và đã làm, xem [RPT-261111-T03](../implementation/RPT-261111-IVY-T03-Delivery.md). Trả lời §7: (1) ok; (2) **a**, bước 2 dịch theo "Processing"; (3) **a**, dải ngày theo ngày đặt đơn |
| Task | [ivy-docs/TASKS.md T03](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-05 · G-07 · BR-06 · phần còn lại của BUG-011 (pill trên thẻ giao hàng) |
| Figma | `1007:1069` (EN, đã đối chiếu), Master `992:935`. Bản KO `1006:4374` chưa xem được vì Figma MCP hết lượt gọi (gói Starter) |
| TC | TC-03-01..05 ([e2e/tests/03-delivery.spec.ts](../../e2e/tests/03-delivery.spec.ts)), baseline 0/5 |
| Migration | **Không có** |
| Deploy | Push → CI → server tự deploy. Có đổi `packages/types` (API dùng) và `apps/widget` |

## 1. Hiện trạng → mục tiêu

Chip Delivery đã có sẵn thẻ giao hàng (`ShipmentList.tsx` + `TrackingStepperH.tsx`, từ PLN-260817). T03 chỉnh lại cho khớp thiết kế.

| | Thiết kế `1007:1069` | Code hiện tại |
|---|---|---|
| Nhãn bước | Preparing · **Processing** · **In Transit** · Delivered | Preparing · **Shipped** · **In transit** · Delivered (server gửi về theo ngôn ngữ, `DELIVERY_STEPS_BY_LANG`) |
| Vòng bước | 40px, **chỉ icon** (hộp · xe · xe · dấu ✓); đã qua và hiện tại: xanh; chưa tới: xám | 36px, icon **kèm số bước**; bước chưa tới chỉ có số |
| Nhãn dưới vòng | ~12px, xanh / xám | 10px |
| Pill | In Transit **cam**, Delivered **xám** (theo mã trạng thái) | `Badge` + `toneForStatus` đoán màu theo chữ (BUG-011) |
| Tóm tắt | "Ultra Mini Portable Fan, Powerful + 2 more items" | "… + 2 more" |
| Thông điệp | Đang giao: cam đậm "Your order is on the way!"<br>Đã giao: **đen đậm** "Your order is Delivered !" | "Your order is on its way — it will reach you soon!"<br>Đã giao: xám thường "This order has been delivered." |
| Nút | "Track Order", viền xám, full-width, **không icon** | "Track shipment" + icon mở link ngoài |
| Nhóm ngày | Có dải "Today's" phía trên các thẻ | Không có |
| Test-id | `delivery-card`, `delivery-step` + `data-state` (SPEC §9) | Chưa có |

## 2. Quyết định thiết kế

**D1 — Nhãn bước sửa ở server, một chỗ cho mọi màn.**
- `DELIVERY_STEPS_BY_LANG` (`packages/types/src/domain/status-map.ts`) là nguồn nhãn mà API gửi kèm dữ liệu tracking, theo ngôn ngữ của phiên chat. Bản dự phòng `orders.trackingSteps` trong 6 file ngôn ngữ của widget đổi theo.
- EN: **Preparing · Processing · In Transit · Delivered**.
- KO giữ nguyên **발송준비 · 배송시작 · 배송중 · 배송완료** (khớp BR-06). SPEC SCR-IVY-05 ghi bước 1 là "배송준비"; hai chỗ trong SPEC lệch nhau, mình giữ theo BR-06 và code hiện tại.
- ES / VI / JA / ZH: xem câu hỏi §7-2.

**D2 — Chữ theo thiết kế, đủ 6 ngôn ngữ.**
- Nút: "Track Order" (KO 배송조회, giữ nguyên).
- Đang giao: "Your order is on the way!"
- Đã giao: "Your order is Delivered!". Thiết kế có dấu cách trước "!"; mình bỏ dấu cách đó vì đó là lỗi gõ trong tiếng Anh.
- KO giữ câu hiện có. ES / VI / JA / ZH dịch lại theo câu EN mới.

**D3 — Stepper vẽ lại theo thiết kế.**
- Vòng 40px, chỉ icon, không số: hộp → xe → xe → dấu ✓.
- Mỗi bước có `data-state`:
  - `done`: đã qua;
  - `current`: bước đang ở;
  - `todo`: chưa tới.
  - Khi đã tới bước cuối (Delivered), cả 4 bước đều `done`.
- Đường nối: xanh giữa các bước đã qua, xám phần còn lại.
- Quy tắc tính trạng thái là hàm thuần (`deliveryStepState`), có unit test.

**D4 — Pill theo mã trạng thái** (hết BUG-011 trên màn này).
- Dùng `StatusPill` của T02; nhãn `notifications.status.*` đã có đủ 6 ngôn ngữ.
- Trạng thái lấy từ tracking khi đã tải: tới bước cuối = Delivered, còn lại = In Transit. Khi tracking chưa tải xong thì lấy từ trạng thái đơn.
- Nhờ vậy pill, stepper và thông điệp luôn nói cùng một điều.

**D5 — Tóm tắt "SP + 2 more items"**, có số ít / số nhiều (`orders.itemsMore_one/_other`). Danh sách My Orders (T09) dùng chung key nên cũng đổi theo.

**D6 — Nhóm ngày** "Today's" / "Yesterday's" / ngày, cùng kiểu dải xám như chip Order, theo múi giờ máy khách. Mốc thời gian: xem §7-3.

**D7 — Track Order** giữ quy tắc hiện tại (Q-05):
- Có link tracking của hãng vận chuyển → mở tab mới.
- Không có → mở Order Detail ngay trong widget. Dữ liệu đơn không có link "order status" của Shopify nên chưa dùng được phương án đó.
- Bỏ icon mở link ngoài cho giống thiết kế.

**Giữ nguyên:** chip Delivery vẫn hiện đơn **đang giao hoặc đã giao**, tối đa 5 đơn mới nhất. Đơn mới thanh toán, chưa gửi hàng, nằm ở chip Order (pill Confirmed).

## 3. Wireframe (chip Delivery, 380px)

```
┌──────────────────────────────────────┐
│ Hi, Seungeob            🌐 EN  ⚙  ✕ │
├──────────────────┬───────────────────┤
│ Notifications ④  │      Chat ①       │
│ ════════════════ │                   │
├──────────────────┴───────────────────┤
│ (Order)[Delivery](Promo)(Review) Select│
├──────────────────────────────────────┤
│ Today's                              │  ← notif-group (D6)
├──────────────────────────────────────┤
│ IVY-39891                [Delivered] │  ← delivery-card · pill xám
│ Ultra Mini Portable Fan + 2 more items│
│  (📦)━━━(🚚)━━━(🚚)━━━(✓)            │  ← 4 × delivery-step, tất cả done
│ Preparing Processing In Transit Delivered│
│       Your order is Delivered!       │  ← đen đậm
│ ┌──────────────────────────────────┐ │
│ │           Track Order            │ │  ← link tab mới / Order Detail
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ IVY-39641               [In Transit] │  ← pill cam
│ Vitamin C Serum Set                  │
│  (📦)━━━(🚚)━━━(🚚)───( ✓ )          │  ← done · done · current · todo (xám)
│ Preparing Processing In Transit Delivered│
│      Your order is on the way!       │  ← cam đậm
│ ┌──────────────────────────────────┐ │
│ │           Track Order            │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

## 4. Thay đổi

| File | Nội dung |
|---|---|
| `packages/types/src/domain/status-map.ts` | Nhãn bước mới (D1). Cập nhật `status-map.spec.ts` |
| `apps/widget/src/components/notifications/ShipmentList.tsx` | Thẻ theo thiết kế: `data-testid="delivery-card"`, `StatusPill`, tóm tắt, thông điệp, nút, nhóm ngày |
| `apps/widget/src/components/orders/TrackingStepperH.tsx` | Vòng 40px chỉ icon, `delivery-step` + `data-state` (D3). Component này chỉ chip Delivery dùng |
| `apps/widget/src/components/ui/StatusPill.tsx` | Nhận thêm mã trạng thái có sẵn (`status`), ngoài chữ `badge` |
| `apps/widget/src/lib/format.ts` hoặc file mới | `deliveryStepState()` + unit test `apps/widget/test/*.mjs` |
| `apps/widget/src/i18n/locales/*.ts` ×6 | `orders.trackingSteps`, `trackingCta`, `shipmentInTransit`, `shipmentDelivered`, `itemsMore_one/_other` |
| `e2e/package.json` | Thêm `@T03` vào `test:ci` khi 5/5 xanh |
| `ivy-docs/*`, RPT | Trạng thái, kết quả TC, sửa ghi chú SPEC (KO bước 1) |

## 5. Ảnh hưởng phụ

- **Có hiệu lực ngay trên production sau khi deploy**, không cần chờ cấu hình T01:
  - Hiện IVY đang ở layout 3 tab, nên thay đổi hiện ở tab **Orders → chip Delivery**.
  - Khi tab Orders tắt, thay đổi hiện ở **Notifications → chip Delivery**.
- Nhãn bước mới cũng hiện ở các màn khác dùng chung dữ liệu tracking, nên mọi chỗ nói giống nhau:
  - stepper dọc trong **Order Detail** (T04);
  - danh sách **My Orders** (T09).
- Code nhãn bước dùng chung cho mọi tenant, nhưng nhánh này chỉ deploy talk.ivyusa.com.
- API: chỉ đổi một hằng số chữ, không đổi endpoint, không đổi dữ liệu, không có SQL.

## 6. Kiểm thử

- `tsc` cho api, widget, types; Jest `packages/types`; `node --test apps/widget/test`; `i18n:check`; `radius:check` (chạy trong container Linux).
- `@T03` **5/5**, rồi cổng CI cũ + `@T02` với `--repeat-each=2`, và toàn bộ desktop để so với baseline 50/35.
- Ảnh chụp EN / KO / VI ở 380px so với Figma `1007:1069`.

## 7. Xin bạn xác nhận

1. **Duyệt kế hoạch này?** Duyệt thì mình bắt đầu sửa code, test, rồi push. Push là production tự cập nhật.
2. **Nhãn bước 2 cho ES / VI / JA / ZH.** Thiết kế EN gọi bước 2 là "Processing", còn KO gọi là 배송시작 ("bắt đầu giao").
   - **a (khuyến nghị):** dịch theo EN "Processing" → ES *En proceso* · VI *Đang xử lý* · JA *処理中* · ZH *处理中*. Khách đổi ngôn ngữ vẫn thấy cùng một ý.
   - **b:** giữ nghĩa "đã gửi hàng" như hiện tại (*Enviado* · *Đã gửi hàng* · *発送済み* · *已发货*). Chỉ EN đổi.
3. **Dải ngày ("Today's") trên thẻ giao hàng tính theo mốc nào?**
   - **a (khuyến nghị):** theo **ngày đặt đơn**. Không cần sửa API; thứ tự thẻ ổn định.
   - **b:** bỏ dải ngày ở chip Delivery.

Trả lời ví dụ: `1. ok  2. a  3. a`
