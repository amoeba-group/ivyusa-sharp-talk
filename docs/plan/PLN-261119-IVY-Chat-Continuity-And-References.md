# PLN-261119 — Chat của IVY: bong bóng không tự đổi chữ, thẻ còn sau khi chuyển trang, ẩn "Knowledge referenced"

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-19** trong chat (`1. ok 2. a 3. ok`) và đã làm — [RPT-261119](../implementation/RPT-261119-IVY-Chat-Continuity-And-References.md) |
| Nguồn | Chủ dự án thử bản Preview ngày 2026-11-19, sau khi đoạn chat đã được giữ qua các trang (BUG-037): "Delivery inquiry" tự đổi thành "How long does shipping take?"; thẻ Contact Support mất sau khi chuyển trang; danh sách "Knowledge referenced" làm đoạn chat quá dài |
| Phạm vi | `apps/api` (chat scenario, tuỳ chọn thiết kế, seed), `apps/widget`, `apps/web` (một ô trong Custom widget, 6 ngôn ngữ), `packages/types`, `e2e` |
| Migration | Không có SQL |

## 1. Hiện trạng và nguyên nhân

| # | Hiện tượng | Nguyên nhân |
|---|---|---|
| 1 | Bấm nút có kịch bản: bong bóng hiện tên nút, vài giây sau đổi thành một câu hỏi khác | Widget vẽ ngay **tên nút**; server lại lưu **câu soạn sẵn của kịch bản** (`script.utterance`) làm lời của khách. Lần đồng bộ kế tiếp thay bong bóng bằng bản đã lưu (BUG-038) |
| 2 | Thẻ Contact Support, form liên hệ, Product Help, câu trả lời My Orders mất sau khi chuyển trang | Các thẻ này là trạng thái riêng của trang (`inserts` trong `ChatTab`), không phải tin nhắn, chưa bao giờ gửi lên server. Trước BUG-037 cả đoạn chat đều mất nên không ai thấy |
| 3 | Mỗi câu trả lời của AI kéo theo danh sách "Knowledge referenced" | Widget luôn vẽ `citations` khi có; không có công tắc nào |

## 2. Thiết kế

1. **Lời của khách = tên nút đã bấm.** Widget gửi kèm `label`; server lưu nó (gộp khoảng trắng, tối đa 120 ký tự) thay cho câu soạn sẵn, và chỉ dùng câu soạn sẵn khi không có `label`. Kịch bản nào đã chạy vẫn nằm trong `retrievalTrace.scenario`.
2. **Thẻ được nhớ trên trình duyệt của khách (lựa chọn 2a).** `sessionStorage` của khung widget, theo phiên và theo cuộc trò chuyện; khôi phục một lần khi widget tải lại; xoá khi cuộc trò chuyện kết thúc; tối đa 40 thẻ, 24 giờ. Token của phiên không nằm trong khoá lưu trữ. Trình duyệt chặn lưu trữ thì hành vi như cũ.
3. **Tuỳ chọn thiết kế mới `citations: shown | hidden`** (Custom widget → Knowledge references). `hidden` bỏ cả danh sách khỏi màn hình của khách. Đặt `hidden` cho IVY (seed và production).

## 3. Wireframe

```
HIỆN NAY                                   SAU KHI SỬA
┌──────────────────────────────┐          ┌──────────────────────────────┐
│            ┌───────────────┐ │          │            ┌───────────────┐ │
│            │Delivery inquiry│ │ →vài giây│            │Delivery inquiry│ │ giữ nguyên
│            └───────────────┘ │  đổi thành│            └───────────────┘ │
│   "How long does shipping…"  │          │ ( Delivery: Orders ship …  ) │
│ ( Delivery: Orders ship …  ) │          │                              │
│ Knowledge referenced         │          │  (không còn danh sách nguồn) │
│ · Shipping & Delivery        │          │                              │
│ · CS Policy — Refunds …      │          │ ┌ Contact Support ─────────┐ │ còn sau khi
│ · Warranty …                 │          │ │ hello@ivyusa.com …       │ │ chuyển trang
└──────────────────────────────┘          │ └──────────────────────────┘ │
                                           └──────────────────────────────┘

CONSOLE — Custom widgets → Edit
  Knowledge references   [ Shown under each answer ▾ ]   ← ô mới: Shown · Hidden
```

## 4. Ảnh hưởng phụ

- Nhân viên trong console thấy "Delivery inquiry" (tên nút) thay cho câu soạn sẵn ở các hội thoại mới. Hội thoại cũ không đổi.
- Ẩn danh sách nguồn cũng ẩn **link sản phẩm và video** mà AI gợi ý kèm câu trả lời, vì chúng nằm trong cùng danh sách.
- Thẻ chỉ được nhớ trong cùng tab trình duyệt. Đổi máy, đổi trình duyệt hay mở tab mới: tin nhắn còn, thẻ không. Nhân viên vẫn không thấy các lần bấm đó (đó là lựa chọn 2b, chưa làm).
- Nút tuỳ biến kiểu "gửi một câu hỏi" (`message`) không đổi: bong bóng vẫn là câu hỏi của nút.

## 5. Kiểm thử

- Unit: server lưu tên nút / dùng câu soạn sẵn khi thiếu / cắt 120 ký tự; bộ nhớ thẻ (đúng phiên + cuộc trò chuyện, hết hạn, giới hạn 40, lưu trữ bị chặn); tuỳ chọn `citations`.
- E2E: TC-11-07 — thẻ Contact Support còn sau khi tải lại trang.
- Production: đặt Knowledge references = Hidden cho thiết kế đang dùng, kiểm trên bản Preview.
