# PLN-261125 — Làm TalkTalk khớp PRD v1.0 của IVY

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt** 2026-11-25: `ok duyệt, đã chạy SQL, CSAT a, E-02 b`. Giai đoạn 1: [RPT](../implementation/RPT-261125-IVY-PRD-v1-Phase1.md), [TCR](../test/TCR-261125-IVY-PRD-v1-Phase1.md). SQL giai đoạn 1 đã chạy trên production (chủ dự án) |
| Nguồn | [REQ-261125-IVY-PRD-v1-Gap](../analysis/REQ-261125-IVY-PRD-v1-Gap.md) — PRD v1.0 của IVY (24 slide, 2026-11) |
| Phạm vi | widget, API, console. Mỗi giai đoạn deploy riêng |
| Migration | Giai đoạn 1: `sql/261125-prd-v1-phase1.sql` (2 cột). Giai đoạn 2: bảng gợi ý sản phẩm + cột tồn kho. Chạy SQL **trước** khi push |

## 1. Thứ tự

| Giai đoạn | Nội dung | Cần ai quyết | Ước lượng |
|---|---|---|---|
| **1** | Mọi P0 không cần quyết định: thông báo New / Recent, giờ hiển thị, tự đánh dấu đã đọc, icon xe tải, xoá bằng nhấn giữ / chuột phải, báo huỷ / hoàn tiền, 4 nút chat ra thẻ / form, email liên hệ kèm đơn + đoạn chat, campaign chọn người nhận + loại khách từ chối | — | 2–3 ngày |
| **2** | Gợi ý sản phẩm 2 chế độ (A-01…A-04): tồn kho, xếp hạng theo bán 30 ngày, tab admin, thẻ sản phẩm trong chat | IVY: tiêu chí AI Auto (có mặc định đề xuất) | 3–4 ngày |
| **3** | Lời nhắn do AI viết (C-02), câu hỏi Affiliate qua AI rồi bỏ nút thứ 8, chuyển form email khi AI bí (E-02) | Bedrock đã bật; chủ dự án: E-02 | 2 ngày sau khi Bedrock chạy |
| **4** | Review sau N ngày + Yotpo (N-05), Klaviyo, tự kết thúc chat + báo cáo (S-01), chat mới bắt đầu lại từ đầu | IVY: N ngày, giờ tự kết thúc, khoá Yotpo / Klaviyo | theo quyết định của IVY |

## 2. Giai đoạn 1

### 2.1 Thông báo New / Recent (N-01) — widget + API

**Quy tắc (PRD slide 9):**

| # | Quy tắc | Cách làm |
|---|---|---|
| 1 | New = chưa đọc, Recent = đã đọc; mới nhất ở trên | Nhóm theo `readAt` thay cho nhóm theo ngày (`groupByDate`) |
| 2 | Đã đọc khi **chạm** thẻ | Giữ nguyên |
| 3 | Thẻ chỉ đổi nhóm ở **lần mở sau**; đang mở thì chỉ tắt nền tô và chấm đỏ | Widget chụp danh sách id chưa đọc khi panel mở. Thẻ trong danh sách đó vẫn ở New tới lần mở sau. Thẻ mới tới trong lúc mở thì thêm vào New |
| 4 | Trạng thái mới của cùng đơn → thẻ mới đầu New, thẻ cũ **tự đã đọc** | API: ghi thông báo đơn (`refType=order`) thì đánh dấu đã đọc các thông báo cũ hơn của cùng đơn. Lúc mở danh sách cũng dọn một lần, để dữ liệu cũ đúng luôn |
| 5 | Số trên tab / header = số thẻ trong New, **tối đa 1 mỗi đơn** | `unreadCount` đếm theo đơn: số đơn có thông báo chưa đọc + số thông báo chưa đọc không gắn đơn |
| 6 | Ẩn nhóm rỗng; Recent giữ **30 ngày** | API chỉ trả thẻ đã đọc trong 30 ngày. Thẻ chưa đọc luôn hiện. Không xoá dữ liệu: giữ 365 ngày như cũ |
| — | Nền tô | Tô **mọi** thẻ chưa đọc (PRD: "Highlighted card or red dot"). Bỏ quy tắc cũ "chỉ thẻ mới nhất" (PLN §7 D-5) |

