# PLN-261118 — Màn Chat của IVY theo đúng thiết kế: bỏ nút đính kèm, bỏ dòng dưới ô nhập, chữ trắng trên nền xanh

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-18** (`1. ok 2. a 3. a 4. a`; chủ dự án xác nhận màu bong bóng trong Figma là `#2B7FFF`) và đã làm — [RPT-261118](../implementation/RPT-261118-IVY-Chat-Composer-Match-Design.md) |
| Nguồn | Chủ dự án, 2026-11-18, sau khi xem bản Preview: ô nhập không có nút Attach; bong bóng của khách phải là nền xanh chữ trắng; dòng "AI-generated replies · processed in the United States · End chat" không có trong thiết kế |
| Phạm vi | `packages/types` (tuỳ chọn thiết kế), `apps/api` (kiểm tra đầu vào, seed), `apps/web` (trình sửa Custom widget, 6 ngôn ngữ), `apps/widget`, `e2e` |
| Migration | Không có SQL (tuỳ chọn nằm trong JSON thiết kế widget sẵn có) |
| Thay thế | SPEC Q-13 ("giữ dòng công bố AI"), Q-14 ("giữ nút đính kèm"), G-13, G-14 |

## 1. Hiện trạng và vì sao nó như vậy

Cả ba điểm đều đã được ghi trong `ivy-docs/SPEC.md` là **khác thiết kế có chủ ý** ở đợt T08; không phải nhầm lẫn khi làm.

