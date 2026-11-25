# TCR-261125 — IVY PRD v1, giai đoạn 4: S-01 · N-05 · C-03

| | |
|---|---|
| Kế hoạch | [PLN-261125-IVY-PRD-v1-Phase4](../plan/PLN-261125-IVY-PRD-v1-Phase4.md) |
| Báo cáo | [RPT-261125-IVY-PRD-v1-Phase4](../implementation/RPT-261125-IVY-PRD-v1-Phase4.md) |

## 1. Unit

### 1.1 Yêu cầu review — `review-request.service.spec.ts` (mới, 8 ca)

| Ca | Kỳ vọng |
|---|---|
| Truy vấn | Lọc cả `f.tenant_id` và `o.tenant_id`, status delivered, chưa xử lý, có khách, bỏ huỷ / hoàn. Cửa sổ `dueBefore = now − N`, `notBefore = now − (N + 7)`. Tối đa 200 đơn |
| Gửi | Hỏi về sản phẩm **đầu tiên chưa review** của đơn. Ngôn ngữ theo phiên gần nhất (KO). `refType = order_item`, `refId` đúng sản phẩm. Đánh dấu đơn bằng `now` |
| Không có ngôn ngữ | Tiếng Anh: "How was your order?" / "Leave a review for Lash Glue (#IVY-2)." |
| Bỏ qua | Khách từ chối marketing; đơn đã review hết. Cả hai vẫn được đánh dấu, không gửi |
| Review của người khác | Không tính là của khách này, vẫn gửi |
| Chạy trùng | Đơn đã bị tiến trình khác đánh dấu (`affected = 0`): không gửi |
| Không có đơn tới hạn | Không hỏi danh sách từ chối, không ghi gì |
| Lượt quét | Chỉ tenant có N hợp lệ (bỏ 0, 61). Một tenant lỗi không chặn tenant khác |

### 1.2 Ngày giao — `shopify-sync.shipment.spec.ts` (thêm 5 ca, sửa 1)

| Ca | Kỳ vọng |
|---|---|
| `summarizeFulfillments` | `deliveredAt` = `delivered_at` muộn nhất. Không có thì giờ cập nhật. `null` khi chưa giao hết |
| Gói mới đã giao | `deliveredAt` = giờ Shopify báo |
| Đơn đã delivered từ trước, chưa có giờ | Điền 1 lần, không gửi thông báo giao hàng |
| Đã có giờ | Không đổi, kể cả khi số tracking đổi |
| Đang giao | `deliveredAt = null` |
| Đọc lại cùng trạng thái (ca cũ) | Không lưu, không thông báo. Bản ghi mẫu nay có sẵn `deliveredAt` |

### 1.3 Cài đặt N ngày — `tenant.service.spec.ts` (thêm 5 ca)

| Ca | Kỳ vọng |
|---|---|
| 7 → bỏ trống → `null` | Lưu 7. Bỏ trống thì giữ 7. `null` thì tắt |
| 0 · 61 · 2.5 · '7' | **E5168** |

### 1.4 Báo cáo CSAT — `agent.service.csat.spec.ts` (thêm 2 ca, mở rộng 1)

| Ca | Kỳ vọng |
|---|---|
| Hai cuộc chat | Không gán nhân viên → `mode: 'ai'`. Có nhân viên → `'agent'`. Có phiếu liên hệ → `emailForm: true`. Một truy vấn, có lọc tenant |
| Truy vấn phiếu lỗi | Báo cáo vẫn trả về, `emailForm: false` |

## 2. E2E (widget) — `12-affiliate-csat.spec.ts`

| TC | Kỳ vọng | Kết quả |
|---|---|---|
| TC-12-08 | End → chưa trả lời đánh giá thì không có nút → Skip → **Start a new chat** → chỉ còn lời chào + menu. Sau 6 giây và sau khi tải lại vẫn sạch | ✅ |
| TC-12-09 | Sau Start a new chat, nút Affiliate mở chat mới: 1 bộ thẻ bước, có End, không có "chat has ended" sau 6 giây | ✅ |

T12 cả bộ: **9 / 9**, desktop.

## 3. Tích hợp trên máy (local)

| Bước | Kết quả |
|---|---|
| SQL chạy 2 lần | Không lỗi. 3 cột + `idx_ful_review_due (tenant_id, status, delivered_at)` |
| API khởi động | `Nest application successfully started`, `Review request sweep every 60 min` |
| `PATCH /tenants/widget-settings` | 0 và 61 → 400 **E5168**, có log cảnh báo. 5 → 200, `reviewRequestDays: 5` |
| Lịch chạy | Đơn IVY-1002 giao 6 ngày trước, N = 5. Lượt đầu (90 giây sau khi khởi động) ghi `asked 1, skipped 0`. Thông báo: `review`, "How was your order?", "Leave a review for IVY Repair Serum (IVY-1002).", `order_item` 2. Đơn được đánh dấu |
| `GET /agent/csat/conversations` | Mỗi dòng có `mode`, `emailForm` |
| Console | Settings → Marketing hiện thẻ **Review requests** (ô ngày = 5). Statistics → Satisfaction có cột **Answered by** / **Email form** |

## 4. Bộ test chung

| Bộ | Kết quả |
|---|---|
| API | 3031 / 3034. 3 ca chỉ đỏ trên Windows: embed-loader, board-attachment, heic-conversion |
| `packages/types` | 224 / 224 |
| Widget | 150 / 150 |
| Typecheck types · API · console · widget | Sạch |
| `i18n:check` | Đủ 6 ngôn ngữ |
| Manifest migration | Có 4 dòng mới |

## 5. Ca biên

- **Bật tính năng sau nhiều tháng:** đơn giao trước N + 7 ngày không bao giờ được hỏi (cửa sổ).
- **Re-sync nhiều tháng đơn:** `delivered_at` lấy theo giờ của Shopify, không theo lúc đồng bộ. Đơn cũ nằm ngoài cửa sổ.
- **Khách đổi ngôn ngữ:** câu theo phiên **gần nhất** lúc gửi. Thông báo đã gửi thì không đổi.
- **Chặn bộ nhớ trình duyệt (Start a new chat):** trang hiện tại vẫn sạch. Tải lại thì thấy lại đoạn đã kết thúc, đúng như trước khi có nút.
- **Nhân viên mở lại cuộc chat đã ẩn (BUG-044):** cuộc chat hiện lại, vì chỉ cuộc **ended** mới bị ẩn.
