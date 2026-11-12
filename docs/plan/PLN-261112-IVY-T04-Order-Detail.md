# PLN-261112 — IVY T04 · Order Detail (địa chỉ, điện thoại, chữ theo thiết kế)

| | |
|---|---|
| Trạng thái | 🟨 **Chờ duyệt.** Chưa sửa code. Câu hỏi ở §7 |
| Task | [ivy-docs/TASKS.md T04](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-06 · G-08 |
| Figma | `1154:116`, `1007:250`, `1008:3254` (EN), `1006:4282` (KO). Chưa mở được vì Figma MCP vẫn hết lượt gọi (gói Starter). Dựa vào SPEC SCR-IVY-06, mô tả thiết kế trong [REQ-260920](../analysis/REQ-260920-Widget-Order-Detail-Redesign.md) và màn hiện tại |
| TC | TC-04-01..05 ([e2e/tests/04-order-detail.spec.ts](../../e2e/tests/04-order-detail.spec.ts)), hiện **3/5** (01, 02, 05 xanh) |
| Migration | **Không có** nếu chọn §7-2a. Có (2 cột) nếu chọn §7-2b |
| Deploy | Push → CI → server tự deploy. Đổi `apps/api`, `apps/widget`, `packages/types` |

## 1. Hiện trạng → mục tiêu

Màn Order Detail đã có từ PLN-260920: danh sách sản phẩm, khối tiền, tên + email, Track, hỏi về đơn. Phần còn thiếu là **địa chỉ và số điện thoại**. REQ-260920 (G8) đã cố ý hoãn phần này, với lý do: theo Shopify, địa chỉ và điện thoại là **dữ liệu khách hàng được bảo vệ** (Protected Customer Data, PCD). App phải được Shopify cấp quyền đọc trường đó thì mới được đọc và lưu.

| | Thiết kế / SPEC | Code hiện tại |
|---|---|---|
| Tiêu đề | **Order Detail** (KO 주문 상세) | "Order detail" |
| Khối liên hệ | **Information**: tên, email (link) | "Contact information" |
| Billing address | Có, "-" khi trống | Không có |
| Shipping address | Tên · địa chỉ · thành phố / bang / ZIP · quốc gia · điện thoại | Không có. API không trả địa chỉ, DB không lưu |
| Hàng hỏi về đơn | **Contact** (KO 문의하기) | "Contact us" (KO 문의하기) |
| Dòng sản phẩm | Ảnh, tên (tối đa 2 dòng), biến thể, giá | Như thiết kế, thêm "· Qty 1" sau biến thể |
| TC-04-04 | Contact → sang Chat, có câu hỏi về đơn | **Chạy đúng**, nhưng test đỏ: chữ "39891" khớp 2 chỗ, một ở Order Detail trong tab bị ẩn (vẫn còn trong trang) và một ở tin nhắn chat. Lỗi của test |

## 2. Quyết định thiết kế

**D1 — Lấy địa chỉ trực tiếp từ Shopify khi mở Order Detail, không lưu vào DB** (§7-2a, khuyến nghị).
- Endpoint mới `GET /orders/:id/addresses`, kiểm tra quyền sở hữu giống `GET /orders/:id`:
  - API gọi Shopify GraphQL `order(id) { shippingAddress, billingAddress }` cho đúng đơn đó;
  - trả `{ available, billing, shipping }`.
  - Mỗi địa chỉ gồm `name, address1, address2, city, province, zip, country, countryCode, phone`.
- Tách khỏi `GET /orders/:id`, giống `/tracking`: màn chi tiết hiện ngay như bây giờ, khối địa chỉ hiện sau đó khoảng nửa giây.
- `available: false`, và khối địa chỉ **ẩn hẳn**, khi:
  - app chưa có quyền PCD;
  - đơn không phải Shopify (Cafe24…);
  - Shopify lỗi hoặc chậm quá 4 giây.

  Ẩn chứ không hiện "-", vì "-" sẽ khiến khách hiểu là đơn không có địa chỉ.
- Không lưu địa chỉ vào DB, cache hay log. Log chỉ ghi mã đơn và lý do. Vì vậy luồng xuất / xoá dữ liệu (GDPR/CCPA) không phải sửa.
- Widget giữ kết quả 5 phút (React Query), nên mở lại cùng một đơn không gọi Shopify lần nữa.

**D2 — Bố cục theo thiết kế.**
- **Information** (tên, email) bên trái, **Billing address** bên phải. Khi Shopify trả về đơn không có địa chỉ thanh toán thì hiện "-".
- **Shipping address** ở dưới, full width:
  - tên;
  - địa chỉ (+ dòng 2 nếu có);
  - "THÀNH PHỐ Bang ZIP";
  - quốc gia;
  - điện thoại.
- Tên quốc gia hiện theo ngôn ngữ của widget, ví dụ "United States" / "미국" / "Hoa Kỳ" (`Intl.DisplayNames` theo mã quốc gia; không có mã thì dùng chữ Shopify gửi).
- Hàm định dạng địa chỉ là hàm thuần, có unit test.

**D3 — Chữ theo thiết kế, 6 ngôn ngữ:** "Order Detail", "Information", "Billing address", "Shipping address", "Contact". Chữ KO xem §7-4.

**D4 — Dòng sản phẩm:** chỉ hiện "Qty N" khi N > 1. Thiết kế không có số lượng; đa số dòng là 1, nhưng mua 2 cái thì khách vẫn cần biết.

**D5 — Không đổi:**
- Khối tiền: Discount đỏ, Subtotal · N items, Shipping Free, Total "USD $55.00". Đã đúng (TC-04-02 xanh).
- Pill trạng thái cạnh mã đơn (PLN-260920 §2-1). Thiết kế vẽ icon xe tải; giữ pill để giống dòng đã dẫn tới màn này.
- Hàng Track và Write Review.
- Contact vẫn chuyển sang Chat và gửi "I have a question about order #…".

**D6 — Sửa TC-04-04:** tìm câu hỏi trong **tab Chat**, không tìm trên cả panel.

## 3. Wireframe (380px)

**a) Đã có quyền đọc địa chỉ**
```
┌──────────────────────────────────────┐
│ ←            Order Detail            │
├──────────────────────────────────────┤
│ #IVY-39891               [Confirmed] │
│ ┌──┐ Hydrating Face Mask (10pcs) $4.99│
│ └──┘                                 │
│ ┌──┐ Ultra Mini Portable Fan,   $4.99│
│ └──┘ Powerful Pocket-Sized…          │
│      Burgundy / 6-8                  │  ← "Qty 2" chỉ khi > 1
├──────────────────────────────────────┤
│ Discount                      -$4.99 │  ← đỏ
├──────────────────────────────────────┤
│ Subtotal · 3 items            $55.00 │
│ Shipping                        Free │
│ Total                     USD $55.00 │
├──────────────────────────────────────┤
│ Information        Billing address   │
│ Hyein Kim          -                 │  ← "-" khi đơn không có
│ hykim4@ivyent.com                    │
│                                      │
│ Shipping address                     │
│ Hyein Kim                            │
│ 25 HARBOR PARK DR                    │
│ PORT WASHINGTON New York 11050-4605  │
│ United States                        │
│ 123123123                            │
├──────────────────────────────────────┤
│ 🚚 Track                           › │
│ 💬 Contact                         › │
└──────────────────────────────────────┘
```

