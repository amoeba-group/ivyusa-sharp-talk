# IVY USA · TalkTalk Widget — TEST CASES

> Ca kiểm thử cho từng task trong [TASKS.md](TASKS.md), suy ra từ [SPEC.md](SPEC.md) (SCR/BR/NFR). Mỗi TC tương ứng **1 test Playwright** trong `e2e/tests/`, và tiêu đề test bắt đầu bằng mã TC.
> Cách chạy, lớp mock và hợp đồng selector: [ARCHITECTURE.md §8](ARCHITECTURE.md), [SPEC.md §9](SPEC.md).

## Cách chạy

```bash
# 1) Stack local (repo root)
npm run db:up && npm run dev            # API :3000 · widget :5174 (cần apps/widget/.env)

# 2) E2E (thư mục e2e/)
cd e2e
npm install && npx playwright install chromium   # lần đầu
npm run test:smoke                     # @smoke — phải luôn xanh
npm run test:ci                        # cổng CI: @smoke + các task đã xong (hiện @T00|@T01|@T02|@T03|@T04|@T05|@T06|@T07|@T08|@T09|@T10|@T13)
npm run test:task -- @T03              # toàn bộ TC của 1 task
npx playwright test --project=mobile   # các ca @responsive
npm test                               # tất cả (desktop + mobile)
npm run report                         # mở báo cáo HTML
E2E_TARGET=prod npm run test:prod      # smoke production (chỉ @prod, cần IP được allowlist)
```

**CI:** workflow *IVY CI/CD* chạy `test:ci` trên stack được seed mới (widget bản build qua `vite preview`) cho mỗi push/PR vào `deploy/talk-ivyusa`. Task xong thì thêm `|@Tnn` vào `test:ci` ([GUIDE-261110 §7](../docs/guide/GUIDE-261110-IVY-CICD.md)). Khi fail, tải artifact `e2e-report-*` của run để xem chi tiết.
**Tag:** `@T<nn>` task · `@smoke` luôn xanh · `@design` đối chiếu Figma (mock API) · `@integration` API thật · `@i18n` · `@a11y` · `@responsive` / `@mobile-only` · `@prod`.
**Lớp mock (`@design`):** `e2e/fixtures/mock-api.ts` vá `session/ensure` (khách "Kiho Lee" đã nhận diện, 2 tab, consent granted) và phục vụ notifications/orders/tracking/review/products/affiliate/inquiries/CSAT bằng dữ liệu Figma (`e2e/fixtures/ivy-data.ts`). Trường **PROPOSED** trong fixture là hợp đồng API mà task phải hiện thực.

---

## 0. Baseline

Chạy ngày **2026-11-09** trên commit `583ce121` (chưa sửa code widget), stack local, tenant seed `ivyusa`, Chromium. **26 pass / 49 fail** trên 75 test (desktop + mobile), mất 4.8 phút. TC đỏ là **đúng chủ đích**: chúng mô tả thiết kế chưa được implement (TDD). Từng ca đỏ đã được rà, đều tương ứng một gap G-xx (thiếu test-id, copy hoặc tính năng), không phải lỗi của test.

| Task | Pass / Tổng | TC đang xanh | TC đang đỏ |
|---|---|---|---|
| T00 | 4 / 4 | TC-00-01, TC-00-02, TC-00-03, TC-00-04 | — |
| T01 | 4 / 7 → **18 / 18** ✅ (T01, 2026-11-10; gồm TC-01-08 ×11) | tất cả | — |
| T02 | 0 / 6 → **6 / 6** ✅ (T02, 2026-11-11) | tất cả | — |
| T03 | 0 / 5 → **5 / 5** ✅ (T03, 2026-11-11) | tất cả | — |
| T04 | 0 / 5 → 3 / 5 (nhờ T02) → **7 / 7** ✅ (T04, 2026-11-12; thêm TC-04-06, 07) | tất cả | — |
| T05 | 0 / 4 → **7 / 7** ✅ (T05, 2026-11-12; thêm TC-05-05..07) | tất cả | — |
| T06 | 0 / 3 → **5 / 5** ✅ (T06, 2026-11-12; thêm TC-06-04, 05) | tất cả | — |
| T07 | 1 / 3 → **7 / 7** ✅ (T07, 2026-11-12; thêm TC-07-04..07) | tất cả | — |
| T08 | 1 / 5 → **6 / 6** ✅ (T08, 2026-11-12; thêm TC-08-06) | tất cả | — |
| T09 | 1 / 4 → **7 / 7** ✅ (T09, 2026-11-12; thêm TC-09-05..07) | tất cả | — |
| T10 | 1 / 5 → **7 / 7** ✅ (T10, 2026-11-12; thêm TC-10-06..07) | tất cả | — |
| T11 | 0 / 4 → **8 / 8** ✅ (T11, 2026-11-13; thêm TC-11-05..08) | tất cả | — |
| T12 | 0 / 4 → **6 / 6** ✅ (T12, 2026-11-13; thêm TC-12-05..06) | tất cả | — |
| T13 | 4 / 4 → **6 / 6** ✅ (T13, 2026-11-13; thêm TC-13-05, 06) | tất cả | — |
| T14 | 7 / 8 → 8 / 8 (nhờ T02: chip KO 주문 · 배송 · 프로모 · 리뷰) | TC-14-01 [en], TC-14-01 [es], TC-14-01 [ko], TC-14-01 [vi], TC-14-01 [ja], TC-14-01 [zh], TC-14-03, TC-14-02 [ko] | — |
| T15 | 3 / 4 → 4 / 4 (nhờ T02: chip `aria-pressed`) | tất cả | — |

> T16 (`@prod`) không chạy ở baseline vì talk.ivyusa.com trả 403 cho máy này (BUG-004).
> Khi một task xong, cập nhật lại dòng của task đó (chạy `npm run test:task -- @Tnn`).

---

## T00 · Môi trường (`00-smoke.spec.ts`)

