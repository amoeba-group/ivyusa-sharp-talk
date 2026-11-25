# REQ-261125 — IVY TalkTalk PRD v1.0 đối chiếu với bản đang chạy

| | |
|---|---|
| Nguồn | `[EN]IVY_TalkTalk_PRD___202611_1.pptx` — PRD v1.0 của IVY (24 slide, sửa 2026-11-25), chủ dự án gửi ngày 2026-11-25 |
| Đối chiếu với | nhánh `deploy/talk-ivyusa` tại `d2073407` (gồm adapter Bedrock, chưa push) |
| Cách làm | Đọc từng yêu cầu của PRD rồi tra code (widget, API, console) có dẫn file và dòng. Không đoán: chỗ nào chưa tra được ghi "chưa kiểm" |
| Kế hoạch | [PLN-261125-IVY-PRD-v1-Alignment](../plan/PLN-261125-IVY-PRD-v1-Alignment.md) |

## 1. Tóm tắt

PRD có ba điều **mới**:

1. Thông báo chia nhóm **New / Recent** theo đã đọc / chưa đọc.
2. Quy tắc **AI chỉ hướng dẫn, khách tự thao tác**.
3. Gợi ý sản phẩm **2 chế độ** (admin chọn / AI tự xếp hạng), có trang quản trị.

Phần lớn khung (thông báo, theo dõi giao hàng, Order Detail, form liên hệ, CSAT, Settings, 6 ngôn ngữ) đã làm theo Figma trong T00–T17.

| Mức | Số yêu cầu | Gồm |
|---|---|---|
| ✅ Khớp | 5 | A-05, S-03, quy tắc AI không thao tác đơn, admin duyệt đề xuất của AI, nguồn trả lời theo dữ liệu đơn của chính khách |
| 🟡 Khớp một phần | 9 | N-02, N-03, N-06, C-01, C-03, C-04, E-01, S-01, S-02 |
| ❌ Chưa có | 9 | N-01 (New/Recent), N-04 (loại khách từ chối + chọn người nhận), N-05 (review tự động), C-02 (mọi lời nhắn do AI viết), A-01…A-04 (gợi ý 2 chế độ), E-02 (chuyển form email), Klaviyo, Yotpo |

Lỗi IVY đã báo và **vẫn còn**: campaign gửi cho **mọi** khách — `segmentRef` lưu nhưng không đọc, `campaign.service.ts:192`.

## 2. Đối chiếu từng yêu cầu

### 2.1 Thông báo

