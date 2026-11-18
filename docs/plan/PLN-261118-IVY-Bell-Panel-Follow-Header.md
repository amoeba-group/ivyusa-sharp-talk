# PLN-261118 — Kiểu chuông: khung bám theo header, có nút ✕ và nút ngôn ngữ

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-18** (`1. ok 2. a 3. a`) và đã làm — [RPT-261118](../implementation/RPT-261118-IVY-Bell-Panel-Follow-Header.md) |
| Nguồn | Chủ dự án, 2026-11-18, sau khi thử kiểu chuông trên theme nháp `Ivyusa Talk Staging`: "làm giống 100% thiết kế" và "cần khung bám theo header để UX/UI đẹp mắt" |
| Phạm vi | `apps/widget` (loader `public/embed.js`, `WidgetPanel.tsx`), một dòng chú thích trong console (`apps/web`, 6 ngôn ngữ), `e2e` |
| Migration | Không có SQL. Không đổi API |
| Liên quan | SPEC SCR-IVY-01, SCR-IVY-02, G-26, Q-17 · [GUIDE-261118](../guide/GUIDE-261118-IVY-Header-Bell-Install.md) |

## 1. Hiện trạng (đo trên bản Preview của theme nháp, 2026-11-18)

Kiểu chuông đang chạy: bấm chuông mở đúng khung IVY. Còn bốn chỗ chưa đạt.

| # | Vấn đề | Số đo |
|---|---|---|
| 1 | Khung đặt cố định cách mép trên 176px, không đi theo header | Desktop: header ở đầu trang kết thúc tại 171px, khi cuộn tại 91px → hở 85px. Điện thoại: khi cuộn xuống header ẩn → phía trên khung hở 176px trang |
| 2 | Máy tính bảng: khung **đè lên** header | iPad Mini, iPad Pro 11: header kết thúc tại 208px, khung bắt đầu tại 176px → đè 32px |
| 3 | Điện thoại xoay ngang: khung quá thấp để dùng | iPhone 15 ngang: khung cao 162px. Galaxy S24 ngang: 179px. Không có nút ✕ |
| 4 | Từ 640px trở lên, header của khung **không có nút ✕ và nút ngôn ngữ** | Thiết kế SCR-IVY-02: "Hi, {name}" · 🌐 EN · ⚙ · ✕ |

Điện thoại dọc (12 máy giả lập, iOS bằng WebKit, Android bằng Chromium): chuông nằm trong màn hình, khung vừa màn hình, có ✕, ô nhập nhìn thấy được, đóng được. Đây là giả lập, không phải máy thật.

**Chưa đối chiếu lại được với Figma hôm nay.** Kết nối Figma hết lượt gọi (gói Starter) sau frame `1006:2431`. Frame đó xác nhận điểm mở là chuông trên header; chưa thấy frame nào vẽ khung đang mở trên nền trang. Mục 4 dựa trên header đã làm ở T01 (đã đối chiếu `1006:7825` khi đó). Khoảng cách giữa header và khung vì vậy là câu hỏi ở mục 7.

## 2. Thiết kế

### 2.1 Khung bám theo header (loader)
- **Mốc bám:** phần tử `header` chứa chuông (`chuông.closest('header, [role=banner]')`). Đoạn mã cài có thể chỉ định khác bằng khoá mới `anchor` (CSS selector). Không tìm thấy mốc → dùng **Top offset** của console như hiện nay.
- **Vị trí:** mép trên của khung = mép dưới của mốc + khoảng cách (mục 7, câu 2). Tính lại khi cuộn, đổi cỡ cửa sổ, xoay máy, và khi header đổi chiều cao; gộp theo khung hình để không giật.
- **Header ẩn** (điện thoại, cuộn xuống): mép dưới của mốc ≤ 0 → khung lên sát mép trên màn hình.
- **Chiều cao:** phần còn lại của cửa sổ, tối đa bằng chiều cao khung của tenant (desktop 600–680px).
- **Không đủ chỗ** (dưới header còn chưa tới 360px, ví dụ điện thoại xoay ngang): khung phủ kín màn hình, kể cả header. Luôn có ✕ để đóng.

### 2.2 Header của khung (widget)
Ở kiểu chuông, header của khung giống kiểu nút tròn: nút ngôn ngữ theo thiết lập **Header buttons** của tenant (IVY đang bật), và **luôn có ✕**. Bấm lại chuông và bấm ra ngoài vẫn đóng khung như hiện nay.

### 2.3 Console
Không thêm ô nào. Sửa dòng chú thích dưới **Top offset (px)** (6 ngôn ngữ): giá trị này chỉ dùng khi trang không có header để bám.

## 3. Wireframe