| TC | Mô tả | Bước | Kỳ vọng | Tag |
|---|---|---|---|---|
| TC-00-01 | API health | `GET /api/v1/health` | 200, `data.status = ok` | smoke, integration |
| TC-00-02 | Storefront + launcher | mở `/?shop=ivyusa.myshopify.com` | thấy nút "Open support", **0 lỗi console** | smoke, integration |
| TC-00-03 | Mở panel tạo session | bấm launcher | `POST /session/ensure` 201 có `sessionToken`; tab Chat hiện | smoke, integration |
| TC-00-04 | Lưu consent | bấm Accept | `POST /session/consent` 201, `consentState = granted`; không có "We could not save your choice" | smoke, integration |

## T01 · Shell, header & tab (`01-shell-header.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-01-01 | Đúng 2 tab (cấu hình thật của tenant) | Có đúng 2 tab Notifications, Chat; không có tab Orders | G-01, SCR-IVY-03 |
| TC-01-02 | Lời chào | `.st-header-title` = "Hi, Kiho" (first name của "Kiho Lee") | G-02, SCR-IVY-02 |
| TC-01-03 | Badge chưa đọc | tab Notifications có nhãn "{n} unread" với n = số chưa đọc | BR-02 |
| TC-01-04 | Ẩn badge khi 0 | feed rỗng → không có badge | BR-02 |
| TC-01-05 | Đóng/mở | Close → ẩn; mở lại vẫn ở tab cũ; `Esc` → ẩn | SCR-IVY-01 |
| TC-01-06 | Rộng 380px (theme thật) | bề rộng panel 378–382px, **chờ** theme của tenant về (panel có thể mở ở 404px mặc định trước đó, BUG-018) | G-03, §4 |
| TC-01-07 | Settings | ⚙ → "Chat & AI consent"; Back → về tab | SCR-IVY-02 |
| TC-01-08 ×11 | Mọi kích thước màn hình, mở qua **`embed.js` thật** trên một trang storefront (tag `@devices`) | Panel nằm trọn trong màn hình. ≥ 640px: 380 × min(600, frame − 20). < 640px: rộng bằng màn hình, cao min(680, màn hình), bám đáy. Header "Hi, Kiho", 2 tab và nút Close đều hiện trong panel | SCR-IVY-01, yêu cầu 2026-11-10 "PC, tablet, mọi mobile" |

**Kết quả T01 (2026-11-10, local):** 7/7 + TC-01-08 11/11 ✅. Kích thước đo được:

| Màn hình | Panel |
|---|---|
| PC 1920×1080 · laptop 1366×768 · cửa sổ thấp 1280×650 | 380×600 |
| iPad dọc 768×1024 · ngang 1024×768 · iPad Pro 1024×1366 | 380×600 |
| điện thoại 320×568 · iPhone SE 375×667 | toàn màn hình |
| iPhone 15 390×844 · Pixel 7 412×915 | bottom sheet rộng hết màn, cao 680 |
| điện thoại xoay ngang 844×390 | 380×370 (tự co, không bị cắt) |

## T02 · Notifications — Order (`02-notifications-order.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-02-01 | Thanh chip | Order · Delivery · Promo · Review theo thứ tự trái→phải; không có All/Payment/Event; Order `aria-pressed=true` | G-04, BR-01 |
| TC-02-02 | Nhóm ngày | `notif-group` đầu chứa "Today"; có 1 nhóm "Yesterday" | BR-04 |
| TC-02-03 | Cấu trúc dòng | dòng IVY-39891: pill "Confirmed" `data-status=confirmed`, "Hydrating Face Mask (10pcs) + 2 items", `notif-time` = "Just now" | G-05, BR-08 |
| TC-02-04 | Định dạng thời gian | mọi `notif-time` khớp `Just now \| {n}mins ago \| {n}h ago \| Yesterday \| {n} days ago \| MMM d` | BR-05 |
| TC-02-05 | Đã đọc + mở chi tiết | dòng `data-unread=true` → bấm → `POST /notifications/:id/read` → heading "Order Detail" | G-06, BR-03, BR-07 |
| TC-02-06 | Màu pill | confirmed: xanh lá trội · in_transit: đỏ > lục (cam) · delivered: xám (chênh kênh < 24) · review: tím | §4, BR-06 |

**Kết quả (2026-11-11):** 6/6. Chạy lặp `@T02` + cổng CI cũ ×2: 68/68.

**Kiểm thử bổ sung cho T02:**

| Loại | File | Ca |
|---|---|---|
| Unit widget | `apps/widget/test/notice-row.test.mjs` | Biên thời gian BR-05: 59s / 1 phút / 59 phút / 1 giờ, qua nửa đêm, Yesterday theo lịch, 2 và 6 ngày, ngày tháng, khác năm. Nhóm Today's/Yesterday's. Mã pill: 6 chữ chuẩn, không đoán theo chữ na ná ("Delivery failed") |
| Unit widget | `apps/widget/test/tab-chips.test.mjs` | Bar 1 tab danh sách, bar 3 tab không đổi, chip cũ (`all`/`orders`/`payment`) quay về Order, lọc dòng Order |
| Jest API | `notification.service.spec.ts` | B2: tạo đúng, không lặp, không hồi sinh dòng đã xoá, chờ thanh toán, tenant 2 tab, không có Redis/khoá/tenant, chạy chung một lần giữa feed và badge, lỗi không làm hỏng feed, sắp theo thời điểm sự kiện. Feed chỉ đọc kênh `in_app` (BUG-015) |
| Jest API | `order.service.tracking.spec.ts` | B1: thông báo giao hàng có `refType 'order'` + `refId` |
| Tích hợp local (API + MySQL thật) | thủ công | B2 tạo 2 dòng, `createdAt` = ngày đặt, đã đọc (> 24 giờ). Gọi lại không tạo thêm. Dòng đã xoá không bị tạo lại. Đơn mới (< 24 giờ) → chưa đọc, badge 2 → 3 |