**Giờ hiển thị (PRD slide 9, thay BR-05):** tính theo thời gian đã trôi qua, làm tròn xuống, không phụ thuộc múi giờ.

| Đã trôi qua | Hiện | Tiếng Việt |
|---|---|---|
| < 1 phút | Just now | Vừa xong |
| 1–59 phút | 1 min ago · 5 min ago | 5 phút trước |
| 1–23 giờ | 1 hour ago · 2 hours ago | 2 giờ trước |
| ≥ 24 giờ | 1 day ago · 3 days ago (47 giờ = 1 day ago) | 3 ngày trước |

Bỏ "Yesterday" và ngày tháng "Nov 3". Dùng chung cho danh sách thông báo và chip Review.

**Chip Delivery** (đang nhóm theo ngày đặt hàng): dùng cùng New / Recent. Đơn có thông báo chưa đọc ở New. Mở thẻ thì các thông báo của đơn đó thành đã đọc.

```
┌─ Notifications ──────────────────────────┐
│ (Order) (Delivery) (Promo) (Review) Select│
├───────────────────────────────────────────┤
│ New                                       │
│▓[📦] IVY-39891  [Delivered]            ● ▓│  ← nền tô + chấm đỏ
│▓     Hydrating Face Mask + 2 items       ▓│
│▓     2 hours ago                         ▓│
├───────────────────────────────────────────┤
│ Recent                                    │
│ [📦] IVY-39891  [In Transit]              │  ← tự đã đọc khi Delivered tới
│      Hydrating Face Mask + 2 items        │
│      1 day ago                            │
│ [📦] IVY-39891  [Confirmed]               │
│      Hydrating Face Mask + 2 items        │
│      2 days ago                           │
└───────────────────────────────────────────┘
Header 🔔 1  ← tối đa 1 cho mỗi đơn
```

### 2.2 Xoá bằng nhấn giữ / chuột phải (N-06)

Nhấn giữ 0,5 giây (điện thoại) hoặc chuột phải (máy tính) → menu nhỏ ngay cạnh thẻ → **Delete** → xoá thẻ đó, báo "1 notification deleted". Esc hoặc chạm ra ngoài thì đóng. Bàn phím: phím Menu / Shift+F10 trên thẻ mở cùng menu. Chế độ Select / Delete All giữ nguyên.

```
│ [📦] IVY-39891  [In Transit]       │
│      Hydrating Face M┌───────────┐ │
│      1 day ago       │ 🗑 Delete │ │
│ [📦] IVY-39891  [Con└───────────┘ │
```

### 2.3 Icon xe tải ở Order Detail (PRD slide 7 ②)

Cạnh mã đơn có nút xe tải. Đơn đang giao thì có **chấm cam**. Chạm → sang chip **Delivery**, thẻ của đúng đơn đó nằm đầu và được tô. Đơn chưa gửi hàng vẫn hiện thẻ ở bước Preparing. Nhãn trạng thái vẫn giữ: thẻ thông báo dẫn tới đây có nhãn, bỏ đi thì cùng một đơn trông như hai.

```
┌─ ← Order Detail ─────────────────────────┐
│ IVY-39891  [🚚•]           [In Transit]  │  ← • = chấm cam khi đang giao
│ [img] Hydrating Face Mask (10pcs) ...    │
```

### 2.4 Báo huỷ / hoàn tiền (N-02)

- Đồng bộ đọc thêm `cancelledAt` (GraphQL) / `cancelled_at` (webhook) và trạng thái tài chính `refunded`.
- Hai trạng thái mới: `cancelled` → **Cancelled**, `refunded` → **Refunded**. Nhãn xám, 6 ngôn ngữ.
- Trạng thái đổi sang một trong hai (≤ 48 giờ, đơn có khách) → thông báo chip Order, chạm mở Order Detail.
- Hoàn một phần (`partially_refunded`) không đổi trạng thái đơn.
- Không SQL: cột trạng thái là chuỗi.

