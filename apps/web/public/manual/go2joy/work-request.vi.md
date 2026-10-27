# SharpTalk × Go2Joy — Yêu cầu công việc (các việc Go2Joy cần thực hiện)

> Yêu cầu công việc liệt kê những việc Go2Joy cần làm theo từng bộ phận (2026-10-27 · v1.4). Đội phát triển HA: xem checklist ở đầu tài liệu cùng với [Đặc tả tích hợp HA v1.4](ha-identify.vi.html). Để in hoặc gửi: [PDF](work-request.vi.pdf)

| Mục | |
|---|---|
| Gửi đến | PM Go2Joy · Đội phát triển HA (backend · FE) · Đội phát triển Go2Joy (Partner API) · Hạ tầng · Vận hành (CS) · Pháp chế |
| Từ | SharpTalk (Amoeba) |
| Ngày / phiên bản | 2026-10-27 · **v1.4** (thay thế v1.3 ngày 10/24) |
| Căn cứ | ① [Đặc tả tích hợp đăng nhập HA v1.4](GUIDE-261024-Go2Joy-HA-Identify-v1.4.vi.md) (bản sửa tài liệu 10/27, định dạng truyền không đổi) ② Yêu cầu tích hợp & danh sách kiểm tra (số G, 2026-10-22) ③ Tài liệu Go2Joy Support Assistant API và tài liệu Partner API công khai (kiểm tra 10/23, kiểm tra lại 10/27: không thay đổi) ④ Rà soát nội bộ WR v1.3 + đặc tả v1.4 (10/26) và kiểm tra staging / HA UAT (10/26 – 10/27) |
| Phản hồi | Báo cáo hoàn thành theo từng việc, hoặc bảng phản hồi tại §8 — kênh trao đổi hằng ngày (WR-40) |

## ✅ Những việc HA (Go2Joy) phải làm — danh sách kiểm tra

Đặc tả v1.4 đã chốt (phê duyệt 10/24). Cách kiểm tra từng mục, kèm mã mẫu, có trong danh sách kiểm tra ở đầu [đặc tả tích hợp HA v1.4](GUIDE-261024-Go2Joy-HA-Identify-v1.4.vi.md).

- **Backend (WR-01 · 02, hạn Thứ Ba 10/27)**: ☐ secret chỉ nằm trong biến môi trường của server ☐ endpoint chỉ dành cho phiên đã đăng nhập ☐ giá trị lấy từ phiên và DB ☐ `userId = "ha:" + userSn` ☐ chỉ 4 thuộc tính `hotel_id · hotel_name · province_sn · role` ☐ `province_sn` = provinceSn của Go2Joy ☐ mã vai trò + **gửi danh sách mã** ☐ "tất cả khách sạn" → chỉ `role` ☐ NFC → gộp khoảng trắng → trim → 120 ký tự ☐ bỏ giá trị rỗng và email không phải địa chỉ hợp lệ ☐ HMAC-SHA256 ☐ **test vector T1 – T6 khớp, gửi lại kết quả** ☐ không bao giờ ghi gói định danh vào log
- **FE (WR-04, hạn Thứ Tư 10/28)**: ☐ bỏ việc lắp ráp trên trình duyệt và `hash: "testing"` ☐ chuyển nguyên phản hồi của server vào `identify` ☐ identify lại khi đăng nhập, tải lại trang, **đổi khách sạn**, đổi ngôn ngữ ☐ `logout` khi đăng xuất, hết hạn phiên, chuyển tài khoản, đăng xuất ở tab khác ☑ giữ `locale` (hoàn thành 10/27) ☑ CSP và CORS trên UAT (hoàn thành 10/27) ☐ một thiết lập duy nhất cho tên miền SharpTalk
- **UAT (WR-05, 10/29 – 30)**: ☐ đạt **danh sách kiểm tra §8 của đặc tả (danh sách UAT duy nhất)** ☐ tài khoản thử nghiệm miền Bắc và miền Nam
- **Production (WR-06)**: ☐ secret production ☐ tên miền production `sharptalk.go2joy.vn` ☐ CSP, CORS production, chia sẻ lịch phát hành

## Thay đổi trong v1.4 (10/27)

- **Không chỉ tin vào `ok: true` (WR-04, S-06).** Trong khi staging còn chấp nhận đăng nhập không ký cho UAT, chữ ký sai cũng trả về 200, `consentState: "granted"` và `identified {ok: true}`. Bằng chứng của chữ ký đúng là `"authenticated": true` trong phản hồi identify và trạng thái "đã xác minh" (không phải "Unverified") trên console. SharpTalk tắt chế độ tạm thời **ngay khi thấy một identify đã xác minh trên HA UAT, trước UAT chung**, để các mục kiểm tra 401 có thể đạt.
- **Không có tỉnh nào thuộc vùng 3 (Central).** Trong Province Feed, Đà Nẵng, Quảng Nam, Bình Định, Khánh Hòa, Gia Lai thuộc vùng 5 (South Center) và Thừa Thiên Huế thuộc vùng 4 (North Central). WR-10 và UAT nay dùng 4 vùng thực sự tồn tại.
- **Một danh sách kiểm tra UAT duy nhất**: §8 của đặc tả. §6.1 ở đây trỏ tới đó.
- **Nhà cung cấp AI nhận tên hiển thị của nhân viên** (cùng tên khách sạn, tỉnh, vùng và vai trò), để có thể chào và trả lời đúng ngữ cảnh. Email, số điện thoại và user id không được gửi. Đã đính chính cho WR-30.
- **Vì sao đội South vẫn chưa có nhân viên đang hoạt động (WR-11)**: nhân viên được mời nếu đăng nhập bằng mật khẩu tạm thời sẽ vẫn ở trạng thái "đã mời" và không được phân công; chỉ khi đặt mật khẩu qua liên kết mời thì mới thành "đang hoạt động". Một số nhân viên Go2Joy (kể cả đội South) đã làm việc trên console theo cách này. SharpTalk sẽ sửa (S-13); trong lúc chờ, vui lòng dùng liên kết mời.
- Cập nhật số liệu staging (§2.3): 12 tài khoản, 3 đang hoạt động, và **cả 3 tài khoản đang hoạt động đều là tài khoản Amoeba / thử nghiệm** — chưa có yêu cầu nào được phân công cho nhân viên Go2Joy. 11 trên 12 tài khoản là master.
- Việc mới của SharpTalk: S-13 (đã mời → đang hoạt động ở lần đăng nhập đầu tiên), S-14 (tên tỉnh có gạch nối bị lưu thành vùng sai, ví dụ Bà Rịa - Vũng Tàu), S-15 (dòng đăng nhập trùng lặp trong nhật ký công việc), S-11 nay bao gồm URL chính sách quyền riêng tư, S-07 nay đăng ký origin production của HA.
- Các hạn 10/26 đã qua: WR-02, WR-23 (gửi yêu cầu) và WR-40 quá hạn. Mới WR-40a: xác nhận các ngày (10/31 là Thứ Bảy).
- Kiểm tra lại HA UAT 10/26 – 10/27: D1 – D6 không thay đổi; D7 (locale) và CSP / CORS hoàn thành; D8 một phần; D9 (đổi khách sạn) chưa được gọi.