| ID | PRD | Ưu tiên | Hiện tại (bằng chứng) | Kết quả |
|---|---|---|---|---|
| N-01 | 4 nhóm Order · Delivery · Promo · Review | P0 | 4 chip có sẵn (G-04, T02) | ✅ |
| N-01 | Nhóm **New** (chưa đọc) / **Recent** (đã đọc), mới nhất ở trên | P0 | Nhóm theo **ngày** Today's / Yesterday's / ngày cụ thể theo múi giờ máy khách (`NotificationsTab.tsx:517`, `format.ts:145-163`, BR-04) | ❌ |
| N-01 | Đã đọc khi **chạm**, không phải khi mở widget | P0 | Đúng: chạm dòng / mở link promo / Copy code → `POST /notifications/:id/read` | ✅ |
| N-01 | Dòng chỉ đổi nhóm ở **lần mở sau**; đang mở thì chỉ tắt nền tô | P0 | Không có khái niệm nhóm theo đã đọc | ❌ |
| N-01 | Trạng thái mới của **cùng đơn** → thẻ mới đầu New, thẻ cũ **tự đã đọc** → Recent | P0 | Trạng thái mới = dòng mới (đúng), nhưng dòng cũ **không bao giờ** tự đã đọc (`notification.service.ts` chỉ set `readAt` ở :549, :566) | ❌ |
| N-01 | Số trên tab / header = số mục trong New, **tối đa 1 mỗi đơn** | P0 | Đếm theo dòng, không gộp theo đơn (`notification.service.ts:581-608`) | ❌ |
| N-01 | Ẩn tiêu đề nhóm rỗng; Recent giữ **30 ngày** (đề xuất) | P0 | Nhóm ngày tự ẩn; xoá cứng sau 365 ngày (`retention.service.ts`), không có mốc 30 ngày | ❌ |
| N-01 | Thời gian: Just now · N min ago · **N hours ago (1–23 giờ)** · **N days ago (≥ 24 giờ)**, làm tròn xuống, số ít / số nhiều | P0 | Có "Yesterday", "{n}h ago" chỉ trong cùng ngày lịch, từ 7 ngày hiện **ngày tháng** "Nov 3" (BR-05, `notice-time-text.ts:9-22`) | ❌ |
| N-02 | Sự kiện đơn **paid · cancelled · refunded** → thông báo; chạm mở Order Detail | P0 | "Confirmed" tạo **muộn** khi khách mở (≤ 30 ngày, ≤ 10 đơn, chỉ chưa đọc nếu đặt < 24 giờ; không tạo nếu đơn đã có dòng giao hàng — `notification.service.ts:426-497`). **Không có** huỷ / hoàn tiền: đồng bộ bỏ qua `financial_status`, không có trạng thái Cancelled / Refunded (`shopify-sync.service.ts:651-655`). Chạm mở Order Detail ✅ | 🟡 |
| N-03 | Tracker 4 bước; bước xong xanh, chưa tới xám; câu cam "on the way" / đen "Delivered"; Track Order → link hãng vận chuyển; thông báo mỗi lần đổi chặng | P0 | Đúng cả (`TrackingStepperH.tsx:36-63`, `ShipmentList.tsx:85-113`); thông báo khi đổi chặng qua đồng bộ 30 phút (≤ 48 giờ) | ✅ |
| N-03 (slide 7 ②) | Order Detail: **icon xe tải cạnh mã đơn** (chấm cam khi đang giao) → sang tab Delivery, đúng đơn đó | P0 | Cạnh mã đơn là nhãn trạng thái (quyết định PLN-261112 D5); icon xe tải ở dòng Track cuối trang, mở link hãng vận chuyển (`OrderDetail.tsx:234-241, 382-408`) | ❌ |
| N-04 | Coupon / campaign; **không gửi** cho khách từ chối marketing hoặc CCPA | P1 | Campaign có. Gửi cho **mọi** khách, không lọc theo người nhận và vẫn hiện trong app cho khách đã từ chối (`campaign.service.ts:192`, `notification.service.ts:168-185`). Chưa có coupon riêng từng khách. Lỗi "mất nội dung khi lưu" IVY báo: chưa kiểm | ❌ |
| N-05 | Yêu cầu review **N ngày sau khi giao**; Write review → nền tảng review (Yotpo) | P1 | `requestReview()` chỉ được gọi trong test; không lịch, không Yotpo (chỉ lưu khoá + test kết nối) | ❌ |
| N-06 | Đã đọc khi chạm; xoá chọn / xoá tất cả | P0 | Có (T07); Delete All chỉ xoá chip đang xem; xoá mềm | ✅ |
| N-06 | **Nhấn giữ** (điện thoại) / **chuột phải** (máy tính) → menu → Delete | P0 | Không có | ❌ |

### 2.2 Chat

