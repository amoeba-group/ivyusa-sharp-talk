# PLN-261117 — Ẩn các phần Go2Joy trong console của IVY

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-17** (`1. ok 2. a 3. a`) và đã làm — [RPT-261117](../implementation/RPT-261117-IVY-Hide-Go2Joy.md) |
| Yêu cầu | Chủ dự án, 2026-11-17: "hãy ẩn hết những section có Go2joy trong dự án này" |
| Phạm vi | `apps/web` (console). Không đụng API, widget, database |
| Migration | Không có SQL |
| Deploy | Push `deploy/talk-ivyusa` → CI → server build lại `web` |

## 1. Khảo sát (đọc code, 2026-11-17)

Go2Joy là một khách hàng khác của nền tảng (đặt phòng khách sạn, Việt Nam). Code của họ nằm chung repo. Trong console, chữ "Go2Joy" hiện ra cho người dùng ở **3 nhóm**; các chỗ còn lại (khoảng 60 file ở API / widget / web) chỉ là ghi chú trong code, người dùng không thấy.

| # | Chỗ hiện | Hiện gì | IVY có dùng không |
|---|---|---|---|
| 1 | Tenant Settings → **Platforms** → Add a platform | Nút **+ Go2Joy Partner API** (và thẻ / form của nó nếu đã kết nối) | Không |
| 2 | **Customers** → tab **Business customers** | Danh sách "công ty" là khách sạn đối tác: nút thêm khách sạn theo `hotelSn`, loại phòng, giờ mở cửa, "Go2Joy synced…", "From Go2Joy (read-only)"… | Không — IVY bán lẻ cho người mua cá nhân |
| 3 | Chữ ví dụ | AI Settings (ô nhập câu hỏi mẫu: "How do I pay Go2Joy? … Techcombank…") · Tenant Settings → Widget (gợi ý tên nhân viên: "Go2Joy Support") · Platforms → Own platform (ví dụ "Go2Joy", `partner.go2joy.vn`) | Chỉ là ví dụ, nhưng lộ tên và số tài khoản mẫu của khách hàng khác |

Console không có sẵn cơ chế bật / tắt các phần này theo tenant: danh sách nền tảng là hằng số trong code (`integration-providers.ts`), tab Business customers luôn hiện.

## 2. Thiết kế

**Cơ chế:** một file cấu hình của bản cài, `apps/web/src/lib/deployment.ts`, khai báo `GO2JOY_ENABLED = false`. Nhánh `deploy/talk-ivyusa` chỉ phục vụ IVY và không bao giờ merge vào `main` (CLAUDE.md §8), nên đặt cờ ngay trong code của nhánh là đủ: không cần sửa cấu hình trên server, không ảnh hưởng bản cài của Go2Joy (chạy từ nhánh khác).

**Ẩn, không xoá:** code Go2Joy giữ nguyên; chỉ không vẽ ra. Bật lại = đổi cờ thành `true`.

```
Tenant Settings → Platforms                         Customers
Add a platform                                      ┌──────────────────────────────────┐
[+ Shopify] [+ Cafe24] [+ WooCommerce] [+ Odoo]     │ Trước:  [Business customers] [Personal customers]
[+ Haravan] [+ Own platform]                        │ Sau:    (không có hàng tab — chỉ còn danh sách
            ▲ không còn [+ Go2Joy Partner API]      │          khách cá nhân như tab Personal hiện nay)
                                                    └──────────────────────────────────┘
```

| Nhóm | Thay đổi |
|---|---|
| 1 | Bỏ `go2joy_partner` khỏi danh sách "Add a platform" và khỏi các thẻ đã kết nối khi cờ tắt |
| 2 | Khi cờ tắt: không vẽ hàng tab, luôn hiện danh sách khách cá nhân; link cũ `?tab=b2b` rơi về danh sách đó |
| 3 | Đổi chữ ví dụ trong 6 file ngôn ngữ thành ví dụ trung tính (không tên khách hàng, không số tài khoản): "How do I pay? … bank name\|account number", "Support team", "My store", `https://example.com/` |

## 3. Thay đổi

| Phần | File |
|---|---|
| Cờ | `apps/web/src/lib/deployment.ts` (mới) |
| Nhóm 1 | `domain/settings/integration-providers.ts`, `SettingsPlatformsPage.tsx` |
| Nhóm 2 | `domain/customers/CustomersPage.tsx` |
| Nhóm 3 | `i18n/locales/{en,es,ko,vi,ja,zh}/{aiSetting,settings}.json` — `npm run i18n:check` |

## 4. Ảnh hưởng phụ

- **Tenant khác trên cùng server:** hiện chỉ có ivyusa. Nếu sau này thêm tenant khách sạn trên `talk.ivyusa.com` thì phải bật lại cờ.
- **API không đổi:** các endpoint Go2Joy vẫn tồn tại ở server (không ai gọi). Ẩn ở giao diện không phải là khoá quyền.
- **Nhóm 3 đổi chữ dùng chung** của mọi bản cài lấy code từ nhánh này — chỉ là ví dụ, không đổi hành vi.
- Dashboard có nhãn "Go2Joy Partner" nhưng chỉ hiện khi tenant đã kết nối Go2Joy; ivyusa chưa kết nối nên không thấy. Không cần đổi.
- Menu **Customers** vẫn còn (danh sách khách cá nhân).

## 5. Kiểm thử

Local: Platforms không còn nút Go2Joy; Customers không còn tab Business; mở `/customers?tab=b2b` vẫn ra danh sách khách cá nhân; tìm chữ "Go2Joy" trên các màn AI Settings, Tenant Settings → Widget / Platforms không còn. Typecheck, build, `i18n:check`.

## 6. Xin bạn xác nhận

1. **Duyệt kế hoạch này?**
2. **Phạm vi:** **a (khuyến nghị)** cả 3 nhóm · **b** chỉ nhóm 1 (nút Go2Joy ở Platforms) · **c** nhóm 1 + 3, giữ tab Business customers.
3. **Tab Business customers (nhóm 2):** **a (khuyến nghị)** ẩn cả tab · **b** giữ tab, chỉ ẩn các ô / chữ riêng của Go2Joy bên trong (làm lâu hơn, và tab gần như trống với IVY).

Trả lời ví dụ: `1. ok  2. a  3. a`
