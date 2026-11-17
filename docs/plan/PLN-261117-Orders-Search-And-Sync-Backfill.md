# PLN-261117 — Console Orders: tìm theo mã đơn · đồng bộ Shopify dừng ở 500 đơn

| | |
|---|---|
| Trạng thái | 🟨 **Chờ duyệt** (§7) |
| Yêu cầu | Chủ dự án, 2026-11-17: "ở màn hình Order hãy thêm search theo mã đơn hàng"; "hiện tại chỉ có 500 đơn hàng và 228 customers" |
| Phạm vi | `apps/web` (console → Orders), `apps/api` (`admin/orders`, đồng bộ Shopify). Không đụng widget |
| Migration | **A: không có SQL** (đã có index `idx_orders_number`). **B: tuỳ phương án** (§3) |
| Deploy | Push `deploy/talk-ivyusa` → CI → server build lại `api` và `web` |

## 1. Hiện trạng (đọc code, 2026-11-17)

**A — Màn Orders của console** (`apps/web/src/domain/orders/OrdersPage.tsx`, 69 dòng): một bảng (Order · Status · Amount · Items · Date) và phân trang. Không có ô tìm hay bộ lọc nào. API `GET /admin/orders` chỉ nhận `page`, `size`, sắp theo ngày tạo giảm dần, đã lọc theo `tenant_id`.

**B — Vì sao chỉ có 500 đơn** (`apps/api/src/domain/order/shopify-sync.service.ts`, `shopify-admin.client.ts`):

| Điểm trong code | Hệ quả |
|---|---|
| `MAX_PAGES = 10`, mỗi trang 50 đơn | Một lần đồng bộ đọc tối đa **500 đơn** — đúng con số đang thấy |
| Query `orders(... sortKey: UPDATED_AT)`, không có `reverse` | Đọc theo thứ tự **cập nhật cũ nhất trước**. 500 đơn đã lấy là 500 đơn lâu chưa đổi nhất, không phải 500 đơn mới nhất |
| Sau lần chạy đầu, dù còn trang chưa đọc ("more pages remain"), con trỏ vẫn được đặt = lúc bắt đầu chạy | Các lần **Sync now** sau chỉ lấy đơn "cập nhật từ con trỏ". **Phần còn lại của lần đầu không bao giờ được đọc**, trừ khi đơn đó đổi trạng thái (webhook) hoặc chủ đơn đăng nhập widget (bù tối đa 100 đơn / khách) |
| Token không có quyền `read_all_orders` (`shopify.app.toml` và hướng dẫn chỉ xin 4 quyền đọc) | Theo quy định của Shopify, khi đó API chỉ trả đơn trong **60 ngày gần nhất** |
| 228 customers | Theo code, khách được tạo từ chính các đơn đã đồng bộ, nên số khách đi theo số đơn |

Phần B là suy ra từ code. **Chưa kiểm trên production:** dòng trạng thái trong popup Shopify (nếu ghi "initial full sync, more pages remain" là đúng trường hợp này) và ngày của các đơn trong màn Orders.

## 2. Thiết kế A — tìm theo mã đơn

```
Orders                                                   (PageHeader như cũ)
Orders synced from the store.

┌──────────────────────────────────────┐
│ 🔍  Search by order number…       ✕  │                 ← mới
└──────────────────────────────────────┘
┌──────────┬────────────┬──────────┬───────┬─────────────┐
│ Order    │ Status     │   Amount │ Items │ Date        │
├──────────┼────────────┼──────────┼───────┼─────────────┤
│ #39891   │ Confirmed  │   $55.00 │     3 │ Nov 16, 2026│
│ #39812   │ Delivered  │   $18.00 │     1 │ Nov 14, 2026│
└──────────┴────────────┴──────────┴───────┴─────────────┘
                                   ‹ 1 2 3 ›   (đếm theo kết quả tìm)

Không có kết quả:   No orders match "39x".      [Clear search]
```

- Gõ `39891`, `#39891` hay `IVY-39891` đều tìm được: bỏ dấu `#` và khoảng trắng đầu / cuối, so **chứa** (không phân biệt hoa thường) với `order_number`.
- Chờ 300ms sau phím cuối mới gọi API; đổi từ khoá thì về trang 1; nút ✕ và phím Esc xoá ô tìm.
- Từ khoá nằm trên URL (`/orders?q=39891`), nên tải lại trang hay gửi link vẫn giữ kết quả.
- Chỉ đọc dữ liệu: không có thao tác lưu, nên không cần toast (CLAUDE.md §2 — kết quả hiện ngay).

**Thay đổi:**

