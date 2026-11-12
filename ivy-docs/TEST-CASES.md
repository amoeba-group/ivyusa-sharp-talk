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
npm run test:ci                        # cổng CI: @smoke + các task đã xong (hiện @T00|@T01|@T02|@T03|@T07|@T13)
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
| T04 | 0 / 5 → 3 / 5 (nhờ T02: chạm dòng mở Order Detail) | TC-04-01, TC-04-02, TC-04-05 | TC-04-03, TC-04-04 |
| T05 | 0 / 4 | — | TC-05-01, TC-05-02, TC-05-03, TC-05-04 |
| T06 | 0 / 3 | — | TC-06-01, TC-06-02, TC-06-03 |
| T07 | 1 / 3 → **7 / 7** ✅ (T07, 2026-11-12; thêm TC-07-04..07) | tất cả | — |
| T08 | 1 / 5 | TC-08-05 | TC-08-01, TC-08-02, TC-08-03, TC-08-04 |
| T09 | 1 / 4 | TC-09-01 | TC-09-02, TC-09-03, TC-09-04 |
| T10 | 1 / 5 | TC-10-05 | TC-10-01, TC-10-02, TC-10-03, TC-10-04 |
| T11 | 0 / 4 | — | TC-11-01, TC-11-02, TC-11-03, TC-11-04 |
| T12 | 0 / 4 | — | TC-12-01, TC-12-02, TC-12-03, TC-12-04 |
| T13 | 4 / 4 | TC-13-01, TC-13-02, TC-13-04, TC-13-03 | — |
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
| TC-04-03 | Thông tin & địa chỉ | Information (Hyein Kim, email) · Billing address · Shipping address (25 HARBOR PARK DR / PORT WASHINGTON New York 11050-4605 / United States / 123123123) | G-08 |
| TC-04-04 | Contact | chuyển sang tab Chat, có câu hỏi chứa số đơn 39891 | SCR-IVY-06 |
| TC-04-05 | Back | quay lại danh sách | SCR-IVY-06 |

## T05 · Promo (`05-promo.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-05-01 | Coupon vs sự kiện | `promo-item` `data-kind=coupon` / `event`; "Mad Shade" đậm (≥ 600) + "Buy one Get One 50% OFF today !" | G-09, SCR-IVY-07 |
| TC-05-02 | Màu icon | coupon: navy tối (B > R, tổng < 300); sự kiện: magenta (R > 180, G < 120, B > 60) | §4 |
| TC-05-03 | Mã coupon | `coupon-code` = SCHOOL20; "Copy" → clipboard = SCHOOL20 | G-09, Q-16 |
| TC-05-04 | Link sự kiện | bấm "Mad Shade" → tab mới `ivyusa.com/collections/mad-shade` | G-09 |

## T06 · Review (`06-review.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-06-01 | Dòng review | IVY-39875; pill Review; "Rose Hip Facial Oil 30ml · $55.00"; nút/link "Write Review" | SCR-IVY-08 |
| TC-06-02 | Write Review | mở trang sản phẩm ivyusa.com **hoặc** form trong widget (có nút Submit) | BR-10, Q-06 |
| TC-06-03 | Lỗi lưu | `POST /reviews` 500 → hiện `role=alert` "could not / failed / try again" | BUG-009 |

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
| TC-08-02 | 7 quick-reply | `quick-replies` có đúng 7 nút theo thứ tự, mỗi nút có emoji + nhãn (💰 Payment check … 🤝 Contact Support) | G-12, BR-11 |
| TC-08-03 | Kiểu chip | nền `rgb(255,255,255)`, viền ≥ 1px, ≥ 3 chip trên 1 hàng (wrap, không lưới 2 cột) | G-12, §4 |
| TC-08-04 | Composer | placeholder "Ask Anything"; Send disabled khi rỗng, enabled khi có chữ | G-13 |
| TC-08-05 | Hỏi–đáp thật | gửi câu hỏi → `POST /chat/message` < 300 → bubble khách + câu trả lời bot hiện | BR-16 |

## T09 · My Orders (`09-my-orders.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-09-01 | Danh sách đơn | "…recent orders…" + thẻ IVY-39891 | SCR-IVY-11 |
| TC-09-02 | Chip tiếp theo | Track delivery · Cancel order · Start over | G-15, BR-12 |
| TC-09-03 | Thẻ bấm được | bấm thẻ → "Order Detail" | G-15 |
| TC-09-04 | Start over | quay về menu quick-reply (có "Payment check") | BR-12 |

## T10 · Product Help (`10-product-help.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-10-01 | Menu con | Usage/How to use · Ingredients · Exchange / Return · Restock alert · Start over | SCR-IVY-12 |
| TC-10-02 | Danh mục | 11 chip: Hair … K-Beauty | G-16, BR-17 |
| TC-10-03 | Sản phẩm phổ biến | Nails → "Popular products" → "Gel Polish Starter Set"; có gọi `/products` hoặc `/products/recommendations` | G-16 |
| TC-10-04 | Chính sách đổi trả | Exchange / Return → câu chứa "7 days" + "unopened" | SCR-IVY-12 |
| TC-10-05 | Đang gõ (API thật) | trong lúc chờ trả lời thấy "Writing a reply…" | BR-16 |

## T11 · Contact (`11-contact.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-11-01 | Kênh email | help@ivy.com, "24h", "1 business day"; **không** có 1588-0000 | G-17, BUG-010 |
| TC-11-02 | Form | "Email inquiry" → `contact-form` có Name, Email (= hykim4@ivyent.com), Message | G-18, BR-14 |
| TC-11-03 | Validate | email sai → báo lỗi; không gửi `POST /inquiries` | BR-14 |
| TC-11-04 | Gửi | `POST /inquiries {name, email, message}` → "YOUR INQUIRY" + "Your message has been sent successfully." | G-18 |

## T12 · Affiliate & CSAT (`12-affiliate-csat.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-12-01 | 3 bước + 4 chip | "Submit application", "1–3 business days", "10%"; Apply now · Learn more · Start over · End | G-19 |
| TC-12-02 | CSAT 4 mức | End → `csat-card` có đúng 5 nút: Dissatisfied · Neutral · Satisfied · Very satisfied · Skip | G-20, Q-12 |
| TC-12-03 | Gửi đánh giá | Very satisfied → `POST /chat/csat` rating 5 → "Thank you for your feedback" **rồi** "chat has ended" (nằm dưới) | BR-13, G-20 |
| TC-12-04 | Bỏ qua | Skip → "chat has ended", không gọi `/chat/csat` | BR-13 |

## T13 · Settings / Privacy (`13-settings.spec.ts`)

| TC | Mô tả | Kỳ vọng | Nguồn |
|---|---|---|---|
| TC-13-01 | Consent (API thật) | "Chat & AI consent", "Consent given", "Notice version", nút Withdraw consent | SCR-IVY-15 |
| TC-13-02 | Rút consent (API thật) | Withdraw → xác nhận → có "Give consent again"/Accept | BR-18 |
| TC-13-03 | Khách đã nhận diện | Marketing messages + toggle, CCPA, Download my data (JSON), Delete my data | SCR-IVY-15 |
| TC-13-04 | Khách vãng lai (API thật) | có khối consent, **không** có Download my data | SCR-IVY-15 |

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
