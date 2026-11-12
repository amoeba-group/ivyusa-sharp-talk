# GUIDE-261112 — Đặt cấu hình Product Help của IVY trên production (T10)

Dành cho: chủ dự án / quản trị console của IVY. Làm **sau khi** T10 đã deploy, tức `~/ivy-autodeploy.log` có `Deployed.` cho commit T10.

Code T10 không tự đổi dữ liệu của IVY. Hai thứ sau là **cấu hình của tenant**; seed chỉ đặt chúng cho DB mới (local / CI):
- 11 danh mục của "Popular products";
- câu trả lời Exchange / Return và Cancel order.

Làm theo 4 phần dưới đây, mất khoảng 20 phút. Mỗi phần lưu riêng và có hiệu lực ngay, không cần deploy lại.

Đăng nhập console bằng tài khoản **Master** của tenant ivyusa, mở **AI Settings**.

## 1. Mười một danh mục

Khối **Scenario buttons** → nút **Product inquiry** (Action: Product help). Ngay dưới nút có bảng mới **Product categories**.

Bấm **Add category** 11 lần, điền theo đúng thứ tự dưới đây, rồi bấm **Save** của khối:
- **Name:** chỉ cần gõ ở một ngôn ngữ. Ngôn ngữ chưa gõ sẽ dùng tên đã gõ, đúng như thiết kế KO vẫn để tên tiếng Anh.
- **Shopify collection:** dán cả URL cũng được, ví dụ `https://ivyusa.com/collections/nails`. Rời ô thì console tự rút còn `nails`.

| # | Name | Shopify collection |
|---|---|---|
| 1 | Hair | `hair` |
| 2 | Makeup | `makeup-main` |
| 3 | Nails | `nails` |
| 4 | Face & Body | `face-body-care-main` |
| 5 | Lashes | `lashes` |
| 6 | For Men | `for-men` |
| 7 | Fragrance | `fragrance` |
| 8 | Fashion | `fashion` |
| 9 | For Kids | `for-kids` |
| 10 | Wellness | `wellness` |
| 11 | K-Beauty | `k-beauty` |

Collection lấy từ link trên menu ivyusa.com (khảo sát 2026-11-12). Nếu sau này cửa hàng đổi menu, chỉ cần sửa cột này.

Console báo lỗi đỏ và **không lưu** khi một dòng thiếu tên hoặc collection không hợp lệ.

## 2. Câu trả lời Exchange / Return

Khối **Built-in conversations** → dòng `return_exchange` → **View / edit**.

1. Ở mỗi ngôn ngữ (thanh **Language**), thay **Reply text** bằng câu trong bảng dưới.
2. **Follow-up chips:** xoá các chip đang có, thêm 2 chip theo thiết kế:

   | action id | label EN | KO | ES | VI | JA | ZH |
   |---|---|---|---|---|---|---|
   | `track_delivery` | Track delivery | 배송 조회 | Seguir envío | Theo dõi giao hàng | 配送状況 | 查询物流 |
   | `cancel_order` | Cancel order | 주문 취소 | Cancelar pedido | Huỷ đơn hàng | 注文キャンセル | 取消订单 |

   Không cần thêm "Start over": widget tự thêm vào mọi câu trả lời có chip.
3. Bấm **Save** của khối.