> Fixture: dòng "hôm qua" giờ là **đúng 24 giờ trước** (`yesterday()` trong `e2e/fixtures/ivy-data.ts`). Trước đây dùng 26 giờ, nên từ 00:00 đến 02:00 giờ New York nó rơi vào 2 ngày trước và TC-02-02 đỏ (BUG-016).

## T03 · Delivery (`03-delivery.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-03-01 | Thẻ theo đơn | có `delivery-card` cho IVY-39641 (đang giao) và IVY-39880 (đã giao) | SCR-IVY-05 |
| TC-03-02 | Nhãn bước | 4 `delivery-step` = Preparing · Processing · In Transit · Delivered | G-07, BR-06 |
| TC-03-03 | Thẻ đang giao | pill "In Transit"; `data-state` = done, done, current, todo; "Your order is on the way!" | BR-06 |
| TC-03-04 | Thẻ đã giao | pill "Delivered"; 4 bước done; "Your order is Delivered!" (test chấp nhận có hoặc không có dấu cách trước "!") | BR-06 |
| TC-03-05 | Track Order | mở tab mới tới `ups.com/track` (trackingUrl). Trang UPS được giả lập; test chờ tab mới điều hướng xong rồi mới đọc URL (BUG-017) | SCR-IVY-05, Q-05 |

**Kết quả (2026-11-11):** 5/5, lặp ×3: 15/15. Cổng CI mới (`@smoke|@T00|@T01|@T02|@T03|@T13`) ×2: 78/78. Toàn bộ desktop: 55 pass / 30 fail, mọi ca đỏ thuộc T04–T12 chưa làm.

**Kiểm thử bổ sung cho T03:**

| Loại | File | Ca |
|---|---|---|
| Unit widget | `apps/widget/test/delivery-card.test.mjs` | Trạng thái bước: đang giao (done · done · current · todo), đã giao (cả 4 done), bước 1–2, chưa có tracking (-1), số bước khác 4. Pill theo bước tracking khi đã tải (kể cả khi trạng thái đơn chậm hơn fulfillment), theo trạng thái đơn khi chưa tải |
| Jest `packages/types` | `status-map.spec.ts` | Đủ 4 bước ở cả 6 ngôn ngữ; EN = Preparing · Processing · In Transit · Delivered; VI bước 2 = "Đang xử lý" |
| Ảnh chụp | thủ công, 380px | EN / KO / VI / ES so với Figma `1007:1069` |

## T04 · Order Detail (`04-order-detail.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-04-01 | Dòng hàng | IVY-39891; "Hydrating Face Mask (10pcs)"; 2× "Burgundy / 6-8"; 3× "$4.99" | SCR-IVY-06 |
| TC-04-02 | Tổng tiền | Discount "-$4.99" · "Subtotal · 3 items" "$55.00" · Shipping "Free" · "USD $55.00" | SCR-IVY-06 |
| TC-04-03 | Thông tin & địa chỉ | Information (Hyein Kim, email) · Billing address · Shipping address (25 HARBOR PARK DR / PORT WASHINGTON New York / 11050-4605 / United States / 123123123). ZIP một dòng riêng như Figma `1008:3254`; "United States" so khớp chính xác (BUG-020) | G-08 |
| TC-04-04 | Contact | chuyển sang tab Chat, có câu hỏi chứa số đơn 39891 **trong tab đang hiện** (BUG-020) | SCR-IVY-06 |
| TC-04-05 | Back | quay lại danh sách | SCR-IVY-06 |
| TC-04-06 | Không đọc được địa chỉ | `GET /orders/:id/addresses` → `available: false`: không có "Billing address" / "Shipping address" / dòng địa chỉ; tiêu đề, tên, Total vẫn hiện | PLN-261112 D1 |
| TC-04-07 | Không có billing | khối Billing address = "-"; widget có gọi `/orders/:id/addresses` | Figma `1008:3254` |

**Kết quả (2026-11-12):** 7/7, lặp ×3 (2 worker): 21/21. Cổng CI mới (`@smoke|@T00|@T01|@T02|@T03|@T04|@T07|@T13`) ×2: 106/106. Toàn bộ desktop: 65 pass / 26 fail, mọi ca đỏ thuộc T05, T06, T08–T12 chưa làm.

**Kiểm thử bổ sung cho T04:**

| Loại | File | Ca |
|---|---|---|
| Jest API | `order-address.service.spec.ts` | Client: query đúng 1 đơn theo gid, có `phone`; lỗi PCD ("not approved to access", "Access denied") → `denied`, lỗi khác vẫn ném, đơn không có → null. Mapper: đổi field, chuỗi trống → null, mã quốc gia viết hoa, địa chỉ trống → null. Service: đúng kết nối của tenant; đơn người khác / không có → 404; đơn Cafe24 hoặc không có kết nối → không gọi Shopify; không có quyền / lỗi / không có đơn → `available: false`; quá 4 giây → `available: false` |
| Unit widget | `apps/widget/test/order-address.test.mjs` | Các dòng địa chỉ theo thiết kế (ZIP riêng), dòng 2, thiếu trường, tên quốc gia 6 ngôn ngữ, không có mã quốc gia, mã đơn có / không "#" |
| Tích hợp local (API thật) | thủ công | `GET /orders/1/addresses` (đơn của khách, local không có kết nối Shopify) → `available: false`; đơn lạ → 404 `E5001`. API boot `successfully started` với service mới |
| Ảnh chụp | thủ công, 380px | EN / KO / VI so với ảnh Figma `1008:3254` / `1006:4282` chủ dự án gửi |