## 0. Tóm tắt

- Các tính năng giai đoạn 1 của SharpTalk (xác minh chữ ký, khách sạn = khách hàng doanh nghiệp, tính liên tục của hội thoại, định tuyến danh mục tư vấn × vùng, cảnh báo, hồ sơ khách sạn và loại phòng) **đã triển khai và đang hoạt động trên staging**. Hỗ trợ đặc tả v1.4 có trên staging từ 10/24.
- **HA UAT vẫn chưa ký** (kiểm tra lại 10/27): gói được dựng trên trình duyệt với `hash: "testing"`, ID đăng nhập làm `userId`, 5 khóa lạ, và tên tỉnh trong `region`.
- **Chưa có yêu cầu nào đến được nhân viên Go2Joy.** Đội South không có nhân viên đang hoạt động (WR-11 · S-13), chưa có người phụ trách mặc định (WR-13), và các tài khoản đang hoạt động duy nhất là của Amoeba. Khách sạn miền Nam và miền Trung, danh mục bị bỏ qua và yêu cầu "tất cả khách sạn" đều cảnh báo tới mọi người.
- **Mở staging ngày 10/31 (Thứ Bảy — vui lòng xác nhận, WR-40a)** cần: WR-01 · 02 · 04 · 05 · 10 – 14 · 40.
- **Mở production** cần thêm WR-06 · WR-20 – 23 · WR-30 · 31. Sớm nhất **11/10 – 11/11**, tính từ thông tin xác thực production Partner API (WR-23, khoảng một tuần sau khi gửi yêu cầu) cộng cài đặt (4 ngày làm việc) và UAT production (3 ngày làm việc).

## 1. Lịch sử đặc tả tích hợp

Một phần HA được xây dựng theo bản PDF v1.0, vì vậy khác biệt giữa các phiên bản được gom vào một bảng. **Cột v1.4 là đặc tả cuối cùng.** SharpTalk đã phát hành đặc tả v1.4 và test vector vào 10/24 (S-01) và chấp nhận v1.4 trên staging (S-02).

| Mục | v1.0 (PDF 10/20, đã thu hồi) | v1.3 | **v1.4** |
|---|---|---|---|
| `userId` | ID đăng nhập (`go2joysupport`) | `"ha:" + userSn` | Giống v1.3 |
| Khóa thuộc tính được ký | 5: `hotel_id` · `hotel_name` · `province` · `region` · `role` | 5 (giống) | **4**: `hotel_id` · `hotel_name` · `province_sn` · `role` |
| Tỉnh | `province` = tên tỉnh (`Hồ Chí Minh`) | Giống | `province_sn` = `provinceSn` của Go2Joy (Province Feed `sn`, ví dụ Hồ Chí Minh = `"1"`) |
| Vùng | HA suy ra, 3 giá trị | HA suy ra, 5 mã | **Không gửi.** SharpTalk suy ra từ Province Feed `region` |
| Vai trò | Tên hiển thị (`Lễ tân`) | Giống | **Mã vai trò HA** (không phụ thuộc ngôn ngữ giao diện); danh sách mã gửi lại trong WR-01 |
| Chuẩn hóa | trim · 120 ký tự | + NFC | Thứ tự cố định: **NFC → gộp khoảng trắng → trim → 120 ký tự (`mb_substr`)** |
| Chọn "tất cả khách sạn" | Chưa quy định | Chỉ identify lại | Bỏ 3 khóa khách sạn, chỉ ký `role` → người phụ trách mặc định (WR-13) |
| Giá trị rỗng | Bỏ thuộc tính rỗng và email rỗng | Giống | `name` · `email` · `phone` rỗng cũng bị bỏ khỏi trường (email rỗng hoặc sai định dạng → 400, toàn bộ lượt đăng nhập thất bại) |
| Test vector | T1 · T2 (userId cũ) | T1 – T5 | **T1 – T6** (T6 = đầu vào Unicode dạng tách rời). Không dùng các vector trước đó |

**Chuyển tiếp**: trong một thời gian SharpTalk vẫn chấp nhận các khóa v1.3 (`province` · `region`); định tuyến ưu tiên giá trị v1.4. Việc này kết thúc bằng một bản phát hành riêng sau khi HA đạt UAT trên v1.4; ngày kết thúc sẽ được thông báo trước.

Cách SharpTalk suy ra vùng: Province Feed `region` `1` → `south`, `2` → `north`, `4` → `north_center`, `5` → `south_center`. `3` → `central` có trong tài liệu nhưng **hiện không có tỉnh nào dùng**. Giá trị `10` chưa có trong tài liệu (17 thành phố Manila) được lưu thành `region_10` cho đến khi WR-27 được trả lời.

## 2. Hiện trạng (2026-10-27)

### 2.1 Đã sẵn sàng phía SharpTalk (staging)

