# PLN-261118 — Kiểu chuông trên điện thoại: khung kín màn hình, chừa thanh menu dưới

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-18** (`1. ok 2. a 3. a`: chỉ trình duyệt, không có app riêng; máy tính bảng nhỏ và xoay ngang giữ dạng hiện tại) và đã làm — [RPT-261118](../implementation/RPT-261118-IVY-Bell-Phone-Fullscreen.md) |
| Nguồn | Chủ dự án, 2026-11-18: frame Figma `3050:24` (ảnh do chủ dự án gửi) — "trên điện thoại hãy làm như thiết kế này… không bị đè lên [thanh menu dưới] và hiển thị fullscreen" |
| Phạm vi | `apps/widget/public/embed.js` (loader), `e2e`, một dòng trong đoạn mã cài trên theme |
| Migration | Không có SQL. Không đổi API. Không đổi console |
| Thay thế | Quyết định 3a của [PLN-261118-IVY-Bell-Panel-Follow-Header](PLN-261118-IVY-Bell-Panel-Follow-Header.md) (điện thoại: khung nằm dưới header) — thiết kế cho thấy khác |

## 1. Thiết kế nói gì (frame `3050:24`, điện thoại dọc)

- Khung bắt đầu **từ đỉnh màn hình**, che header của trang cửa hàng. Dòng đầu tiên là header của khung: "Hi, Kiho" · 🌐 EN · ⚙ · ✕.
- Khung kết thúc **ở mép trên thanh menu dưới** của ivyusa.com (Home · K-Beauty · My Bag · Beautizen · Round Table · My Ivy). Thanh menu vẫn thấy và bấm được.
- Khung rộng kín màn hình, không bo góc, không viền.

Tôi chỉ có ảnh PNG của frame (kết nối Figma hết lượt gọi của gói Starter), nên không đọc được số đo px, màu hay cỡ chữ. Kế hoạch này chỉ sửa **vị trí và kích thước** của khung. Nội dung bên trong (header, tab, chip, dòng thông báo) đã làm ở T01–T15 và nhìn bằng mắt khớp với ảnh; tôi không đo lại được.

## 2. Hiện trạng (đo trên bản Preview của theme nháp, 2026-11-18)

| Mục | Số đo |
|---|---|
| Thanh menu dưới | `nav.mobile-nav`, `position: fixed; bottom: 0`, cao **67px**, `z-index: 29` |
| Hiện ở cỡ màn nào | Dưới **768px** (theme ẩn nó từ 768px). Gồm cả điện thoại xoay ngang (734×343) và máy tính bảng nhỏ (640–767px) |
| Khi cuộn | Không ẩn, không dịch chuyển |
| Vùng an toàn phía dưới (iPhone) | Thanh menu không tự cộng `safe-area-inset-bottom`; trang không khai báo `viewport-fit=cover`, nên trình duyệt tự giữ nội dung trong vùng an toàn |
| Khung talk hiện nay (điện thoại) | Từ dưới header (175px) tới **đáy màn hình**, lớp trên cùng → **che thanh menu**, ô nhập tin nằm chồng đúng chỗ thanh menu |

Ngưỡng của hai bên lệch nhau: widget coi dưới 640px là điện thoại, theme hiện thanh menu tới 767px. Ở 640–767px khung dạng thẻ cũng đang chạm vào thanh menu.

## 3. Thiết kế kỹ thuật

### 3.1 Khung không bao giờ đè thanh menu dưới (mọi cỡ màn)
- Đoạn mã cài có thêm một khoá: `bottomBar: ".mobile-nav"` (CSS selector của thanh menu).
- Loader đo thanh đó mỗi lần đo header (khi mở, cuộn, đổi cỡ, xoay máy). Nếu thanh đang hiện và dính ở đáy, khung kết thúc tại mép trên của nó. Thanh ẩn (từ 768px) hoặc không khai báo khoá → như hiện nay.
- Áp cho cả ba dạng: điện thoại, thẻ trên máy tính bảng nhỏ, điện thoại xoay ngang.

### 3.2 Điện thoại dọc (< 640px): từ đỉnh màn hình
- Mép trên của khung = 0, không còn nằm dưới header.
- Chiều cao = phần màn hình nhìn thấy trừ thanh menu: `calc(100dvh − 67px)` (số 67 là số đo được, không viết cứng).

### 3.3 iOS và Android: những chỗ dễ sai

