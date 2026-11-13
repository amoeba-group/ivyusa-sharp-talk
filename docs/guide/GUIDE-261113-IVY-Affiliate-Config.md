# GUIDE-261113 — Affiliate của IVY trên production (T12)

Kèm theo [PLN-261113-IVY-T12](../plan/PLN-261113-IVY-T12-Affiliate-CSAT.md) và [RPT-261113-IVY-T12](../implementation/RPT-261113-IVY-T12-Affiliate-CSAT.md).

Làm **sau khi** T12 đã deploy, tức `~/ivy-autodeploy.log` có dòng `deployed` cho commit T12. **Không có SQL.** Mất khoảng 10 phút. Mỗi phần lưu riêng và có hiệu lực ngay.

Tenant IVY trên production có từ trước, nên seed không tự áp dụng. Chưa làm §1 thì khách không thấy nút Affiliate. Chưa làm §2 thì câu trả lời dùng câu chung, không có "IVY Beauty" và "10%".

Đăng nhập console bằng tài khoản **Master** của tenant ivyusa, mở **AI Settings**.

## 1. Nút thứ 8 "💼 Affiliate"

Khối **Scenario buttons**. Trước khi sửa, **chụp ảnh khối này** để có thể hoàn tác.

- **Đã có nút Action = Affiliate** (nút cũ; GUIDE T08 §3 có thể đã cho tắt): tick **Enabled**, bấm **Move down** cho tới khi nó đứng cuối, rồi sửa Emoji và Label như bảng dưới.
- **Chưa có:** bấm **Add button**, chọn **Action** = **Affiliate**.

| Ô | Giá trị |
|---|---|
| Emoji | 💼 |
| Label | EN `Affiliate` · KO `제휴` · ES `Afiliados` · VI `Cộng tác viên` · JA `アフィリエイト` · ZH `推广合作` |
| Enabled | tick |

- Nhãn gõ vào chỉ áp cho **ngôn ngữ đang chọn** ở đầu khối. Đổi ngôn ngữ rồi gõ lại cho đủ 6.
- Bấm **Save** của khối. Màn chat của khách có 8 chip, Affiliate đứng cuối.

## 2. Câu trả lời Affiliate (IVY Beauty, 10%)

Khối **Built-in conversations** → dòng `affiliate` → **View / edit**.

Ở mỗi ngôn ngữ (thanh **Language**):
1. **Customer's line:** câu ở bảng dưới. Đây là bong bóng của khách sau khi bấm nút.
2. **Reply text:** xoá câu đang có, dán khối tương ứng bên dưới.
   - **Giữ nguyên 3 dòng đánh số** `1. **…** — …`. Widget vẽ 3 dòng đó thành 3 thẻ bước; dòng trên và dòng dưới thành bong bóng.
3. **Follow-up chips:** để trống (mặc định là Apply now · Learn more · End). Widget tự thêm Start over trước End.

Bấm **Save** → toast "Conversation copy saved."

| Ngôn ngữ | Customer's line |
|---|---|
| EN | How to become an Affiliate? |
| KO | 제휴 파트너는 어떻게 되나요? |
| ES | ¿Cómo ser afiliado? |
| VI | Làm sao để trở thành affiliate? |
| JA | アフィリエイトになるには？ |
| ZH | 如何成为推广合作伙伴？ |

**Reply text — EN**
```
Become an IVY Beauty affiliate partner! 💼

1. **Submit an application** — Fill out a short form.
2. **Review (1–3 business days)** — Our team will review it and email you.
3. **Start earning** — Share your own link → earn 10% on every sale!

If you have any questions, just ask!
```

**Reply text — KO** (đúng chữ thiết kế)
```
IVY Beauty 제휴 파트너가 되어주세요! 💼

1. **신청서 제출** — 간단한 양식을 작성해주세요.
2. **심사 (1–3 영업일)** — 팀에서 검토 후 이메일로 안내드려요.
3. **활동 시작 & 수익** — 전용 링크 공유 → 판매 시 10% 적립!

궁금한 점이 있으시면 언제든 물어봐주세요!
```

