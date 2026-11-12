# RPT-261112 — IVY T04 · Order Detail (địa chỉ, điện thoại, chữ theo thiết kế)

Kế hoạch: [PLN-261112-IVY-T04](../plan/PLN-261112-IVY-T04-Order-Detail.md), duyệt ngày 2026-11-12. Task: ivy-docs/TASKS.md T04. SPEC: SCR-IVY-06, G-08.

**Quyết định của chủ dự án (2026-11-12):**
1. Duyệt kế hoạch.
2. Địa chỉ **đọc trực tiếp từ Shopify** khi mở Order Detail, không lưu DB.
3. Quyền PCD (Address, Phone) của app Shopify production **chưa rõ**. Khối địa chỉ tự ẩn cho tới khi có quyền.
4. Chủ dự án gửi ảnh Figma `1006:4282` (KO) và `1008:3254` (EN) để đối chiếu.

## 1. Thay đổi

### Dùng chung và API (không có migration)

| File | Nội dung |
|---|---|
| `packages/types/src/api/widget.types.ts` | `OrderAddressResponse`, `OrderAddressesResponse { available, billing, shipping }` |
| `order/shopify-admin.client.ts` | `fetchOrderAddresses()`: query GraphQL `order(id) { shippingAddress, billingAddress }` cho đúng 1 đơn. Shopify từ chối vì thiếu quyền ("not approved to access", "Access denied") → `'denied'`, không ném lỗi. Hàm nhận biết lỗi quyền của lần sync 30 phút **giữ nguyên** |
| `order/order-address.service.ts` (mới) | `addressesForSession()`:<br>• kiểm tra sở hữu như `GET /orders/:id`;<br>• chỉ đơn Shopify, dùng kết nối của chính tenant;<br>• chờ Shopify tối đa 4 giây;<br>• không có quyền / lỗi / quá giờ → `available: false`.<br>Khi thiếu quyền, log 1 lần mỗi giờ cho mỗi tenant. Không lưu và không log địa chỉ |
| `order/order.mapper.ts` | `toAddress()`: chuỗi trống → null, mã quốc gia viết hoa, địa chỉ trống → null |
| `order/order.controller.ts`, `order.module.ts` | Route `GET /orders/:id/addresses` |

### Widget

| File | Nội dung |
|---|---|
| `lib/address.ts` (mới) | `addressLines()`: tên · địa chỉ · dòng 2 · "THÀNH PHỐ Bang" · ZIP · quốc gia · điện thoại. `countryName()`: tên quốc gia theo ngôn ngữ. `displayOrderNumber()`: "IVY-39891" giữ nguyên, số trơn "1002" → "#1002" |
| `services/orderService.ts`, `hooks/useOrders.ts`, `lib/types.ts` | `getOrderAddresses()`, `useOrderAddresses()` (giữ 5 phút, không thử lại) |
| `orders/OrderDetail.tsx` | • Khối khách (`order-customer`): **Information** \| **Billing address** 2 cột, **Shipping address** bên dưới.<br>• Đơn không có billing → "-".<br>• Không đọc được → ẩn 2 khối địa chỉ.<br>• Lúc đang tải: một khối xám mờ.<br>• Pill trạng thái dùng `StatusPill`.<br>• Mã đơn không thêm "#".<br>• "Qty" chỉ khi > 1 |
| `i18n/locales/*.ts` ×6 | `billingAddress`, `shippingAddress`. EN: `detail` "Order Detail", `contact` "Information", `askRow` "Contact" |

**Khác kế hoạch:**
- **Pill trạng thái:** vẫn là pill như PLN D5, nhưng giờ là cùng pill với dòng thông báo: "Confirmed", màu theo mã. Trước đây Order Detail ghi "Paid" trong khi dòng dẫn tới nó ghi "Confirmed". Hết BUG-011 trên màn này.
- **Chữ KO của khối liên hệ:** giữ **연락처 정보**, vì bản KO ghi "Contact information". Không dùng "주문자 정보" như đề xuất.
- **ZIP ở một dòng riêng:** cả hai frame Figma đều vẽ như vậy.
- **Service riêng `OrderAddressService`**, thay vì thêm hàm vào `OrderService`: các test hiện có tạo `OrderService` theo thứ tự tham số, thêm phụ thuộc vào đó dễ làm lệch.
- **Icon xe tải và chấm cam** cạnh mã đơn (Figma EN) chưa làm. Chỗ đó vẫn là pill, theo PLN D5.

### Test và tài liệu