| Vấn đề | iOS Safari | Android Chrome | Cách xử lý |
|---|---|---|---|
| Thanh địa chỉ co giãn khi cuộn | Chiều cao nhìn thấy đổi liên tục | Tương tự | Dùng `100dvh` (đã dùng từ T15); máy cũ không có `dvh` thì `100vh`. Đo lại khi `resize` |
| Vùng an toàn phía dưới (vạch home) | Có | Thanh điều hướng cử chỉ | Trang không dùng `viewport-fit=cover` nên trình duyệt đã chừa. Khung kết thúc ở mép trên thanh menu **đo được**, nên đúng trong cả hai trường hợp |
| Tai thỏ / Dynamic Island | Trong Safari, trang nằm dưới thanh trạng thái | Tương tự | Không cần chừa thêm. Hình đảo đè lên header trong ảnh là khung máy của bản vẽ. Chỉ khác nếu IVY có app riêng mở trang ở chế độ tràn viền (câu hỏi 2, mục 7) |
| Bàn phím ảo | Bàn phím đè lên trang, phần `fixed` không tự co; Safari tự cuộn ô nhập vào tầm nhìn | Từ Chrome 108 cũng không co trang | Khi bàn phím mở (`visualViewport` thấp hơn cửa sổ rõ rệt), khung co lại vừa phần nhìn thấy, để ô nhập và tin nhắn mới nhất nằm ngay trên bàn phím; thanh menu dưới lúc đó nằm sau bàn phím. Bàn phím đóng → trở lại như 3.2 |
| Chạm vào thanh menu khi khung đang mở | — | — | Trang chuyển hướng như bình thường; khung đóng (đã là hành vi "bấm ra ngoài") |

Phần bàn phím ảo **không kiểm được bằng giả lập** (giả lập không có bàn phím thật). Tôi viết test đơn vị cho phép tính, còn hành vi thật phải thử trên máy thật.

### 3.4 Các cỡ khác
- **Điện thoại xoay ngang** (ví dụ 734×343): khung từ đỉnh, cao tới mép trên thanh menu (276px), giữ dạng thẻ 380px bên phải.
- **Máy tính bảng nhỏ 640–767px:** khung dạng thẻ dưới header như T17, nhưng dừng ở mép trên thanh menu.
- **Từ 768px:** không đổi so với T17.

## 4. Wireframe

```
HIỆN NAY (điện thoại)            THEO THIẾT KẾ                   BÀN PHÍM MỞ
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│ ☰ IVY   👤 🛒 🔔│            │ Hi, Kiho 🌐EN ⚙ ✕│ ← từ đỉnh  │ Hi, Kiho 🌐EN ⚙ ✕│
│ [search]         │            │ Notifications│Chat│            │ Notifications│Chat│
│ menu …           │ 175        │ (Order)(Delivery)…│            │  … tin nhắn …    │
├──────────────────┤            │ Today's          │            │ [Ask Anything  ➤]│
│ Hi, Kiho 🌐 ⚙ ✕ │            │  IVY-39891 …     │            ├──────────────────┤
│ Notif. │ Chat    │            │  IVY-39891 …     │            │                  │
│  …               │            │ Yesterday's      │            │   bàn phím ảo    │
│                  │            │  IVY-39891 …     │            │                  │
│ [Ask Anything ➤]│ ← đè lên   ├──────────────────┤ ← dừng ở đây└──────────────────┘
│▒▒ thanh menu ▒▒▒▒│   thanh    │ Home K-B Bag … Ivy│   67px
└──────────────────┘   menu     └──────────────────┘
```

## 5. Việc trên theme (chủ dự án, 1 dòng)

Trong `layout/theme.liquid` của theme nháp, thêm dòng `bottomBar`:

```liquid
window.SHARPTALK_WIDGET_CONFIG = {
  shop: "ivyusa.myshopify.com",
  widgetUrl: "https://talk.ivyusa.com/widget",
  trigger: "#st-bell",
  bottomBar: ".mobile-nav"
};
```

Chưa thêm dòng này thì khung vẫn mở từ đỉnh màn hình nhưng còn đè thanh menu.

## 6. Kiểm thử

- **Unit loader:** khung từ 0 trên điện thoại; dừng ở mép trên thanh menu; thanh ẩn hoặc không khai báo → tới đáy; bàn phím mở → vừa phần nhìn thấy; 640–767px và xoay ngang dừng ở thanh menu.
- **E2E:** sửa TC-17-06 (điện thoại: từ 0, cao = màn hình − thanh menu, thanh menu bấm được), thêm ca cho 700×1000 và xoay ngang có thanh menu. Trang thử có thêm thanh menu 67px giống theme.
- **Trên Preview sau deploy:** chạy lại 18 thiết bị giả lập (iOS bằng WebKit, Android bằng Chromium), kỳ vọng: mọi máy dưới 768px có khung kết thúc đúng mép trên thanh menu; điện thoại dọc bắt đầu từ 0.
- **Máy thật (chủ dự án):** một iPhone (Safari) và một máy Android (Chrome). Kiểm riêng: gõ tin nhắn với bàn phím mở; cuộn cho thanh địa chỉ co lại; xoay máy.

## 7. Cần chủ dự án quyết

1. **Duyệt hướng làm ở mục 3?**
2. **IVY có app điện thoại riêng mở ivyusa.com bên trong không?**
   - a. Không, khách chỉ dùng trình duyệt (Safari, Chrome, trình duyệt trong Instagram/Facebook) — làm như trên (khuyên dùng nếu đúng thực tế).
   - b. Có app riêng — cần thêm phần chừa tai thỏ ở đỉnh khung; cho tôi biết app nào để kiểm.
3. **Máy tính bảng nhỏ (640–767px) và điện thoại xoay ngang** (thiết kế không vẽ):
   - a. Như mục 3.4: giữ dạng hiện tại, chỉ thêm việc không đè thanh menu (khuyên dùng).
   - b. Coi mọi máy dưới 768px là điện thoại: khung rộng kín màn hình, từ đỉnh.
