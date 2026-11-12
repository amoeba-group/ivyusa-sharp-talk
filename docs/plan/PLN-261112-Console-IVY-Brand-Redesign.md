# PLN-261112 — Console · Nhận diện IVY (màu chủ đạo từ favicon, làm mới giao diện)

| | |
|---|---|
| Trạng thái | 🟨 **Chờ duyệt** phần thiết kế lại (§7). Phần 0 đã làm và đã push (`ef496f81`) |
| Yêu cầu | Chủ dự án, 2026-11-12: lấy favicon ivyusa.com làm logo dashboard và favicon; cài skill frontend-design; dùng nó làm lại giao diện "đẹp mắt, hiện đại", **màu chủ đạo theo favicon**. Sau đó làm tiếp T06 |
| Skill | `.claude/skills/frontend-design` (bản chính thức của Anthropic, xem `SOURCE.md`). Kế hoạch này theo quy trình của skill: token → tự rà lại → code → chụp ảnh tự soát |
| Migration | Không có. Chỉ đổi `apps/web` (console) |
| Deploy | Push → CI → server tự deploy |

## 0. Đã làm (theo yêu cầu trực tiếp, push `ef496f81`)

- Favicon console và trang widget dùng icon IVY (`public/ivy-icon.png`, 256×256). Widget chạy dưới `/widget/`, đã kiểm tra bản build trỏ đúng `/widget/ivy-icon.png`.
- Logo ở sidebar và 2 logo ở trang đăng nhập dùng icon IVY, thay ô vuông lấp lánh chung chung.
- Đã cài skill `frontend-design` vào dự án.
- PWA không được deploy cho IVY nên giữ nguyên icon.

## 1. Đối tượng (bước "ground in the subject" của skill)

- **Sản phẩm:** console của SharpTalk mà nhân viên CS IVY USA dùng cả ngày: Live Chat, Issue board, lịch sử hội thoại, cài đặt AI, kiến thức, đơn hàng, campaign.
- **Người dùng:** nhân viên CS và quản lý của một nhà bán lẻ làm đẹp (nail, mi, tóc, K-beauty). Họ đọc tiếng Anh / Hàn, làm việc nhiều giờ liền, bảng dữ liệu dày.
- **Việc chính:** trả lời khách nhanh, biết lúc nào AI đang trả lời và lúc nào người phải nhận.
- **Ý chính của thiết kế:** dải màu favicon đi từ **tím lavender sang xanh**. Mình gán nghĩa cho nó: **lavender = AI**, **xanh = người / hành động**. Đó đúng là câu chuyện của console: AI trả lời trước, người nhận khi cần. Màu lúc đó mang thông tin, không chỉ để trang trí.

## 2. Token

**Màu (6 giá trị gốc):**

| Tên | Hex | Vai trò |
|---|---|---|
| Periwinkle | `#6A90EF` | Màu thương hiệu (giữa dải favicon): viền focus, điểm nhấn, icon đang chọn |
| Periwinkle đậm | `#4A6ADC` | Nút chính, link. Chữ trắng trên nền này ≥ 4.5:1 (đạt WCAG AA) |
| Lavender | `#AD8CEC` | Mọi thứ của **AI** (nhãn "AI", trạng thái AI đang trả lời). Chữ dùng sắc đậm `#7550C2` (5.2:1 trên nền nhạt) |
| Sky | `#7CDAFF` | Chỉ nằm trong dải màu thương hiệu, không dùng làm chữ |
| IVY Navy | `#1A2E6B` | Tiêu đề trang; cùng màu navy của thẻ coupon trong Figma IVY (SPEC §4) |
| Mist | `#F5F6FB` | Nền trang: trắng ánh xanh rất nhẹ, thay xám trung tính `#F9FAFB` |

- Thang `primary` 50–950 sinh từ Periwinkle, sắc đậm chỉnh tay để giữ tông tím, không ngả sang xanh hoàng gia.
- Chế độ tối dùng lại cơ chế có sẵn trong `theme.palette.js`: chỉ đổi thang màu, mọi `primary-*` tự đổi theo.

**Chữ:** giữ **Pretendard**. Lý do có chủ đích: console chạy 6 ngôn ngữ, và chữ Latin + Hangul của Pretendard được thiết kế cùng nhau, nên chuỗi trộn Anh–Hàn (tên sản phẩm, tên khách) đứng thẳng hàng. Font trưng bày riêng sẽ không có chữ Hàn / Nhật / Trung, nên mỗi ngôn ngữ trông một kiểu. Tính cách đến từ thang chữ:

| | Cỡ / dòng | Độ đậm |
|---|---|---|
| Tiêu đề trang | 24/32, khoảng chữ −0.01em, màu IVY Navy | 600 |
| Tiêu đề khối | 16/24 | 600 |
| Nội dung | 14/20 | 400 |
| Phụ | 12/16 | 500 |

Số trong bảng và thẻ số liệu dùng `tabular-nums`, để cột số thẳng hàng.

**Bố cục:**
- Giữ khung hiện có: sidebar 240px + header + vùng nội dung. Nhân viên đã quen vị trí menu, đổi chỗ chỉ làm họ chậm lại.
- Nội dung căn trái. Form tối đa ~640px, để mỗi dòng dưới 80 ký tự.
- Bo góc theo cấp: khung / thẻ 12px, ô nhập / nút 8px, chip / badge tròn hẳn. Hiện mọi thứ đều cùng một độ bo.

## 3. Wireframe

**a) Khung console (1280px)**
```
┌────────────────┬──────────────────────────────────────────────────────┐
│ (ivy) ivyusa   │ Customers & commerce › Campaigns  [Search  Ctrl K] 🔔 ☀ EN │
│       SharpTalk├──────────────────────────────────────────────────────┤
│                │  nền Mist #F5F6FB                                     │
│ Overview       │  Campaigns                           [New campaign]  │ ← tiêu đề IVY Navy
│   ▦ Dashboard  │  Create and send outbound campaigns                  │
│ Conversations  │ ┌──────────────────────────────────────────────────┐ │
│ ▌ 💬 Live chat │ │ Name         Channel  Status   Audience  Created │ │ ← tiêu đề cột viết thường
│   ▤ Issue board│ ├──────────────────────────────────────────────────┤ │
│   ⟲ History    │ │ Back to sch… email    ● Sent      1,204   Nov 12 │ │ ← số thẳng hàng
│ AI & knowledge │ │ Mad Shade    email    ○ Draft         —        — │ │
│   ✦ AI settings│ └──────────────────────────────────────────────────┘ │
└────────────────┴──────────────────────────────────────────────────────┘
 ▌ = thanh 3px chuyển màu lavender → xanh: chỗ duy nhất trong app có dải màu thương hiệu
 Nhóm menu "Overview", "Conversations": chữ thường, không VIẾT HOA giãn chữ như hiện tại
```

**b) Trang đăng nhập: điểm nhấn duy nhất của cả console**
```
┌──────────────────────────────┬─────────────────────────────────┐
│░ lavender ─▶ periwinkle ─▶ sky░│                      ☀  English │
│░ (ivy) SharpTalk             ░│              (ivy)              │
│░                             ░│             ivyusa              │
│░ AI-powered chat & support   ░│           SharpTalk             │
│░ for your online store       ░│   ┌───────────────────────────┐ │
│░                             ░│   │ Email                     │ │
│░ ◇ AI answers, around the…   ░│   │ Password                  │ │
│░ ◇ Seamless human handoff    ░│   │ [         Sign in       ] │ │ ← Periwinkle đậm
│░ ◇ Multilingual by default   ░│   └───────────────────────────┘ │
└──────────────────────────────┴─────────────────────────────────┘
 Dải màu đúng hướng favicon (trên trái → dưới phải), bỏ 2 đốm mờ trang trí hiện có
```

**c) Nhãn AI / người**
```
 [✦ AI]  nền lavender nhạt, chữ #7550C2    → AI đang trả lời / AI soạn
 [● Staff] nền periwinkle nhạt, chữ #3F5BC9 → nhân viên đã nhận
```

## 4. Nguyên tắc

1. **Đậm ở một chỗ:** dải màu favicon chỉ nằm ở trang đăng nhập và thanh đánh dấu menu đang chọn. Không có dải màu nào trên thẻ, nút hay tiêu đề.
2. **Màu là thông tin:** lavender chỉ dành cho AI, xanh cho người và hành động. Màu trạng thái (đỏ / vàng / xanh lá) giữ như cũ.
3. **Yên tĩnh cho công việc dài:** thẻ chỉ có viền mảnh, không đổ bóng. Bóng chỉ dùng cho thứ nổi lên (menu xổ, modal).
4. **Không VIẾT HOA nhãn:** nhãn nhóm menu và tiêu đề cột viết thường.
5. **Chuyển động chỉ khi người dùng thao tác:** mở, đóng, xác nhận. Không thêm hiệu ứng tự chạy.
6. **Mức chất lượng tối thiểu:** viền focus nhìn thấy được (Periwinkle 2px, ≥ 3:1), tôn trọng giảm chuyển động, chế độ tối vẫn đúng, chạy tốt tới 375px.