**Reply text — ES**
```
¡Hazte socio afiliado de IVY Beauty! 💼

1. **Envía tu solicitud** — Completa un formulario breve.
2. **Revisión (1–3 días hábiles)** — Nuestro equipo la revisará y te escribirá por correo.
3. **Empieza a ganar** — Comparte tu enlace personal → ¡gana un 10% por cada venta!

Si tienes alguna pregunta, ¡pregúntanos!
```

**Reply text — VI**
```
Hãy trở thành đối tác affiliate của IVY Beauty! 💼

1. **Gửi đơn đăng ký** — Điền một biểu mẫu ngắn.
2. **Xét duyệt (1–3 ngày làm việc)** — Đội ngũ IVY sẽ xem xét và gửi email cho bạn.
3. **Bắt đầu kiếm tiền** — Chia sẻ đường link riêng → nhận 10% cho mỗi đơn hàng!

Nếu có câu hỏi, bạn cứ hỏi nhé!
```

**Reply text — JA**
```
IVY Beautyのアフィリエイトパートナーになりませんか？💼

1. **申し込み** — 簡単なフォームにご記入ください。
2. **審査（1〜3営業日）** — チームが確認し、メールでご案内します。
3. **活動開始・報酬** — 専用リンクをシェア → 販売ごとに10%を還元！

ご不明な点があれば、いつでもお尋ねください！
```

**Reply text — ZH**
```
欢迎成为 IVY Beauty 的推广合作伙伴！💼

1. **提交申请** — 填写一份简短的表格。
2. **审核（1–3 个工作日）** — 我们的团队审核后会通过邮件通知您。
3. **开始赚取收益** — 分享专属链接 → 每笔销售可获得 10% 返利！

如有任何问题，欢迎随时咨询！
```

## 3. Learn more (tuỳ chọn)

Cùng khối → dòng `affiliate_details`. Câu mặc định là câu chung: affiliate chia sẻ link riêng, nhận hoa hồng khi có người mua qua link, đơn được xét trong 1–3 ngày làm việc, đối tác được duyệt nhận link và điều khoản qua email.

Muốn nói cụ thể hơn (ví dụ 10%, cách nhận tiền), sửa **Reply text** ở đây rồi **Save**.

## 4. Thử trên production

Widget chưa gắn vào ivyusa.com thì mở `https://talk.ivyusa.com/widget/?shop=ivyusa.myshopify.com` (máy / mạng đang vào được console) → **Open support** → **Accept** ở thông báo quyền riêng tư → tab **Chat**.

1. Bấm **💼 Affiliate** → "Become an IVY Beauty affiliate partner! 💼", 3 thẻ bước, chip **Apply now · Learn more · Start over · End**.
2. **Apply now** → form điền sẵn "I'd like to join your affiliate program…" → điền tên → **Send Message**.
   - Tin vào console `https://talk.ivyusa.com/live-chat/alerts?tab=inquiries` và mail tới `hello@ivyusa.com`, giống form liên hệ T11.
3. Bấm Affiliate lần nữa → **End** → "We hope today's chat was helpful…" → thẻ **4 mặt** + **Skip**.
   - Chọn một mặt → "Thank you for your feedback" → "The chat has ended".
   - Hoặc **Skip** → "The chat has ended", không lưu đánh giá.

## 5. Khi có sự cố

| Hiện tượng | Xem |
|---|---|
| Không có nút Affiliate | §1 chưa **Save**, hoặc nút chưa tick **Enabled** |
| Câu trả lời không có "IVY Beauty" / "10%" | §2 chưa lưu ở ngôn ngữ đó. Mỗi ngôn ngữ lưu riêng |
| 3 bước hiện thành danh sách thường, không thành thẻ | Dòng không bắt đầu bằng `1. ` / `2. ` / `3. `, hoặc đã xoá hết chip: thẻ chỉ vẽ cho câu trả lời có chip |
| Bấm Affiliate thấy "Please accept the privacy notice…" | Khách chưa bấm **Accept** ở đầu khung chat. Kịch bản cần consent vì được lưu vào lịch sử chat |
| Apply now gửi lỗi | Như form liên hệ T11: [GUIDE-261113 Contact Support §6](GUIDE-261113-IVY-Contact-Support-Config.md) |