## T05 · Promo (`05-promo.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-05-01 | Coupon vs sự kiện | `promo-item` `data-kind=coupon` / `event`; "Mad Shade" đậm (≥ 600) + "Buy one Get One 50% OFF today !" | G-09, SCR-IVY-07 |
| TC-05-02 | Màu icon | coupon: navy tối (B > R, tổng < 300); sự kiện: magenta (R > 180, G < 120, B > 60) | §4 |
| TC-05-03 | Mã coupon | `coupon-code` = SCHOOL20; "Copy" → clipboard = SCHOOL20; toast `status` "Code copied" | G-09, Q-16 |
| TC-05-04 | Link sự kiện | bấm "Mad Shade" → tab mới `ivyusa.com/collections/mad-shade`. Trang ivyusa.com được giả lập; chờ tab điều hướng xong rồi mới đọc URL (cùng kiểu BUG-017) | G-09 |
| TC-05-05 | Thông báo cũ (chưa có `kind`) | có link → `data-kind=event`, không link → `coupon`; không có `coupon-code` | PLN-261112-T05 D3 |
| TC-05-06 | Copy lỗi | clipboard từ chối → `role=alert` "Couldn't copy the code", có nút Close | CLAUDE.md §2 |
| TC-05-07 | Đang chọn (T07) | bấm ô chọn của "Mad Shade" → được tick, không mở tab mới; không còn nút Copy | PLN-261112-T05 D3 |

**Kết quả (2026-11-12):** 7/7, lặp ×3 (2 worker): 21/21. Cổng CI mới (`@smoke|@T00|@T01|@T02|@T03|@T04|@T05|@T07|@T13`) ×2: 120/120. Toàn bộ desktop: 72 pass / 22 fail, mọi ca đỏ thuộc T06, T08–T12 chưa làm.

**Kiểm thử bổ sung cho T05:**

| Loại | File | Ca |
|---|---|---|
| Jest `packages/types` | `common/promo.spec.ts` | 2 loại; mã hợp lệ / không hợp lệ (trống, dấu cách, ký hiệu, > 32); `promoFromContent`: không có `kind` → event, chỉ coupon giữ mã |
| Jest API | `campaign/campaign.promo.spec.ts` | Coupon giữ mã đã trim; event bỏ mã cũ; content cũ để nguyên; `kind` lạ / thiếu mã / mã sai → E5158; đã gửi → đổi loại / mã → E5159, sửa nội dung khác vẫn được; đổi status về draft không mở khoá; draft đổi được; `send` kiểm lại content cũ; gửi → `refType 'campaign'` + `refId`, mã qua moderation; mã bị chặn / bị che → không gửi, audit `coupon_code_moderated` |
| Jest API | `notification/notification-promo.service.spec.ts` | Gắn loại + mã cho từng dòng, 1 truy vấn; campaign của tenant khác không dùng; không có dòng campaign → không truy vấn; campaign đã xoá → không có; response có `kind` / `couponCode`, null khi không phải promo |
| Unit widget | `apps/widget/test/promo.test.mjs` | `promoKind`: loại từ API thắng, đoán theo link cho dòng cũ, chỉ `event` là promo; `safeLink`: chỉ `https` (`http`, `javascript:`, `data:`, đường dẫn tương đối → không có link) |
| Tích hợp local (API + MySQL + RabbitMQ thật) | thủ công | Tạo campaign Coupon ` SCHOOL20 ` → lưu `SCHOOL20`; mã "TWO WORDS" → E5158; gửi → thông báo `in_app` có `ref_type campaign`; feed widget trả `kind: coupon`, `couponCode: SCHOOL20`; đổi mã sau khi gửi → E5159; sửa nội dung → OK. Đã xoá dữ liệu thử |
| Ảnh chụp | thủ công | Widget EN / KO / VI chip Promo + toast; console modal: campaign đã gửi (2 ô mờ), campaign mới với mã sai (chữ đỏ, Save mờ) |

## T06 · Review (`06-review.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-06-01 | Dòng review | IVY-39875; pill Review; "Rose Hip Facial Oil 30ml · $55.00"; nút/link "Write Review" | SCR-IVY-08 |
| TC-06-02 | Write Review | mở trang sản phẩm ivyusa.com **hoặc** form trong widget (có nút Submit). Trang ivyusa.com giả lập; chờ tab mới điều hướng rồi mới đọc URL (BUG-017) | BR-10, Q-06 |
| TC-06-03 | Lỗi lưu | Dòng **không có link** (để luôn mở form); `POST /reviews` 500 → `role=alert` "Couldn't save… try again"; ô chữ vẫn "Love it", nút Submit bấm được | BUG-009 |
| TC-06-04 | Gửi lại | Lần 1 → 500 (toast lỗi), lần 2 → 201 → "Thanks for your review!" | PLN-261112-T06 D3 |
| TC-06-05 | Bị chặn | `POST /reviews` 422 `E4002` → toast "…Remove contact details or offensive words…" | PLN-261112-T06 D3 |

**Kết quả (2026-11-12):** 5/5, lặp ×3 (2 worker): 15/15. Cổng CI mới (`@smoke|@T00|@T01|@T02|@T03|@T04|@T05|@T06|@T07|@T13`) ×2: 130/130. Toàn bộ desktop: 77 pass / 19 fail, mọi ca đỏ thuộc T08–T12 chưa làm.

**Kiểm thử bổ sung cho T06:**

| Loại | File | Ca |
|---|---|---|
| Unit widget | `apps/widget/test/review-error.test.mjs` | E4002 → `review.blocked`; lỗi mạng, mã khác, null → `review.saveFailed` |
| Tích hợp local (API thật) | thủ công | `GET /orders/review-items` → dòng "IVY Repair Serum" (không có link, nên mở form). `POST /reviews` → 201, dòng chuyển `reviewed: true`. Đã xoá review thử. Ghi nhận: tenant local không có luật che email, nên email trong nội dung review không bị che (xem RPT §3) |
| Ảnh chụp | thủ công, 380px | EN / KO / VI chip Review; EN form + toast lỗi (form giữ 4 sao và nội dung) |