| Tính năng | Trạng thái |
|---|---|
| Xác minh identify có chữ ký (v1.4 và v1.3), ghi nhận điều khoản HA làm sự đồng ý của widget (không hiện banner đồng ý), tên nhân viên trong lời chào đầu tiên | Hoàn thành |
| Khách sạn = khách hàng doanh nghiệp, nhân viên = người liên hệ, tách B2B / B2C, hội thoại liên tục theo tài khoản khách sạn | Hoàn thành |
| Danh mục tư vấn: khi chọn "nói chuyện với nhân viên" hoặc khi AI chuyển giao, widget hỏi nội dung yêu cầu (có thể bỏ qua); lựa chọn × vùng khách sạn → đội × nhãn công việc | Hoàn thành (10/24) |
| Trung tâm cảnh báo: người phụ trách, quy tắc, danh mục, khách sạn, vùng; xác nhận hoặc bỏ qua; cài đặt cá nhân | Hoàn thành (10/24) |
| Kiểm tra phân công (trình mô phỏng) và cảnh báo quy tắc | Hoàn thành (10/24) |
| Nhiều phiên của cùng khách hàng hoặc khách sạn được gộp vào một phòng | Hoàn thành (10/23) |
| Dòng thông báo AI dưới widget kèm liên kết điều khoản; hiện / ẩn nút trên thanh tiêu đề | Hoàn thành (10/23) |
| Yêu cầu đánh giá mức độ hài lòng và tự động đóng sau câu trả lời; thông báo "nhân viên đang trả lời chậm" và yêu cầu gọi lại | Hoàn thành (10/27) |
| Câu trả lời và nút theo ngôn ngữ đã chọn (vi / en), tiêu đề live chat "nhân viên / khách sạn", tìm kiếm nội dung hội thoại | Hoàn thành |
| Partner API: thông tin khách sạn và loại phòng → hồ sơ công ty và sản phẩm theo từng khách sạn; bảng tỉnh (80 tỉnh, mã → tên và vùng) làm mới hằng ngày | Hoàn thành — thông tin xác thực staging |
| Giải pháp tạm cho dữ liệu HA hiện tại: tên tỉnh gửi trong `region` → vùng từ bảng tỉnh | Hoàn thành (10/23) — **tên có gạch nối bị lỗi** (S-14) |
| Tên hiển thị dạng văn bản thường trên danh sách console và được che trong log. **Nhà cung cấp AI nhận tên hiển thị của nhân viên, tên khách sạn, tỉnh, vùng và vai trò** (để chào và trả lời đúng ngữ cảnh); email, số điện thoại và user id không được gửi | Hoàn thành |

### 2.2 Phát hiện từ HA UAT (10/23, kiểm tra lại 10/26 và 10/27)

Đọc từ mã nhúng trên trang HA UAT (`window.sharptalkSignIn`) và log staging của SharpTalk.

| # | Mục | HA hiện tại | v1.4 | Trạng thái |
|---|---|---|---|---|
| D1 | Chữ ký | Gói được dựng trên trình duyệt, `hash: "testing"` | Server HA ký bằng HMAC-SHA256 | Chưa bắt đầu |
| D2 | `userId` | ID đăng nhập (`go2joysupport`) | `"ha:" + userSn` | Chưa bắt đầu |
| D3 | Khóa thuộc tính | 5 + `hotel_code` · `hotel_group_id` · `user_id` · `user_sn` · `district` | Chỉ 4 khóa | Chưa bắt đầu |
| D4 | Vùng | Tên tỉnh trong `region` | Không gửi | Chưa bắt đầu (SharpTalk có giải pháp tạm) |
| D5 | Giá trị tỉnh / vai trò | Tên hiển thị (`Hồ Chí Minh`, `Lễ tân`) | `province_sn` · mã vai trò | Chưa bắt đầu |
| D6 | Chuẩn hóa | Không áp dụng (dựng ở FE) | NFC → khoảng trắng → trim → 120 | Chưa bắt đầu |
| D7 | `locale` | `localStorage.lang` → `vi` / `en`, `setLocale` khi thay đổi | Giống | **Hoàn thành** |
| D8 | Đăng xuất | `logout` khi bấm nút đăng xuất và khi token hết hạn | + chuyển tài khoản, tab khác (sự kiện `storage`) | Một phần |
| D9 | Đổi khách sạn | `identify` chỉ được gọi một lần khi khởi động | Identify lại mỗi lần đổi, kể cả "tất cả khách sạn" | Chưa làm |
| — | CSP / CORS | Không giới hạn trên UAT, widget tải được | Cho phép tên miền SharpTalk | **Hoàn thành trên UAT** (production là WR-06) |

### 2.3 Thiết lập định tuyến staging của go2joy (đọc 10/27)

Các giá trị đội vận hành Go2Joy đã nhập trong console. Cài đặt › Chuyển giao nhân viên › **Kiểm tra phân công** cho cùng kết quả với một danh mục và vùng cho trước.

| Mục | Hiện tại |
|---|---|
| Danh mục tư vấn (hiển thị cho khách hàng) | `bs` Business Support · `cs` Customer Services — **chưa có tên tiếng Việt** (màn hình tiếng Việt hiển thị tiếng Anh) |
| Đội | North · North Center · South · South Center |
| 12 tài khoản | **3 đang hoạt động — đều là tài khoản Amoeba / thử nghiệm** (North 1, North Center 2) · **9 đã được mời** (North 3, North Center 1, South 4, South Center 1), gồm cả 6 tài khoản @go2joy.vn |
| Cấp bậc | 11 trên 12 tài khoản là master (toàn quyền trên tenant) |
| Nhãn công việc | `cs` · `sa` (ngoài ra consult · accounting · operations). Nhân viên North duy nhất đang hoạt động giữ cả `sa` và `cs` |
| Người phụ trách mặc định | **Chưa có** |

| Quy tắc | Danh mục | Vùng khách sạn | Đích | Kết quả hiện tại |
|---|---|---|---|---|
| BS_North_SA | bs | north · north_center | Đội North × sa | Đã phân công (1 người đang hoạt động — tài khoản Amoeba) |
| CS_North_CS | cs | north · north_center | Đội North × cs | Đã phân công (cùng người) |
| CS_South | cs | south · south_center | Đội South × cs | **Bị bỏ qua — 0 người hoạt động** |
| BS_South_SA | bs | south · south_center | Đội South × sa | **Bị bỏ qua — 0 người hoạt động** |

