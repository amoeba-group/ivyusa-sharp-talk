# FIX-261125 — Công tắc "Do not send me marketing messages" hiện sai với khách chưa chọn

| | |
|---|---|
| Phát hiện | 2026-11-25, khi soạn hướng dẫn test cho IVY (mục 35). Chủ dự án: "sửa công tắc mục 35 cho đúng luôn" |
| Ảnh hưởng | Widget → ⚙ Settings. Khách chưa từng chọn thấy công tắc **bật** (như đã từ chối), nhưng vẫn nhận khuyến mãi và yêu cầu review trong widget |
| Liên quan | PRD v1 S-02 · N-04 · N-05; [FIX-261125-IVY-Review-Request-Not-Shown](FIX-261125-IVY-Review-Request-Not-Shown.md) |

## 1. Nguyên nhân gốc

Cùng một câu hỏi "khách này có từ chối marketing không", hai chỗ trả lời theo hai quy tắc khác nhau:

| Chỗ | Quy tắc | Khách chưa chọn |
|---|---|---|
| Công tắc (`marketingOptOut`) | Từ chối khi **không có** dòng marketing nào bật. Lý do cũ: email / SMS marketing mặc định tắt | **Từ chối** → công tắc bật |
| Gửi đi (`marketingRefusers`): campaign N-04, yêu cầu review N-05 | Từ chối khi có dòng marketing **tắt** và không có dòng nào bật | **Không từ chối** → vẫn nhận trong widget |

Quy tắc của công tắc có từ trước PRD v1, khi marketing chỉ đi qua email / SMS. Từ PRD v1, khuyến mãi và yêu cầu review hiện cả trong widget cho khách chưa chọn. Từ đó công tắc nói một đằng, widget làm một nẻo.

## 2. Cách sửa

Công tắc dùng **đúng quy tắc của việc gửi**:

- Có dòng marketing bật → **tắt**.
- Có dòng marketing tắt và không có dòng nào bật → **bật**.
- Không có dòng nào (chưa chọn) → **tắt**.

Không đổi việc gửi. Email / SMS marketing vẫn tắt cho tới khi khách đồng ý. Bật công tắc thì dừng mọi thứ, như trước. CCPA ghi cùng các dòng tắt, nên sau CCPA công tắc cũng bật.

Widget: lúc đang chờ API, công tắc hiện tắt (trước đây là bật).

File:

- `notification.service.ts` (`marketingOptOut`) và spec
- widget `PreferencesPanel.tsx`
- hướng dẫn test mục 35

## 3. Kiểm thử

- **Unit** (`notification.service.spec.ts` 53/53):
  - chưa chọn → không từ chối;
  - chỉ có dòng giao dịch (shipping) → không tính là lựa chọn marketing;
  - opt-out → từ chối;
  - opt-in → không từ chối.
- **E2E** `13-settings`: 7/7.

## 4. Cách phòng

Một trạng thái mà khách nhìn thấy (công tắc, nhãn) phải đọc từ **cùng một hàm** với hàm quyết định việc gửi. Nếu cần hai hàm, phải có một test khẳng định chúng cho cùng kết quả với cùng dữ liệu. Ở đây đó là ca "reads as opted out exactly when the sends treat the customer as a refuser".