## T07 · Chọn & xoá (`07-select-delete.spec.ts`) — test fail nếu xuất hiện `window.confirm/alert`

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-07-01 | Xoá đã chọn | Select → tick 2 → "Delete Selected Notifications" → `DELETE /notifications {ids}` đúng 2 id; còn n−2 dòng; toast "deleted" | G-11, BR-09 |
| TC-07-02 | Xoá tất cả | "Delete All Notifications" → xác nhận **trong panel** → `DELETE {all:true}` → 0 dòng | G-11 |
| TC-07-03 | Huỷ | Cancel → hết checkbox; không có request DELETE | SCR-IVY-09 |
| TC-07-04 | Phạm vi "Delete All" | Ở chip Order: hộp xác nhận nhắc "Order" → `DELETE {all:true, categories:['payment','shipping']}`; toast "3 notifications deleted"; chip Promo vẫn còn 3 dòng | PLN-261111 §7-2a |
| TC-07-05 | Bàn phím | Hộp xác nhận mở với focus ở Cancel; Esc đóng hộp xác nhận, **không** đóng widget; focus về "Delete All Notifications"; không có DELETE | PLN-261111 D2 |
| TC-07-06 | Tên ô chọn | ô chọn của dòng IVY-39891 tên "Select IVY-39891" | PLN-261111 D4 |
| TC-07-07 | Xoá lỗi | `DELETE /notifications` 500 → `role=alert` "Couldn't delete notifications"; dòng vẫn được tick, số dòng không đổi; sau 3,5 giây vẫn còn; nút Close đóng nó | CLAUDE.md §2, PLN-261111 D3 |

**Kết quả (2026-11-12):** 7/7, lặp ×3 (2 worker): 21/21. Cổng CI mới (`@smoke|@T00|@T01|@T02|@T03|@T07|@T13`) ×2: 92/92. Toàn bộ desktop: 60 pass / 29 fail. 28 ca đỏ thuộc T04–T12 chưa làm; ca còn lại là TC-02-04 đọc DOM không chờ, đã sửa (BUG-019), chạy lại `@T02|@T03` ×3 với 4 worker: 33/33.

**Kiểm thử bổ sung cho T07:**

| Loại | File | Ca |
|---|---|---|
| Unit widget | `apps/widget/test/tab-chips.test.mjs` | `deleteAllFilter`: chip Order → payment + shipping (không dùng scope `order` vì có cả review); Promo/Event → `event`; All → `scope` khi 2 tab danh sách, cả feed khi 1 tab |
| Unit widget | `apps/widget/test/toast.test.mjs` | Toast thành công tự tắt đúng 3 giây; toast lỗi không tự tắt, đóng bằng `dismiss`; cùng một câu không hiện 2 lần; tối đa 3 toast |
| Jest API | `notification.service.spec.ts` | `all` chỉ xoá kênh `in_app` của chính khách; `categories` → đúng các loại đó; `scope` → cùng nửa feed như `list()`; `categories` thắng `scope`; `'all'` không phải loại; xoá theo id không bị `categories`/`scope` ảnh hưởng |
| Jest API | `dto/request/notification.request.spec.ts` | Body cũ (`ids`, `all`) vẫn hợp lệ; `categories`/`scope` hợp lệ; loại lạ, `'all'`, scope lạ → 400 |
| Tích hợp local (API + MySQL thật) | thủ công | `DELETE {all, categories:['event']}` → `deleted: 1`: chỉ dòng event `in_app` của khách bị xoá; dòng email cùng sự kiện, dòng của khách khác và thông báo đơn hàng còn nguyên. API dev trả 400 cho `scope`/`categories` sai |
| Ảnh chụp | thủ công, 380px | EN / KO / VI: chế độ chọn (ô xanh / xám), hộp xác nhận, toast |

## T08 · Chat home (`08-chat-home.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-08-01 | Lời chào | bubble có "IVY Beauty" | SCR-IVY-10 |
| TC-08-02 | 7 quick-reply + Affiliate | `quick-replies` có đúng 8 nút theo thứ tự: 7 nút thiết kế (💰 Payment check … 🤝 Contact Support) rồi 💼 Affiliate (T12 §8-3a). Mỗi nút có emoji + nhãn | G-12, BR-11 |
| TC-08-03 | Kiểu chip | nền `rgb(255,255,255)` (đọc bằng `expect.poll`), viền ≥ 1px. EN: trong một hàng có chip rộng khác nhau (rộng theo chữ, không lưới 2 cột). **KO** (frame `1008:2291`): ≥ 3 chip trên 1 hàng | G-12, §4 |
| TC-08-04 | Composer | placeholder "Ask Anything"; Send disabled khi rỗng, enabled khi có chữ | G-13 |
| TC-08-05 | Hỏi–đáp thật | gửi câu hỏi → `POST /chat/message` < 300 → bubble khách + câu trả lời bot hiện | BR-16 |
| TC-08-06 | Lần vẽ đầu | MutationObserver ghi màu nền chip **ngay khi chip xuất hiện** = trắng (không vẽ kiểu mặc định rồi đổi). Bỏ cơ chế chờ thì đỏ 6/6 (BUG-023) | PLN-261112-T08 |

**Kết quả (2026-11-12):** 6/6, lặp ×4 (3 worker): 24/24. Cổng CI mới (`@smoke|@T00|@T01|@T02|@T03|@T04|@T05|@T06|@T07|@T08|@T13`) ×2: 140/140. Toàn bộ desktop: 82 pass / 15 fail, mọi ca đỏ thuộc T09–T12 chưa làm.

> TC-08-01 và TC-08-04 đọc lời chào và placeholder từ **cấu hình thật của tenant** (session/ensure không bị mock). CI có cấu hình này nhờ seed; DB local cũ cần nhập cấu hình như GUIDE-261112-IVY-Chat-Home-Config.

**Kiểm thử bổ sung cho T08:**

