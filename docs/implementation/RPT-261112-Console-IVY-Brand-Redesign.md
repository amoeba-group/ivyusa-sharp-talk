# RPT-261112 — Console · Nhận diện IVY (màu chủ đạo từ favicon, làm mới giao diện)

Kế hoạch: [PLN-261112-Console-IVY-Brand-Redesign](../plan/PLN-261112-Console-IVY-Brand-Redesign.md).

**Quyết định của chủ dự án (2026-11-12):**
1. Duyệt hướng thiết kế.
2. Phạm vi **a**: bảng màu + khung + component dùng chung. Không chỉnh riêng từng màn.
3. Widget **giữ nguyên** (theo Figma IVY). Màu widget chỉnh trong console → Widget settings.

Skill dùng: `.claude/skills/frontend-design` (bản chính thức của Anthropic). Đã theo đủ quy trình của nó: token → tự rà lại so với lối mòn (PLN §5) → code → chụp ảnh tự soát sáng / tối.

## 1. Thay đổi

### Phần 0 (đã push trước, `ef496f81`)

- Favicon console và trang widget là icon IVY (`public/ivy-icon.png`).
- Logo sidebar và trang đăng nhập dùng icon IVY.
- Cài skill `frontend-design`.

### Phần thiết kế lại (chỉ `apps/web`)

| File | Nội dung |
|---|---|
| `theme.palette.js` | • Thang `primary` → **Periwinkle** (`500 #6A90EF`, nút `600 #4A6ADC`: chữ trắng 4.79:1).<br>• Thêm thang **`lavender`** (`500 #AD8CEC`, chữ `700 #7550C2`), có đủ biến thể tối.<br>• Nền trang **Mist** `#F5F6FB`.<br>• Biến `--st-title`: **IVY Navy** `#1A2E6B` khi sáng, màu chữ thường khi tối |
| `tailwind.config.js` | Màu `lavender`, `title`; `shadow-card` = không bóng (thẻ chỉ còn viền) |
| `layouts/Sidebar.tsx` | Nhãn nhóm menu viết thường. Thanh đánh dấu menu đang chọn chuyển màu lavender → periwinkle: chỗ duy nhất trong app có dải màu thương hiệu |
| `layouts/CommandPalette.tsx`, `components/{OnThisPage,HelpModal,Table}.tsx` | Bỏ nhãn VIẾT HOA giãn chữ. `Table`: số dùng `tabular-nums` |
| `components/PageHeader.tsx`, `KpiCard.tsx` | Tiêu đề trang và số liệu màu IVY Navy |
| `components/Badge.tsx`, `StatusBadge.tsx` | Kiểu `ai` (lavender). Trạng thái **AI answering** → lavender, **agent** → periwinkle: AI và người phân biệt được bằng màu |
| `domain/live-chat/{AutoReplyControl,BriefingCard,LiveChatPage}.tsx` | Các dấu hiệu AI (nút tự trả lời, icon AI Briefing, nhãn "auto reply" trên bong bóng) → lavender |
| `domain/auth/AuthShell.tsx` | Hero đăng nhập theo dải favicon (lavender 600 → periwinkle 600 → xanh `#2A7BC8`), quầng sky ở góc dưới phải. Bỏ 2 đốm mờ trang trí. Chữ chân trang sáng hơn (white/80) |
| `domain/journey/**` (4 file) | `indigo-*` (màu chính cũ) → `primary-*` để khớp màu mới |

**Không đổi:**
- Widget của khách, chữ / i18n, logic, API.
- Bản xem trước widget trong Settings (dùng màu của tenant).
- Màu biểu đồ.
- Màu riêng của từng kênh (Viber, Telegram…).

## 2. Kiểm thử (local, 2026-11-12)

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit` web | sạch |
| `vite build` web | OK |
| `npm run i18n:check` | đủ 6 ngôn ngữ (không có chữ mới) |
| Độ tương phản (WCAG) | Nút `#4A6ADC` / chữ trắng 4.79:1. Chữ AI `#7550C2` / nền lavender nhạt 5.17:1. Tiêu đề navy / nền Mist 11.8:1. Viền focus `#6A90EF` / trắng 3.07:1 (≥ 3:1 cho thành phần không phải chữ). Chữ trắng trên hero 4.07–4.79:1 (tiêu đề 30px) |

**Ảnh chụp tự soát (1366px, sáng + tối):** đăng nhập, Dashboard, Live Chat, Customers, Campaigns.
- Sáng: tiêu đề navy, nút periwinkle, thẻ viền mảnh không bóng, nhãn menu viết thường, thanh menu đang chọn có dải màu.
- Tối: tiêu đề tự chuyển sáng, nút giữ màu, tint chuyển tối.
- Sửa sau lần soát đầu: chip "AI answering" trong danh sách phiên vẫn màu cyan → chuyển lavender; icon AI Briefing → lavender; số trong bảng → `tabular-nums`.

E2E widget không bị ảnh hưởng: chỉ đổi `apps/web`, cổng CI chạy trên widget.

## 3. Ghi chú cho production

- Có hiệu lực ngay sau deploy, cho mọi tài khoản đăng nhập console trên talk.ivyusa.com.
- Không có SQL, không có migration, không ảnh hưởng widget của khách.
- Muốn widget cũng màu Periwinkle: console → Widget settings → màu chính `#6A90EF` (cấu hình, không cần deploy).

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Phần 0 | ✅ `ef496f81`, CI run 43164775495 xanh |
| Thiết kế lại | ✅ `c2352982`, CI run 43166024802 xanh lúc 06:10:50Z: verify ✅, e2e gate ✅, deploy-gate ✅ |
| Server `talkaibotprd01` | ⏳ **Chưa xác nhận.** Cron deploy vài phút sau khi CI xanh. Máy dev bị ELB trả 403, nên không tự kiểm tra được. Chủ dự án kiểm tra bằng `tail -n 30 ~/ivy-autodeploy.log`: tìm `Deployed.` cho `c2352982` |
| SQL / migration | Không có |
