# FIX-261118 — iPhone tự phóng to trang khi chạm vào ô nhập của widget

ivy-docs: BUG-036. Báo bởi chủ dự án ngày 2026-11-18, iPhone (Safari), bản Preview của theme nháp `Ivyusa Talk Staging`.

## Hiện tượng

Chạm vào ô "Ask Anything": cả trang bị phóng to. Khung talk rộng hơn màn hình: nút ⚙ và ✕ ra ngoài mép phải, tiêu đề lệch, ô nhập và thanh menu dưới không còn thấy. Đóng bàn phím xong trang vẫn ở trạng thái phóng to.

## Nguyên nhân gốc

- iOS Safari tự phóng to trang khi ô đang được chọn có cỡ chữ **dưới 16px**, và không tự thu lại. Việc này áp cho cả ô nằm trong iframe: trang bị phóng là trang cửa hàng.
- Cỡ chữ gốc của widget là thiết lập của tenant. IVY đặt 13px (theo thiết kế), và các ô nhập dùng `text-sm` = 0,875rem ≈ **11,4px**.
- Phần "khung co theo bàn phím" (PLN-261118 phone) chủ ý bỏ qua khi trang đang phóng to, để không nhầm thao tác chụm phóng với bàn phím. Nên sau khi bị phóng, khung cũng không tự vừa lại.

Vì sao không bị bắt trước: mọi kiểm thử chạy trên trình duyệt giả lập, nơi không có hành vi tự phóng to của iOS. Chỉ máy thật mới lộ ra.

## Sửa

`apps/widget/src/index.css`: trên thiết bị cảm ứng (`@media (pointer: coarse)`), và riêng cho iOS / iPadOS (`@supports (-webkit-touch-callout: none)`), mọi `input` (trừ checkbox / radio / range), `textarea`, `select` có `font-size: 16px !important`.

Không đổi gì trên desktop: ô nhập vẫn theo cỡ chữ của thiết kế.

Cách khác đã cân nhắc và không chọn: thêm `maximum-scale=1` vào thẻ viewport của trang cửa hàng. Nó nằm ở theme chứ không ở widget, và chặn luôn quyền phóng to của người dùng trên toàn trang.

## Ảnh hưởng

Trên điện thoại, chữ trong ô nhập (và placeholder "Ask Anything") lớn hơn bản vẽ: 16px thay vì ~11px. Đây là mức tối thiểu để iOS không phóng to. Áp cho mọi tenant.

## Kiểm

- E2E mới `TC-15-07` (project mobile, thiết bị cảm ứng): ô nhập chat và 3 ô của form liên hệ đều ≥ 16px.
- `test:ci` 144 / 144; TC-15-06 (6 ngôn ngữ, 390×844, không phần tử nào tràn) vẫn xanh với cỡ chữ mới.
- **Chưa kiểm được trên máy thật**: chủ dự án thử lại trên iPhone sau deploy.

## Phòng ngừa

- Ô nhập trên thiết bị cảm ứng không bao giờ dưới 16px; TC-15-07 giữ điều này.
- Giả lập không thay được máy thật cho các hành vi của trình duyệt di động (tự phóng to, bàn phím ảo, thanh địa chỉ). Thay đổi nào chạm tới ô nhập hoặc bố cục điện thoại cần một lần thử trên iPhone thật trước khi Publish.