| Loại | File | Ca |
|---|---|---|
| Jest API | `ai-engine/ai-config.service.scenario-emoji.spec.ts` | Lưu nút giữ `emoji` (cắt khoảng trắng) và `message` (BUG-022); `message` dài tới 300; emoji / message trống thì không lưu; emoji dài cắt ở 16 đơn vị **theo ký tự trọn vẹn**; emoji có tông da giữ nguyên |
| Jest API | `tenant/tenant.service.spec.ts` | `composer_placeholder_*`: theo ngôn ngữ, cắt khoảng trắng, xoá như các bag khác |
| Seed | thủ công, DB tạm `db_t08_seedcheck` | Seed mới tạo: lời chào KO, placeholder EN "Ask Anything", `quickReplyStyle: card`, `disclosurePlacement: bottom`, 7 nút (nút 1 💰, nút 7 KO "Contact Support"). Đã xoá DB tạm |
| Tích hợp local (API thật) | thủ công | Nhập cấu hình IVY qua đúng endpoint console dùng: `PATCH /tenants/widget-settings`, `PATCH /tenants/widget-theme`, `PUT /ai-config`. Đọc lại đúng 6 ngôn ngữ (utf8mb4) |
| Ảnh chụp | thủ công, 380px | KO / EN / VI; KO khớp ảnh thiết kế (3 chip / hàng, bong bóng xám không avatar) |

## T09 · My Orders (`09-my-orders.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-09-01 | Danh sách đơn | bong bóng khách "My Orders" (`.st-message-user`) + "…recent orders…" + thẻ IVY-39891 | SCR-IVY-11 |
| TC-09-02 | Chip tiếp theo | Track delivery · Cancel order · Start over | G-15, BR-12 |
| TC-09-03 | Thẻ bấm được | bấm thẻ → "Order Detail" | G-15 |
| TC-09-04 | Start over | quay về menu quick-reply (có "Payment check") | BR-12 |
| TC-09-05 | Start over ở kịch bản khác | Exchange & Refund (kịch bản `cancel_refund`, API thật, consent **bấm thật**) → có chip Start over → bấm → "What else can I help you with?" + 2 khối `quick-replies` | BR-12 |
| TC-09-06 | Back từ Order Detail | Back → tab Chat, câu trả lời My Orders và chip Track delivery vẫn còn | PLN-261112-T09 D1 |
| TC-09-07 | Track delivery | → tab Notifications, chip Delivery `aria-pressed=true`, có `delivery-card` | PLN-261112-T09 §7-2a |

**Kết quả (2026-11-12):** 7/7, lặp ×3 (2 worker): 21/21. Cổng CI mới (thêm `@T09`) ×2: 154/154. Toàn bộ desktop: 88 pass / 12 fail, mọi ca đỏ thuộc T10–T12 chưa làm.

> **Consent trong test có kịch bản chạy trên API thật.**
> - Mock mặc định chỉ sửa câu trả lời `session/ensure` thành "đã đồng ý". Phiên trên server thì **chưa** có consent, nên `/chat/scenario` trả câu từ chối và không có chip.
> - Test cần kịch bản thật thì dùng `consent: 'pending'` rồi `acceptConsentIfShown()`, như TC-09-05.

**Kiểm thử bổ sung cho T09:**

| Loại | File | Ca |
|---|---|---|
| Unit widget | `apps/widget/test/reply-chips.test.mjs` | `withStartOver`: thêm 1 lần, không thêm vào câu trả lời không có chip; `orderAnswerChips`: 3 chip khi có đơn, chỉ Start over khi không có |
| Ảnh chụp | thủ công, 380px | KO / EN khớp ảnh thiết kế: thẻ thụt vào, pill 주문확인 / 배송중 / 배송완료, "더 도움이 필요하신가요?", chip 배송 조회 · 주문 취소 · 처음으로; menu hiện lại sau Start over |

## T10 · Product Help (`10-product-help.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-10-01 | Menu con | Trong `product-help`: bong bóng khách "Product inquiry", "What do you need help with?", chip How to use · Ingredients · Exchange / Return · Restock alert · Start over · Popular products; menu đầu (`quick-replies`) vẫn còn | SCR-IVY-12 |
| TC-10-02 | Danh mục | Popular products → `product-categories`: bong bóng khách "Popular products", 11 chip Hair … K-Beauty + Start over | G-16, BR-17 |
| TC-10-03 | Sản phẩm phổ biến | Popular products → Nails → "Here are our most popular Nails products" + thẻ "Gel Polish Starter Set" (`product-card`, link trang sản phẩm, tab mới); link "See all Nails on ivyusa.com"; gọi `GET /products/popular?category=nails` | G-16 |
| TC-10-04 | Chính sách đổi trả | Exchange / Return (API thật, consent **bấm thật**) → bong bóng khách "Exchange / Return", câu chứa "10 days" + "unopened", chip Track delivery · Cancel order · Start over | SCR-IVY-12, PLN-261112-T10 §8-3a |
| TC-10-05 | Đang gõ (API thật) | trong lúc chờ trả lời thấy "Writing a reply…" | BR-16 |
| TC-10-06 | Shopify không trả lời | mock `popular: 'unavailable'` → "I couldn't load the popular Lashes products right now.", không có thẻ, có link "See all Lashes on ivyusa.com" | PLN-261112-T10 D3 |
| TC-10-07 | Chip đã chọn | Popular products `aria-pressed=true`, Ingredients `false`; Nails `true`; "Other categories" → picker thứ 2 ở dưới | PLN-261112-T10 D1 |

**Kết quả (2026-11-12):** 7/7, lặp ×3 (2 worker): 21/21. Cổng CI mới (thêm `@T10`) ×2: 168/168. Toàn bộ desktop: 94 pass / 8 fail, mọi ca đỏ thuộc T11–T12 chưa làm.

> **Đổi so với bản TC ban đầu:** TC-10-02 / 03 bấm Popular products trước (thứ tự §8-2a). TC-10-03 gọi API mới `/products/popular`, không phải `/products`. TC-10-04 kiểm "10 days" theo chính sách thật (§8-3a), không phải "7 days" của thiết kế.

