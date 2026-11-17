# FIX-261117 — Đồng bộ Shopify dừng ở 500 đơn và bỏ sót phần còn lại (BUG-033)

## Hiện tượng
Chủ dự án kết nối Shopify cho tenant ivyusa trên production (2026-11-17) và bấm Sync now: console có đúng **500 đơn, 228 khách**, trong khi cửa hàng có 181.188 đơn và 219.739 khách. Bấm Sync now lần nữa không thêm đơn nào.

## Nguyên nhân (đọc code)
`ShopifySyncService.syncOrders`:
1. `MAX_PAGES = 10` × 50 đơn → một lần chạy dừng ở 500.
2. Query sắp theo `UPDATED_AT` tăng dần, nên 500 đơn đó là 500 đơn **lâu chưa đổi nhất**.
3. Dù `pageInfo` còn trang ("more pages remain"), lần chạy vẫn ghi con trỏ = lúc bắt đầu chạy. Lần sau chỉ hỏi "đơn đổi từ con trỏ" → **phần chưa đọc không bao giờ được đọc**.
4. Cùng lỗi ở lần chạy tăng dần: hơn 500 đơn đổi giữa hai lần đồng bộ thì phần vượt trần bị bỏ.
5. `syncOrdersForCustomer` (khách đăng nhập) dùng cùng thứ tự tăng dần với trần 100: khách có hơn 100 đơn nhận 100 đơn cũ nhất.

## Sửa
- Con trỏ chỉ tiến tới **thời điểm đổi của đơn cuối đã đọc** khi một lô dừng ở trần; chỉ khi đọc hết mới đặt = lúc bắt đầu chạy.
- Lô dừng ở trần thì phần còn lại được đọc tiếp ở nền, từng lô (20 trang), tối đa 200 lô, nghỉ 500ms giữa các lô; có khoá theo tenant để không chạy chồng.
- Lô không tiến được (số đơn đổi trong cùng một thời điểm nhiều hơn một lô) thì dừng, không lặp, không dời con trỏ.
- Lần đầu chỉ đọc cửa sổ `SHOPIFY_INITIAL_SYNC_DAYS` (60) thay vì cả cửa hàng; đơn ngoài cửa sổ lấy theo nhu cầu (`lookupOrderByNumber`). Lý do: PLN-261117 B3.
- `resyncRecent`: xoá con trỏ để tenant đã bị cắt (ivyusa) đọc lại cửa sổ.
- Khách đăng nhập: `reverse: true` — mới nhất trước.

## Kiểm
`shopify-sync.backfill.spec.ts` B-01..B-05 (TCR-261117 §1). Với cửa hàng thật: chưa kiểm, xem RPT-261117 §4.

## Phòng ngừa
- Vòng lặp phân trang có trần thì **kết quả "chưa hết" phải thay đổi trạng thái lưu lại** (con trỏ, cờ), không chỉ thay đổi câu thông báo. "more pages remain" trong chuỗi `detail` không ai đọc.
- Con trỏ tăng dần chỉ được tiến tới thứ đã đọc xong, không tới đồng hồ.
- Test phân trang phải có ca "dừng ở trần": bộ test cũ chỉ có ca một trang.
- Ước lượng theo cỡ dữ liệu thật trước khi chọn trần: 500 đơn là 0,3% cửa hàng này.
