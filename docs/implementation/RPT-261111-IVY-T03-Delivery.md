# RPT-261111 — IVY T03 · Notifications: Delivery (thẻ giao hàng, stepper 4 bước, Track Order)

Kế hoạch: [PLN-261111-IVY-T03](../plan/PLN-261111-IVY-T03-Delivery.md), duyệt ngày 2026-11-11. Task: ivy-docs/TASKS.md T03. SPEC: SCR-IVY-05, G-07, BR-06. Figma `1007:1069`.

**Quyết định của chủ dự án (2026-11-11):**
1. Duyệt kế hoạch.
2. Bước 2 ở ES / VI / JA / ZH dịch theo "Processing" của thiết kế EN.
3. Dải ngày trên thẻ tính theo **ngày đặt đơn**.

## 1. Thay đổi

### Dùng chung (API đọc qua `packages/types`, không có migration)

| File | Nội dung |
|---|---|
| `packages/types/src/domain/status-map.ts` | `DELIVERY_STEPS_BY_LANG`: EN **Preparing · Processing · In Transit · Delivered**; ES *En proceso*, VI *Đang xử lý*, JA *処理中*, ZH *处理中* ở bước 2; KO giữ nguyên. API gửi nhãn này trong `GET /orders/:id/tracking` theo ngôn ngữ của phiên |
| `packages/types/src/domain/status-map.spec.ts` | Đủ 4 bước ở 6 ngôn ngữ; khoá chữ EN theo thiết kế |

### Widget

| File | Nội dung |
|---|---|
| `notifications/ShipmentList.tsx` | Thẻ theo Figma: `delivery-card` (+`data-id`), `StatusPill`, "SP + 2 more items", câu trạng thái (cam đậm / đen đậm), nút **Track Order** (link hãng vận chuyển ở tab mới, không có thì mở Order Detail), dải ngày theo ngày đặt đơn, sắp mới nhất trước |
| `orders/TrackingStepperH.tsx` | Vòng 40px chỉ icon (hộp · xe · xe · ✓), xanh khi đã tới, xám khi chưa; `delivery-step` + `data-state`; `aria-current="step"` cho bước hiện tại |
| `lib/delivery.ts` (mới) | `deliveryStepState()`, `isDeliveredStep()`, `deliveryCardStatus()`: pill, stepper và câu trạng thái dùng chung một quy tắc |
| `ui/StatusPill.tsx` | Nhận thêm mã trạng thái có sẵn (`status`), ngoài chữ `badge` |
| `notifications/DateGroupHeader.tsx` (mới) | Dải "Today's" / "Yesterday's" / ngày, dùng chung cho chip Order và Delivery |
| `notifications/NotificationsTab.tsx` | Dùng `DateGroupHeader` (giao diện không đổi) |
| `i18n/locales/*.ts` ×6 | `orders.trackingSteps`, `trackingCta`, `shipmentInTransit`, `shipmentDelivered`; `itemsMore` → `itemsMore_one/_other` |

**Chữ mới (EN):** "Track Order" · "Your order is on the way!" · "Your order is Delivered!" (bỏ dấu cách trước "!" của bản thiết kế, PLN D2) · "+ 2 more items".

### Test và tài liệu

| File | Nội dung |
|---|---|
| `apps/widget/test/delivery-card.test.mjs` (mới) | 7 test: trạng thái từng bước, đã giao = cả 4 `done`, chưa có tracking, số bước khác 4, pill theo tracking hoặc theo đơn |
| `e2e/tests/03-delivery.spec.ts` | TC-03-05: giả lập trang UPS và chờ tab mới điều hướng xong (BUG-017) |
| `e2e/tests/01-shell-header.spec.ts` | TC-01-06: chờ theme tenant về rồi mới đo độ rộng (BUG-018) |
| `e2e/package.json` | `test:ci` thêm `@T03` |
| `ivy-docs/{TASKS,TEST-CASES,BUGS,SPEC}.md`, GUIDE §7, PLN | Trạng thái, kết quả, BUG-011 (thêm phạm vi T03), BUG-017, BUG-018. SPEC: selector T03 ✅, G-07 ✅, sửa ghi chú KO bước 1 (발송준비, khớp BR-06) |

## 2. Kiểm thử (local, 2026-11-11)

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit`: api, widget, web, e2e | sạch |
| `vite build` widget | OK |
| Jest `packages/types` | **198/198** |
| Jest API order + notification | 12 suite, **130/130** |
| `node --test apps/widget/test/*.mjs` | **84/84** (+7 test mới) |
| `npm run i18n:check` | đủ 6 ngôn ngữ |
| `radius:check` (container Linux) | sạch |
| `@T03` | **5/5** (baseline 0/5); lặp ×3: 15/15 |
| Cổng CI mới `@smoke\|@T00\|@T01\|@T02\|@T03\|@T13`, `--repeat-each=2` | **78/78** (sau khi sửa BUG-018) |
| TC-01-06 ×15 với 4 worker | trước sửa 4/15, sau sửa **15/15** |
| Toàn bộ desktop | **55 pass / 30 fail** (trước T03: 50 / 35). Mọi ca đỏ thuộc T04–T12 chưa làm |

Đã kiểm tra bằng mắt ảnh chụp EN / KO / VI / ES ở 380px so với Figma `1007:1069`: nhãn bước, icon, màu pill, câu trạng thái, nút và dải ngày đều khớp. VI: "Đang vận chuyển" xuống 2 dòng dưới vòng tròn, vẫn đọc được.

## 3. Ghi chú cho production

- **Có hiệu lực ngay sau deploy**, không cần chờ cấu hình T01:
  - Trong lúc IVY còn bật tab Orders (layout 3 tab), thẻ mới hiện ở **Orders → chip Delivery**.
  - Khi tab Orders tắt, thẻ mới hiện ở **Notifications → chip Delivery**.
- Nhãn bước mới cũng hiện ở các màn khác dùng chung dữ liệu tracking:
  - stepper dọc trong Order Detail;
  - stepper trong danh sách đơn.
- Tóm tắt "+ 2 more items" cũng đổi ở danh sách đơn và thẻ đơn trong chat, vì các màn này dùng chung key.
- API chỉ đổi chữ nhãn bước. Không đổi endpoint, không đổi dữ liệu, không có SQL hay migration.
- Không gửi push, email hay SMS nào.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Commit | `dc4d545d` trên `deploy/talk-ivyusa` |
| CI | ✅ run 42974469712, xong 06:46:35Z: verify ✅, e2e gate ✅ (có `@T03`), deploy-gate ✅ |
| Server `talkaibotprd01` | ⏳ **Chưa xác nhận.** Cron sẽ deploy vài phút sau khi CI xanh.<br>• Máy dev bị ELB trả 403, nên không tự kiểm tra được.<br>• Chủ dự án kiểm tra bằng `tail -n 30 ~/ivy-autodeploy.log`: tìm `Deployed.` cho `dc4d545d`. Commit tài liệu sau đó chỉ cập nhật code, không build lại |
| SQL / migration | Không có |