| ID | PRD | Ưu tiên | Hiện tại | Kết quả |
|---|---|---|---|---|
| C-01 | **7** nút nhanh, nhãn 6 ngôn ngữ, chạm là bắt đầu luồng | P0 | 7 nút + nút thứ 8 **Affiliate** (T12) | 🟡 |
| C-01 · Payment check | Thẻ trạng thái thanh toán của đơn gần nhất + AI hướng dẫn | P0 | Gửi chữ "Payment check" cho AI | ❌ |
| C-01 · Delivery inquiry | Thẻ tracker giao hàng + AI hướng dẫn | P0 | Kịch bản soạn sẵn `shipping_policy` (chính sách giao hàng), không có thẻ đơn | ❌ |
| C-01 · Stock inquiry | Chọn sản phẩm → AI trả lời từ dữ liệu tồn kho | P0 | Gửi chữ cho AI; **không có dữ liệu tồn kho** (`products_cache` không có cột tồn kho, đồng bộ tắt) | ❌ |
| C-01 · Exchange & refund | AI trả lời từ kho chính sách, form liên hệ khi cần | P0 | Kịch bản soạn sẵn `cancel_refund` + chip "Talk to an agent" | 🟡 |
| C-01 · Product inquiry | Chọn danh mục → AI trả lời / gợi ý sản phẩm | P0 | Menu Product Help → 11 danh mục → 5 sản phẩm bán chạy từ Shopify (T10) | 🟡 |
| C-01 · Feedback | Nhập góp ý → **lưu ở admin** | P0 | Gửi chữ cho AI; không có nơi lưu góp ý | ❌ |
| C-01 · Contact Support | **Mở thẳng** form email | P0 | Hiện thẻ kênh trước (IVY chỉ có 1 thẻ email), bấm mới ra form | 🟡 |
| C-02 | **Mọi** lời nhắn do AI viết; có chỉ báo đang gõ; lưu lịch sử | P0 | Lịch sử và chỉ báo có. Lời nhắn của nút nhanh là **văn bản soạn sẵn** (`scenario.service.ts:106-238`) hoặc chữ của widget. AI production đang là **Stub** (Bedrock chưa bật) | ❌ |
| C-03 | Thẻ đơn gần đây + Track · Cancel order · Start over; Cancel order chỉ dẫn khách tự huỷ trên Shopify | P0 | Có (My Orders, T09). Cancel order hiện câu "email hello@ivyusa.com", không có link Shopify. Không code nào huỷ đơn ✅ | 🟡 |
| C-04 | 11 danh mục → AI trả lời hoặc gợi ý | P0 | 11 danh mục có; gợi ý = bán chạy của Shopify, không theo 2 chế độ | 🟡 |
| A-01…A-04 | Gợi ý **2 chế độ** theo danh mục × loại (Popular / Recommended / New); admin chọn ≤ 10 sản phẩm, sắp thứ tự, thời hạn; AI Auto xếp theo bán 30 ngày + điểm review + tồn kho; bỏ hết hàng / ẩn; ≤ 3 thẻ sản phẩm; ghi chế độ vào log AI; lịch sử thay đổi | P0 | **Chưa có gì** ngoài truy vấn bán chạy của Shopify. Câu hỏi tự do "gợi ý sản phẩm phổ biến" đi qua tìm kiếm kiến thức, không có số bán — khớp các lỗi IVY ghi ở slide 17 | ❌ |
| A-05 | Quản lý kịch bản · FAQ · kho chính sách | P0 | AI Settings + Knowledge | ✅ |
| E-01 | Form tên / email điền sẵn; **đính kèm đoạn chat + mã đơn**; mail CS + hộp thư admin; xác nhận trong chat | P0 | Form, mail, hộp thư Inquiries, xác nhận: có. Mail **không có** đoạn chat hay mã đơn; `orderId` luôn null (`inquiry.service.ts:97-114, 191-227`) | 🟡 |
| E-02 | AI không trả lời được / khách xin gặp người → **form email** (v1 không có nhân viên chat — PRD ghi "Confirmed") | P1 | Luôn chuyển **nhân viên chat** (status `waiting`, chuông console, mail / Slack — `chat.service.ts:1402-1469`) | ❌ |
| S-01 | 4 mức + Bỏ qua; cảm ơn; "Chat has ended"; chat mới **bắt đầu lại từ đầu**; báo cáo admin: điểm · chế độ trả lời · chuyển form | P1 | 4 mức có, nhưng nhãn **Dissatisfied · Neutral · Satisfied · Very satisfied** (theo Figma; PRD ghi Unhappy · Neutral · Happy · Very happy). Chat AI không tự đóng (IVY chưa đặt chính sách). Sau End, đoạn cũ vẫn ở trên màn. Báo cáo có điểm, chưa có chế độ trả lời / chuyển form | 🟡 |
| S-02 | Consent AI (ngày, phiên bản; rút là dừng ngay); marketing opt-out (đồng bộ **Klaviyo**); CCPA; tải / xoá dữ liệu | P0 | Có cả (T13), trừ Klaviyo (chỉ lưu khoá + test kết nối) và chuyển trạng thái đồng ý sẵn có từ Shopify / Klaviyo | 🟡 |
| S-03 | 6 ngôn ngữ giao diện + câu trả lời AI | P1 | Có (T14); IVY duyệt bản dịch | ✅ |