## 5. Tự rà lại so với lối mòn (bước bắt buộc của skill)

| Bản nháp đầu | Vì sao là lối mòn | Đã đổi thành |
|---|---|---|
| Dải tím–xanh làm nền thẻ số liệu và nút chính | Bộ "SaaS-card kit": gradient phủ làm trang trí | Dải màu chỉ ở đăng nhập + thanh menu đang chọn; nút màu phẳng |
| Thẻ số liệu: số to, nhãn nhỏ, viền gradient | Kiểu mặc định của mọi dashboard | Số `tabular-nums` màu navy; chỉ phần thay đổi (tăng / giảm) có màu |
| Giữ nhãn VIẾT HOA giãn chữ ở sidebar và bảng | Dấu hiệu "template chrome" | Chữ thường, 12px, độ đậm 500 |
| Mọi thẻ cùng bo 12px + cùng bóng xám | Một độ bo cho mọi thứ | Bo theo cấp; thẻ chỉ có viền |
| Đổi sang một font hình học "hiện đại" | Lựa chọn cho có; mất chữ Hàn / Nhật / Trung | Giữ Pretendard, tạo tính cách bằng thang chữ và màu navy |
| Tím–xanh chỉ vì logo có màu đó | Màu không mang nghĩa gì | Lavender = AI, xanh = người: khớp đúng việc của console |

## 6. Thay đổi

**Theo §7-2a (khuyến nghị): bảng màu + khung + component dùng chung.** Mọi màn đổi theo trong một lần push, không viết lại từng màn.

| File | Nội dung |
|---|---|
| `apps/web/theme.palette.js` | Thang `primary` Periwinkle; thêm thang `lavender`; nền trang `--st-page` = Mist (tối giữ nguyên) |
| `apps/web/tailwind.config.js` | Màu `navy`, `lavender`; `shadow-card` = không bóng |
| `apps/web/src/layouts/Sidebar.tsx`, `Header` | Nhãn nhóm viết thường; thanh menu đang chọn chuyển màu lavender → xanh |
| `apps/web/src/domain/auth/AuthShell.tsx` | Nền hero theo dải favicon; bỏ 2 đốm mờ |
| `apps/web/src/components/{Card,Table,PageHeader,Button,Badge,KpiCard,Field}.tsx` | Viền thay bóng; tiêu đề cột viết thường; tiêu đề trang navy; bo góc theo cấp; `tabular-nums`; Badge thêm kiểu `ai` (lavender) |
| `live-chat/AutoReplyControl.tsx`, nhãn "auto reply" trên bong bóng (`LiveChatPage.tsx`) | Hai chỗ đang đánh dấu AI ở Live Chat → màu lavender |

**Không đổi:**
- Widget của khách. Widget theo Figma IVY (`ivy-docs/SPEC.md`), và màu của nó là cấu hình tenant trong console → Widget settings.
- Chữ, i18n, logic, API.

## 7. Xin bạn xác nhận

1. **Duyệt hướng thiết kế này?** Gồm: màu (§2), chữ Pretendard, wireframe (§3), nguyên tắc (§4). Duyệt thì mình làm, chụp ảnh tự soát cả sáng / tối, rồi push. Push là production tự cập nhật.
2. **Phạm vi:**
   - **a (khuyến nghị):** bảng màu + khung + component dùng chung (§6). Mọi màn đổi màu và kiểu cùng lúc, 1 lần push. Rủi ro thấp vì không viết lại logic màn nào.
   - **b:** như a, thêm chỉnh riêng các màn chính (Dashboard, Live Chat, Issue board), mỗi màn 1 lần push. Lâu hơn nhiều, làm xong mới quay lại T06.
3. **Widget của khách:**
   - **a (khuyến nghị):** giữ nguyên theo Figma IVY. Nếu muốn widget cũng màu Periwinkle, chỉnh trong console → Widget settings → màu chính, không cần sửa code.
   - **b:** đổi màu mặc định trong code widget. Chỉ có tác dụng với tenant chưa đặt màu riêng.

Trả lời ví dụ: `1. ok  2. a  3. a`