### 2.5 Bốn nút chat nhanh (C-01)

Nút vẫn là 7 + Affiliate; Affiliate bỏ ở giai đoạn 3.

| Nút | Hiện tại | Sau |
|---|---|---|
| **Payment check** | Gửi chữ cho AI | Thẻ đơn gần nhất: mã đơn, ngày, tổng tiền, **trạng thái thanh toán** (Paid · Refunded · Cancelled). Kèm câu hướng dẫn và nút Track · Contact Support · Start over. Chưa đăng nhập → khung đăng nhập như My Orders |
| **Delivery inquiry** | Kịch bản chính sách giao hàng | Thẻ tracker 4 bước của đơn gần nhất đang giao (không có thì đơn gần nhất) + Track Order. Câu chính sách giao hàng vẫn ở dưới. Không có đơn → câu chính sách như cũ |
| **Feedback** | Gửi chữ cho AI | Form góp ý (ô nội dung + Send) → lưu ở console, mục Inquiries, lọc **Feedback**. Không gửi mail CS |
| **Contact Support** | Thẻ kênh rồi mới tới form | Mở **thẳng** form email khi email là kênh duy nhất (IVY) |

Câu đi kèm thẻ là văn bản soạn sẵn theo 6 ngôn ngữ; giai đoạn 3 đổi thành AI viết (C-02).

```
┌─ Chat ───────────────────────────────────┐
│                     [ Payment check ]    │
│ ┌──────────────────────────────────────┐ │
│ │ IVY-39891              Nov 23, 2026  │ │
│ │ Hydrating Face Mask + 2 items        │ │
│ │ Total $48.00          [Paid]         │ │
│ └──────────────────────────────────────┘ │
│ Your payment for IVY-39891 went through. │
│ [Track] [Contact Support] [Start over]   │
│                                          │
│                      [ Feedback ]        │
│ ┌─ Send us your feedback ──────────────┐ │
│ │ [                                  ] │ │
│ │ [                                  ] │ │
│ │                          [ Send ]    │ │
│ └──────────────────────────────────────┘ │
│ Thanks — your feedback reached the team. │
└──────────────────────────────────────────┘
```

### 2.6 Email liên hệ kèm đơn và đoạn chat (E-01)

- Form gửi kèm **mã đơn** khi khách đang hỏi về một đơn: mở từ thẻ đơn, Order Detail hoặc Payment / Delivery. Lưu `orders.id` vào `inquiries.order_id`; cột có sẵn nhưng xưa nay luôn null.
- Mail gửi CS thêm:
  - `Order: IVY-39891`;
  - **20 tin gần nhất** của cuộc chat, mỗi dòng `[giờ UTC] Customer / AI / Staff: nội dung`, cắt 500 ký tự mỗi tin;
  - link mở cuộc chat trong console.
- Console, mục Inquiries: hiện mã đơn; có sẵn link cuộc chat.
- Contact ở cuối Order Detail: giữ "Ask about this order" (PRD slide 7 cho phép AI chat). Thêm dòng **Contact IVY** → mở form có sẵn mã đơn.

```
Subject: [IVY USA] New inquiry from Jane Doe — order IVY-39891
Name: Jane Doe · Email: jane@… · Language: en · Order: IVY-39891
Message: …
— Recent chat (last 20 messages) —
[14:02] Customer: Where is my order?
[14:02] AI: Your order IVY-39891 is In Transit …
Open in console: https://talk.ivyusa.com/live-chat?conversation=123
```

### 2.7 Campaign: người nhận + loại khách từ chối (N-04)

