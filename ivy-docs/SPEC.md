# IVY USA · TalkTalk Widget — SPEC

> Tài liệu nguồn (source of truth) cho đợt redesign widget chat trên storefront **ivyusa.com** (Shopify) theo Figma "TalkTalk".
> Đọc cùng: [TASKS.md](TASKS.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [TEST-CASES.md](TEST-CASES.md) · [BUGS.md](BUGS.md).
> Quy ước chung của repo (DTO, i18n, moderation, RBAC, quy trình REQ→PLN→RPT) vẫn theo [/CLAUDE.md](../CLAUDE.md) và [/SPEC.md](../SPEC.md). Tài liệu này **không thay thế** chúng, chỉ đặc tả phần widget IVY.

| Mục | Giá trị |
|---|---|
| Phiên bản | v0.1 (2026-11-09) — bản phân tích đầu tiên |
| Nhánh | `deploy/talk-ivyusa` (không làm trên `main`) |
| Domain | https://talk.ivyusa.com (production IVY USA) |
| Figma | file `fviVlvtkuHYU0Agre1daTr` "TalkTalk-Hau-Copy" |
| Trang thiết kế chính | `23:2` "2.Design (F) _ Front & Backend (LISA&AMB)" — bản mới nhất, dùng để implement |
| Trang logic | `0:1` "1.Levising Logic & Design (IVY)" — ghi chú nghiệp vụ (tiếng Hàn) + bản nháp Admin Dashboard |
| Tenant | `ivyusa` |

> ⚠️ **Giới hạn khi phân tích:** Figma MCP đang ở gói Starter, đã chạm giới hạn lượt gọi giữa chừng. Đã đọc **100% metadata + text** của cả 2 trang; screenshot lấy được 17 màn hình chính. Chưa lấy được `get_variable_defs` / `get_design_context` → **màu/khoảng cách ở §4 là đo từ ảnh, cần xác nhận lại** khi quota reset (task T00-b).

---

## 1. Mục tiêu & phạm vi

**Mục tiêu:** đưa widget khách hàng (`apps/widget`) về đúng thiết kế TalkTalk: bố cục **2 tab (Notifications · Chat)** có badge, trung tâm thông báo theo **4 nhóm Order / Delivery / Promo / Review**, thẻ theo dõi giao hàng 4 bước, màn chi tiết đơn, chat với quick-reply có emoji, các kịch bản (My Orders, Product Help, Contact Support, Affiliate), form liên hệ, đánh giá CSAT và màn Settings/Privacy.

| Trong phạm vi | Ngoài phạm vi (đợt này) |
|---|---|
| UI widget `apps/widget` (mọi màn ở §6) | Admin Dashboard trên trang `0:1` (bản nháp, chưa chốt) |
| API cần bổ sung cho widget (xoá thông báo, chi tiết đơn, promo…) | Thay đổi theme Shopify ivyusa.com |
| i18n đủ 6 ngôn ngữ cho copy mới | App mobile React Native (`apps/mobile`) |
| E2E Playwright cho mọi màn | Thay đổi nhà cung cấp AI / moderation |

---

## 2. Môi trường

| Môi trường | URL | Ghi chú |
|---|---|---|
| Local — widget (storefront demo + launcher) | http://localhost:5174 | cần `apps/widget/.env` (copy từ `.env.example`) — xem BUG-001 |
| Local — API + Swagger | http://localhost:3000/api/v1 · `/api/v1/docs` | `npm run dev` |
| Local — console quản trị | http://localhost:5173/ivyusa · `/admin/login` | seed: `dev@amoeba.group` / `amb2026!@` |
| Local — PWA | http://localhost:5175/app/ | |
| Production | https://talk.ivyusa.com · widget `/widget/` · API `/api/v1` | EC2 `talkaibotprd01` sau AWS ELB |

**Quy trình đưa lên talk.ivyusa.com:** `git push origin deploy/talk-ivyusa` **chưa phải deploy**. Repo không có workflow deploy tự động (CI chỉ chạy trên `main`/`production`). Bước deploy chạy thủ công trên server: `git pull` → `bash scripts/deploy-self-hosted.sh` (xem [RPT-261030](../docs/implementation/RPT-261030-Console-UX-Refresh.md) §3). Chi tiết ở [ARCHITECTURE.md §6](ARCHITECTURE.md).

> ⚠️ Ngày 2026-11-09, mọi đường dẫn của talk.ivyusa.com đều trả **403 từ AWS ELB** (`Server: awselb/2.0`) khi gọi từ máy dev này, nhiều khả năng do allowlist IP/WAF → test `E2E_TARGET=prod` chỉ chạy được từ mạng đã được cho phép (BUG-004).

---

## 3. Người dùng & trạng thái nhận diện

| Loại | Nhận diện | Hiển thị theo thiết kế |
|---|---|---|
| Khách đã đăng nhập Shopify | Shopify App Proxy (chữ ký được verify ở API) | Header "Hi, {firstName}"; thấy Notifications, đơn hàng, promo cá nhân |
| Khách vãng lai (guest) | Không có | Thiết kế **không vẽ** trạng thái guest → giữ cơ chế hiện có (Verify your identity / Guest order lookup) và hỏi lại (Q-01) |

Mọi thiết kế đều giả định khách đã đăng nhập (tên mẫu: Kiho, Lisa, Joo, Seungeob, Andrew).

---

## 4. Design tokens (đo từ screenshot — cần xác nhận, xem cảnh báo đầu trang)

| Token | Giá trị | Ghi chú |
|---|---|---|
| Panel | rộng **380px**, cao tối đa ~738px, bo góc ~16px, nền trắng, đổ bóng mềm | Order Detail cao 830px (cuộn) |
| Header | cao 48px, "Hi, {name}" đậm ~18px; phải: 🌐 + mã ngôn ngữ, ⚙, ✕ | Màn Settings dùng biến thể header **xanh** (#2563EB, chữ trắng) |
| Tab | 2 tab chia đều, cao 48px; active: chữ đen đậm + gạch dưới 2px đen; inactive: xám | |
| Badge | hình tròn đỏ/hồng (~#F43F5E), số trắng | trên cả 2 tab |
| Filter chip | cao 32px, bo tròn; active: nền đen chữ trắng; inactive: nền xám nhạt (~#F3F4F6) | |
| Nhóm ngày | dải nền xám nhạt (~#F7F8FA), chữ xám 12–13px | "Today's" / "Yesterday's" |
| Status pill | Confirmed **xanh lá** (~#22C55E) · Delivered **xám** (~#9CA3AF) · In Transit **cam** (~#F97316) · Review **tím** (~#A855F7) | chữ trắng, bo 4px |
| Stepper | vòng tròn 40px; bước đã qua: xanh dương (~#2F80ED) + icon trắng; chưa tới: xám; đường nối xanh/xám | |
| Thông điệp giao hàng | In Transit: cam "Your order is on the way!" · Delivered: đen "Your order is Delivered !" | |
| Nút phụ | "Track Order": viền xám, full-width, bo 8px | |
| Nút xoá | "Delete Selected": nền xanh dương · "Delete All": viền xanh dương | |
| Bubble bot | nền xám nhạt (~#F3F4F6), bo 12px | |
| Bubble khách | nền xanh dương (~#2F80ED), chữ trắng | |
| Quick-reply chip | nền trắng, viền xám 1px, bo tròn, có emoji đầu | chip đang chọn: viền xanh |
| Composer | input bo tròn "Ask Anything" + nút gửi tròn xanh 40px | form liên hệ: "Type your message" + nút gửi xám |
| Icon promo | coupon: nền **Deep Navy #1A2E6B** (gift) · event: **Bright Magenta #E91E8C** / hồng (sparkle) | bộ 8 icon coupon ở node `993:1254`, dùng 32–40px |
| Font | sans-serif dạng Inter; fallback tiếng Hàn | |

> Bán kính phải đi qua radius token của widget (CI chạy `npm run radius:check`, xem FIX-260917). Không hard-code `rounded-*` cố định.

---

## 5. Kiến trúc thông tin

```
Launcher (góc phải dưới) ─► Panel 380px
 ├─ Header: "Hi, {name}" · 🌐 EN ▾ · ⚙ Settings · ✕ Close
 ├─ Tab [Notifications ●4]
 │   ├─ Chip: Order | Delivery | Promo | Review
 │   ├─ Order    → danh sách nhóm Today/Yesterday/… → chạm → Order Detail
 │   ├─ Delivery → thẻ theo dõi (stepper 4 bước) → Track Order
 │   ├─ Promo    → coupon / sự kiện
 │   ├─ Review   → yêu cầu đánh giá → Write Review
 │   └─ Chế độ chọn → ☑ … → Delete Selected / Delete All
 ├─ Tab [Chat ●1]
 │   ├─ Lời chào + 7 quick-reply có emoji
 │   ├─ Kịch bản: My Orders · Product Help · Contact Support · Affiliate · …
 │   ├─ Câu hỏi tự do → AI trả lời ("답변을 작성중입니다..." khi đang gõ)
 │   └─ Kết thúc → CSAT (4 mức) → "상담이 종료되었습니다"
 └─ ⚙ Settings: Chat & AI consent · Marketing messages · Privacy & your data
```

---

## 6. Đặc tả màn hình (SCR-IVY-xx)

> Cột "Figma" là node id trên trang `23:2` (dùng `get_screenshot`/`get_design_context` với fileKey ở đầu trang). Bộ **Master Shots** (`992:189`) là bản chốt cuối cùng; các frame khác là biến thể/ngôn ngữ.

### SCR-IVY-01 · Launcher & Panel
- **Figma:** mockup desktop `1006:2431`, `1006:2455`, `1006:4258`, `1006:5260`, `1006:5374`, `1006:5398`, `1008:2755` (1903×901 trên nền ivyusa.com); mobile `1282:17` (iPhone 15 Pro).
- Launcher tròn góc phải dưới; bấm → panel 380px nổi phía trên launcher; trên mobile ≤ 480px → panel toàn màn hình.
- ✕ đóng panel; `Esc` cũng đóng; mở lại giữ tab/vị trí cuộn cuối cùng.

### SCR-IVY-02 · Header & ngôn ngữ
- **Figma:** `1006:7825` (header), menu ngôn ngữ `1008:3231`, `1004:1100`.
- "Hi, {firstName}" — tên lấy từ khách Shopify đã nhận diện.
- 🌐 + mã ngôn ngữ hiện tại (EN/KO/…); menu: English · Español · 한국어 · Tiếng Việt · 日本語 · 简体中文; đổi ngôn ngữ áp dụng ngay cho toàn panel (kể cả nội dung bot ở phiên mới).
- ⚙ mở Settings (SCR-IVY-15).

### SCR-IVY-03 · Tab & badge
- **Figma:** Master `992:526`.
- 2 tab **Notifications** và **Chat** (hiện tại code có thêm tab **Orders** → gộp vào chip Order/Delivery, xem gap §10).
- Badge đỏ = số chưa đọc (Notifications: thông báo chưa đọc; Chat: tin nhắn chưa đọc). 0 thì ẩn badge.

### SCR-IVY-04 · Notifications — Order
- **Figma:** Master `992:526` (KR, có chế độ chọn), `1006:7825` (EN), `1006:2930`, `1006:6868` ("Payment").
- Nhóm theo ngày: **Today's** / **Yesterday's** / cũ hơn.
- Dòng thông báo: icon hộp (tròn 40px) · mã đơn `IVY-39891` · pill trạng thái · tóm tắt "Hydrating Face Mask (10pcs) + 2 items" · thời gian "Just now"/"10mins ago".
- Chưa đọc: nền dòng tô nhạt (cam nhạt) + chấm đỏ bên phải.
- Chạm 1 dòng → mở **Order Detail** (SCR-IVY-06) và đánh dấu đã đọc.

### SCR-IVY-05 · Notifications — Delivery
- **Figma:** Master `992:935`, `1007:1069` (EN), `1006:4374` / `1154:379` (KO).
- Mỗi đơn 1 thẻ: mã đơn đậm + pill (In Transit cam / Delivered xám) · tên sản phẩm · **stepper 4 bước** `Preparing → Processing → In Transit → Delivered` (KO: 발송준비 · 배송시작 · 배송중 · 배송완료, theo BR-06; trước đây mục này ghi "배송준비", lệch với BR-06) · thông điệp trạng thái · nút **Track Order** (KO: 배송조회).
- Track Order → mở trang tracking của hãng vận chuyển (tab mới) — cần URL tracking từ fulfillment (Q-05).

### SCR-IVY-06 · Order Detail
- **Figma:** `1154:116`, `1007:250`, `1008:3254` (EN), `1006:4282` (KO "주문 상세").
- Header: ← Back · "Order Detail".
- Mã đơn + icon xe tải (chấm cam = đang giao) · danh sách dòng hàng: ảnh, tên (tối đa 2 dòng), biến thể "Burgundy / 6-8", giá.
- **Discount** (đỏ, "-$4.99") · Subtotal · N items · Shipping (Free) · **Total "USD $55.00"**.
- **Information** (tên, email dạng link) · **Billing address** ("-" nếu trống) · **Shipping address** (tên, địa chỉ, thành phố/bang/ZIP, quốc gia, điện thoại).
- Dòng **Contact** (KO: 문의하기) ở cuối → mở Chat với ngữ cảnh đơn này.
- **Đã làm (T04, 2026-11-12):** đối chiếu ảnh Figma `1008:3254` (EN) và `1006:4282` (KO).
  - Nhãn EN "Information"; bản KO ghi "Contact information" → KO 연락처 정보.
  - ZIP ở một dòng riêng.
  - Địa chỉ đọc trực tiếp từ Shopify (`GET /orders/:id/addresses`), không lưu. App chưa có quyền PCD Address/Phone thì khối địa chỉ ẩn.
  - Giữ pill trạng thái thay icon xe tải (PLN-261112 D5).

### SCR-IVY-07 · Notifications — Promo
- **Figma:** `1006:5284` (EN), `1007:1978` (KO), `993:1618`; bộ icon coupon `993:1254`.
- 2 loại: **coupon cá nhân** (icon gift nền navy; vd. "Your exclusive 10% off coupon has arrived!") và **sự kiện** (icon sparkle nền magenta; tiêu đề đậm "Mad Shade" + mô tả "Buy one Get One 50% OFF today !", "BACK TO SCHOOL · CODE:SCHOOL20", "Beauty Pro & Student · Exclusive Saving 20% OFF").
- Sự kiện có thể nhắm theo tag (subscription / IVY member / Beautizen / Round) và có icon khác nhau theo tag (ghi chú trang `0:1`).
- **Đã làm (T05, 2026-11-12):**
  - Loại (Event / Coupon) và mã coupon nhập ở console → Campaigns, khoá sau khi gửi.
  - Thông báo trỏ về campaign (`ref_type 'campaign'`).
  - Thẻ coupon có ô mã + Copy code; thẻ có link `https` mở tab mới.
  - Chưa làm: icon theo tag và coupon riêng từng khách.

### SCR-IVY-08 · Notifications — Review
- **Figma:** Master `992:192`, `1008:2191` (EN), `1006:5936`.
- Mã đơn + pill tím **Review** · "Rose Hip Facial Oil 30ml · $55.00" · ⭐ **Write Review** (chữ cam) · thời gian.
- Chỉ sinh cho đơn đã **Delivered**.
- **Đã làm (T06, 2026-11-12):**
  - Pill `StatusPill` Review; "Write Review" chữ cam đậm `#C94F00` cho đủ tương phản (BUG-021); thời gian BR-05.
  - Lưu review lỗi có toast (BUG-009).
  - Mở review: có link sản phẩm → trang ivyusa.com, không có → form trong widget (Q-06 giữ nguyên).

### SCR-IVY-09 · Chế độ chọn & xoá thông báo
- **Figma:** Master `992:526`, `1006:2814` (EN), `1006:2698` (KO).
- Mỗi dòng có nút tròn ✓ (xám = chưa chọn, xanh = đã chọn) · đáy panel: **Delete Selected Notifications** (KO 선택 알림 삭제) + **Delete All Notifications** (KO 전체 알림 삭제).
- Cách vào chế độ chọn **chưa được vẽ** (Q-03). Ghi chú trang `0:1` gợi ý thêm vuốt trái để xoá trên mobile.
- Xoá phải có phản hồi thành công/lỗi (quy tắc UX của repo — toast).
- **Đã làm (T07, 2026-11-12):** "Delete All" xác nhận ngay trong panel (Cancel / Delete, focus ở Cancel, Esc chỉ đóng hộp xác nhận) và chỉ xoá **chip đang xem**. Toast: thành công tự tắt ~3 giây, lỗi đóng tay và giữ nguyên các dòng đã tick. Vuốt trái để xoá: chưa làm, để T15.

### SCR-IVY-10 · Chat — màn đầu
- **Figma:** `1008:2291` (KO), `993:1993` (EN).
- Bubble chào: "안녕하세요! IVY Beauty입니다. 무엇을 도와드릴까요?" (EN cần dịch — Q-07).
- 7 quick-reply dạng chip trắng có emoji, xếp tự do (wrap): 💰 결제 확인 · 🚚 배송 문의 · 📦 재고 문의 · 😊 교환 및 환불 · ✨ 제품문의 · 💬 피드백 · 🤝 Contact Support.
- Composer: "Ask Anything" + nút gửi tròn xanh.
- **Đã làm (T08, 2026-11-12):** đối chiếu ảnh thiết kế chủ dự án gửi (KO).
  - Emoji cho nút (`ScenarioButton.emoji`); kiểu "card" = chip trắng.
  - Placeholder là cấu hình tenant (`widgetCopy.composerPlaceholder`).
  - Lời chào và 7 nút là cấu hình tenant: seed cho DB mới; production nhập theo GUIDE-261112-IVY-Chat-Home-Config.
  - **T12 (2026-11-13):** thêm nút thứ 8 "💼 Affiliate" ở cuối (chủ dự án chọn PLN-261113 §8-3a), vì thiết kế có kịch bản SCR-IVY-14 nhưng không vẽ lối vào.
  - Giữ nút đính kèm (Q-14) và dòng công bố AI dưới ô nhập (Q-13).

### SCR-IVY-11 · Kịch bản My Orders
- **Figma:** `1006:5530`.
- Bot: "주문 내역을 조회해드릴게요! 최근 주문입니다 👇" → thẻ đơn gần đây (mã, pill, tóm tắt) → "더 도움이 필요하신가요?" → chip **배송 조회 · 주문 취소 · 처음으로**.
- **Đã làm (T09, 2026-11-12):** đối chiếu ảnh chủ dự án gửi.
  - Có bong bóng khách "My Orders".
  - Thẻ bấm được → Order Detail đè lên chat.
  - 배송 조회 → tab Notifications, chip Delivery.
  - 주문 취소 → kịch bản `cancel_order`.
  - 처음으로 → menu hiện lại ở cuối cuộc chat.
  - Tóm tắt giữ "+ 2 items" theo BR-08 (thiết kế ghi "+ 2 Others").

### SCR-IVY-12 · Kịch bản Product Help
- **Figma:** `1006:5588` (menu con), `993:2207` / `993:2416` (danh mục), `1008:2613` (đang gõ), `1008:2722` (AI trả lời).
- Menu con: **제품 사용법 · 성분 문의 · 교환 / 반품 · 재입고 알림 · 처음으로**; chọn 교환/반품 → "교환·반품은 수령 후 7일 이내 신청 가능합니다. 제품은 미개봉 상태여야 합니다." + chip 배송 조회 · 주문 취소.
- Nhánh danh mục: "어떤 도움이 필요하신가요? 원하시는 항목을 선택해주세요 😊" → chip **Hair · Makeup · Nails · Face & Body · Lashes · For Men · Fragrance · Fashion · For Kids · Wellness · K-Beauty** → (vd. Nail) "어떤 안내를 도와드릴까요?" → **인기상품** + 2 chip "??" (chưa chốt — Q-04).
- Câu hỏi tự do (vd. "제일 인기 많은 상품 추천해줘") → chỉ báo "답변을 작성중입니다..." → câu trả lời AI (dựa KB, đúng ngôn ngữ phiên, qua moderation).
- **Đã làm (T10, 2026-11-12):** theo `1006:5588`, có thêm nhánh danh mục.
  - Chip: 인기상품 · 제품 사용법 · 성분 문의 · 교환 / 반품 · 재입고 알림 · 처음으로, trả lời trong luồng chat. Hàng chip vẫn hiện, chip đã chọn viền xanh.
  - 인기상품 → 11 danh mục (collection ivyusa.com, cấu hình tenant) → 5 sản phẩm bán chạy từ Shopify.
  - 교환 / 반품 → câu chính sách **10 ngày** theo ivyusa.com, chip 배송 조회 · 주문 취소 · 처음으로. Thiết kế ghi 7 ngày, khác trang chính sách.
  - 재입고 알림 → câu hỏi cho AI (chưa có báo hàng về thật, G-25).
  - Q-04: 2 chip "??" bỏ.

### SCR-IVY-13 · Contact Support & form liên hệ
- **Figma:** `1006:5650` (kênh), `1006:6529` (form), `1006:6597` (đã gửi).
- Bot: "고객센터 연결 방법을 선택해주세요." → thẻ **📧 이메일 문의 · 24시간 접수 · 1영업일 내 회신 · help@ivy.com** → chip 처음으로.
- Form: bubble "Please enter your contact information and tell us how we can help." (nhãn "IVY Beauty, just now") → thẻ form **NAME** (Enter your name) · **EMAIL** (điền sẵn email khách) · **MESSAGE** (Please describe how we can help you) · nút **Send Message** (nền đen).
- Gửi xong: thẻ tối "YOUR INQUIRY · Name · Email · Message" (phía khách) + bubble "Your message has been sent successfully. / Our support team will review your inquiry and reply to the email address you provided. / Please check your inbox for our response."
- Composer chuyển thành "Type your message" (nút gửi xám khi trống). **T11 D6:** giữ placeholder của tenant ("Ask Anything").
- **Đã làm (T11):** email trên thẻ là cấu hình tenant (IVY: hello@ivyusa.com — Q-08). Tên được điền sẵn cùng email khi khách đã đăng nhập. Thẻ "YOUR INQUIRY" và bong bóng xác nhận gắn tại vị trí form.

### SCR-IVY-14 · Kịch bản Affiliate + CSAT
- **Figma:** `1006:5990`, `1006:6050`, `1006:6110` (CSAT), `1006:6200`, `1006:6290` (kết thúc).
- User chọn "How to become an Affiliate?" → "IVY Beauty 제휴 파트너가 되어주세요! 💼" → 3 thẻ bước: **신청서 제출** (간단한 양식을 작성해주세요.) · **심사 (1–3 영업일)** (팀에서 검토 후 이메일로 안내드려요.) · **활동 시작 & 수익** (전용 링크 공유 → 판매 시 10% 적립!) → "궁금한 점이 있으시면 언제든 물어봐주세요!" → chip **지금 신청하기 · 더 알아보기 · 처음으로 · 종료**.
- **종료** → "오늘 상담이 도움이 되셨으면 좋겠습니다 상담은 어떠셨나요?" → thẻ CSAT "상담 만족도를 선택해주세요": 😞 불만족 · 😐 보통 · 😊 만족 · 😍 매우 만족 · **건너뛰기**.
- Chọn mức → "소중한 의견 감사합니다" → "상담이 종료되었습니다 / 이용해 주셔서 감사합니다!".
- **Đã làm (T12, 2026-11-13):** chủ dự án duyệt PLN-261113 (`1. ok 2. a 3. a 4. a`).
  - Affiliate là kịch bản trên server (`affiliate`); 3 dòng `1. **Tên** — mô tả` của câu trả lời vẽ thành 3 thẻ. Câu chữ IVY (IVY Beauty, 10%) là cấu hình tenant: seed cho DB mới, production theo GUIDE-261113-IVY-Affiliate-Config.
  - Apply now → form liên hệ T11 điền sẵn (vào Inquiries + mail). Learn more → kịch bản `affiliate_details`. End kết thúc ngay, không hỏi xác nhận.
  - Lối vào: nút thứ 8 "💼 Affiliate" cuối menu (thiết kế không vẽ lối vào).

### SCR-IVY-15 · Settings / Privacy
- **Figma:** `1004:1367` (EN), `1004:1447` (KO).
- ← Back · **Chat & AI consent** (🛡): "Consent given — On {date} · Notice version {ver}" · nút đỏ viền **Withdraw consent** · "If you withdraw, chat and AI processing stops immediately."
- **Marketing messages:** toggle "Do not send me marketing messages" · "Order and delivery updates are sent regardless — this covers promotions, coupons and review requests."
- **Privacy & your data:** toggle "CCPA: Do not sell or share my personal information" · "Turns off email, SMS and web-push messaging for your account. In-app notices stay on." · ⬇ **Download my data (JSON)** · 🗑 **Delete my data**.
- **Đã làm (T13, 2026-11-13):** đối chiếu ảnh EN chủ dự án gửi. Thanh đầu: lúc đầu giữ "Hi, Kiho" như ảnh; **sau đó làm 2a theo chủ dự án** — thanh màu brand "← Settings" chữ trắng + ✕ (sắc 700 của brand, chữ trắng 5,0:1, đạt AA); ẩn lời chào, 🌐 và ⚙; ← và Esc quay về tab. "← Back" trong nội dung bỏ đi. Tiêu đề khối 16px, dòng 14px, ghi chú 12px, lề 24px. Nút rút consent viền đỏ. Toggle 44×24 (`switch` có tên). Không icon trước CCPA. Toggle marketing: bật = không nhận marketing qua email / SMS / push; thông báo trong app luôn hiện.

---

## 7. Quy tắc nghiệp vụ (BR)

| ID | Quy tắc | Nguồn |
|---|---|---|
| BR-01 | 4 nhóm thông báo: **Order** (thanh toán/xác nhận đơn) · **Delivery** (tiến trình giao theo từng bước) · **Promo** (coupon/sự kiện) · **Review** (yêu cầu đánh giá đơn đã giao). Biến thể cũ (전체/결제/구독/이벤트/리뷰/배송) **không dùng** — Master Shots chốt 4 nhóm. | Master `992:189`; ghi chú `0:1` `3:3` |
| BR-02 | Badge tab = số chưa đọc; 0 → ẩn. | `0:1` `3:2` "새로 도착한 알림 개수를 아이콘에 표시합니다." |
| BR-03 | Chưa đọc = nền tô + chấm đỏ; chạm mở → đã đọc. | `1006:7825` |
| BR-04 | Nhóm theo ngày: Today's / Yesterday's / cũ hơn, theo **múi giờ máy của khách** (chủ dự án chốt 2026-11-11). | Master |
| BR-05 | Thời gian: trong 1 giờ → "Just now" / "{n}mins ago"; hôm nay → "{n}h ago"; hôm qua → "Yesterday"; 2–6 ngày → "{n} days ago"; cũ hơn → ngày tháng "Nov 3" (Q-02, chốt 2026-11-11). Ngày tính theo lịch của **máy khách**, không cố định America/New_York (ghi chú hỏi EST/EDT; chủ dự án chọn giờ máy khách ngày 2026-11-11). | `0:1` `21:26` |
| BR-06 | Mapping trạng thái giao hàng: 발송 준비 = **Preparing** · 배송 시작 = **Processing** (ghi chú gọi "Shipped") · 배송중 = **In Transit** · 배송완료 = **Delivered**. Pill: Confirmed xanh lá, In Transit cam, Delivered xám, Review tím. | `0:1` `7:14`; Master |
| BR-07 | Chạm thông báo giao hàng → đi tới vị trí trạng thái giao của đơn đó. | `0:1` `3:37` "클릭 시, 배송현황 위치로 가도록" |
| BR-08 | Tóm tắt đơn: "{sản phẩm đầu} + {n} items" (EN) / "{sản phẩm đầu} 외 {n}개" (KO). Thiết kế còn lẫn "+ 2 Others", "and 2 more items" → chuẩn hoá theo Master ("+ 2 items"). | Master; `0:1` `7:140..143` |
| BR-09 | Xoá: chọn nhiều + "Delete Selected" / "Delete All"; có toast kết quả. Vuốt trái để xoá trên mobile = tuỳ chọn. | Master; `0:1` `21:22` |
| BR-10 | Thông báo Review chỉ sinh khi đơn **Delivered**; "Write Review" mở form/trang review sản phẩm (Q-06). | `0:1` `3:3` |
| BR-11 | Quick-reply ở Chat do tenant cấu hình (`/ai-config/scenario`), thứ tự & emoji theo §6 SCR-IVY-10. | `1008:2291` |
| BR-12 | Mọi kịch bản có chip **처음으로** (quay về đầu); "종료" kết thúc phiên → CSAT. | `1006:5530…6290` |
| BR-13 | CSAT 4 mức + Bỏ qua; gửi xong hiện cảm ơn và đóng phiên. | `1006:6110`, `1006:6290` |
| BR-14 | Form liên hệ: Name/Email/Message bắt buộc, email đúng định dạng, email khách điền sẵn; tạo inquiry phía API; trả lời qua email. | `1006:6529`, `1006:6597` |
| BR-15 | Email hỗ trợ hiển thị lấy theo cấu hình tenant (thiết kế ghi `help@ivy.com` — Q-08). | `1006:5650` |
| BR-16 | Trả lời AI theo ngôn ngữ phiên, có chỉ báo đang gõ, **bắt buộc qua `ModerationService.moderate()`**. | CLAUDE.md §2 |
| BR-17 | Danh mục Product Help bám theo collection của ivyusa.com (11 danh mục ở SCR-IVY-12). | `993:2207` |
| BR-18 | Rút consent → dừng chat & AI ngay; marketing opt-out không chặn thông báo đơn/giao hàng; CCPA opt-out tắt email/SMS/web-push nhưng giữ thông báo trong app. | `1004:1367` |
| BR-19 | Mọi chuỗi UI qua `t()`; đủ en/es/ko/vi/ja/zh; chạy `npm run i18n:check`. | CLAUDE.md §2 |

---

## 8. Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NFR-01 | Panel mở < 1s sau khi bấm launcher (local); không layout shift khi tải dữ liệu (skeleton). |
| NFR-02 | A11y: tab dùng `role="tab"` + `aria-selected`; badge có nhãn đọc được ("4 unread"); chip lọc có `aria-pressed`; panel là `role="dialog"`; `Esc` đóng; focus không thoát khỏi panel. |
| NFR-03 | Responsive: ≤ 480px → panel toàn màn hình; kiểm thử 390×844 (iPhone) và 1280×900. |
| NFR-04 | Không lỗi console khi mở panel và chuyển tab. |
| NFR-05 | Privacy: consent trước khi chat/AI; PII che trong log; tôn trọng CCPA/marketing opt-out. |
| NFR-06 | Theming: bán kính qua radius token (`npm run radius:check` xanh). |

---

## 9. Hợp đồng selector cho E2E

Test ưu tiên **role + accessible name** (tiếng Anh, locale `en`). Chỉ dùng `data-testid` cho phần tử cấu trúc không có role rõ ràng. Khi implement phải giữ đúng các tên/test-id dưới đây — đây là "hợp đồng" giữa code và [TEST-CASES.md](TEST-CASES.md).

Cột "Trạng thái": ✅ = đã có trong DOM hiện tại · ➕ = **phải thêm** khi làm task tương ứng.

| Phần tử | Selector | Trạng thái |
|---|---|---|
| Launcher | `getByRole('button', { name: 'Open support' })` | ✅ `Widget.tsx` |
| Panel | `getByRole('dialog', { name: 'Support widget' })` | ✅ `WidgetPanel.tsx` |
| Lời chào header | `.st-header-title` (text "Hi, {firstName}") | ✅ class / ➕ nội dung |
| Nút ngôn ngữ / Settings / Close | `getByRole('button', { name: 'Language' \| 'Settings' \| 'Close' })` | ✅ |
| Tab | `getByRole('tab', { name: /Notifications/ \| /Chat/ })` + `aria-selected` | ✅ `TopTabs.tsx` |
| Badge tab | `getByLabel('{n} unread')` bên trong tab | ✅ |
| Chip lọc | `getByRole('button', { name: 'Order' \| 'Delivery' \| 'Promo' \| 'Review', exact: true })` + `aria-pressed` | ✅ nhãn mới + `aria-pressed` (T02) |
| Nút vào chế độ chọn | `getByRole('button', { name: 'Select' })` | ✅ |
| Nhóm ngày | `[data-testid="notif-group"]` | ✅ (T02) |
| Dòng thông báo | `[data-testid="notif-item"]` + `data-id` + `data-unread="true\|false"` + `data-category` | ✅ (T02) |
| Thời gian dòng | `[data-testid="notif-time"]` (text theo BR-05) | ✅ (T02) |
| Pill trạng thái | `[data-testid="status-pill"]` + `data-status="confirmed\|in_transit\|delivered\|review"` (ngoài ra `pending_payment`, `cancel_requested`; chữ lạ → `other`) | ✅ (T02) — mới có trong feed thông báo; thẻ Delivery ✅ (T03, mã lấy từ bước tracking); Review ở T06 |
| Thẻ giao hàng | `[data-testid="delivery-card"]` (+`data-id`); bước `[data-testid="delivery-step"]` + `data-state="done\|current\|todo"` (đã giao: cả 4 `done`) | ✅ (T03) |
| Order Detail | `getByRole('heading', { name: 'Order Detail' })`; khối khách `[data-testid="order-customer"]` | ✅ (T04) |
| Chọn từng dòng | `getByRole('checkbox')` trong `notif-item`; tên theo dòng: `Select IVY-39891` | ✅ `role="checkbox"` + `aria-checked` (tên theo dòng: T07) |
| Nút xoá | `getByRole('button', { name: 'Delete Selected Notifications' \| 'Delete All Notifications' })` | ✅ (T07) |
| Xác nhận xoá tất cả | `getByRole('alertdialog')` (+`data-testid="delete-all-confirm"`), nút `Cancel` / `Delete` | ✅ (T07) |
| Toast | `getByRole('status')` (thành công) / `getByRole('alert')` (lỗi, có nút `Close`); `[data-testid="toast"]` + `data-tone="success\|error"` | ✅ (T07) — dùng chung, T05/T06 dùng lại |
| Thẻ promo | `[data-testid="promo-item"]` + `data-kind="coupon\|event"`; icon `[data-testid="promo-icon"]`; mã coupon `[data-testid="coupon-code"]` + nút "Copy code" | ✅ (T05) |
| Quick-reply | `[data-testid="quick-replies"]` › `getByRole('button', { name })` | ✅ (T08); class `.st-quick-reply` ✅ |
| Composer | `getByPlaceholder('Ask Anything')`, `getByRole('button', { name: 'Send' })` | ➕ placeholder (T08); Send ✅ |
| Chip quay về đầu | `getByRole('button', { name: 'Start over' })` | ➕ (T09) |
| Form liên hệ | `[data-testid="contact-form"]` › `getByLabel('Name' \| 'Email' \| 'Message')`, `getByRole('button', { name: 'Send Message' })` | ➕ (T11) |
| CSAT | `[data-testid="csat-card"]` › `getByRole('button', { name: 'Very satisfied' \| 'Satisfied' \| 'Neutral' \| 'Dissatisfied' \| 'Skip' })` | ➕ (T12) |
| Settings | `getByRole('button', { name: 'Withdraw consent' })`, `getByRole('switch' \| 'checkbox', { name: /marketing/i })` | ✅ phần lớn |

---

## 10. Gap analysis (thiết kế ↔ code hiện tại)

Khảo sát ngày 2026-11-09 trên commit `583ce121`. **Kết luận: phần lớn khung đã có.** Nhiều điểm chỉ cần đổi **cấu hình tenant** hoặc copy; phần thiếu thật nằm ở promo/coupon, địa chỉ trong Order Detail, form liên hệ, danh mục Product Help, các chip điều hướng (처음으로/종료) và vuốt để xoá.

Loại thay đổi: **CFG** = cấu hình tenant (console/DB, không sửa code) · **UI** = `apps/widget` · **I18N** = locale · **API/DB** = backend + migration SQL.

| # | Thiết kế | Code hiện tại (file) | Việc cần làm | Loại | Task |
|---|---|---|---|---|---|
| G-01 | 2 tab Notifications · Chat | Mặc định 3 tab Notifications · Orders · Chat (`packages/types/src/common/enum.types.ts` `WIDGET_TABS_DEFAULT`); 2 tab = cột `tenant.widget_tabs` | Đặt `widget_tabs = ["notifications","chat"]` cho tenant ivyusa (local + prod); khi chỉ còn 1 tab danh sách, chip của Orders tự gộp vào (`tab-chips.ts` `chipsFor`) | CFG | T01 |
| G-02 | "Hi, {firstName}" | "Hi, {{name}}" dùng `customerName` (có thể là họ tên đầy đủ); khi guest: tiêu đề tenant hoặc "Notification Center" (`WidgetPanel.tsx` 173-177) | Lấy **first name**; guest theo Q-01 | UI | T01 |
| G-03 | Panel 380px, bo ~16px | 404×600, bo `--ivy-radius` 12px; tenant chỉnh được rộng 360–480 (`widget-theme.ts` 226-229) | Đặt theme tenant: width 380, radius lg | CFG | T01 |
| G-04 | Chip **Order · Delivery · Promo · Review** | Gộp 1 tab: **All · Payment · Delivery · Event · Review** (+Inquiries nếu có workflow) (`tab-chips.ts`) | Đổi nhãn Payment→**Order**, Event→**Promo**; bỏ chip All (Q-10); thêm `aria-pressed` cho chip | UI · I18N | T02 |
| G-05 | Dòng: mã đơn + pill + "X + 2 items" + "Just now / 10mins ago" | Tiêu đề/nội dung tự do; pill = text server **chưa dịch**, màu đoán theo text (`Badge.tsx` 43-52); thời gian dạng `Intl` ("10 minutes ago") (`format.ts`) | Hiển thị có cấu trúc (mã đơn tách khỏi tóm tắt), pill map theo **mã trạng thái** + i18n, định dạng thời gian theo BR-05 | UI · I18N | T02 |
| G-06 | Chạm thông báo → mở Order Detail / vị trí giao hàng (BR-07) | Chỉ đánh dấu đã đọc, `linkUrl` không mở (`NotificationsTab.tsx`) | Điều hướng theo `refType/refId` | UI | T02 |
| G-07 | Stepper **Preparing → Processing → In Transit → Delivered**; "Your order is on the way!" / "Your order is Delivered !"; nút **Track Order** | **Preparing → Shipped → In transit → Delivered** (`packages/types/src/domain/status-map.ts` `DELIVERY_STEPS_BY_LANG`); "Your order is on its way — it will reach you soon!"; "Track shipment" (`ShipmentList.tsx`) | Đổi nhãn bước 2 + copy (lưu ý `status-map.ts` dùng chung với API/console) | I18N | T03 ✅ (2026-11-11; bước 2 ở ES/VI/JA/ZH dịch theo "Processing") |
| G-08 | Order Detail có **Billing/Shipping address + phone**, nhãn "Information" | Không có địa chỉ/điện thoại trong response (`widget.types.ts` `OrderDetailResponse`), nhãn "Contact information" | Thêm cột order (sync Shopify `shipping_address`, `billing_address`, `phone`) → mapper → UI. **Cần migration SQL** | API · UI | T04 ✅ (2026-11-12; đọc trực tiếp từ Shopify, không migration; hiện khi app có quyền PCD Address/Phone) |
| G-09 | Promo: coupon (gift navy) vs sự kiện (sparkle magenta), tiêu đề đậm + mô tả, mã coupon | Chỉ là notification `event` với icon gift/sparkle; không có mã/copy; link không bấm được; API không có khái niệm coupon | Thẻ promo theo thiết kế + bấm mở link; hiển thị mã coupon (lấy từ body/metadata) + nút copy | UI (+API tuỳ chọn) | T05 ✅ (2026-11-12; loại + mã lưu trong campaign, khoá sau khi gửi; chưa có coupon riêng từng khách) |
| G-10 | Review: "⭐ Write Review" | Đã có (`ReviewItemList.tsx`, `ReviewForm.tsx`) — copy "Write a review"; **lưu review lỗi bị nuốt** (BUG-009) | Chỉnh copy, thêm toast lỗi/thành công | UI · I18N | T06 ✅ (2026-11-12) |
| G-11 | Chọn nhiều + "Delete Selected Notifications" / "Delete All Notifications" | Đã có: nút "Select", "Delete selected (n)", "Delete all notifications" + `window.confirm` (`NotificationsTab.tsx` 324-333, 391-410) | Copy theo thiết kế; thay `window.confirm` bằng xác nhận trong panel; toast kết quả; (tuỳ chọn) vuốt trái để xoá | UI · I18N · API | T07 ✅ (2026-11-12; "Delete All" chỉ xoá chip đang xem; vuốt trái để xoá → T15) |
| G-12 | Chat home: chip trắng viền có **emoji**, xếp wrap; lời chào IVY | Lưới 2 cột pill xanh nhạt hoặc thẻ có icon; nút scenario không có trường emoji (`ScenarioMenu.tsx`, `/ai-config/scenario`) | Thêm trường `emoji` cho nút scenario + kiểu hiển thị "chip wrap"; cấu hình 7 nút + lời chào cho tenant | UI · API · CFG | T08 ✅ (2026-11-12; emoji + chip trắng; nút / lời chào là cấu hình tenant) |
| G-13 | Composer "Ask Anything", không thấy nút đính kèm | "Type a message…" + nút đính kèm (`ChatTab.tsx` 776-815) | Placeholder theo copy tenant; giữ/ẩn đính kèm theo Q-14 | UI · CFG | T08 ✅ (2026-11-12; placeholder là cấu hình tenant; giữ nút đính kèm) |
| G-14 | Không vẽ thanh công bố AI | Có thanh "This chat is AI-powered…" + banner consent (bắt buộc pháp lý) | **Giữ** (compliance), thu gọn cho gần thiết kế — Q-13 | UI | T08 ✅ (2026-11-12; `disclosurePlacement: bottom` = 1 dòng dưới ô nhập) |
| G-15 | My Orders: thẻ đơn bấm được + chip 배송 조회 · 주문 취소 · 처음으로 | Thẻ không bấm được; chip ẩn khi đang hiện thẻ (`ChatTab.tsx` 439-445); không có chip "처음으로" ở đâu cả | Thẻ mở Order Detail; luôn hiện follow-up chip; thêm chip **처음으로** (start over) dùng chung cho mọi kịch bản | UI · I18N | T09 ✅ (2026-11-12; Start over là chip widget tự thêm, dùng chung cho T10–T12) |
| G-16 | Product Help: 11 danh mục + 인기상품; menu con 사용법/성분/교환·반품/재입고 | Menu con có; **thiếu danh mục & sản phẩm phổ biến**; API sẵn có nhưng chưa dùng: `GET /products/categories`, `/products?category=`, `/products/recommendations` | Luồng danh mục → sản phẩm phổ biến; "재입고 알림" gọi `POST /restock/subscribe` | UI | T10 ✅ (2026-11-12; danh mục = collection cấu hình tenant, popular = Shopify best-selling; restock → G-25) |
| G-17 | Contact Support: chỉ thẻ email `help@ivy.com` | 3 thẻ (điện thoại 1588-0000, email, live chat) **hard-code trong locale** (`ContactCard.tsx`) | Lấy kênh liên hệ từ cấu hình tenant; IVY chỉ bật email (+ live chat nếu có agent — Q-15) | UI · API · CFG | T11 ✅ (2026-11-13; `widgetCopy.supportEmail` / `supportPhone` / `contactLiveChat`; IVY: hello@ivyusa.com, chỉ email) |
| G-18 | Form liên hệ Name/Email/Message → "Your message has been sent successfully." | **Không có.** `POST /inquiries` tồn tại nhưng không nhận name/email/message và widget không gọi | Mở rộng DTO/entity inquiry (+console xem được) + thẻ form + thẻ "YOUR INQUIRY". **Có thể cần migration SQL** | API · DB · UI | T11 ✅ (2026-11-13; `sql/261112-inquiry-contact-form.sql`; console → chuông 🔔 → View all → Alarm center → Inquiries; mail Reply-To = khách) |
| G-19 | Affiliate: 3 bước có mô tả + chip 지금 신청하기 · 더 알아보기 · 처음으로 · 종료 | 3 bước chỉ có tiêu đề + 1 nút "지금 신청" (`AffiliateCard.tsx`, `POST /affiliate/apply`) | Mô tả bước qua copy tenant; thêm 3 chip; "종료" → CSAT | UI · I18N · CFG | T12 ✅ (2026-11-13; kịch bản `affiliate` + `affiliate_details`, câu chữ sửa ở AI Settings; IVY: IVY Beauty, 10%; Apply now → form liên hệ T11) |
| G-20 | CSAT **4** mặt + **건너뛰기** | **5** mặt (thang 1–5, cố ý), nút "닫기" (`CsatCard.tsx`) | Quyết định Q-12; đổi "닫기" → "건너뛰기"; dòng "상담이 종료되었습니다" hiện **sau** khi đánh giá (hiện đang ở trên) | UI · I18N | T12 ✅ (2026-11-13; 4 mặt lưu 1·3·4·5; câu hỏi → thẻ → cảm ơn → khối kết thúc) |
| G-21 | Settings/Privacy | Đã có đủ khối (`PreferencesPanel.tsx`); không có tiêu đề màn | Đối chiếu copy/khoảng cách; header biến thể (Q-09) | UI | T13 ✅ (2026-11-13; theo ảnh `1004:1367`: cỡ chữ, khoảng cách, nút viền đỏ, toggle 44×24, câu "stops immediately". Tiêu đề màn: thanh 2a "← Settings" màu brand, chủ dự án chốt) |
| G-22 | Copy KO/EN theo thiết kế | i18n 6 ngôn ngữ đã có (`apps/widget/src/i18n/locales/*.ts`) | Thêm/sửa key mới; chạy `npm run i18n:check` | I18N | T14 ✅ (2026-11-13; so với bản trích chữ Figma: KO pill 결제완료, "리뷰 쓰기", "고객님께 배송중입니다!"; tóm tắt đơn theo BR-08; tiếng Hàn ngắt ở dấu cách; bước giao hàng theo ngôn ngữ widget; chip ES / VI xuống hàng) |
| G-23 | A11y chip lọc | ~~Chip không có `aria-pressed`~~ → có từ T02; badge tab có `aria-label` "{n} unread" ✓ | Bổ sung theo NFR-02 | UI | T15 |
| G-24 | Mobile toàn màn hình | Có chế độ `compact=1` / `mode=app` | Kiểm thử 390px, sửa tràn | UI | T15 |
| G-25 | Báo hàng về thật (재입고 알림) | `POST /restock/subscribe` có, nhưng `notifyRestock` không được gọi ở đâu (không có nguồn báo khi Shopify có hàng lại) và bản đăng ký không lưu tenant | Nguồn báo hàng về (webhook `inventory_levels/update` hoặc product sync) → thông báo trong app; chip Restock alert đăng ký cho sản phẩm cụ thể | API · UI | Task riêng (chủ dự án chốt 2026-11-12, T10 §8-4a) |

**Đã khớp thiết kế (giữ nguyên):** menu 6 ngôn ngữ (`LanguageSwitcher.tsx`), nút Settings/Close, badge tab (99+), nhóm "Today's/Yesterday" (code: "Today's notifications"/"Yesterday"), thẻ giao hàng + stepper ngang (`TrackingStepperH.tsx`), chế độ chọn/xoá, review list + form, typing bubble "답변을 작성 중입니다…", Settings (consent + ngày + version, marketing opt-out, CCPA, export JSON, delete).

> **Lưu ý đa tenant:** nhánh `deploy/talk-ivyusa` chỉ deploy cho stack IVY, nhưng code vẫn là code SharpTalk dùng chung. Ưu tiên **cấu hình tenant** trước, sau đó mới tới thay đổi có điều kiện. Không xoá tính năng mà tenant khác (ví dụ Go2Joy) đang dùng, để còn merge ngược về `main` được.

---

## 11. Câu hỏi mở (cần IVY/PM xác nhận)

| ID | Câu hỏi | Mặc định nếu chưa có trả lời |
|---|---|---|
| Q-01 | Khách vãng lai thấy gì ở header và tab Notifications? | Header "Hi there", giữ cổng Verify identity / Guest order lookup |
| Q-02 | Từ 2 ngày trở lên hiện **ngày tháng** (ghi chú) hay "2days ago" (thiết kế)? | ✅ **Chốt 2026-11-11:** "{n} days ago" tới 6 ngày, sau đó ngày tháng `MMM d`; ngày theo múi giờ máy khách |
| Q-03 | Vào chế độ chọn để xoá bằng cách nào (nút "Edit", nhấn giữ…)? | Nút "Select" ở hàng chip |
| Q-04 | 2 chip "??" sau "인기상품" trong Product Help là gì? | Ẩn, chỉ hiện "인기상품" — ✅ T10 (bỏ 2 chip) |
| Q-05 | "Track Order" mở trang nào (Shopify order status hay link hãng vận chuyển)? | Link tracking của fulfillment, không có thì trang order status của Shopify |
| Q-06 | "Write Review" mở form trong widget hay trang review của ivyusa.com? | Mở trang sản phẩm trên ivyusa.com ở anchor review |
| Q-07 | Copy tiếng Anh cho lời chào và 7 quick-reply (thiết kế chỉ có bản KO)? | Dịch: Payment check · Delivery inquiry · Stock inquiry · Exchange & Refund · Product inquiry · Feedback · Contact Support |
| Q-08 | Email hỗ trợ thật (thiết kế ghi `help@ivy.com`)? | Lấy từ cấu hình tenant. ✅ **Chốt (T11, 2026-11-12):** hello@ivyusa.com |
| Q-09 | Header Settings màu xanh (khác các màn khác) là chủ ý? | Theo màu brand của tenant. **T13 (2026-11-13):** ảnh EN `1004:1367` có thanh đầu **trắng** "Hi, Kiho" → giữ thanh trắng. Chủ dự án chọn 2a (thanh màu brand "← Settings") nhưng gửi ảnh thanh trắng. ✅ **Chốt 2026-11-13: làm 2a** — thanh màu brand "← Settings" chữ trắng + ✕ (sắc 700 của brand, chữ trắng 5,0:1, đạt AA); ẩn lời chào, 🌐 và ⚙; ← và Esc quay về tab |
| Q-10 | Có chip "All/전체" không (biến thể `992:246` có, Master không có)? | Không — theo Master |
| Q-11 | Tab "Orders" hiện tại bỏ hẳn hay ẩn sau chip Order/Delivery? | Bỏ tab qua cấu hình `widget_tabs` (chip tự gộp) |
| Q-12 | CSAT 4 mặt (thiết kế) hay 5 mặt (code, thang 1–5 đang lưu DB)? | Giữ thang 1–5 trong DB; hiển thị 4 mặt map → 1 · 3 · 4 · 5. ✅ **Làm (T12, 2026-11-13)** đúng như vậy; chế độ survey giữ 5 mặt |
| Q-13 | Thanh công bố AI ("This chat is AI-powered…") không có trong thiết kế — giữ dạng nào? | Giữ (pháp lý), thu gọn 1 dòng dưới composer |
| Q-14 | Giữ nút đính kèm file trong composer? | Giữ (thiết kế không cấm) |
| Q-15 | Contact Support của IVY gồm những kênh nào (thiết kế: chỉ email)? | Email + live chat khi có agent online. ✅ **Chốt (T11, 2026-11-12):** chỉ email, đúng thiết kế; tenant bật thêm live chat được ở console |
| Q-16 | Mã coupon lấy từ đâu (Shopify discount code? nhập tay khi gửi campaign?) | Nhập trong campaign console, lưu ở metadata notification. **Chốt (T05, 2026-11-12):** nhập trong console Campaigns, lưu ở `content.couponCode` của campaign; mỗi campaign một mã. |

**Lỗi chính tả / copy trong Figma cần designer sửa** (không implement theo): "Today’s__" (placeholder), "Todays’__", "KR" lẫn "KO" ở nút ngôn ngữ, "구독 해택" → **혜택**, "4월 전" (nhiều khả năng là **4일 전**), tên frame "02.Pamyent", "03.Delievery".