- **Đội North Center và South Center** không là đích của quy tắc nào; khách sạn vùng bắc-trung cũng được chuyển tới đội North.
- **Không có tỉnh nào thuộc vùng 3 (Central).** Khách sạn duyên hải miền Trung (Đà Nẵng, Quảng Nam, Bình Định, Khánh Hòa, Gia Lai …) theo các quy tắc South (vùng 5); Thừa Thiên Huế theo các quy tắc North (vùng 4).
- Khách hàng **bỏ qua** bước chọn danh mục, yêu cầu không khớp quy tắc nào, Manila (`region_10`) và "tất cả khách sạn" được chuyển tới người phụ trách mặc định — và khi chưa thiết lập, thành cảnh báo "mọi người — không khớp quy tắc".
- Các yêu cầu thật #906 và #907 (MAI VILLA HÀ NỘI, 10/26) được phân công cho tài khoản Amoeba trong đội North.
- 4 trên 7 hồ sơ khách sạn chưa có tỉnh hoặc vùng (1721, 4495, 726, 4162). Đăng nhập không ký không cập nhật hồ sơ công ty; một lượt đăng nhập v1.4 có ký sẽ điền vào. Định tuyến không bị ảnh hưởng (dùng vùng của phiên).
- Điều kiện vùng của quy tắc dùng vùng do SharpTalk suy ra, nên quy tắc không cần thay đổi sau khi chuyển sang v1.4.

## 3. Hạng mục công việc

**P0-S** mở staging 10/31 · **P0** mở production · **P1** chất lượng production · **P2** giai đoạn 2 trở đi. Thời hạn là đề xuất của SharpTalk; nếu không phù hợp, vui lòng ghi ngày khả thi vào bảng phản hồi (§8). **Quá hạn** = đã qua ngày đề xuất.

### 3.1 Đội phát triển HA — backend

| WR | Công việc | Chi tiết | Hoàn thành khi | Ưu tiên | Hạn (đề xuất) | Trạng thái | Tham chiếu |
|---|---|---|---|---|---|---|---|
| WR-01 | **Endpoint ký** | Một API được gọi bằng phiên đăng nhập (ví dụ `GET /api/v1/staff/sharptalkIdentity`) dựng và ký gói định danh trên server.<br>① `userId = "ha:" + userSn`<br>② 4 thuộc tính: `hotel_id` · `hotel_name` · `province_sn` · `role` (mã vai trò). Không có `region`<br>③ "Tất cả khách sạn": bỏ 3 khóa khách sạn, chỉ ký `role`<br>④ Chuẩn hóa theo thứ tự: NFC → gộp khoảng trắng → trim → `mb_substr(…, 0, 120)` (PHP `intl`)<br>⑤ Bỏ giá trị rỗng, trong attributes và trong `name` · `email` · `phone`. Bỏ cả email không phải địa chỉ hợp lệ — email sai định dạng, `userId` dài hơn 120 ký tự, tên dài hơn 200 hoặc số điện thoại dài hơn 40 sẽ trả về 400 và toàn bộ lượt đăng nhập thất bại<br>⑥ `hash = hex(HMAC-SHA256(embed secret, signing string))`<br>⑦ Đọc giá trị từ phiên và DB của HA, không bao giờ lấy từ trình duyệt | Test vector **T1 – T6** của đặc tả v1.4 khớp + gửi lại **danh sách mã vai trò HA** (mã · nhãn vi/en) | P0-S | Thứ Ba 10/27 | Chưa bắt đầu | G10 · D1 – D6 |
| WR-02 | **Quyết định khóa ký** | **Phương án A (khuyến nghị)**: embed secret do SharpTalk cấp, chỉ lưu trong biến môi trường server HA; SharpTalk gửi secret staging qua kênh bảo mật trong cùng ngày (S-03).<br>**Phương án B**: dùng lại client secret của Go2Joy; SharpTalk phải bổ sung chỗ nhập secret do đối tác cung cấp (S-04), và nếu bị lộ thì quyền truy cập Partner API cũng bị lộ.<br>**Chưa có quyết định: staging tiến hành theo phương án A**; lựa chọn có thể được xem xét lại trước production (cùng đặc tả và mã, chỉ giá trị secret thay đổi). | Có quyết định + secret staging đã được cài đặt | P0-S | Thứ Hai 10/26 | **Quá hạn** | G12 |
| WR-03 | Thời hạn chữ ký (`ts`) | Có thêm thời điểm ký để ngăn tái sử dụng gói hay không. Thời hạn 5 phút như Partner API đồng nghĩa hai bên cùng thay đổi đặc tả | Có / không | P1 | 11/06 | Mở | G16 |

### 3.2 Đội phát triển HA — FE và triển khai

| WR | Công việc | Chi tiết | Hoàn thành khi | Ưu tiên | Hạn (đề xuất) | Trạng thái | Tham chiếu |
|---|---|---|---|---|---|---|---|
| WR-04 | **Sửa mã nhúng** | ① Chuyển phản hồi của WR-01 vào `identify` **nguyên vẹn** (không lắp ráp hay chỉnh sửa trên trình duyệt); bỏ `hash: "testing"`<br>② Gọi khi xác nhận đăng nhập · khi tải lại trang · **mỗi khi đổi khách sạn đang chọn (kể cả "tất cả khách sạn")** — hiện chỉ được gọi một lần khi khởi động · khi đổi ngôn ngữ HA<br>③ Gọi `logout` khi bấm nút đăng xuất và khi token hết hạn (đã làm) · ngay trước khi đăng nhập bằng tài khoản khác · khi tab khác đăng xuất (sự kiện `storage`) — còn thiếu<br>④ `locale` (hoàn thành 10/27)<br>⑤ CSP và CORS (hoàn thành trên UAT 10/27)<br>⑥ Đưa 3 chỗ dùng tên miền SharpTalk (src của `embed.js` · `widgetUrl` · kiểm tra origin của `ivy:event`) về một thiết lập môi trường duy nhất | identify **200 với `"authenticated": true`**, và console hiển thị phiên là "đã xác minh" (không phải "Unverified"). Chỉ `ok: true` không phải là bằng chứng trong khi staging còn chấp nhận đăng nhập không ký | P0-S | Thứ Tư 10/28 | Một phần (④ ⑤) | G11 · D1 · D8 · D9 |
| WR-05 | UAT chung | Cùng SharpTalk thực hiện **danh sách kiểm tra §8 của đặc tả** (danh sách UAT duy nhất), **sau S-06** | Bảng kết quả đã ký xác nhận | P0-S | 10/29 – 10/30 | Mở | G13 |
| WR-06 | **Triển khai HA production** | ① Triển khai WR-01 · WR-04 lên HA production<br>② Embed secret production (khác với staging; S-08)<br>③ Tên miền SharpTalk production: `https://sharptalk.go2joy.vn/widget/embed.js` · `widgetUrl` · kiểm tra origin<br>④ CSP và CORS production<br>⑤ Chia sẻ trước lịch phát hành HA | identify 200 với `"authenticated": true` trên HA production; gói ký bằng secret staging nhận 401 | P0 | Trước UAT production | Mở | G11 · G1 |