| File | Nội dung |
|---|---|
| `apps/api/.../order-address.service.spec.ts` (mới) | 10 ca: client, mapper, service (sở hữu, Cafe24, không kết nối, thiếu quyền, lỗi, quá giờ) |
| `apps/widget/test/order-address.test.mjs` (mới) | 5 ca: dòng địa chỉ, thiếu trường, tên quốc gia 6 ngôn ngữ, mã đơn |
| `e2e/fixtures/ivy-data.ts`, `mock-api.ts` | `orderAddresses()`, route `/orders/:id/addresses`, tuỳ chọn `addresses: 'unavailable'` |
| `e2e/tests/04-order-detail.spec.ts` | Sửa TC-04-03/04 (BUG-020); ZIP dòng riêng; thêm TC-04-06 (không đọc được → ẩn), TC-04-07 (không billing → "-") |
| `e2e/package.json` | `test:ci` thêm `@T04` |
| `ivy-docs/{TASKS,TEST-CASES,BUGS,SPEC}.md`, GUIDE §7, PLN | Trạng thái, kết quả, BUG-011 (thêm T04), BUG-020. SPEC: SCR-IVY-06, selector Order Detail ✅, G-08 ✅ |

## 2. Kiểm thử (local, 2026-11-12)

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit`: api, widget, web, e2e; build `packages/types` | sạch |
| `vite build` widget | OK |
| Jest API order + notification | 14 suite, **147/147** (+10 test mới) |
| Jest `packages/types` | **198/198** |
| `node --test apps/widget/test/*.mjs` | **95/95** (+5 test mới) |
| `npm run i18n:check` | đủ 6 ngôn ngữ |
| `radius:check` (container Linux) | sạch |
| `@T04` | **7/7** (baseline 3/5); lặp ×3 với 2 worker: 21/21 |
| Cổng CI mới `@smoke\|@T00\|@T01\|@T02\|@T03\|@T04\|@T07\|@T13`, `--repeat-each=2` | **106/106** |
| Toàn bộ desktop | **65 pass / 26 fail** (trước T04: 60 / 29). Mọi ca đỏ thuộc T05, T06, T08–T12 chưa làm |
| API dev thật | Boot `successfully started` với service mới. `GET /orders/1/addresses` (đơn của khách; local không có kết nối Shopify) → `available: false`. Đơn lạ → 404 `E5001` |

**Không kiểm tra được với Shopify thật:** DB dev không có kết nối Shopify. Phần gọi Shopify được kiểm bằng Jest với response mẫu, gồm cả lỗi thiếu quyền.

**Ảnh chụp EN / KO / VI ở 380px:** khớp ảnh Figma chủ dự án gửi:
- 2 cột Information (KO 연락처 정보) và Billing address "-";
- Shipping address với ZIP một dòng riêng;
- hàng Contact / 문의하기.

Tên quốc gia theo ngôn ngữ: "United States" / "미국" / "Hoa Kỳ".

## 3. Ghi chú cho production

- **Khối địa chỉ chỉ hiện khi app Shopify có quyền đọc Address và Phone** (Protected Customer Data):
  - Chưa có quyền thì Order Detail giống hiện tại, cộng chữ mới và pill mới.
  - Có quyền thì khối địa chỉ hiện ngay, **không cần deploy lại**.
- **Cách kiểm tra app đã có quyền chưa:**
  - Trên server: `docker logs` của API có dòng `Shopify refused order addresses — grant the app Protected Customer Data Address + Phone access`, tối đa 1 lần mỗi giờ, ngay sau khi có người mở Order Detail. Có dòng này nghĩa là **chưa có quyền**.
  - Trên dashboard Shopify: Partner / Dev Dashboard → app → API access → Protected customer data → chọn thêm **Address** và **Phone** (lần trước chỉ chọn Name và Email). Mình không vào được dashboard này.
- **Có hiệu lực ngay sau deploy**, không cần chờ cấu hình T01. Order Detail mở từ:
  - tab Orders (danh sách đơn);
  - các dòng thông báo đơn hàng;
  - chip Order khi tab Orders tắt.
- **Mỗi lần mở Order Detail gọi Shopify 1 lần**, widget giữ kết quả 5 phút. Không ảnh hưởng lần sync 30 phút.
- **Dữ liệu cá nhân:**
  - Địa chỉ chỉ trả cho đúng khách sở hữu đơn.
  - Không lưu vào DB, không cache ở server, không ghi log.
  - Luồng xuất / xoá dữ liệu không đổi.
- Không có SQL, không có migration, không gửi push / email / SMS.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Commit | ⏳ điền sau khi push lên `deploy/talk-ivyusa` |
| CI | ⏳ |
| Server `talkaibotprd01` | ⏳ Cron sẽ deploy vài phút sau khi CI xanh. Máy dev bị ELB trả 403, nên không tự kiểm tra được. Chủ dự án kiểm tra bằng `tail -n 30 ~/ivy-autodeploy.log` |
| SQL / migration | Không có |
| Quyền PCD Address / Phone | ⏳ Chưa rõ, chủ dự án kiểm tra (§3) |