- **Loại khách từ chối (PRD slide 12):** khách đã tắt marketing hoặc bật CCPA "do not sell / share" không nhận Promo và Review, kể cả trong widget. Đơn hàng và giao hàng vẫn gửi.
  - "Đã từ chối" = có dòng tuỳ chọn marketing **bị tắt** và không dòng nào bật.
  - Khách chưa từng chạm vào cài đặt **không** bị loại khỏi trong widget; email / SMS vẫn mặc định không gửi như cũ.
- **Người nhận:** form campaign thêm **Send to**: All customers / Specific customers (dán email, mỗi dòng một). API đổi email → khách của tenant, lưu danh sách id; dispatch chỉ gửi cho họ. Hiện báo "N emails not found".
- Kiểm lỗi IVY báo "lưu mất nội dung": dựng lại trên máy, sửa nếu còn.

```
┌─ New campaign ───────────────────────────┐
│ Name      [ Black Friday BOGO          ] │
│ Send to   (●) All customers              │
│           ( ) Specific customers         │
│               [ jane@example.com       ] │
│               [ john@example.com       ] │
│               2 found · 0 not found      │
│ ⓘ Customers who opted out of marketing   │
│   or chose "Do not sell" are skipped.    │
└──────────────────────────────────────────┘
```

### 2.8 SQL giai đoạn 1 — `sql/261125-prd-v1-phase1.sql`

```sql
ALTER TABLE inquiries ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'inquiry';  -- 'inquiry' | 'feedback'
ALTER TABLE campaigns ADD COLUMN target_customer_ids JSON NULL;                -- null = all customers
```

Viết idempotent (kiểm `information_schema` trước khi thêm). Gỡ ra: `DROP COLUMN`; code cũ không đọc hai cột này.

## 3. Giai đoạn 2 — Gợi ý sản phẩm 2 chế độ (A-01…A-04)

| Phần | Cách làm |
|---|---|
| Dữ liệu sản phẩm | Đồng bộ sản phẩm Shopify mỗi 6 giờ vào `products_cache`: thêm tồn kho (`totalInventory`), trạng thái, published |
| Xếp hạng AI Auto | Số bán 30 ngày từ `order_items` (đã có) + điểm review từ bảng `reviews` (có sẵn; Yotpo ở giai đoạn 4). Trọng số mặc định bán 0,7 / review 0,3, chờ IVY chốt. Bỏ hàng hết, ẩn, không bán ở Mỹ. Thiếu dữ liệu → bán chạy của danh mục (cách hiện tại) → link trang danh mục |
| Admin chọn | Bảng mới `product_recommendations` (tenant, danh mục, loại Popular / Recommended / New, chế độ, thời hạn, danh sách ≤ 10 sản phẩm có thứ tự). Hết hạn → AI Auto. Mọi thay đổi ghi audit |
| Console | AI Settings → tab **Recommended Products** theo wireframe PRD slide 18 |
| Chat | Chọn danh mục / hỏi "gợi ý sản phẩm phổ biến" → ≤ 3 thẻ sản phẩm (ảnh · giá · link), mỗi sản phẩm chỉ một lần, đúng danh mục; danh sách được đưa vào prompt để AI viết lời giới thiệu; ghi chế độ dùng vào log AI |
| Stock inquiry | Chọn sản phẩm (tìm theo tên) → trả lời từ tồn kho |

```
┌─ AI Settings ─ [Scenarios] [Knowledge] [Recommended Products] ───────┐
│ Category [ Nails ▾ ]   Type [ Popular ▾ ]                   [ Save ] │
│ Answer mode  (●) AI Auto   ( ) Admin Selected                        │
│ Display period [2026-11-20] ~ [2026-12-31]  (then back to AI Auto)   │
│ Selected products (shown in order, max 10)                           │
│  ≡ 1  imPRESS Press-On Nails — Color            In stock    ✕        │
│  ≡ 2  KISS Gel Fantasy Nails                    In stock    ✕        │
│  [ 🔍 Search Shopify products to add …                    ]          │
│ History: 2026-11-20 14:02 dev@… set Nails/Popular → Admin Selected   │
└──────────────────────────────────────────────────────────────────────┘
```

Chi tiết (SQL, API) viết thành PLN riêng khi bắt đầu giai đoạn 2.

