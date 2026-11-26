# FIX-261126 — Câu hỏi nêu đúng tên sản phẩm mà AI không tìm ra sản phẩm đó

| | |
|---|---|
| Phát hiện | Smoke production của [PLN-261126](../plan/PLN-261126-IVY-Chat-Typed-Product-Questions.md), 2026-11-26 ~07:20 UTC, sau deploy `37e0d9f4` |
| Mức | 🟠 — tính năng thẻ sản phẩm chạy, nhưng với nhiều sản phẩm bán chạy khách không thấy thẻ nào |
| Báo cáo | [RPT-261126 §5](../implementation/RPT-261126-IVY-Chat-Typed-Product-Questions.md) |

## 1. Hiện tượng

Khách vãng lai trên talk.ivyusa.com/widget, tên lấy từ Popular products → Nails (3 sản phẩm bán chạy):

| Câu hỏi | Kết quả |
|---|---|
| "Is Gold Finger Holiday Limited Edition Nails in stock? How much is it?" | "I can't confirm stock or pricing for the Gold Finger Holiday Limited Edition Nails… use the Stock inquiry button". Không thẻ |
| "Tell me about Kiss Gel Fantasy Glue On Nails - Long Lasting False Nails. Is it in stock?" | "I don't have any details on Kiss Gel Fantasy Glue On Nails…", rồi nói về **sản phẩm khác** (Kiss New York Gel Pro … Under the Pecan Tree): "in stock" + 1 thẻ đúng của sản phẩm khác đó ($11.99) |

Phần đọc cửa hàng và thẻ chạy đúng (câu 2 có thẻ, tồn kho, giá đúng). Lỗi nằm ở bước **tìm tài liệu**.

## 2. Nguyên nhân (đã kiểm, chỉ đọc)

- Danh mục không cũ: đồng bộ sản phẩm 2026-11-26 02:59 UTC, 2.410 sản phẩm. Cả hai sản phẩm có tài liệu trong kho kiến thức (`inKnowledge: true`); 1.940 tài liệu sản phẩm, chỉ 8 tài liệu tắt.
- Không phải tài liệu chính sách chen chỗ: chỉ 1 / 12 tài liệu `knowledge_store` chứa từ của câu 1, 0 chứa từ của câu 2.
- Vậy tài liệu đúng tên **không lọt vào 8 ứng viên của nhánh từ khoá**: FULLTEXT chấm trên cả nội dung, mà 1.940 tài liệu sản phẩm lặp lại cùng các từ (Gold Finger, Nails, Gel, Kiss… và cả danh sách biến thể). Nhánh vector không thêm được tài liệu nào ngoài nhánh từ khoá (embedding stub chỉ xếp hạng, không tự đưa tài liệu vào). Cộng điểm theo tên (`titleBonus`) chỉ chạy trên ứng viên đã có, nên không cứu được.

## 3. Sửa (tối thiểu, chỉ lượt hỏi sản phẩm)

`RagService`: **nhánh tên sản phẩm** khi `preferGroup = product` (cùng điều kiện đọc cửa hàng):

- Đọc id + tên của mọi tài liệu sản phẩm đang bật trong phạm vi agent (một truy vấn, giữ 5 phút).
- Chấm `titleMatchScore` (tỉ lệ từ của tên có trong câu hỏi; tên dưới 4 từ = 0). Lấy ≥ 0,75, tối đa 3, điểm bằng nhau thì tên dài hơn trước (`pickProductTitles`).
- Gộp vào kết quả như nhánh thứ ba (RRF); `titleBonus` sẵn có đưa sản phẩm đúng tên lên đầu.

Câu hỏi không phải sản phẩm: không đổi.

## 4. Kiểm

- `rag.store-data.spec.ts`: `pickProductTitles` (tên đúng đứng đầu; câu tiếng Hàn; tên dài hơn khi bằng điểm; thiếu nhiều từ / tên < 4 từ bị loại; tối đa 3) và `answer()` (sản phẩm đúng tên thành mục [1], được hỏi cửa hàng và có thẻ; không có ưu tiên sản phẩm thì như cũ; danh sách tên đọc 1 lần).
- Smoke production lại với 2 câu trên sau deploy (RPT §5).

## 5. Phòng ngừa

- Tìm theo **tên riêng** (sản phẩm, mã) cần một nhánh so tên trên **toàn bộ** tên, không chỉ trên ứng viên của nhánh từ khoá / vector: khi kho có hàng nghìn tài liệu giống nhau, điểm toàn văn không phân biệt được tài liệu đúng tên.
- Smoke production của tính năng tra cứu phải dùng **tên thật lấy từ cửa hàng** (ví dụ Popular products), không dùng tên ví dụ trong tài liệu: lần smoke đầu với "KISS Gel Fantasy Nails" (tên ví dụ trong PRD) không nói được gì.