### 3.3 Vận hành Go2Joy (CS)

| WR | Công việc | Chi tiết | Hoàn thành khi | Ưu tiên | Hạn (đề xuất) | Trạng thái | Tham chiếu |
|---|---|---|---|---|---|---|---|
| WR-10 | **Xác nhận quy tắc định tuyến** | Kiểm tra 4 quy tắc tại §2.3.<br>① **Đội North Center và South Center** có nhận yêu cầu không? Nếu có, tách quy tắc theo vùng hoặc thêm hai đội làm đích<br>② Các tỉnh duyên hải miền Trung (Đà Nẵng, Quảng Nam, Bình Định, Khánh Hòa, Gia Lai …) thuộc vùng 5 "South Center" trong Province Feed và Thừa Thiên Huế thuộc vùng 4 "North Central"; không có tỉnh nào thuộc vùng 3. Với quy tắc hiện tại, chúng được chuyển tới đội South / North — xác nhận đây là chủ ý, hoặc liệt kê các tỉnh ngoại lệ<br>③ Nhân viên North duy nhất đang hoạt động giữ cả `sa` và `cs` — xác nhận<br>④ Philippines (`region_10`) thuộc giai đoạn 2 | Xác nhận bằng văn bản (hoặc sửa trong console và báo cho chúng tôi); kiểm tra phân công không còn cảnh báo | P0-S | 10/27 | Một phần | G20 |
| WR-11 | **Kích hoạt nhân viên, hoàn thiện danh sách nhân sự, đặt cấp bậc** | **Mỗi nhân viên được mời đặt mật khẩu qua liên kết mời** (đăng nhập bằng mật khẩu tạm thời sẽ giữ tài khoản ở trạng thái "đã mời" và không được phân công — SharpTalk sửa việc này ở S-13; sau đó chỉ cần đăng nhập một lần). Mỗi đội có ít nhất một nhân viên Go2Joy đang hoạt động, trước hết là South và South Center. Gửi cấp bậc của từng người: 11 trên 12 tài khoản là master (toàn quyền). Gửi họ tên · email · đội · nhãn công việc (cs / sa) của những người còn thiếu | Mỗi đội có một nhân viên **@go2joy.vn** đang hoạt động; không còn cảnh báo "0 người hoạt động"; đã đặt cấp bậc | P0-S | 10/27 | Một phần | G21 |
| WR-12 | **Định nghĩa và đặt tên danh mục tư vấn** | Khi nào chọn Business Support và khi nào chọn Customer Services (mỗi loại 1 – 2 dòng), và **tên hiển thị tiếng Việt** (hiển thị nguyên văn trên thẻ của widget). Có chia nhỏ hơn không (ví dụ đối soát / hợp đồng) | Tên tiếng Việt hiển thị trên widget tiếng Việt | P0-S | 10/27 | Một phần | G22 |
| WR-13 | **Giờ làm việc, thứ tự khi vắng mặt, người phụ trách mặc định** | Giờ làm việc theo đội (múi giờ HCM), thứ tự xử lý khi không ai sẵn sàng (đề xuất: nhân viên dự phòng → hàng đợi của đội → tin nhắn ngoài giờ). **Người phụ trách mặc định** — hiện chưa có, nên các trường hợp sau cảnh báo tới mọi người: bỏ qua danh mục, khách sạn miền Nam / miền Trung trong khi South có 0 người hoạt động, Manila, "tất cả khách sạn" | Kiểm tra phân công "bỏ qua danh mục" → người phụ trách mặc định | P0-S | 10/27 | Mở | G23 |
| WR-14 | **Tài khoản thử nghiệm UAT** | Một `Quản lý` (nhiều khách sạn, dùng để thử đổi khách sạn — D9) + một `Lễ tân` (một khách sạn), bao gồm khách sạn **miền Bắc và miền Nam** và ít nhất một tên khách sạn có dấu tiếng Việt | Tài khoản được gửi qua kênh bảo mật | P0-S | 10/27 | Một phần (một tài khoản miền Nam) | G13 |
| WR-15 | Kết nối lại nguồn tri thức Notion | 3 nguồn đã được kết nối lại vào 10/22 và đồng bộ bình thường | — | P0 | — | **Hoàn thành** | G30 |
| WR-16 | Quyết định về xung đột tri thức | 78 mục được phân loại ngày 10/15: giữ bên nào | Bảng quyết định | P1 | 11/06 | Mở | G31 |
| WR-17 | Rà soát golden set | Xác nhận câu trả lời của 44 câu hỏi `#Talk-4-Hotel` | Kết quả rà soát | P1 | 11/06 | Mở | G32 |
| WR-18 | Phạm vi hiển thị widget và khung thời gian tiếp tục | Mặc định hiện tại: widget hiển thị hội thoại của chính người dùng + "n yêu cầu trước đó của khách sạn này"; AI thấy hội thoại trước đó của khách sạn; ưu tiên cùng nhân viên trong 24 giờ (nếu đã chọn danh mục thì quy tắc được áp dụng trước) | Giữ / thay đổi | P1 | 11/06 | Cần xác nhận | G14 · G15 |
| WR-19 | Zalo OA · mẫu ZNS | Để gửi cảnh báo cho nhân viên qua cả Zalo | OA và mẫu đã được duyệt | P1 | Chưa xác định | Mở | G24 |
| WR-19a | Cài đặt cảnh báo của nhân viên | Mỗi nhân viên tự thiết lập tại 🔔 › Cài đặt: phạm vi cảnh báo, âm thanh, **cho phép thông báo trên màn hình**, mail | Đã thiết lập cho mọi nhân viên | P1 | 10/30 | Mở | — |