> **Consent thật: dùng `acceptConsent()`** (TC-10-04, TC-09-05).
> - Trên dev server, widget gọi `/session/ensure` 2–3 lần lúc mở (StrictMode, BUG-003). Lời gọi về sau có thể đổi token **sau khi** đã bấm Accept, nên consent nằm ở phiên bị bỏ.
> - `acceptConsentIfShown()` còn có thể bỏ qua bước Accept nếu banner chưa hiện. Kết quả là server từ chối kịch bản: 1/21 lần chạy TC-10-04.
> - `acceptConsent()` chờ mạng yên rồi mới bấm. Sau khi đổi: 16/16 lượt TC-10-04 + TC-09-05.

**Kiểm thử bổ sung cho T10:**

| Loại | File | Ca |
|---|---|---|
| Unit types | `packages/types/src/common/product-category.spec.ts` | Đọc handle từ handle trần hoặc URL cửa hàng; handle chữ Hàn; từ chối khoảng trắng, `..`, quá 100 ký tự |
| Unit API | `ai-config.service.product-categories.spec.ts` | Lưu giữ `categories` (BUG-022); chuẩn hoá handle; bỏ dòng thiếu tên / handle hỏng / trùng; tối đa 20; chỉ nút Product help; trả tên theo ngôn ngữ phiên |
| Unit API | `product-popular.service.spec.ts` | Collection đã cấu hình → sản phẩm + link; cache 15 phút; collection lạ / nút tắt → 400; Shopify lỗi / không kết nối → `available: false`, nhớ 60 giây; timeout 4 giây; client lọc DRAFT và sản phẩm không lên cửa hàng, đúng thứ tự best-selling |
| Unit widget | `apps/widget/test/reply-chips.test.mjs` | `productHelpChips`: Popular products chỉ khi có danh mục, kết thúc bằng Start over; `categoryChips`: giữ thứ tự, phân biệt danh mục với chip điều khiển |
| Ảnh chụp | thủ công, 380px | KO khớp `1006:5588`: chip 교환 / 반품 viền xanh, bong bóng khách, câu 10일, chip 배송 조회 · 주문 취소 · 처음으로. EN: thẻ sản phẩm + "See all Nails on ivyusa.com" |

## T11 · Contact (`11-contact.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-11-01 | Kênh email | "Please choose how you'd like to reach us.", hello@ivyusa.com (§8-2a), "24 hours", "1 business day"; **không** có 1588-0000 / help@ivy.com; không có thẻ live chat; chip Start over | G-17, BUG-010, Q-08, Q-15 |
| TC-11-02 | Form | "Email inquiry" → câu dẫn + `contact-form` có Name, Email (= hykim4@ivyent.com), Message (placeholder theo thiết kế) | G-18, BR-14 |
| TC-11-03 | Validate | tên trống, email sai, nội dung trống → báo lỗi dưới từng ô; không gửi `POST /inquiries` | BR-14 |
| TC-11-04 | Gửi | `POST /inquiries {name, email, message}` → thẻ "YOUR INQUIRY" có đủ 3 giá trị, "Your message has been sent successfully.", "Please check your inbox…"; form biến mất | G-18 |
| TC-11-05 | Tenant bật live chat | Có cả thẻ Email inquiry và "Chat with an agent" | G-17, Q-15 |
| TC-11-06 | Gửi lỗi | `POST /inquiries` 500 → toast lỗi "Your message couldn't be sent…"; form giữ nội dung; không có thẻ đã gửi | CLAUDE.md §2 UX feedback |
| TC-11-07 | Tenant không cấu hình | Chỉ thẻ live chat; không có 1588-0000 / help@ivy.com / hello@ivyusa.com | BUG-010 |
| TC-11-08 | API thật (khách chưa đăng nhập) | Đồng ý consent → form không điền sẵn → gửi → API trả 201 → bong bóng thành công | G-18, BR-14 |

| Loại | File | Ca |
|---|---|---|
| Unit types | `packages/types/src/common/inquiry.spec.ts` | `inquiryProblems` (thiếu / sai / quá dài), `isEmailAddress`, `normalizeInquiry`, `contactChannels` (chỉ kênh đã điền; không điền gì → live chat), `telHref` |
| Unit API | `inquiry.service.spec.ts` | Khách vãng lai → lead chỉ từ email; khách đăng nhập giữ customer; chỉ gắn cuộc chat của chính phiên; mail tới email hỗ trợ với Reply-To = khách; không SMTP / không email hỗ trợ → không mail; consent / dữ liệu sai / email đã xoá → từ chối, không lưu; 5 lần / giờ; xem chi tiết đúng tenant + audit; đổi trạng thái |
| Unit API | `tenant.service.spec.ts` | Contact Support: email viết thường, số giữ nguyên, cờ live chat; xoá như các trường khác; email / số sai → 400 |
| Unit API | `session.mapper.spec.ts` | Phiên trả `customerEmail` |
| API thật (local) | script ngoài repo | 17 bước: lưu cấu hình, `ensure` có `supportEmail`, 403 khi chưa consent, 400 / 429, DB không có bản rõ, danh sách che email, chi tiết + audit, 404 |
| Ảnh chụp | thủ công, 380px | KO khớp `1006:5650` (고객센터 연결 방법을 선택해주세요 · 📧 이메일 문의 · 24시간 접수 · 1영업일 내 회신 · 처음으로). EN khớp `1006:6529` / `1006:6597`. Console: khối Contact Support, tab Inquiries, hộp chi tiết |

## T12 · Affiliate & CSAT (`12-affiliate-csat.spec.ts`)