| Phần | File | Nội dung |
|---|---|---|
| API | `order/dto/request/*` (mới: `AdminOrderListQuery`), `order.controller.ts`, `order.service.ts` | `GET /admin/orders?q=` (tuỳ chọn, tối đa 32 ký tự, class-validator). `listAll` thêm điều kiện `order_number LIKE %q%` **trong cùng `tenant_id`**; ký tự `%` `_` trong từ khoá được escape. Không có `q` thì y như cũ |
| Web | `orders.service.ts`, `orders.hooks.ts`, `OrdersPage.tsx` | Ô tìm, debounce, `q` trong query key (kèm `tenantId` như hiện nay), trạng thái rỗng riêng cho tìm kiếm |
| i18n | `apps/web/src/i18n/locales/{en,es,ko,vi,ja,zh}/orders.json` | `searchPlaceholder`, `searchClear`, `emptySearch` — đủ 6 ngôn ngữ, `npm run i18n:check` |
| Test | `order.service` spec (mới 3 ca) | có `q` → chỉ đơn khớp của đúng tenant; `q` chứa `%` không khớp tất cả; không `q` → như cũ |

## 3. Thiết kế B — đồng bộ đủ đơn (cần chọn phương án ở §7)

**B1 (khuyến nghị) — lần đầu đọc tới hết, mới nhất trước:**
- Lần đồng bộ đầu (chưa có con trỏ) đọc **mới nhất trước** (`reverse: true`) và không dừng ở 10 trang: đọc tới hết, có giới hạn an toàn (ví dụ 200 trang = 10.000 đơn, và tự chậm lại theo hạn mức của Shopify).
- Nếu vẫn chưa hết khi chạm giới hạn: **không đặt con trỏ**, ghi rõ "còn đơn chưa đọc" ở dòng trạng thái, lần Sync now sau đọc tiếp.
- Các lần sau (đã có con trỏ) giữ nguyên cách chạy hiện nay.
- Không cần SQL. Rủi ro: lần đầu với cửa hàng lớn chạy lâu (vài phút); chạy nền, không chặn console.

**B2 — chỉ nâng trần:** đổi `MAX_PAGES` 10 → 100. Ít code nhất, nhưng vẫn giữ lỗi "còn trang mà con trỏ vẫn nhảy" cho cửa hàng trên 5.000 đơn.

**Với tenant ivyusa đang ở trạng thái "đã chạy lần đầu, thiếu đơn":** cần một lần **đồng bộ lại từ đầu**. Đề xuất thêm nút / tham số "Full re-sync" (bỏ con trỏ rồi chạy như lần đầu), ghi audit. Upsert theo mã đơn Shopify nên chạy lại không tạo bản trùng.

**Đơn cũ hơn 60 ngày:** chỉ đọc được khi app Shopify có quyền `read_all_orders`. Quyền này do Shopify xét duyệt và chủ cửa hàng cấp; code không tự mở được.

## 4. Ảnh hưởng phụ

- **Đa tenant:** console và API dùng chung cho mọi tenant của bản cài này. A chỉ thêm tham số tuỳ chọn, mặc định không đổi. B đổi cách chạy lần đồng bộ đầu của mọi tenant Shopify trên server này (hiện chỉ có ivyusa).
- **Hiệu năng A:** `LIKE %q%` không dùng được index, nhưng đã thu hẹp theo `tenant_id` (có index). Vài chục nghìn đơn vẫn nhanh; nếu sau này chậm thì đổi sang so khớp đầu chuỗi.
- **Hạn mức Shopify (B):** đọc nhiều trang liên tiếp tiêu hạn mức GraphQL của cửa hàng; client hiện đã đọc chi phí query, B1 phải chờ khi hạn mức thấp.
- **Widget:** không đổi code. Có thêm đơn trong DB thì các màn Order / Delivery / My Orders của khách có thêm dữ liệu.
- E2E gate của nhánh chỉ chạy widget; A và B dựa vào unit test của API và kiểm tay trên console.

## 5. Kiểm thử

- Unit API: ca của A (§2); B: lần đầu vượt trần → con trỏ không đặt, lần sau đọc tiếp; lần đầu đọc hết → con trỏ đặt; thứ tự mới nhất trước.
- Tay, local: tìm `39891`, `#39891`, chuỗi không có, xoá ô tìm, đổi trang trong kết quả, tải lại trang giữ `q`.
- Sau deploy: tìm một mã đơn thật trên console production; chạy Full re-sync, so số đơn với Shopify admin.

## 6. Tài liệu sau khi làm

TCR, RPT (kèm SHA, run CI, trạng thái server), `ivy-docs/BUGS.md` (B là lỗi: BUG-033), FIX cho B.

## 7. Xin bạn xác nhận

1. **Duyệt phần A (ô tìm theo mã đơn) như §2?**
2. **Phạm vi tìm:** **a (khuyến nghị)** chỉ mã đơn · **b** thêm cả email / tên khách (cần thêm join và che bớt dữ liệu cá nhân, làm lâu hơn).
3. **Phần B (đồng bộ thiếu đơn):** **a (khuyến nghị)** làm B1 + nút Full re-sync cùng đợt này · **b** chỉ B2 (nâng trần) · **c** chưa làm, chỉ làm A.
4. **Đơn cũ hơn 60 ngày:** **a** không cần · **b** cần — khi đó bạn phải xin quyền `read_all_orders` cho app trên Shopify; tôi chỉ ghi hướng dẫn.

Trả lời ví dụ: `1. ok  2. a  3. a  4. a`