### 3.4 Hạ tầng · đưa Partner API vào vận hành

| WR | Công việc | Chi tiết | Hoàn thành khi | Ưu tiên | Hạn (đề xuất) | Trạng thái | Tham chiếu |
|---|---|---|---|---|---|---|---|
| WR-20 | **Server production + SSH + DNS + TLS** | `sharptalk.go2joy.vn` (chưa có bản ghi DNS tính đến 10/27), khu vực Việt Nam. Thí điểm 4 vCPU / 8 GB / 80 GB; production 8 vCPU / 16 GB / 200 GB trở lên. Bộ nhớ sao lưu hằng ngày. **IP công khai tĩnh** (danh sách cho phép của WR-23) và **đồng bộ thời gian NTP** (`timestamp` của Partner API hết hạn sau 5 phút) | Đã bàn giao quyền SSH và IP tĩnh, DNS phân giải được | P0 | 10/30 | Mở | G1 |
| WR-21 | **Khóa API AI production (tài khoản và thanh toán của Go2Joy)** | LLM trả lời (khuyến nghị Anthropic Claude) và embedding (Voyage). Hạn mức hằng tháng và người nhận cảnh báo khi hết hạn mức | Khóa được gửi qua kênh bảo mật | P0 | 10/30 | Mở | G2 |
| WR-22 | Tài khoản gửi mail | SMTP cho mail cảnh báo nhân viên | Đã bàn giao tài khoản | P1 | 10/30 | Mở | G3 |
| WR-23 | **Chứng nhận production Partner API, thông tin xác thực và danh sách IP cho phép** | Quy trình đưa vào vận hành trong tài liệu: gửi yêu cầu chứng nhận (khoảng một tuần) → 3 lượt đặt phòng thử → clientId · secret production → thêm 3 lượt đặt phòng. **SharpTalk không dùng API đặt phòng**, vì vậy chúng tôi đề nghị được miễn và thay bằng kiểm tra kết nối qua API tra cứu. Cho phép IP tĩnh production của SharpTalk trên `https://partner.go2joy.vn` (khoảng 500 request/phút) | Đã gửi yêu cầu → có trả lời về miễn trừ → đã bàn giao thông tin xác thực, kiểm tra kết nối đạt | P0 | Gửi 10/26 · thông tin xác thực trước 11/02 | **Quá hạn nộp** | G18 |

### 3.5 Đội phát triển Go2Joy — câu hỏi về Partner API

Những điểm tài liệu Support Assistant API (không thay đổi 10/23 – 10/27) và kết quả đo trên staging không khớp. Chỉ cần trả lời; Go2Joy quyết định có cần sửa gì hay không.

| WR | Câu hỏi | Tài liệu / quan sát | Ưu tiên | Tham chiếu |
|---|---|---|---|---|
| WR-24 | Cơ sở dữ liệu Partner staging so với HA UAT | Khách sạn 4118: 21 phòng trên Partner / 7 trên HA, giá và giờ khác nhau. Production có dùng một cơ sở dữ liệu không? | P1 | G19 ① |
| WR-25 | Mã trạng thái phòng | Tài liệu định nghĩa `status` là 1 Available · 2 Locked, nhưng chúng tôi quan sát thấy 1 · 4 · 5 | P1 | G19 ② |
| WR-26 | Số lượng phòng | `numOfRoom` luôn là 2147483647 ("không xác định được"). Có trường nào cho tổng số phòng của khách sạn không? | P1 | G19 ③ ⑥ |
| WR-27 | Vùng `10` và vùng `3` | Enum trong tài liệu là 1 – 5, nhưng feed trả về 17 thành phố Manila với `10`, và không có tỉnh nào với `3`. Tên và ý nghĩa của `10`; sẽ có tỉnh nào nhận `3` không? | P1 | G19 ⑤ |
| WR-28 | Lỗi tra cứu theo giờ | Room Type List với `bookingType=1` trả về `code 0`. SharpTalk sẽ kiểm tra lại request của mình với `startTime` · `endTime` trước (S-09) | P2 | G19 ⑦ |
| WR-29 | Phạm vi và hành vi của Hotel Feed | Feed có bao gồm mọi khách sạn HA không (thiếu 4118)? Việc trả về toàn bộ khi không có khách sạn nào khớp có phải là chủ ý không? | P2 | G18 · G34 |
| — | Đính chính tài liệu | Đường dẫn Hotel Info `getHotelnfo` (đúng ra là `getHotelInfo`); đường dẫn Room Type Feed v1 lại hiển thị ví dụ phản hồi v2; bước đặt phòng thử khi đưa vào vận hành có áp dụng cho đối tác chỉ tra cứu không? | P2 | G19 ⑧ |

### 3.6 Pháp chế

| WR | Công việc | Chi tiết | Hoàn thành khi | Ưu tiên | Hạn (đề xuất) | Trạng thái | Tham chiếu |
|---|---|---|---|---|---|---|---|
| WR-30 | **Rà soát quyền riêng tư / PDPL** | Thông báo chuyển dữ liệu xuyên biên giới (bên xử lý Anthropic · Voyage, khu vực xử lý), có cần đánh giá tác động chuyển dữ liệu hay không, phạm vi che dữ liệu, thời gian lưu hội thoại (dự thảo 180 ngày), quy trình thông báo khi rò rỉ dữ liệu. **Rà soát trên cơ sở nhà cung cấp AI nhận tên hiển thị của nhân viên, tên khách sạn, tỉnh, vùng và vai trò** (§2.1) | Trả lời bằng văn bản | P0 | 10/30 | Mở | G4 |
| WR-31 | **URL và phiên bản điều khoản, thông báo AI, URL chính sách quyền riêng tư** | Đã thiết lập trên staging: điều khoản `https://go2joy.vn/vi-vn/policy?tab=terms-of-use`; thông báo VI "Được tạo bởi AI, áp dụng **điều khoản dịch vụ**" / EN "Created by AI; apply **terms of service**". Còn thiếu: **phiên bản điều khoản** và **URL chính sách quyền riêng tư** (thông báo đồng ý hiện chưa có liên kết chính sách) | Xác nhận kèm phiên bản + URL chính sách quyền riêng tư | P0 | 10/30 | Cần xác nhận | G5 |