**b) Chưa có quyền / Shopify lỗi:** như màn hiện tại, chỉ có Information, không có khối địa chỉ.
```
├──────────────────────────────────────┤
│ Information                          │
│ Hyein Kim                            │
│ hykim4@ivyent.com                    │
├──────────────────────────────────────┤
│ 🚚 Track                           › │
```

**c) Đang tải địa chỉ:** một dòng xám mờ (skeleton) chỗ khối địa chỉ, không có spinner giữa màn.

## 4. Thay đổi (theo §7-2a)

| File | Nội dung |
|---|---|
| `packages/types/src/api/widget.types.ts` | `OrderAddressResponse`, `OrderAddressesResponse { available, billing, shipping }` |
| `apps/api/.../order/shopify-admin.client.ts` | `fetchOrderAddresses()`: query GraphQL một đơn. Lỗi "not approved / access denied" → `null` (không có quyền), không ném lỗi |
| `apps/api/.../order/order.service.ts` | `addressesForSession()`: kiểm tra sở hữu, chỉ đơn Shopify, timeout 4 giây, mọi lỗi → `available: false` + `logger.warn` không kèm dữ liệu cá nhân |
| `apps/api/.../order/order.controller.ts`, `order.mapper.ts` | Route `GET /orders/:id/addresses`; map địa chỉ Shopify → response camelCase |
| `apps/widget/src/services/orderService.ts`, `hooks/useOrders.ts` | `getOrderAddresses()`, `useOrderAddresses()` (giữ 5 phút) |
| `apps/widget/src/lib/address.ts` (mới) | `addressLines(address, lang)`: các dòng hiển thị, tên quốc gia theo ngôn ngữ |
| `apps/widget/src/components/orders/OrderDetail.tsx` | Khối Information / Billing / Shipping (D2), "Qty" khi > 1 (D4) |
| `apps/widget/src/i18n/locales/*.ts` ×6 | `orders.detail`, `orders.contact` → Information, `billingAddress`, `shippingAddress`, `askRow` → Contact |
| `e2e/fixtures/ivy-data.ts`, `mock-api.ts` | Chuyển địa chỉ mẫu sang `orderAddresses()`, mock route mới |
| `e2e/tests/04-order-detail.spec.ts` | Sửa TC-04-04 (D6). Thêm TC-04-06: không có quyền → không có khối địa chỉ, phần còn lại vẫn hiện. Thêm TC-04-07: không có billing → "-" |
| Unit / Jest | `addressLines` (US, có / không dòng 2, thiếu trường, tên quốc gia 6 ngôn ngữ); client (map field, lỗi quyền → null); service (đơn của người khác → 404, đơn Cafe24 → unavailable, Shopify lỗi / chậm → unavailable) |
| `e2e/package.json` | Thêm `@T04` vào `test:ci` khi xanh hết |