| # | Thiết kế | Đang chạy | Lý do đã ghi |
|---|---|---|---|
| 1 | Ô nhập "Ask Anything" không có nút đính kèm (G-13) | Có nút kẹp giấy bên trái ô nhập | Q-14: "Giữ (thiết kế không cấm)" |
| 2 | Không có dòng nào dưới ô nhập (G-14) | "AI-generated replies · processed in the United States" + liên kết **End chat** khi đang chat | Q-13: "Giữ (pháp lý), thu gọn 1 dòng" |
| 3 | Bong bóng của khách: nền xanh (~#2F80ED), **chữ trắng** (SPEC §4) | Nền xanh `#2B7FFF`, **chữ tối** | Widget tự chọn màu chữ theo độ tương phản: trắng trên `#2B7FFF` đạt 3,7:1, dưới mức 4,5:1 của WCAG AA, nên nó chọn chữ tối. Quy tắc này áp cho mọi nút nền xanh (Accept, Send…) |

Tôi không mở lại được Figma (hết lượt gọi của gói Starter), nên ba dòng "Thiết kế" ở trên dựa vào ghi chú của SPEC và mô tả của chủ dự án.

**Vì sao không dùng Custom CSS của tenant:** bộ lọc CSS của hệ thống cố ý cấm mọi thuộc tính làm ẩn phần tử (`display`, `visibility`…), để không ai ẩn được thông báo đồng ý. Ẩn nút và ẩn dòng chữ vì vậy phải là tuỳ chọn thiết kế có tên.

## 2. Thiết kế kỹ thuật

Thêm ba tuỳ chọn vào **Custom widget** (thiết kế widget của tenant), mặc định giữ nguyên hành vi cũ cho mọi tenant khác:

| Tuỳ chọn | Giá trị mới | Tác dụng |
|---|---|---|
| Composer attach icon | thêm **None** | Ẩn nút đính kèm và ô chọn file. Khách không gửi ảnh / file qua chat được nữa |
| AI disclosure position | thêm **Hidden** | Không vẽ dòng công bố AI ở cả hai vị trí. Liên kết **End chat** nằm trong dòng đó nên mất theo |
| Text on brand colour (mới) | **Automatic** (mặc định) · **Always white** | "Always white": chữ và biểu tượng trên mọi nền màu thương hiệu là trắng: bong bóng của khách, Accept, Send, các nút chính |

Sau khi deploy: đặt ba tuỳ chọn cho thiết kế đang dùng của tenant ivyusa trên production (console), và đặt giống vậy trong seed để local / CI khớp production.

### Sau khi bỏ "End chat", khách kết thúc chat bằng gì
- Nút **End** / **종료** trong các kịch bản (BR-12), như thiết kế.
- Nút ✕ của khung: khi đang chat, widget hỏi kết thúc và xin đánh giá (đã có).

## 3. Wireframe

```
WIDGET — Chat, hiện nay                      WIDGET — Chat, theo thiết kế
┌──────────────────────────────┐            ┌──────────────────────────────┐
│ Hi, Kiho          🌐EN ⚙ ✕ │            │ Hi, Kiho          🌐EN ⚙ ✕ │
│ Notifications │ Chat         │            │ Notifications │ Chat         │
│ ( Hi! This is IVY Beauty… )  │            │ ( Hi! This is IVY Beauty… )  │
│              ┌─────────────┐ │            │              ┌─────────────┐ │
│              │ My Orders   │ │ chữ tối    │              │ My Orders   │ │ chữ TRẮNG
│              └─────────────┘ │            │              └─────────────┘ │
│ 📎 [ Ask Anything        ] ➤│            │ [ Ask Anything            ] ➤│
│ AI-generated replies · … ·   │            └──────────────────────────────┘
│                    End chat  │
└──────────────────────────────┘

CONSOLE — Tenant Settings → Widget → Custom widgets → Edit
  Composer attach icon     [ Paperclip ▾ ]   → thêm lựa chọn "None (no attachments)"
  AI disclosure position   [ Bottom    ▾ ]   → thêm lựa chọn "Hidden"
  Text on brand colour     [ Automatic ▾ ]   ← ô mới: Automatic · Always white
```

## 4. Ảnh hưởng phụ: ba điều chủ dự án cần biết trước khi duyệt

1. **Bỏ dòng công bố AI.** SPEC ghi dòng này là "bắt buộc pháp lý", và hệ thống cố ý không cho tenant ẩn thông báo bằng CSS. Sau khi bỏ, khách vẫn được báo về AI ở hai chỗ: **khung đồng ý** hiện ở lần đầu mở Chat ("AI: messages are processed by a third-party AI provider in the United States", phải bấm Accept), và **Settings → Chat & AI consent**. Nhưng trong lúc chat sẽ không còn dòng nào nhắc rằng câu trả lời do AI viết. Tôi không đánh giá được việc đó có đủ theo luật của các bang ở Mỹ hay không; đây là quyết định của IVY, nên hỏi người phụ trách pháp lý nếu có.
2. **Chữ trắng trên nền `#2B7FFF` có độ tương phản 3,7:1**, dưới mức 4,5:1 của WCAG AA cho chữ cỡ thường. Thiết kế vẽ như vậy. Các trang bán hàng ở Mỹ hay bị khiếu nại về khả năng tiếp cận, nên đây là rủi ro cần cân nhắc. Phương án giữ được cả chữ trắng lẫn AA: đổi màu thương hiệu sang xanh đậm hơn `#2563EB` (màu thiết kế dùng cho header Settings; trắng đạt 5,2:1). Khi đó widget tự chọn chữ trắng, không cần tuỳ chọn mới.
3. **Bỏ nút đính kèm** thì khách không gửi được ảnh sản phẩm lỗi / hỏng qua chat. Đường còn lại: form Contact Support (gửi email).

## 5. Kiểm thử

- **Unit:** bộ chuẩn hoá thiết kế nhận ba giá trị mới và loại giá trị lạ; API từ chối giá trị ngoài danh sách; widget ẩn nút đính kèm / dòng công bố theo tuỳ chọn; "Always white" đặt đúng màu chữ.
- **E2E IVY:** sửa các ca T08 đang kỳ vọng nút đính kèm và dòng công bố; thêm ca: ô nhập không có nút đính kèm, không có chữ dưới ô nhập, bong bóng của khách chữ trắng `rgb(255, 255, 255)`.
- **`i18n:check`** cho 6 ngôn ngữ của console.
- **Production sau khi đặt tuỳ chọn:** kiểm trên bản Preview của theme nháp, desktop và điện thoại.

## 6. Việc ngoài code: chuông trên header (chủ dự án sửa theme)

Chuông cách giỏ hàng xa hơn các biểu tượng khác vì `margin-left: 12px` trong đoạn CSS tôi đưa. Đo trên bản Preview: nhóm biểu tượng đã tự cách nhau 16px (điện thoại) / 24px (desktop); chuông đang là 28px / 36px. **Xoá `margin-left:12px;`** trong khối `<style>` của `#st-bell` (file `sections/header.liquid`) là đúng.

## 7. Cần chủ dự án quyết

1. **Duyệt hướng làm ở mục 2?**
2. **Dòng công bố AI và End chat** (xem mục 4.1):
   - a. Bỏ cả hai, đúng thiết kế.
   - b. Bỏ **End chat**, giữ dòng công bố AI một dòng nhỏ.
3. **Chữ trắng trên nền xanh** (xem mục 4.2):
   - a. Giữ màu `#2B7FFF`, ép chữ trắng (đúng thiết kế, tương phản 3,7:1).
   - b. Đổi màu thương hiệu sang `#2563EB`, chữ tự thành trắng (đạt AA; màu xanh đậm hơn thiết kế một chút).
   - c. Chủ dự án gửi mã màu xanh chính xác của bong bóng trong Figma, tôi dùng đúng màu đó và báo lại độ tương phản.
4. **Nút đính kèm** (xem mục 4.3): a. Bỏ, đúng thiết kế. b. Giữ.