Nội dung theo [ivyusa.com/policies/refund-policy](https://ivyusa.com/policies/refund-policy) (đọc ngày 2026-11-12):

| Ngôn ngữ | Reply text |
|---|---|
| EN | Returns are accepted within 10 days of delivery for items bought on ivyusa.com. Products must be unopened, unused, and in their original packaging with all seals intact. To start a return, sign in at account.ivyusa.com and select "Request return" on the order. Return shipping is $6.95, deducted from your refund. Clearance, final-sale, free gift, and opened, used, or swatched items can't be returned. |
| KO | 교환·반품은 수령 후 10일 이내 신청 가능합니다. 제품은 미개봉·미사용 상태로 원래 포장과 씰이 그대로 있어야 합니다. account.ivyusa.com에 로그인해 해당 주문에서 "Request return"을 선택해 주세요. 반품 배송비 $6.95는 환불 금액에서 차감됩니다. 클리어런스·파이널 세일·사은품, 개봉·사용·테스트한 제품은 반품이 불가합니다. |
| ES | Aceptamos devoluciones dentro de los 10 días posteriores a la entrega para artículos comprados en ivyusa.com. Los productos deben estar sin abrir, sin usar y en su empaque original con todos los sellos intactos. Para iniciar una devolución, inicia sesión en account.ivyusa.com y selecciona "Request return" en el pedido. El envío de devolución cuesta $6.95 y se descuenta del reembolso. No se aceptan devoluciones de artículos en liquidación o venta final, regalos promocionales ni productos abiertos, usados o probados. |
| VI | Bạn có thể trả hàng trong vòng 10 ngày kể từ khi nhận, với sản phẩm mua trên ivyusa.com. Sản phẩm phải chưa mở, chưa sử dụng, còn nguyên bao bì và tem niêm phong. Để yêu cầu trả hàng, hãy đăng nhập account.ivyusa.com và chọn "Request return" ở đơn hàng. Phí gửi trả $6.95 được trừ vào số tiền hoàn. Hàng thanh lý, hàng final sale, quà tặng khuyến mãi và sản phẩm đã mở, đã dùng hoặc đã thử không được trả lại. |
| JA | ivyusa.comでご購入の商品は、お受け取りから10日以内であれば返品を承ります。商品は未開封・未使用で、シールが付いた元のパッケージのままである必要があります。返品はaccount.ivyusa.comにログインし、該当のご注文で「Request return」を選択してお申し込みください。返送料$6.95は返金額から差し引かれます。クリアランス・ファイナルセール品、プロモーションのギフト、開封・使用・試用済みの商品は返品いただけません。 |
| ZH | 在 ivyusa.com 购买的商品，可在收货后 10 天内申请退货。商品须未开封、未使用，并保持原包装及封条完好。请登录 account.ivyusa.com，在相应订单中选择"Request return"申请退货。退货运费 $6.95 将从退款中扣除。清仓或最终特卖商品、促销赠品，以及已开封、已使用或已试色的商品不支持退货。 |

Câu này cũng là câu trả lời khi khách bấm "Return or exchange" ở chỗ khác (ví dụ sau nút Exchange & Refund), vì chúng chạy cùng kịch bản.

## 3. Câu trả lời Cancel order

Cùng khối → dòng `cancel_order` → **View / edit** → thay **Reply text** ở mỗi ngôn ngữ, giữ nguyên chip, bấm **Save**.

| Ngôn ngữ | Reply text |
|---|---|
| EN | To cancel an order, email hello@ivyusa.com as soon as possible. Orders can't be changed once placed: if you need a change, the order is canceled (when still possible) and you place a new one. |
| KO | 주문을 취소하시려면 가능한 한 빨리 hello@ivyusa.com으로 이메일을 보내 주세요. 주문 후에는 내용을 변경할 수 없어요. 변경이 필요하시면 기존 주문을 취소(가능한 경우)한 뒤 새로 주문해 주세요. |
| ES | Para cancelar un pedido, escribe a hello@ivyusa.com lo antes posible. Los pedidos no se pueden modificar una vez realizados: si necesitas un cambio, se cancela el pedido (si aún es posible) y haces uno nuevo. |
| VI | Để huỷ đơn, hãy gửi email tới hello@ivyusa.com càng sớm càng tốt. Đơn đã đặt thì không sửa được: nếu cần thay đổi, đơn cũ sẽ được huỷ (nếu còn kịp) và bạn đặt đơn mới. |
| JA | ご注文をキャンセルされる場合は、できるだけ早く hello@ivyusa.com までメールでご連絡ください。ご注文後の内容変更はできません。変更が必要な場合は、ご注文をキャンセル（可能な場合）のうえ、新たにご注文ください。 |
| ZH | 如需取消订单，请尽快发送邮件至 hello@ivyusa.com。订单一经提交便无法修改；如需更改，请先取消原订单（如仍可取消），再重新下单。 |

## 4. Kiểm tra KB (để AI không nói ngược)

Khi khách **gõ** câu hỏi đổi trả thay vì bấm chip, AI trả lời theo KB. KB local có cả tài liệu "7 ngày" lẫn "30 ngày, gently used". Nếu KB production cũng có, AI có thể nói sai chính sách.

Vào **Knowledge**, tìm `return`, `refund`, `30 days`. Tắt hoặc sửa mọi tài liệu khác chính sách 10 ngày, ví dụ "CS Policy — Returns (US Cosmetics Standard)".

## 5. Kiểm tra trên widget

Mở talk.ivyusa.com, tab **Chat**:

| Bấm | Phải thấy |
|---|---|
| ✨ Product inquiry | Bong bóng của bạn "Product inquiry" → "What do you need help with?" → chip Popular products · How to use · Ingredients · Exchange / Return · Restock alert · Start over |
| Popular products | 11 chip danh mục + Start over |
| Nails | Tối đa 5 thẻ sản phẩm có ảnh và giá; bấm thẻ mở trang sản phẩm. Có link "See all Nails on ivyusa.com" |
| Exchange / Return | Câu 10 ngày ở §2 + chip Track delivery · Cancel order · Start over |

**Nếu thấy "I couldn't load the popular … products right now":**
- Xem log API (`docker logs` của container api) tìm dòng `popular "nails" unavailable (…)`.
  - `Access denied` / `access scope`: app Shopify chưa được cấp lại quyền `read_products`. Cài lại app (re-authorise) trên Shopify admin.
  - `no Shopify connection`: tenant chưa kết nối Shopify trong console (Integrations).
  - `collection "…" not found on the store`: collection ở §1 gõ sai.
- Lỗi được nhớ 1 phút; sửa xong đợi 1 phút rồi thử lại. Kết quả đúng được nhớ 15 phút.

## 6. Hoàn tác

- **Danh mục:** xoá các dòng ở §1 rồi **Save**. Chip Popular products biến mất, phần còn lại của Product Help vẫn chạy.
- **Câu trả lời:** trong **Built-in conversations**, mở `return_exchange` / `cancel_order` và dùng nút khôi phục về câu mặc định, rồi **Save**.
- **Lịch sử:** mỗi lần Save được ghi lại ở khối **Configuration history** của AI Settings.
