# PLN-261112 — IVY T11 · Contact Support và form liên hệ

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-12** (`1. ok 2. a 3. a 4. a`) và đã làm — [RPT-261113](../implementation/RPT-261113-IVY-T11-Contact-Form.md) |
| Task | [ivy-docs/TASKS.md T11](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-13 · G-17 · G-18 · BR-14 · BR-15 · BUG-010 · BUG-024 (phần Contact) · Q-08 · Q-15 |
| Figma | `1006:5650` (kênh), `1006:6529` (form), `1006:6597` (đã gửi). Figma MCP hết lượt gọi; dựa vào SPEC. Nếu tiện, gửi ảnh 3 frame này |
| TC | TC-11-01..04 ([e2e/tests/11-contact.spec.ts](../../e2e/tests/11-contact.spec.ts)), baseline **0/4** |
| Migration | **Có:** `sql/migration_inquiry_contact_form.sql` thêm 4 cột vào `inquiries`. Phải chạy trên production **trước khi push** (§6) |
| Deploy | Bạn chạy SQL → báo mình → mình push → CI → server tự deploy. Đổi `apps/api`, `apps/widget`, `apps/web` |

## 1. Hiện trạng → mục tiêu

| | Thiết kế (SPEC SCR-IVY-13) | Hiện tại |
|---|---|---|
| Bấm 🤝 Contact Support | "Please choose how you'd like to reach us." → **một thẻ** 📧 Email inquiry · Open 24 hours · Reply within 1 business day · địa chỉ email → chip Start over | 3 thẻ: điện thoại **1588-0000**, email **help@ivy.com**, live chat. Cả hai giá trị **viết cứng trong file ngôn ngữ**, nên hiện cho **mọi tenant** (BUG-010) |
| Bấm thẻ email | Bot "Please enter your contact information and tell us how we can help." → form **Name · Email (điền sẵn) · Message** + nút **Send Message** | Chỉ là link `mailto:` |
| Gửi | Thẻ "YOUR INQUIRY" (tên, email, nội dung) phía khách + "Your message has been sent successfully. Our support team will review your inquiry and reply to the email address you provided. Please check your inbox for our response." | — |
| Phía API | Tạo inquiry, trả lời qua email (BR-14) | `POST /inquiries` có, nhưng **không nhận** tên / email / nội dung. Bảng không có cột cho chúng. Console **không có trang** xem inquiry |
| Vị trí trong luồng chat | Câu trả lời nằm đúng chỗ được hỏi | Thẻ Contact nằm ở ô cố định cuối luồng (BUG-024) |

## 2. Phát hiện khi khảo sát

1. **Email hỗ trợ thật của IVY** trên trang chính sách ivyusa.com là **hello@ivyusa.com**. Thiết kế ghi `help@ivy.com` (Q-08).
2. **Bảng `inquiries`** chỉ có tenant, khách, cuộc chat, đơn, trạng thái. Lưu được tên / email / nội dung thì **phải thêm cột**.
3. **Email của khách** ở bảng `customers` được mã hoá (`piiTransformer`). Email trong inquiry cũng phải mã hoá như vậy.
4. **Xoá dữ liệu cá nhân** (GDPR/CCPA) hiện chỉ gỡ liên kết inquiry khỏi khách. Khi inquiry có tên / email / nội dung thì phải xoá luôn 3 trường này, và đưa chúng vào bản xuất dữ liệu (DSAR).
5. **Widget chưa biết email của khách** để điền sẵn: phiên chỉ trả tên khách.
6. **Gửi mail cần SMTP.** API có sẵn bộ gửi mail, nhưng không cấu hình `SMTP_HOST` thì nó lặng lẽ bỏ qua. Mình **không biết production đã cấu hình chưa** (máy dev không vào được server).

## 3. Quyết định thiết kế

**D1 — Kênh liên hệ lấy từ cấu hình tenant** (G-17, BUG-010).
- Tenant Settings có thêm khối **Contact Support**: email hỗ trợ, số điện thoại, bật/tắt thẻ live chat.
- Lưu trong cột JSON `widget_copy` đã có, nên **không cần SQL cho phần này**.
- Widget chỉ hiện thẻ nào tenant đã điền:
  - **Email:** có địa chỉ → thẻ "Email inquiry" (mở form, D2).
  - **Điện thoại:** có số → thẻ gọi điện.
  - **Live chat:** bật → thẻ "Chat with an agent".
- Tenant không điền gì thì còn mỗi thẻ live chat, để nút không trống.
- Bỏ `1588-0000` và `help@ivy.com` khỏi 6 file ngôn ngữ.
- Câu "Open 24 hours" và "Reply within 1 business day" là câu chữ chung của widget, có đủ 6 ngôn ngữ.

**D2 — Form liên hệ trong luồng chat** (G-18, BR-14).
- Gồm Name, Email, Message, đều bắt buộc. Email kiểm định dạng. Nội dung tối đa 2000 ký tự.
- Khách đã đăng nhập: điền sẵn tên và email; khách vẫn sửa được.
- Lỗi hiện ngay dưới ô, không gọi API.
- Gửi thành công: thẻ "YOUR INQUIRY" phía khách + bong bóng xác nhận như thiết kế.
- Gửi lỗi: toast lỗi, form giữ nguyên nội dung.
- Thẻ Contact, form và thẻ đã gửi gắn vào vị trí trong luồng (BUG-024), như My Orders ở T09.

**D3 — API `POST /inquiries` nhận `{ name, email, message }`.**
- Nếu khách chưa đồng ý quyền riêng tư (consent): từ chối, giống chỗ lưu email khi hết giờ.
- Khách chưa đăng nhập: tạo "lead" từ email, như luồng email hết giờ hiện có. Nhờ vậy inquiry gắn với khách và xoá được theo GDPR.
- Mỗi phiên gửi tối đa 5 inquiry mỗi giờ, để chặn spam.
- Email lưu mã hoá. Log không ghi email hay nội dung.

**D4 — Console có trang Inquiries.**
- Đặt trong nhóm Consult; người có quyền Consult mới xem được.
- Danh sách: thời gian, tên, email, nội dung (rút gọn), trạng thái Open / Answered.
- Mở một inquiry:
  - **Reply by email:** mở trình mail của nhân viên với địa chỉ khách, tiêu đề "Re: Your inquiry", trích nội dung;
  - **Mark answered:** chuyển trạng thái, có toast xác nhận.
- Đọc inquiry có ghi audit (xem PII).

**D5 — Báo cho team:** xem §8-4.

**D6 — Ô nhập sau khi gửi:** giữ placeholder của tenant ("Ask Anything", T08). Thiết kế đổi thành "Type your message", nhưng hai chữ cùng nghĩa, và đổi theo trạng thái sẽ phải thêm một cấu hình nữa.

## 4. Wireframe

**Widget, tab Chat, 380px:**

```
│                     ┌─────────────────┐ │
│                     │ Contact Support │ │ ← bong bóng khách
│                     └─────────────────┘ │
│ (🤖) Please choose how you'd like to     │
│      reach us.                           │
│   ┌──────────────────────────────────┐   │
│   │ 📧 Email inquiry                 │   │ ← bấm → form
│   │ Open 24 hours ·                  │   │
│   │ Reply within 1 business day      │   │
│   │ hello@ivyusa.com                 │   │ ← cấu hình tenant (§8-2)
│   └──────────────────────────────────┘   │
│ ( Start over )                           │
│ (🤖) Please enter your contact           │
│      information and tell us how we      │
│      can help.                           │
│   ┌──────────────────────────────────┐   │
│   │ NAME                             │   │
│   │ [Enter your name               ] │   │
│   │ EMAIL                            │   │
│   │ [hykim4@ivyent.com             ] │   │ ← điền sẵn khi đã đăng nhập
│   │ MESSAGE                          │   │
│   │ [Please describe how we can    ] │   │
│   │ [help you                      ] │   │
│   │ [         Send Message         ] │   │ ← nút đen
│   └──────────────────────────────────┘   │
```

Sau khi gửi (form được thay bằng):

```
│              ┌────────────────────────┐ │
│              │ YOUR INQUIRY           │ │ ← thẻ tối, phía khách
│              │ Name   test            │ │
│              │ Email  hykim4@ivyent…  │ │
│              │ Message dfdfdf         │ │
│              └────────────────────────┘ │
│ (🤖) Your message has been sent          │
│      successfully.                       │
│      Our support team will review your   │
│      inquiry and reply to the email      │
│      address you provided.               │
│      Please check your inbox for our     │
│      response.                           │
│ ( Start over )                           │
```

**Console, Tenant Settings → khối Contact Support (mới):**

```
┌ Contact Support ─────────────────────────────────────────┐
│ Shown when a shopper taps Contact Support in the widget. │
│ Support email   [hello@ivyusa.com        ]               │
│ Support phone   [                        ]  (trống = ẩn) │
│ [ ] Show a "Chat with an agent" card                     │
│                                         [ Save ]         │
└──────────────────────────────────────────────────────────┘
```

**Console, Consult → Inquiries (mới):**

```
┌ Inquiries ───────────────────────────────── [Open ▾] ───┐
│ Received          Name     Email              Status    │
│ Nov 12, 14:03     test     hykim4@ivyent.com  ● Open    │ ← bấm → chi tiết
│ Nov 12, 09:41     Mia K.   mia@example.com    ✓ Answered│
│                                        ‹ 1 2 ›          │
└──────────────────────────────────────────────────────────┘
┌ Inquiry · Nov 12, 14:03 ─────────────────────────────────┐
│ test · hykim4@ivyent.com · EN                            │
│ dfdfdf                                                   │
│ [ Reply by email ]   [ Mark answered ]                   │
└──────────────────────────────────────────────────────────┘
```

## 5. Thay đổi

| Phần | File | Nội dung |
|---|---|---|
| SQL | `sql/migration_inquiry_contact_form.sql` (mới) | `contact_name VARCHAR(100)`, `contact_email VARBINARY(512)` (mã hoá), `message TEXT`, `language VARCHAR(8)`, tất cả nullable. Có câu rollback |
| API | `inquiry/entity`, DTO, service, mapper, controller | Nhận và kiểm `name` / `email` / `message`; consent; lead cho khách chưa đăng nhập; giới hạn 5/giờ; danh sách admin có tên / email / nội dung; audit khi xem |
| API | `privacy/privacy.service.ts` | Xoá dữ liệu: xoá cả tên / email / nội dung của inquiry. DSAR: xuất 3 trường này |
| API | `session` mapper / service, `packages/types` | Phiên trả thêm `customerEmail` (chỉ của chính khách đó) để điền sẵn form |
| API | `tenant` entity / DTO / service / mapper | `widget_copy` thêm `supportEmail`, `supportPhone`, `contactLiveChat`. Kiểm định dạng email |
| API | `database/seed.runner.ts` | IVY: email theo §8-2; thẻ live chat theo §8-3 |
| API | thông báo cho team (nếu §8-4a) | Gửi mail tới email hỗ trợ, **Reply-To = khách**; không có SMTP thì bỏ qua và ghi log một lần |
| Widget | `chat/ContactCard.tsx`, `chat/ContactForm.tsx` (mới), `chat/ChatTab.tsx` | Thẻ theo cấu hình; form; thẻ "YOUR INQUIRY"; gắn vị trí trong luồng; chip Start over |
| Widget | `services`, `i18n/locales/*.ts` ×6 | Gọi `POST /inquiries`. Câu chữ mới; bỏ số / email viết cứng |
| Console | `domain/inquiries/*` (mới), nav, RBAC, i18n ×6 | Trang Inquiries (D4) |
| Console | `settings/SettingsPage.tsx`, i18n | Khối Contact Support |
| E2E | `11-contact.spec.ts`, fixtures | Mock phiên có `customerEmail`; kênh IVY trong mock. Thêm TC-11-05 (thẻ live chat khi tenant bật) và TC-11-06 (gửi lỗi → toast, form giữ nội dung) |
| Docs | ivy-docs, GUIDE | TASKS / TEST-CASES / BUGS (BUG-010, BUG-024) / SPEC; GUIDE: chạy SQL + cấu hình Contact Support trên production |

## 6. Migration và thứ tự deploy

1. Mình viết `sql/migration_inquiry_contact_form.sql`, chạy trên DB local, chạy toàn bộ test.
2. Code xong và xanh hết thì mình **dừng, chưa push**, và gửi bạn đúng lệnh để chạy SQL trên DB production.
   - Code cũ chạy bình thường khi đã có cột mới, nên chạy SQL trước là an toàn.
   - Push code mới khi chưa có cột thì lỗi 500.
3. Bạn chạy xong và báo lại thì mình push.
4. Rollback nếu cần: câu `DROP COLUMN` có sẵn trong file.

## 7. Ảnh hưởng phụ

- **Mọi tenant, ngay sau deploy:**
  - thẻ điện thoại `1588-0000` và email `help@ivy.com` **biến mất** (vốn là giá trị của IVY bị viết cứng);
  - chỉ còn thẻ live chat, cho tới khi tenant điền email / số trong Tenant Settings.
- **IVY:** có đúng thẻ email như thiết kế sau khi bạn nhập email hỗ trợ trên console (GUIDE). Trước đó, Contact Support chỉ có thẻ live chat.
- **Dữ liệu mới:** tên, email (mã hoá) và nội dung khách gửi. Có trong xoá dữ liệu và DSAR.
- Không gửi push / SMS. Chỉ gửi email nếu §8-4a và production có SMTP.

## 8. Xin bạn xác nhận

1. **Duyệt kế hoạch này?** Duyệt thì mình làm và test. Mình sẽ dừng trước khi push để bạn chạy SQL (§6).
2. **Email hỗ trợ hiện trên thẻ của IVY:**
   - **a (khuyến nghị):** `hello@ivyusa.com`, email trên trang chính sách ivyusa.com.
   - **b:** `help@ivy.com`, như trong thiết kế.
   - **c:** địa chỉ khác (bạn ghi rõ).
3. **Thẻ trong Contact Support của IVY:**
   - **a (khuyến nghị):** chỉ thẻ email, đúng thiết kế. Khách vẫn gặp người thật qua chip "Talk to an agent" sau câu trả lời AI.
   - **b:** thẻ email + thẻ "Chat with an agent" (đề xuất Q-15).
4. **Team biết có inquiry mới bằng cách nào:**
   - **a (khuyến nghị):** gửi mail tới email hỗ trợ ở câu 2, Reply-To là email khách, nên team bấm Reply là trả lời được ngay; console cũng có trang Inquiries.
     - Cần production đã cấu hình SMTP. Bạn kiểm bằng `grep SMTP_HOST` trong file `.env` của server.
     - Chưa có SMTP thì mail không đi, chỉ còn trang Inquiries.
   - **b:** chỉ trang Inquiries trên console, không gửi mail.

Trả lời ví dụ: `1. ok  2. a  3. a  4. a`