```
DESKTOP — đầu trang                         DESKTOP — sau khi cuộn
┌────────────────────────────────────┐      ┌────────────────────────────────────┐
│ logo các thương hiệu               │      │ ☰ [search]  IVY beauty   👤 🛒 🔔│ ← header dính, 0–91
│ 25% OFF …                          │      │ menu …                             │
│ ☰ [search]  IVY beauty   👤 🛒 🔔│ 80   ├───────────────────┬────────────────┤
│ menu …                             │ 171  │                   │ Hi, Kiho 🌐EN ⚙ ✕│ ← bám ngay dưới header
├───────────────────┬────────────────┤      │                   │ Notifications│Chat│
│                   │ Hi, Kiho 🌐EN ⚙ ✕│      │   (trang)         │  …             │
│   (trang)         │ Notifications│Chat│      │                   │                │
│                   │  …             │      │                   │ [Ask Anything ➤]│
│                   │ [Ask Anything ➤]│      │                   └────────────────┘
│                   └────────────────┘      │                                    │
└────────────────────────────────────┘      └────────────────────────────────────┘
  hiện nay: khung ở 176 cả hai trường hợp (bên phải hở 85px)

ĐIỆN THOẠI — header còn      ĐIỆN THOẠI — đã cuộn xuống     XOAY NGANG / KHÔNG ĐỦ CHỖ
┌──────────────────┐         ┌──────────────────┐           ┌────────────────────────────┐
│ ☰ IVY   👤 🛒 🔔│         │ Hi, Kiho 🌐 ⚙ ✕ │ ← sát đỉnh │ Hi, Kiho        🌐EN ⚙ ✕ │
│ [search]         │         │ Notif. │ Chat    │           │ Notifications │ Chat       │
│ menu …           │ 176     │  …               │           │  …                         │
├──────────────────┤         │                  │           │ [Ask Anything            ➤]│
│ Hi, Kiho 🌐 ⚙ ✕ │         │                  │           └────────────────────────────┘
│ Notif. │ Chat    │         │                  │             phủ kín, đóng bằng ✕
│  …               │         │ [Ask Anything ➤]│
│ [Ask Anything ➤]│         └──────────────────┘
└──────────────────┘           hiện nay: hở 176px ở trên
```

## 4. Ảnh hưởng phụ

- **Mọi tenant dùng kiểu chuông** nhận hai thay đổi: khung bám header, và header khung có ✕ (cùng nút ngôn ngữ nếu tenant bật). Bản cài này chỉ có IVY. Tenant kiểu nút tròn: không đổi gì.
- **Không cần sửa theme** đã cài: header của ivyusa.com là thẻ `<header>` chứa chuông, loader tự tìm.
- **Hiệu năng trang cửa hàng:** thêm một trình nghe cuộn thụ động, chỉ hoạt động khi khung đang mở.
- **Test cũ của đợt PLN-260916** đang kỳ vọng "kiểu chuông ẩn ✕ và ngôn ngữ" → sửa theo hành vi mới.
- `embed.js` không cache (`/widget/embed.js`), nên cửa hàng nhận bản mới ngay sau deploy.

## 5. Kiểm thử

- **Unit / component:** `WidgetPanel` ở kiểu chuông hiện ✕ và nút ngôn ngữ; ẩn nút ngôn ngữ khi tenant tắt.
- **E2E (thêm vào `test:ci`)** trên trang thử `trigger-test.html`, có thêm biến thể header hai vị trí và header ẩn khi cuộn:
  - khung nằm ngay dưới header ở đầu trang và sau khi cuộn;
  - header ẩn → khung sát đỉnh;
  - cửa sổ 734×343 → khung phủ kín, có ✕;
  - không có mốc → dùng Top offset;
  - ✕, bấm lại chuông, bấm ra ngoài đều đóng.
- **Trên bản Preview của theme nháp sau deploy:** chạy lại ma trận 18 thiết bị giả lập (9 iOS/iPadOS bằng WebKit, 9 Android bằng Chromium), kỳ vọng mục 1 hết cả bốn vấn đề.
- **Máy thật:** tôi không có thiết bị. Chủ dự án mở link Preview trên ít nhất một iPhone và một máy Android trước khi Publish.

## 6. Việc không làm

- Không sửa theme của ivyusa.com.
- Không làm phần nhận diện khách đã đăng nhập (App Proxy `/apps/ivy/identity` đang 404): việc riêng.
- Không đổi kiểu nút tròn.

## 7. Cần chủ dự án quyết

1. **Duyệt hướng làm ở mục 2?**
2. **Khoảng cách giữa header và khung trên desktop** (thiết kế chưa xem được):
   - a. 8px, khung tách khỏi header như một thẻ nổi (khuyên dùng; hiện đang là 5px ở đầu trang).
   - b. 0px, khung dính liền mép dưới header.
   - c. Chờ: chủ dự án gửi ảnh frame Figma có khung đang mở trên nền trang, làm đúng theo ảnh.
3. **Điện thoại, khi header ẩn lúc cuộn xuống:**
   - a. Khung lên sát đỉnh, cao kín màn hình (khuyên dùng).
   - b. Khung giữ nguyên chỗ cũ.
