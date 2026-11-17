# RPT-261117 — Ẩn các phần Go2Joy trong console của IVY

Kế hoạch: [PLN-261117-IVY-Hide-Go2Joy](../plan/PLN-261117-IVY-Hide-Go2Joy.md), duyệt ngày 2026-11-17 (`1. ok 2. a 3. a`).

## 1. Thay đổi

Không có SQL, không đổi API, không đổi widget. Ẩn, không xoá: bật lại bằng `GO2JOY_ENABLED = true`.

| Nhóm | File | Nội dung |
|---|---|---|
| Cờ | `apps/web/src/lib/deployment.ts` (mới) | `GO2JOY_ENABLED = false` cho nhánh `deploy/talk-ivyusa` |
| 1 · Platforms | `domain/settings/integration-providers.ts` | `PARTNER_PROVIDERS` rỗng khi cờ tắt → không còn nút **+ Go2Joy Partner API**, không còn thẻ của nó |
| 2 · Customers | `domain/customers/CustomersPage.tsx` | Không vẽ hàng tab; luôn hiện danh sách khách cá nhân; `?tab=b2b` rơi về danh sách đó |
| 3 · Chữ ví dụ | `i18n/locales/*/aiSetting.json`, `settings.json` (6 ngôn ngữ) | Câu hỏi mẫu: "Which carriers do you ship with? → USPS\|UPS" (bỏ tên Go2Joy và số tài khoản mẫu) · gợi ý tên nhân viên: "Support team" · Own platform: "My store", `https://example.com/` |

## 2. Kiểm thử (local, 2026-11-17)

| Màn | Kết quả |
|---|---|
| Tenant Settings → Platforms | Nút: Shopify · Cafe24 · WooCommerce · Odoo · Haravan · Own platform. Không có Go2Joy |
| Platforms → Own platform (form) | Placeholder "My store"; không có Go2Joy |
| Customers | 0 tab, có bảng khách cá nhân |
| `/customers?tab=b2b&company=1` | 0 tab, vẫn là bảng khách cá nhân |
| Tenant Settings → Widget · AI Settings · Dashboard | Không có chữ "Go2Joy" / "Techcombank" trong chữ hiển thị lẫn placeholder |

Typecheck và build `@sharptalk/web` sạch; `i18n:check` xanh.

**Còn lại, cố ý:**
- Các khoá dịch của chính phần Go2Joy (`integrations.go2joy_partner.*`, phần khách sạn trong `customers.json`, `dashboard.json`) vẫn nằm trong file ngôn ngữ; không màn nào vẽ chúng khi cờ tắt.
- Ghi chú trong code (API, widget, web) nhắc Go2Joy: không đổi, người dùng không thấy.
- Form Own platform còn placeholder mô tả "e.g. Hotel partner admin (in-house)": ví dụ về khách sạn nhưng không nêu tên Go2Joy; chưa đổi.
- API Go2Joy vẫn tồn tại ở server. Ẩn giao diện không phải là khoá quyền.

## 3. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Commit / CI | ⏳ |
| Server `talkaibotprd01` | ⏳ (build lại `web`) |
