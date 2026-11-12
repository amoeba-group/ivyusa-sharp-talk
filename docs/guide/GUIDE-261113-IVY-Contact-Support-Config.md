# GUIDE-261113 — IVY Contact Support trên production (T11)

Kèm theo [PLN-261112-IVY-T11](../plan/PLN-261112-IVY-T11-Contact-Form.md) và [RPT-261113-IVY-T11](../implementation/RPT-261113-IVY-T11-Contact-Form.md). Làm theo thứ tự.

## 1. Chạy SQL — TRƯỚC khi code mới lên

Trên `talkaibotprd01` (user `appops`, qua SSM):

```bash
cd /docker/apps/talktalk
docker exec -i sharptalk_mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' <<'SQL'
ALTER TABLE `inquiries`
  ADD COLUMN `contact_name` VARBINARY(512) NULL,
  ADD COLUMN `contact_email` VARBINARY(512) NULL,
  ADD COLUMN `message` VARBINARY(8192) NULL,
  ADD COLUMN `language` VARCHAR(8) NULL;
SQL
docker exec sharptalk_mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SHOW COLUMNS FROM inquiries"'
```

**Đúng** khi bảng có 11 dòng, 4 dòng cuối là:

```
contact_name   varbinary(512)   YES
contact_email  varbinary(512)   YES
message        varbinary(8192)  YES
language       varchar(8)       YES
```

- `ERROR 1060 … Duplicate column name 'contact_name'` = đã chạy rồi. Không sao.
- Chạy SQL trước là an toàn: code đang chạy bỏ qua 4 cột mới.
- Nếu quên: cron chạy `deploy-self-hosted.sh --check` trước khi deploy. Thấy SQL còn thiếu thì nó quay checkout về commit cũ, production vẫn chạy code cũ.
  - `~/ivy-autodeploy.log` ghi `… waiting: deploy check failed …`.
  - File log chi tiết ghi `FAIL — schema changes are outstanding`.
  - Chạy SQL xong thì lần cron sau tự deploy.
- Nội dung giống hệt `sql/261112-inquiry-contact-form.sql` (file có trên server sau khi code được kéo về).

Rollback (chỉ khi phải gỡ T11):

```bash
docker exec sharptalk_mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "ALTER TABLE inquiries DROP COLUMN contact_name, DROP COLUMN contact_email, DROP COLUMN message, DROP COLUMN language"'
```

## 2. Nhập email hỗ trợ trên console — sau khi deploy

Tenant IVY trên production có từ trước, nên giá trị trong seed **không** tự áp dụng.

Console → **Tenant Settings → Widget → Contact Support**:

| Ô | Giá trị |
|---|---|
| Support email | `hello@ivyusa.com` |
| Support phone | để trống |
| Show a "Chat with an agent" card | **không** tick |

Bấm **Save** → toast "Widget settings saved."

Cho tới khi bạn bấm Save, nút Contact Support chỉ có thẻ "Chat with an agent". Thẻ này chỉ hiện khi tenant chưa cấu hình kênh nào, để nút không trống.

## 3. Mail báo cho team

Mỗi form khách gửi sẽ được mail tới `hello@ivyusa.com`, Reply-To là email khách: bấm Reply là trả lời thẳng cho khách. Việc này **cần SMTP** trên server:

```bash
grep -E '^(SMTP_HOST|SMTP_PORT|SMTP_USER|ALERT_EMAIL_FROM)=' docker/self-hosted/.env.self-hosted
```

- `SMTP_HOST` có giá trị: mail đi.
- `SMTP_HOST` trống: không có mail. Inquiry vẫn được lưu và hiện ở console (§4). Log API có **một** dòng `inquiry mail skipped: SMTP_HOST is not set`.

## 4. Xem và trả lời inquiry

Console → **Live chat → Alerts → tab Inquiries** (số đỏ là số inquiry chưa trả lời).

- Danh sách: thời gian, tên, email (che bớt), đầu nội dung.
- Bấm **Open**: hiện đủ email và nội dung. Mỗi lần mở được ghi vào audit log.
- **Reply by email**: mở ứng dụng mail với địa chỉ khách, tiêu đề "Re: Your inquiry" và trích nội dung khách gửi.
- **Mark answered**: chuyển sang "Answered". Bấm **Open again** nếu cần mở lại.

## 5. Thử trên production

1. Mở widget trên ivyusa.com → tab Chat → **🤝 Contact Support**.
   - Thấy "Please choose how you'd like to reach us." và **một** thẻ 📧 Email inquiry · Open 24 hours · Reply within 1 business day · hello@ivyusa.com.
2. Bấm thẻ → form Name · Email · Message.
   - Khách đã đăng nhập: tên và email được điền sẵn.
3. Gửi một tin thử → thẻ tối "YOUR INQUIRY" + "Your message has been sent successfully."
4. Console → Alerts → Inquiries: thấy tin vừa gửi. Mailbox `hello@ivyusa.com` có mail nếu có SMTP. Bấm **Mark answered** cho tin thử.

## 6. Khi có sự cố

| Hiện tượng | Xem |
|---|---|
| Khách thấy "Your message couldn't be sent" | `docker logs sharptalk_api --since 30m 2>&1 \| grep InquiryService`. Dòng `inquiry refused: …` ghi lý do: consent, ô sai, quá 5 lần / giờ, email đã xin xoá. Log không ghi email hay nội dung. |
| Lỗi 500 khi gửi, log có `Unknown column 'contact_name'` | Chưa chạy SQL §1 |
| Chỉ có thẻ "Chat with an agent" | Chưa lưu email ở §2 |
| Không có mail | §3: kiểm `SMTP_HOST`; log có `inquiry N mail failed: …` nếu SMTP từ chối |
| Khách báo "Please accept the privacy notice…" | Khách chưa bấm Accept ở thông báo quyền riêng tư đầu khung chat. Form cần consent vì có lưu email |
