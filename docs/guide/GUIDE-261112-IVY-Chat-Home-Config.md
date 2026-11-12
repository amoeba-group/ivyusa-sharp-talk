# GUIDE-261112 — Đặt cấu hình màn Chat của IVY trên production (T08)

Dành cho: chủ dự án / quản trị console của IVY. Làm **sau khi** T08 đã deploy, tức `~/ivy-autodeploy.log` có `Deployed.` cho commit T08.

Code T08 không tự đổi màn Chat của IVY: lời chào, các nút và chữ trong ô nhập là **cấu hình của tenant**. Seed chỉ đặt chúng cho DB mới (local / CI). Làm theo 3 phần dưới đây, mất khoảng 15 phút. Mỗi phần lưu riêng và có hiệu lực ngay, không cần deploy lại.

Đăng nhập console bằng tài khoản **Master** của tenant ivyusa.

## 1. Lời chào và chữ trong ô nhập

**Tenant Settings** → khối hành vi widget → chọn **Language to edit** lần lượt từng ngôn ngữ. Với mỗi ngôn ngữ, điền 3 ô:

- **First-visit welcome message**
- **Signed-in greeting**: thiết kế không gọi tên khách, nên điền giống ô trên;
- **Chat input placeholder**: ô mới của T08.

Bấm **Save** sau khi điền xong cả 6 ngôn ngữ.

| Ngôn ngữ | First-visit welcome message = Signed-in greeting | Chat input placeholder |
|---|---|---|
| EN | `Hi! This is IVY Beauty. How can I help you?` | `Ask Anything` |
| KO | `안녕하세요! IVY Beauty입니다. 무엇을 도와드릴까요?` | `무엇이든 물어보세요` |
| ES | `¡Hola! Somos IVY Beauty. ¿En qué podemos ayudarte?` | `Pregunta lo que quieras` |
| VI | `Xin chào! Đây là IVY Beauty. Chúng tôi có thể giúp gì cho bạn?` | `Hỏi bất cứ điều gì` |
| JA | `こんにちは！IVY Beautyです。どのようなご用件でしょうか？` | `何でも聞いてください` |
| ZH | `您好！这里是 IVY Beauty。有什么可以帮您？` | `随便问问` |

## 2. Kiểu nút và dòng công bố AI

**Tenant Settings** → khối **Custom widgets**.

- **Đang dùng một custom widget** ("Custom … in use"): bấm **Edit** trên thiết kế đó. Thận trọng hơn thì **Duplicate** trước rồi sửa bản sao.
- **Đang dùng Basic widget**: bấm **Create custom widget**, rồi đặt lại các mục T01 đã chốt: **Corners** = Large (16px), **Panel size** rộng 380.

Trong form, đặt 2 mục:

| Mục | Giá trị |
|---|---|
| **Quick-reply style** | **White outlined chips (emoji or icon)** |
| **AI disclosure placement** | **One line under the composer** |

Bấm **Save and use**. Nếu console hỏi "This design is in use — saving changes the storefront immediately", chọn tiếp tục.

## 3. Bảy nút trả lời nhanh

**AI Settings** → khối **Scenario buttons**.
- Mỗi nút có ô **Emoji**, **Label**, **Action**.
- Nhãn gõ vào chỉ áp cho **ngôn ngữ đang chọn** ở đầu khối. Muốn nhãn đủ 6 ngôn ngữ thì đổi ngôn ngữ và gõ lại.
- Thứ tự nút trên widget là thứ tự trong danh sách.

Trước khi sửa, **chụp ảnh khối này** để có thể hoàn tác (§5). Sửa hoặc thêm cho đủ 7 nút theo đúng thứ tự dưới đây, rồi bấm **Save**.

**Nút cũ không có trong bảng, như My Orders, Affiliate:** màn đầu trong thiết kế chỉ có 7 nút. Hai kịch bản này (SCR-IVY-11, SCR-IVY-14) sẽ được T09 / T12 chốt chỗ vào.
- **Muốn đúng thiết kế ngay:** tắt các nút đó. Khách sẽ không vào được 2 kịch bản này cho tới T09 / T12.
- **Muốn giữ cho khách dùng:** để bật và kéo xuống sau 7 nút. Màn đầu sẽ có 9 chip.

| # | Emoji | Action | EN | KO | ES | VI | JA | ZH |
|---|---|---|---|---|---|---|---|---|
| 1 | 💰 | Send a message | Payment check | 결제 확인 | Verificar pago | Kiểm tra thanh toán | お支払い確認 | 付款确认 |
| 2 | 🚚 | Delivery status | Delivery inquiry | 배송 문의 | Consulta de envío | Hỏi về giao hàng | 配送のお問い合わせ | 配送咨询 |
| 3 | 📦 | Send a message | Stock inquiry | 재고 문의 | Consulta de stock | Hỏi về tồn kho | 在庫のお問い合わせ | 库存咨询 |
| 4 | 😊 | Cancel / Refund | Exchange & Refund | 교환 및 환불 | Cambios y reembolsos | Đổi trả & hoàn tiền | 交換・返金 | 换货与退款 |
| 5 | ✨ | Product help | Product inquiry | 제품문의 | Consulta de producto | Hỏi về sản phẩm | 商品のお問い合わせ | 商品咨询 |
| 6 | 💬 | Send a message | Feedback | 피드백 | Comentarios | Góp ý | ご意見 | 意见反馈 |
| 7 | 🤝 | Contact support | Contact Support | Contact Support | Contactar con soporte | Liên hệ hỗ trợ | サポートに問い合わせ | 联系客服 |

Bản KO của thiết kế giữ "Contact Support" bằng tiếng Anh, nên ô KO của nút 7 cũng điền tiếng Anh.

## 4. Kiểm tra

Mở widget trên ivyusa.com (hoặc talk.ivyusa.com) → tab **Chat**:

- [ ] Bong bóng chào: "Hi! This is IVY Beauty. How can I help you?". Đổi sang 한국어 thì thấy câu KO.
- [ ] 7 chip trắng, viền mảnh, emoji đứng đầu, đúng thứ tự trên. KO: 3 chip mỗi hàng.
- [ ] Ô nhập ghi "Ask Anything"; nút gửi mờ khi ô trống.
- [ ] Dòng "AI-generated replies · …" nằm dưới ô nhập, chữ nhỏ.
- [ ] Bấm 🚚 Delivery inquiry → widget hỏi về đơn / giao hàng như trước.

## 5. Hoàn tác

- **Phần 1:** xoá chữ trong các ô rồi **Save**. Widget quay về chữ mặc định ("Hi! Welcome to … / Type a message…").
- **Phần 2:** dùng lại thiết kế trước (**Use**), hoặc Basic widget.
- **Phần 3:** lịch sử thay đổi của AI Settings chỉ lưu persona, rules và câu trả lời kịch bản, **không lưu các nút**. Vì vậy **chụp ảnh khối Scenario buttons trước khi sửa**; muốn hoàn tác thì nhập lại theo ảnh rồi **Save**.