## 4. Giai đoạn 3 và 4 (tóm tắt, PLN riêng)

- **C-02, lời nhắn do AI viết:** nút nhanh và kịch bản đưa dữ liệu (thẻ, bước, con số) vào prompt; AI viết câu, bước và số giữ theo kịch bản (PRD slide 20). Bedrock lỗi → quay về câu soạn sẵn.
- **Affiliate:** AI nhận câu hỏi affiliate → trả theo kịch bản; khi chạy ổn thì bỏ nút thứ 8.
- **E-02:** xem quyết định ở mục 6.
- **S-01:**
  - tự kết thúc chat sau X phút không trả lời;
  - sau End: "Chat has ended" + **Start new chat** mở màn chào mới;
  - báo cáo theo cuộc chat: điểm · chế độ trả lời · có chuyển form không.
- **N-05:**
  - yêu cầu review N ngày sau khi giao (scheduler), loại khách từ chối;
  - Write review mở Yotpo khi có khoá, không thì form hiện tại.
- **Klaviyo:** đồng bộ trạng thái opt-out hai chiều; chuyển trạng thái đồng ý sẵn có từ Shopify / Klaviyo.

## 5. Ảnh hưởng phụ

- **Thay quyết định cũ:**
  - BR-04 (nhóm theo ngày, chốt 2026-11-11), BR-05 (Yesterday / ngày tháng) và D-5 (chỉ tô 1 thẻ) đổi theo PRD;
  - PLN-261112 D5 (bỏ icon xe tải) đảo lại, nhãn trạng thái vẫn giữ;
  - ivy-docs SPEC / TEST-CASES cập nhật theo.
- **E2E phải sửa:**
  - TC-02-02 (Today's / Yesterday's → New / Recent);
  - TC-02-04 (chữ giờ);
  - các test đếm badge khi một đơn có nhiều thông báo chưa đọc.
- **Đếm badge theo đơn:** khách có 3 thông báo chưa đọc của cùng đơn trước đây thấy 3, nay thấy 1.
- **Lọc Recent 30 ngày** chỉ ẩn, không xoá. Lịch xoá 365 ngày giữ nguyên.
- **Promo cho khách đã từ chối:** từ nay không ghi dòng mới. Dòng cũ vẫn còn, khách tự xoá được.
- **Huỷ / hoàn tiền:** lần đồng bộ đầu sau deploy có thể thấy nhiều đơn huỷ cũ. Chỉ báo khi thay đổi ≤ 48 giờ, như thông báo giao hàng.
- **Hiệu năng:** đếm theo đơn dùng `COUNT(DISTINCT …)` trên cùng chỉ mục `customer_id`. Lệnh dọn "đã đọc vì có thẻ mới hơn" chỉ chạy khi mở danh sách.

## 6. Cần quyết

**Chủ dự án:**

1. **Duyệt kế hoạch** — ✅ duyệt 2026-11-25; SQL giai đoạn 1 đã chạy.
2. **Nhãn CSAT** — ✅ **a**: giữ theo Figma (Dissatisfied · Neutral · Satisfied · Very satisfied). Không đổi code.
3. **Khi AI bí / khách xin gặp người (E-02)** — ✅ **b**: trong giờ làm vẫn chuyển nhân viên chat; **ngoài giờ mở form email** (kèm mã đơn và đoạn chat như E-01).

   PRD ghi "v1 không live chat" là **Confirmed**, nhưng IVY cũng hỏi "có dùng live chat đã làm sẵn không".

**IVY (gửi kèm bản trả lời):**

1. Tiêu chí AI Auto: 30 ngày, trọng số bán / review, tối đa 10 sản phẩm.
2. Xoá thông báo: hiện là ẩn với khách, xoá hẳn sau 365 ngày.
3. Review: N ngày, Yotpo.
4. Hộp thư CS, SLA, thời gian tự kết thúc chat.
5. Cho Shopify webhook đi qua load balancer.
6. Link nút "Cancel order".