### 2.3 Nguyên tắc và kiến trúc (slide 4–5)

| PRD | Hiện tại | Kết quả |
|---|---|---|
| AI không tự đặt / huỷ / đổi / hoàn tiền | Không có lệnh ghi Shopify nào trừ webhook và xoá dữ liệu GDPR (`shopify-admin.client.ts:272, 369`) | ✅ |
| Admin: AI đề xuất, admin duyệt mới áp dụng | Coach lưu đề xuất `pending`, chỉ áp dụng khi admin bấm (`ai-coach.controller.ts:132-176`) | ✅ |
| AI trả lời chỉ từ đơn của chính khách (đồng bộ từ Shopify) | Có | ✅ |
| Đơn đổi → DB gần thời gian thực qua **webhook** | Load balancer của IVY chặn Shopify (BUG-034); bù bằng đồng bộ 30 phút (PRD ghi "polling backup tắt" — nay đã bật) | 🟡 cần IVY IT cho Shopify đi qua |
| LLM = Amazon Bedrock | Adapter xong, chưa bật (`d2073407`, chờ `.env`) | 🟡 |
| Tìm kiếm kiến thức: full-text + vector (Qdrant + Voyage) | Có code; Voyage cần khoá (PRD: "Voyage AI payment" còn mở) | chưa kiểm trên production |
| Scheduler cho thông báo trễ (review) | Không có | ❌ |
| Chat qua **WebSocket** | Hỏi mỗi 5 giây (`useChat.ts:18`) | ❌ (không nằm trong bảng yêu cầu) |

## 3. Chỗ PRD khác quyết định / thiết kế trước đây

| Điểm | Trước đây | PRD | Đề xuất |
|---|---|---|---|
| Nhóm thông báo | BR-04: theo ngày, chủ dự án chốt 2026-11-11 | New / Recent theo đã đọc | Theo PRD (văn bản mới nhất của IVY) |
| Thời gian | BR-05: "Yesterday", ngày tháng từ 7 ngày | "N hours ago" / "N days ago", không ngày tháng | Theo PRD |
| Order Detail | PLN-261112 D5: giữ nhãn trạng thái thay icon xe tải | Icon xe tải + chấm cam → tab Delivery | Theo PRD: icon cạnh mã đơn, vẫn giữ nhãn trạng thái |
| Nút thứ 8 Affiliate | T12: thêm vì Figma có kịch bản mà không vẽ lối vào | 7 nút; Affiliate trả lời khi khách hỏi | Bỏ nút **khi** AI đã nhận câu hỏi affiliate (giai đoạn 3) |
| Nhãn CSAT | Figma: 불만족 · 보통 · 만족 · 매우 만족 → Dissatisfied · Neutral · Satisfied · Very satisfied | Unhappy · Neutral · Happy · Very happy | **Cần chủ dự án chọn** |
| Khi AI bí | Chuyển nhân viên chat (đang dùng, BUG-044 vừa sửa) | v1 chỉ form email | **Cần chủ dự án chọn** |

## 4. Việc cần quyết

**IVY quyết (PRD slide 24):**

1. Chế độ gợi ý mặc định và tiêu chí AI Auto: 30 ngày? trọng số bán / review? tối đa 10 sản phẩm?
2. Xoá thông báo: xoá thật hay ẩn; giữ bao lâu.
3. Gửi yêu cầu review sau N ngày; dùng Yotpo.
4. Hộp thư nhận form liên hệ, SLA, thời gian tự kết thúc chat.
5. Trang admin đặt ở đâu (Shopify hay console riêng — hiện là console `talk.ivyusa.com`).
6. Quyền: Shopify app, AWS.

Thêm từ đối chiếu này:

7. Cho Shopify webhook đi qua load balancer.
8. Link "Cancel order" trỏ trang nào.

**Chủ dự án quyết:** hai dòng "Cần chủ dự án chọn" ở mục 3.