### 3.7 PM

| WR | Công việc | Chi tiết | Ưu tiên | Hạn (đề xuất) | Trạng thái | Tham chiếu |
|---|---|---|---|---|---|---|
| WR-40 | **Người phụ trách và kênh liên lạc** | Người phụ trách PM, HA backend / FE, hạ tầng, Partner API, vận hành (trưởng CS), pháp chế, và kênh trao đổi hằng ngày | P0-S | 10/26 | **Quá hạn** | G6 |
| WR-40a | **Xác nhận các ngày** | 10/31 là Thứ Bảy — xác nhận mở staging vào Thứ Bảy. Production sớm nhất 11/10 – 11/11 (§5) | P0-S | 10/28 | Mở | — |
| WR-41 | Lịch giai đoạn 2 | B2C trước / sau đặt phòng, webhook đặt phòng hoàn tất, nhúng vào app / web, menu HA (iframe · SSO), nhân viên lễ tân, tính phí theo điểm, hội thoại Zalo, điều khoản hợp đồng | P2 | Tháng 11 | Mở | G40 – G47 · G7 |
| WR-42 | Có cần tên và địa chỉ doanh nghiệp không? | SharpTalk có thể đọc **địa chỉ khách sạn** từ Hotel Feed (trừ khách sạn không có trong feed, WR-29). **Tên doanh nghiệp đã đăng ký** sẽ là một khóa được ký trong đặc tả giai đoạn 2 (v1.5); không gửi trước thời điểm đó | P2 | Cùng WR-41 | Mở | — |

## 4. Công việc của SharpTalk

| # | Công việc | Bắt đầu khi | Hạn | Trạng thái | Ưu tiên |
|---|---|---|---|---|---|
| S-01 | Đặc tả v1.4: lịch sử thay đổi, mã mẫu PHP (có NFC), test vector T1 – T6 (đã đối chiếu với PHP 8.3 + intl). Bản sửa tài liệu 10/27 | — | 10/26 | **Hoàn thành** 10/24 · sửa 10/27 | P0-S |
| S-02 | Chấp nhận v1.4: `province_sn` → tên và vùng từ bảng tỉnh (80), mã vai trò, chấp nhận song song khóa v1.3 | — | 10/27 | **Hoàn thành** 10/24 trên staging | P0-S |
| S-03 | Gửi embed secret staging qua kênh bảo mật | WR-02 (mặc định phương án A) | Trong ngày | Đang chờ người phụ trách HA backend (WR-40) | P0-S |
| S-04 | Chỗ nhập secret do đối tác cung cấp | WR-02 phương án B | Sau khi có quyết định | Có điều kiện | — |
| S-05 | Nhập quy tắc, tên danh mục tiếng Việt, người phụ trách mặc định và giờ làm việc theo phản hồi của Go2Joy; gỡ các tài khoản Amoeba / thử nghiệm khỏi định tuyến go2joy khi nhân viên Go2Joy đã hoạt động; chia sẻ kết quả kiểm tra phân công | WR-10 – 13 | Trong ngày | Đang chờ | P0-S |
| S-06 | **Tắt chế độ tạm thời không ký** trên staging và đặt lại mức tin cậy điều khoản host về "có ký" | **Thấy một identify đã xác minh trên HA UAT** (WR-01 · WR-04) — **trước** WR-05 | ≤ 10/28 | Đang chờ | P0-S |
| S-07 | Cài đặt SharpTalk trên server Go2Joy (hồ sơ VN), chuyển tenant go2joy, tri thức, bảng tỉnh, quy tắc, danh mục và nội dung thông báo, lập chỉ mục lại, kết nối Partner API (trong giới hạn ~500/phút), và **đăng ký origin production của HA vào danh sách origin nhúng được phép của tenant** | WR-20 · 21 · 22 · 23 | 4 ngày làm việc | Đang chờ | P0 |
| S-08 | Gửi embed secret production (khác với staging) | WR-20 | Trước WR-06 | Đang chờ | P0 |
| S-09 | Kiểm tra lại request tra cứu theo giờ (`startTime` · `endTime`) trước khi hỏi WR-28 | — | 10/27 | Mở | P2 |
| S-10 | Xoay vòng secret không gián đoạn (chấp nhận cả cũ và mới trong một khung thời gian) + quy trình trong đặc tả | — | 11/06 | Mở | P1 |
| S-11 | Nhập phiên bản điều khoản và URL chính sách quyền riêng tư | WR-31 | Trong ngày | Đang chờ | P0 |
| S-12 | Xử lý xung đột tri thức | WR-16 | 1 – 2 ngày | Đang chờ | P1 |
| S-13 | **Đã mời → đang hoạt động ở lần đăng nhập đầu tiên** (nhân viên được mời đăng nhập bằng mật khẩu tạm thời sẽ được phân công được) | — | 10/28 | Mở | P0-S |
| S-14 | **Tên tỉnh có gạch nối trong giải pháp tạm** (Bà Rịa - Vũng Tàu bị lưu thành vùng `bà_rịa_vũng_tàu`, nên khách sạn 4162 không khớp quy tắc nào); ngăn vùng sai bị lưu như giá trị có ký | — | 10/28 | Mở | P0-S |
| S-15 | Dòng đăng nhập trùng lặp trong nhật ký công việc khi hai lời gọi identify của cùng một phiên đến cùng lúc | — | 11/06 | Mở | P1 |
| S-16 | Đặc tả v1.4 / WR bằng ko · en · vi + PDF trên /manual/go2joy | — | 10/27 | **Hoàn thành** (phiên bản này) | P0-S |

## 5. Lịch trình và phụ thuộc

