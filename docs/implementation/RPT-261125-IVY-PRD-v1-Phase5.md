# RPT-261125 — IVY PRD v1, giai đoạn 5: lời nhắn do AI viết (C-02)

| | |
|---|---|
| Kế hoạch | [PLN-261125-IVY-PRD-v1-Phase5](../plan/PLN-261125-IVY-PRD-v1-Phase5.md). Bắt đầu theo lệnh chủ dự án 2026-11-25: "ok, bắt đầu làm việc thứ 6 luôn" |
| Kiểm thử | [TCR-261125-IVY-PRD-v1-Phase5](../test/TCR-261125-IVY-PRD-v1-Phase5.md) |
| SQL | Không |

## 1. Thay đổi

| Phần | Nội dung | File |
|---|---|---|
| Bộ kiểm dữ kiện | `keepsFacts`: bản viết lại phải giữ đúng các con số (đọc tiền như văn nói: "42.00" = "$42"), URL, email, link markdown, các dòng bước `1.` `2.` `3.`, số dấu `**`, độ dài 0,5–1,8 lần. `onlyKnownNumbers`: câu cạnh thẻ không được có số ngoài dữ kiện | `chat/ai-wording.ts` |
| Câu kịch bản | `ScriptWordingService`: engine của chức năng `chat` viết lại câu kịch bản theo ngôn ngữ của phiên. Chỉ gửi câu kịch bản cho model. Dùng bản viết lại khi qua bộ kiểm; cache 12 giờ (từ chối: 1 giờ). Stub / quá 5 giây / lỗi → câu gốc | `chat/script-wording.service.ts`, `chat.module.ts` |
| Luồng kịch bản | Sau cổng đồng ý Chat & AI: bản viết lại → moderation → lưu và trả về | `chat/scenario.service.ts` |
| Câu cạnh thẻ (API) | `POST /chat/card-note` `{kind: payment\|delivery\|stock\|popular}` → `{text}`, tối đa 30 lần / phút. Dữ kiện do máy chủ dựng: đơn phải của khách trong phiên; tồn kho và sản phẩm phổ biến lấy từ cùng kết quả widget vừa nhận (cache). Cần đồng ý Chat & AI và engine thật. Có bộ kiểm số + moderation; cache 10 phút | module mới `card-note/`, `product.module.ts` (export `ProductRecommendationService`, `ProductPopularService`), `app.module.ts` |
| Câu cạnh thẻ (widget) | Payment check, Delivery inquiry, Stock inquiry: hiện "đang gõ" khi chờ; có câu AI thì dùng, `null` thì giữ câu cũ. Popular products: câu giới thiệu AI dưới 3 thẻ (`null` → không thêm gì) | `hooks/useCardNote.ts`, `services/chatService.ts`, `OrderStatusAnswers.tsx`, `StockInquiry.tsx`, `ProductHelp.tsx` |

**Khi nào có tác dụng:** khi chức năng **chat** của tenant có engine thật. Production hiện là Stub, nên chưa đổi gì với khách. Đề xuất gán Haiku cho chat và Sonnet cho rag, sau khi PM duyệt kho kiến thức.

## 2. Kiểm thử

| Bộ | Kết quả |
|---|---|
| Unit mới: bộ kiểm 13 · viết lại 7 · card-note 8 · scenario +2 | Xanh |
| E2E chat (Stub): 09, 10, 11, 12 | 39 / 39; sau khi thêm Popular: 10 + 11 = 23 / 23 |
| API toàn bộ, typecheck, build | Xem §3 |

## 3. Trạng thái triển khai

| Bước | Ai | Trạng thái |
|---|---|---|
| 1. Push (không có SQL). Kiểm trước: không có re-sync đơn nào đang chạy | Tôi | ⏳ |
| 2. Kiểm chỉ đọc: `POST /chat/card-note` trả `{text:null}` khi Stub; widget không đổi | Tôi | ⏳ |
| 3. Gán engine: Haiku → chat, Sonnet → rag (sau khi PM duyệt kho kiến thức) | Chủ dự án bảo | ⏳ |
| 4. Kiểm khi đã bật AI (TCR §3) | Tôi | ⏳ |