Chạy với consent thật: Affiliate là kịch bản trên API thật (câu chữ IVY của seed). End và đánh giá cũng đi API thật, mock chỉ ghi lại.

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-12-01 | 3 bước + 4 chip | `script-steps` có 3 thẻ: "Submit an application", "1–3 business days", "10%"; "IVY Beauty affiliate partner"; chip đúng thứ tự **Apply now · Learn more · Start over · End** | G-19 |
| TC-12-02 | CSAT 4 mức | End → "How was your chat today?" → `csat-card` "Please rate your satisfaction" có đúng 5 nút: Dissatisfied · Neutral · Satisfied · Very satisfied · Skip; chưa có "chat has ended" | G-20, Q-12, BR-13 |
| TC-12-03 | Gửi đánh giá | Very satisfied → `POST /chat/csat` rating 5 → "Thank you for your feedback" **rồi** "chat has ended" (nằm dưới) | BR-13, G-20 |
| TC-12-04 | Bỏ qua | Skip → "chat has ended", thẻ biến mất, không gọi `/chat/csat` | BR-13 |
| TC-12-05 | Apply now | Câu dẫn "…email you about the affiliate program"; form điền sẵn "join your affiliate program" → gửi → `POST /inquiries` có câu đó → thẻ "YOUR INQUIRY" | PLN-261113 §8-2a |
| TC-12-06 | Learn more | Câu trả lời ("referral link") nằm **dưới** các thẻ bước (BUG-024); chip còn Apply now · Start over · End | G-19, BR-12 |

**Kết quả (2026-11-13):** 6/6, lặp ×3: 18/18. Cổng CI mới (thêm `@T12`) ×2: 196/196. Toàn bộ desktop: **108 / 108** xanh.

| Loại | File | Ca |
|---|---|---|
| Unit widget | `apps/widget/test/script-steps.test.mjs` | Câu Affiliate EN → mở đầu + 3 bước + câu kết; KO, khoảng "1–3" không bị tách; không in đậm → tách ở gạch có khoảng trắng; không có danh sách / chỉ 1 dòng → không tách; chỉ lấy dãy bước đầu tiên |
| Unit widget | `apps/widget/test/reply-chips.test.mjs` | Start over chèn trước End |
| Unit API | `ai-config.service.scenario-copy.spec.ts` | `affiliate` đi từ nút, `affiliate_details` từ chip; mọi chip của kịch bản có sẵn đều hợp lệ; câu trả lời có 3 dòng bước ở cả 6 ngôn ngữ |
| Ảnh chụp | thủ công, 380px | KO khớp chữ thiết kế SCR-IVY-14: IVY Beauty 제휴 파트너가 되어주세요! 💼 · 신청서 제출 · 심사 (1–3 영업일) · 활동 시작 & 수익 (10% 적립) · 지금 신청하기 · 더 알아보기 · 처음으로 · 종료 → 상담 만족도를 선택해주세요 (불만족 · 보통 · 만족 · 매우 만족 · 건너뛰기) → 소중한 의견 감사합니다 → 상담이 종료되었습니다. EN tương ứng; Apply now: form điền sẵn |

## T13 · Settings / Privacy (`13-settings.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-13-01 | Consent (API thật) | "Chat & AI consent", "Consent given", "Notice version", nút Withdraw consent | SCR-IVY-15 |
| TC-13-02 | Rút consent (API thật) | Withdraw → xác nhận → có "Give consent again"/Accept | BR-18 |
| TC-13-03 | Khách đã nhận diện | Marketing messages + toggle, CCPA, Download my data (JSON), Delete my data | SCR-IVY-15 |
| TC-13-04 | Khách vãng lai (API thật) | có khối consent, **không** có Download my data | SCR-IVY-15 |
| TC-13-05 | Nút rút consent | "Withdraw consent" viền cùng màu đỏ với chữ (không còn viền xám); "…stops immediately."; thanh đầu vẫn "Hi, Kiho", ⚙ có `aria-pressed=true` | SCR-IVY-15 (`1004:1367`) |
| TC-13-06 | Toggle | `switch` có tên "Do not send me marketing messages" và "CCPA: …", `aria-checked`, 44×24; bấm → `PUT /notifications/marketing-opt-out {opt_out: true}` → "Preference saved." | SCR-IVY-15, a11y |

**Kết quả (2026-11-13):** 6/6, lặp ×3: 18/18. `@T01|@T13|@T15`: 27/27. Toàn bộ desktop: **110 / 110** xanh. Ảnh chụp EN khớp `1004:1367` (ảnh chủ dự án gửi): thanh đầu trắng + đường kẻ, Back 14px, tiêu đề 16px, nút viền đỏ, toggle 44×24, không icon trước CCPA.

## T14 · i18n (`14-i18n.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-14-01 ×6 | en/es/ko/vi/ja/zh | nhãn tab đúng locale; panel không lộ key thô (`notifications.filters.x`…) | BR-19 |
| TC-14-02 | Copy KO | chip 주문 · 배송 · 프로모 · 리뷰; "오늘 받은 알림"; 선택 → "선택 알림 삭제", "전체 알림 삭제" | G-22 |
| TC-14-03 | Giữ ngôn ngữ (API thật) | chọn 한국어 → reload → tab "채팅" | SCR-IVY-02 |

## T15 · Responsive & a11y (`15-responsive-a11y.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-15-01 | Mobile (Pixel 7) | panel rộng ≥ 95% viewport, sát mép trái | NFR-03 |
| TC-15-02 | Console sạch | đi qua mọi tab/chip/settings → 0 lỗi console | NFR-04 |
| TC-15-03 | Bàn phím | Tab → focus nằm trong panel; Esc → đóng | NFR-02 |
| TC-15-04 | ARIA | tab `aria-selected`; chip `aria-pressed` đổi theo lựa chọn | NFR-02, G-23 |

## T16 · Production smoke (`16-prod-smoke.spec.ts`, chỉ `E2E_TARGET=prod`, chỉ đọc)

| TC | Mô tả | Kỳ vọng |
|---|---|---|
| TC-16-01 | Health | `https://talk.ivyusa.com/api/v1/health` 200, ok |
| TC-16-02 | Tài nguyên widget | `/widget/` 200; `/widget/embed.js` 200, content-type javascript |
| TC-16-03 | Mở widget | launcher → dialog "Support widget" |