```
Thứ Hai 10/26  (quá hạn) WR-02 quyết định khóa ký · WR-40 người phụ trách · WR-23 gửi yêu cầu
Thứ Ba 10/27   WR-01 endpoint ký + T1–T6 + danh sách mã vai trò · WR-10–14 quy tắc, kích hoạt, danh mục, người phụ trách mặc định, tài khoản
               SharpTalk: S-16 tài liệu v1.4 · S-09
Thứ Tư 10/28   WR-04 sửa FE → identify 200 với "authenticated": true, console "đã xác minh"
               SharpTalk: S-06 ngay sau đó · S-13 · S-14
10/29–30       WR-05 UAT chung theo §8 của đặc tả (sau S-06) · WR-19a cài đặt cảnh báo · WR-20/21/22
Thứ Bảy 10/31  Mở staging (cần xác nhận, WR-40a)

Mở production = ngày cả ba việc sau đều xong
  ① WR-23 gửi yêu cầu → thông tin xác thực khoảng một tuần sau
  ② sau đó S-07 cài đặt (4 ngày làm việc, cần WR-20 · 21 · 22) → UAT production (3 ngày làm việc, cần WR-30 · 31)
  ③ WR-06 triển khai HA production (cần S-08)
  → sớm nhất 11/10 – 11/11, chậm thêm mỗi ngày việc gửi yêu cầu WR-23 bị trễ
```

- Nếu WR-01 hoặc WR-04 bị trễ, staging chỉ có thể mở với chế độ tạm thời không ký. Khi đó chúng tôi khuyến nghị không bắt đầu dịch vụ với nhân viên thật.
- Nếu WR-11 và WR-13 bị trễ, khách sạn miền Nam và miền Trung tiếp tục cảnh báo tới mọi người.

## 6. Tiêu chí hoàn thành

### 6.1 Mở staging

**UAT chung dùng một danh sách duy nhất: [§8 của đặc tả v1.4](GUIDE-261024-Go2Joy-HA-Identify-v1.4.vi.md).** UAT chạy sau S-06, để các mục 401 có thể đạt.

### 6.2 Mở production

| Kiểm tra | Kết quả mong đợi |
|---|---|
| Đăng nhập HA production → widget (`sharptalk.go2joy.vn`) | identify 200 với `"authenticated": true` (secret production); các mục chính của §8 trong đặc tả đạt lại |
| Gửi gói ký bằng secret staging tới production | 401 (các môi trường tách biệt) |
| Origin production của HA | Đã đăng ký trong danh sách origin nhúng được phép của tenant; widget hoạt động khi bật kiểm soát origin |
| Kết nối Partner API production | Làm mới thông tin khách sạn · phòng · bảng tỉnh thành công; không có lỗi 6 (chữ ký) hoặc 8 (IP) |
| Điều khoản và thông báo | Bản ghi đồng ý mang URL và phiên bản điều khoản; thông báo đồng ý có liên kết tới chính sách quyền riêng tư |

## 7. Tham khảo — điểm chính của Partner API (tài liệu công khai, kiểm tra 10/27)

| Mục | Tài liệu | SharpTalk dùng cho |
|---|---|---|
| Môi trường | Staging `staging-partner.go2joy.vn` (khoảng 250/phút) · production `partner.go2joy.vn` (khoảng 500/phút) | Giới hạn tốc độ đồng bộ |
| Xác thực | `Authorization` = hex(HMAC-SHA256(client secret, URL + "\|" + JSON body sắp xếp theo khóa)); body có `clientId` · `timestamp` (hết hạn sau 5 phút); danh sách IP cho phép | WR-20 NTP · IP tĩnh |
| Ngôn ngữ | Header `Localization` `vi` / `en` (mặc định en) | Tra cứu theo ngôn ngữ của widget |
| Vùng | Province Feed `region`: 1 South · 2 North · 3 Central · 4 North Central · 5 South Center (+ `10` chưa có trong tài liệu). Hiện không có tỉnh nào dùng 3 | Cách suy ra tại §1 |
| Feed | Province (80) · District (theo tỉnh) · Hotel (địa chỉ, tỉnh, quận, xếp hạng, hình ảnh — thiếu một phần khách sạn HA) · Room Type (giường, diện tích, tiện nghi, hướng nhìn, hình ảnh) | Bảng tỉnh, hồ sơ khách sạn, sản phẩm phòng |
| API khách sạn | Hotel Info (giờ, hủy phòng, không có tỉnh) · Hotel List và Room Type List (giá trực tiếp, flash sale, trạng thái khóa; số phòng còn lại luôn "không xác định") | Hồ sơ khách sạn; tình trạng phòng trực tiếp là bước sau |
| Mã lỗi | Body `code` 0 lỗi server · 1 thành công · 2 thất bại; lỗi 4 tham số · 6 chữ ký · 8 không được phép (IP / client) · 10 quyền · 11 không tìm thấy · 12 quá nhiều lần thử | Giám sát production |

## 8. Bảng phản hồi

Điền và gửi vào kênh trao đổi hằng ngày.

| WR | Ưu tiên | Người phụ trách | Ngày khả thi | Trạng thái (đang làm / hoàn thành / tạm dừng) | Ghi chú |
|---|---|---|---|---|---|
| WR-01 | P0-S | | | | |
| WR-02 | P0-S | | | | Phương án A / B (A nếu không có phản hồi) |
| WR-03 | P1 | | | | |
| WR-04 | P0-S | | | | |
| WR-05 | P0-S | | | | |
| WR-06 | P0 | | | | |
| WR-10 | P0-S | | | | |
| WR-11 | P0-S | | | | |
| WR-12 | P0-S | | | | |
| WR-13 | P0-S | | | | |
| WR-14 | P0-S | | | | |
| WR-15 | P0 | | | Hoàn thành | |
| WR-16 | P1 | | | | |
| WR-17 | P1 | | | | |
| WR-18 | P1 | | | | Giữ / thay đổi |
| WR-19 | P1 | | | | |
| WR-19a | P1 | | | | |
| WR-20 | P0 | | | | |
| WR-21 | P0 | | | | |
| WR-22 | P1 | | | | |
| WR-23 | P0 | | | | Miễn đặt phòng thử? |
| WR-24 – 29 | P1 / P2 | | | | |
| WR-30 | P0 | | | | |
| WR-31 | P0 | | | | |
| WR-40 | P0-S | | | | |
| WR-40a | P0-S | | | | Thứ Bảy 10/31? |
| WR-41 | P2 | | | | |
| WR-42 | P2 | | | | Cần / không cần |