**Nếu chọn §7-2b (lưu DB):** bảng trên, thay endpoint riêng bằng:
- 2 cột mã hoá AES-256-GCM trong `orders_cache`, kèm `sql/migration_orders_cache_addresses.sql`;
- đồng bộ địa chỉ trong lần sync 30 phút và trong webhook, với tầng dự phòng để sync không hỏng khi thiếu quyền;
- luồng xuất / xoá dữ liệu cá nhân (`privacy.service.ts`) xoá và xuất thêm 2 cột này.

## 5. Ảnh hưởng phụ

- **Quyền Shopify là điều kiện để khối địa chỉ hiện** (§7-3):
  - Code deploy an toàn dù đã có quyền hay chưa: chưa có thì màn giống hệt hiện tại, cộng thêm phần chữ mới.
  - Mình không vào được dashboard Shopify, nên không tự kiểm tra hay bật quyền được.
- **Có hiệu lực ngay**, không cần chờ cấu hình T01:
  - Ở layout 3 tab hiện tại, Order Detail mở từ tab Orders (danh sách đơn) và tab Notifications.
  - Khi tab Orders tắt, Order Detail mở từ chip Order.
- **Mỗi lần mở Order Detail gọi Shopify 1 lần** (giữ 5 phút ở widget). Chi phí GraphQL nhỏ (1 đơn, 2 địa chỉ), không ảnh hưởng hạn mức của lần sync 30 phút.
- **Tenant khác** dùng chung code: tenant Cafe24 hoặc không kết nối Shopify thì không có khối địa chỉ, như hiện tại.
- **Dữ liệu cá nhân:**
  - Địa chỉ chỉ đi tới đúng khách sở hữu đơn, qua phiên đã xác thực.
  - Không lưu, không log.
  - Không có SQL, không gửi push / email / SMS.
- Chữ "Contact" thay "Contact us" ở EN. KO vẫn 문의하기.

## 6. Kiểm thử

- `tsc` api / widget / web / types / e2e; Jest API order + `packages/types`; `node --test apps/widget/test/*.mjs`; `i18n:check`; `radius:check` (container Linux); `vite build`.
- `@T04` **7/7**, lặp ×3; cổng CI mới ×2; toàn bộ desktop so với 60 / 29.
- **Không kiểm tra được với Shopify thật ở local:** DB dev không có kết nối Shopify nào (không có token). Thay vào đó:
  - Jest client dùng response GraphQL mẫu theo tài liệu Shopify (Context7), gồm cả lỗi "not approved to access";
  - API local thật với đơn không kết nối Shopify → `available: false`, màn không lỗi;
  - sau deploy, nếu §7-3 là a: bạn mở Order Detail một đơn thật trên talk.ivyusa.com và so địa chỉ với admin Shopify.
- Ảnh chụp EN / KO / VI: đủ địa chỉ, không có quyền, đang tải.

## 7. Xin bạn xác nhận

1. **Duyệt kế hoạch này?** Duyệt thì mình sửa code, test, rồi push. Push là production tự cập nhật.
2. **Địa chỉ lấy từ đâu?**
   - **a (khuyến nghị):** đọc trực tiếp từ Shopify mỗi lần mở Order Detail, **không lưu vào DB**.
     - Không có SQL hay migration, không phải chạy gì trên server production.
     - DB không thêm dữ liệu cá nhân; luồng xuất / xoá dữ liệu không phải sửa.
     - Đổi lại: khối địa chỉ hiện chậm hơn khoảng nửa giây. Shopify lỗi thì khối đó ẩn.
   - **b:** lưu vào DB (2 cột mã hoá) và cập nhật mỗi 30 phút.
     - Khối địa chỉ hiện ngay.
     - Cần chạy SQL trên production **trước** khi push.
     - Phải sửa luồng xuất / xoá dữ liệu cá nhân.
     - Lấy địa chỉ của **mọi** đơn, kể cả đơn không ai mở.
3. **App Shopify production của IVY đã có quyền đọc Address và Phone chưa?** Kiểm tra trong Shopify Partner / Dev Dashboard → app → API access → Protected customer data. Theo [guide PCD](../guide/쇼피파이PCD승인및웹훅등록가이드_Shopify-PCD-Webhooks.ko.md), lần khai báo trước chỉ chọn Name và Email.
   - **a:** đã có → khối địa chỉ hiện ngay sau deploy.
   - **b:** chưa có / chưa rõ → mình vẫn làm. Khối địa chỉ tự ẩn cho tới khi app được cấp quyền, không cần deploy lại.
4. **Chữ KO** (mình chưa xem được bản Figma KO `1006:4282`). Đề xuất: **주문 상세** · **주문자 정보** · **청구지 주소** · **배송지 주소** · **문의하기**.
   - **a:** dùng đề xuất này; khi Figma mở lại, mình đối chiếu và sửa nếu lệch.
   - **b:** bạn gửi ảnh chụp bản KO, mình làm theo ảnh.

Trả lời ví dụ: `1. ok  2. a  3. b  4. a`
