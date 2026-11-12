# PLN-261112 — IVY T10 · Kịch bản Product Help: danh mục, sản phẩm phổ biến

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-12** và đã làm, xem [RPT-261112-T10](../implementation/RPT-261112-IVY-T10-Product-Help.md). Trả lời §8: (1) ok; (2) **a**, chủ đề trước; (3) **a**, chính sách ivyusa.com; (4) **a**, Restock alert hỏi AI |
| Task | [ivy-docs/TASKS.md T10](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-12 · G-16 · BR-17 · Q-04 |
| Figma | `1006:5588` (menu con): **xem được**, khớp SPEC. `993:2207` / `993:2416` (danh mục): Figma MCP hết lượt gọi. Nếu tiện, gửi ảnh 2 frame này như T04 / T08 |
| TC | TC-10-01..05 ([e2e/tests/10-product-help.spec.ts](../../e2e/tests/10-product-help.spec.ts)), baseline **1/5** (05 xanh) |
| Migration | **Không có.** Danh mục lưu trong JSON của nút Product inquiry (cột `scenario_buttons` đã có) |
| Deploy | Push → CI → server tự deploy. Đổi `apps/api`, `apps/widget`, `apps/web` |

## 1. Hiện trạng → mục tiêu

| | Thiết kế (1006:5588, SPEC SCR-IVY-12) | Hiện tại |
|---|---|---|
| Bấm ✨ Product inquiry | Bong bóng khách "Product Help" → bot "어떤 도움이 필요하신가요? 원하시는 항목을 선택해주세요 😊" → chip | Menu đầu **đổi chỗ** thành menu con. Không có bong bóng, không có câu dẫn |
| Menu con | 제품 사용법 · 성분 문의 · 교환 / 반품 · 재입고 알림 · **처음으로** | Usage · Ingredients · Exchange · Return · Restock alert · **Back** |
| Chip đã chọn | Hàng chip vẫn còn, chip đã chọn **viền xanh** | — |
| 교환 / 반품 | Bong bóng khách "교환 / 반품" → "교환·반품은 수령 후 7일 이내… 미개봉 상태…" → chip 배송 조회 · 주문 취소 · 처음으로 | Bong bóng khách là câu dài "I would like to exchange…"; câu trả lời là kịch bản mặc định **30 ngày, "gently used"** |
| Danh mục (993:2207) | 11 chip Hair … K-Beauty → **인기상품** → sản phẩm | Không có |
| 재입고 알림 | (G-16 đề xuất gọi `POST /restock/subscribe`) | Gửi câu hỏi cho AI |

## 2. Phát hiện khi khảo sát

1. **11 danh mục của thiết kế không có trong DB.**
   - Cột `category` của sản phẩm là *loại sản phẩm* Shopify: hơn 100 loại ("False Nails", "Hairbrushes & Combs"…), và 924 sản phẩm không có loại.
   - Gọi `GET /products/categories` như SPEC đề xuất sẽ ra **hơn 100 chip**, không phải 11.
   - 11 nhóm của thiết kế là **collection trên ivyusa.com**: `hair`, `makeup-main`, `lashes`, `for-men`, `fragrance`, `nails`, `face-body-care-main`, `fashion`, `for-kids`, `wellness`, `k-beauty`.
2. **"Phổ biến" không tính được từ DB.** DB không có số bán theo sản phẩm. Shopify thì có sắp xếp "Best selling" trong từng collection; app đã có quyền `read_products`.
3. **Chính sách đổi trả: ba nguồn khác nhau.**

   | Nguồn | Nội dung |
   |---|---|
   | Thiết kế | 7 ngày, chưa mở |
   | [ivyusa.com/policies/refund-policy](https://ivyusa.com/policies/refund-policy) | **10 ngày kể từ khi nhận hàng.** Chưa mở, chưa dùng, còn nguyên bao bì. Phí gửi trả $6.95. Yêu cầu đổi trả qua account.ivyusa.com |
   | Kịch bản mặc định đang chạy | 30 ngày, "gently used". **Sai với IVY**, nếu production chưa sửa copy |

   - Kịch bản **Cancel order** mặc định ("vào tab Orders bấm Cancel") cũng khác IVY: ivyusa.com ghi "email hello@ivyusa.com".
   - KB local có cả bản 7 ngày lẫn bản 30 ngày ("CS Policy — Returns (US Cosmetics Standard)"). Nếu KB production cũng có bản 30 ngày, AI sẽ trả lời sai khi khách gõ câu hỏi tự do.
4. **Báo hàng về chưa chạy được.**
   - `POST /restock/subscribe` có, nhưng **không có gì gửi thông báo khi hàng về**: hàm `notifyRestock` không được gọi ở đâu.
   - Bản đăng ký cũng không lưu tenant.
   - Gọi API này bây giờ là hứa với khách một việc không bao giờ xảy ra.

## 3. Quyết định thiết kế

**D1 — Product Help trả lời trong luồng chat, theo 1006:5588.**
- Bấm ✨ Product inquiry: bong bóng khách (nhãn nút), rồi bot hỏi "What do you need help with? Please pick an item 😊", rồi chip.
- Chip: **Popular products** (chỉ khi tenant có danh mục) · Usage · Ingredients · Exchange / Return · Restock alert · Start over.
- Gắn vào vị trí trong luồng như My Orders ở T09 (BUG-024), nên câu trả lời sau hiện bên dưới.
- Menu đầu giữ nguyên, không đổi chỗ nữa. Chip "Back" thay bằng **Start over** dùng chung (BR-12).
- Hàng chip đã chọn **vẫn hiện**, chip đã chọn viền xanh (`aria-pressed`), như thiết kế.

**D2 — Danh mục do tenant cấu hình trên nút Product inquiry** (console → AI Settings → nút).
- Mỗi danh mục gồm **tên** (theo ngôn ngữ, giống nhãn nút) và **collection Shopify** (phần sau `/collections/` trên URL cửa hàng).
- Tối đa 20 danh mục. Seed IVY 11 danh mục như §2-1. Production: nhập theo GUIDE.
- Tenant không có danh mục thì không có chip Popular products.

**D3 — Popular products lấy trực tiếp từ Shopify.**
- API mới `GET /products/popular?category=<collection>` trả 5 sản phẩm "Best selling" của collection. Chỉ nhận collection có trong cấu hình tenant.
- Mỗi thẻ: ảnh, tên, hãng, giá. Bấm thẻ thì mở trang sản phẩm ở tab mới. Dưới thẻ có link "See all Nails on ivyusa.com".
- Cache 15 phút mỗi danh mục: với 11 danh mục, tối đa khoảng 44 lần gọi Shopify mỗi giờ.
- Shopify lỗi hoặc chậm quá 4 giây: bot nói "chưa tải được", kèm link tới collection trên cửa hàng. Giống cách T04 xử lý địa chỉ.

**D4 — Exchange / Return** chạy kịch bản `return_exchange`, bong bóng khách là nhãn chip (như thiết kế).
- Câu trả lời và chip lấy từ **copy tenant**: console → AI Settings → kịch bản. Không viết cứng cho IVY.
- IVY: chip **Track delivery · Cancel order · Start over** (theo thiết kế, dùng lại chip của T09). Nội dung câu chọn ở §8-3.

**D5 — Usage / Ingredients:** giữ như hiện tại, gửi câu hỏi cho AI. Thiết kế `1008:2613` / `1008:2722` cũng là chỉ báo "đang gõ" rồi AI trả lời.

**D6 — Restock alert:** xem §8-4.

## 4. Wireframe

**Widget, tab Chat, 380px.** Nhánh Exchange / Return (giống ảnh 1006:5588):

```
│                       ┌─────────────────┐ │
│                       │ Product inquiry │ │ ← bong bóng khách
│                       └─────────────────┘ │
│ (🤖) What do you need help with?          │
│      Please pick an item 😊               │
│ ( Popular products ) ( Usage )            │
│ ( Ingredients ) [ Exchange / Return ]     │ ← chip đã chọn viền xanh
│ ( Restock alert ) ( Start over )          │
│                     ┌───────────────────┐ │
│                     │ Exchange / Return │ │
│                     └───────────────────┘ │
│ (🤖) Returns are accepted within 10 days  │
│      of delivery. Items must be unopened… │ ← copy tenant (§8-3)
│ ( Track delivery ) ( Cancel order )       │
│ ( Start over )                            │
```

Nhánh Popular products:

```
│                    ┌──────────────────┐ │
│                    │ Popular products │ │
│                    └──────────────────┘ │
│ (🤖) Which category are you looking     │
│      for? 😊                            │
│ ( Hair ) ( Makeup ) ( Lashes )          │
│ ( For Men ) ( Fragrance ) [ Nails ]     │
│ ( Face & Body ) ( Fashion ) ( For Kids )│
│ ( Wellness ) ( K-Beauty ) ( Start over )│
│                             ┌───────┐   │
│                             │ Nails │   │
│                             └───────┘   │
│ (🤖) Our most popular Nails right now 👇 │
│   ┌──────────────────────────────────┐  │
│   │ [ảnh] Gel Polish Starter Set     │  │ ← bấm → trang sản phẩm (tab mới)
│   │       KISS · $24.99              │  │
│   └──────────────────────────────────┘  │
│   … (tối đa 5 thẻ)                      │
│   See all Nails on ivyusa.com ↗         │
│ ( Other categories ) ( Start over )     │
```

Khi Shopify không trả lời:

```
│ (🤖) I couldn't load popular Nails       │
│      right now.                          │
│   See Nails on ivyusa.com ↗              │
│ ( Other categories ) ( Start over )      │
```

**Console, AI Settings → nút Product inquiry** (chỉ hiện với nút action Product help):

```
┌ ✨ Product inquiry ─────────────── Action: Product help ─┐
│ Emoji [✨]   Label [Product inquiry          ]           │
│                                                          │
│ Product categories                                       │
│ Shown under "Popular products". Collection is the part   │
│ after /collections/ in your store URL.                   │
│   Name (EN)            Shopify collection                │
│   [Hair            ]   [hair               ]  ↑ ↓ 🗑      │
│   [Makeup          ]   [makeup-main        ]  ↑ ↓ 🗑      │
│   …                                                      │
│   + Add category                               11 / 20   │
└──────────────────────────────────────────────────────────┘
```

Tên danh mục đổi theo tab ngôn ngữ đang chọn ở đầu trang, giống nhãn nút.

## 5. Thay đổi

| Phần | File | Nội dung |
|---|---|---|
| Types | `packages/types` | `ScenarioButton.categories?`; response nút Product help có `categories: {id, label}[]` (nhãn đã chọn theo ngôn ngữ) |
| API | `ai-engine/ai-config.service.ts` + DTO | Lưu và trả `categories`: kiểm tra collection hợp lệ, tối đa 20. **`sanitize()` giữ lại field mới** (bài học BUG-022), có unit test |
| API | `order/shopify-admin.client.ts` | `fetchCollectionBestSellers(handle, n)`: GraphQL, sắp xếp best-selling. Kiểm tra cú pháp API 2026-01 qua Context7 trước khi viết |
| API | `product/product-popular.service.ts` (mới), `product.controller.ts` | `GET /products/popular?category=`: chỉ nhận collection đã cấu hình, cache 15 phút, timeout 4 giây → `{available, products, collectionUrl}` |
| API | `database/seed.runner.ts` | IVY: 11 danh mục; copy `return_exchange` (+ `cancel_order` nếu chọn §8-3a) cho local và CI |
| Widget | `chat/ScenarioMenu.tsx` | Bỏ menu con đổi chỗ; Product inquiry đi qua `onScenario` như các nút khác |
| Widget | `chat/ProductHelp.tsx` (mới) | Câu trả lời Product Help, chọn danh mục, thẻ sản phẩm phổ biến (D1–D3) |
| Widget | `chat/ChatTab.tsx` | 3 loại insert mới: `product`, `categories`, `popular`. Exchange / Return gửi nhãn chip |
| Widget | `chat/ChatChip.tsx` | Prop `selected`: viền xanh + `aria-pressed` |
| Widget | `services/productService.ts` (mới), `i18n/locales/*.ts` ×6 | Gọi API mới. Câu chữ mới; KO theo thiết kế (어떤 도움이 필요하신가요?… / 제품 사용법 · 성분 문의 · 교환 / 반품 · 재입고 알림 / 인기상품) |
| Console | `ai-settings/AiSettingsPage.tsx`, i18n ×6 | Bảng danh mục (wireframe §4); thông báo lưu thành công / lỗi |
| E2E | `10-product-help.spec.ts`, `fixtures/{ivy-data,mock-api}.ts` | Mock `/products/popular` và danh mục trên nút. TC-10-02 / 03 bấm Popular products trước (theo §8-2a). TC-10-04 bấm Accept consent thật (bài học TC-09-05). Thêm TC-10-06 (Shopify lỗi → link cửa hàng) và TC-10-07 (chip đã chọn `aria-pressed`) |
| Docs | ivy-docs, GUIDE | TASKS / TEST-CASES / BUGS / SPEC; GUIDE cho production: 11 danh mục + copy chính sách; gap mới cho báo hàng về |

## 6. Ảnh hưởng phụ

- **Mọi tenant có nút Product help:**
  - menu con giờ hiện trong luồng chat, có bong bóng khách và câu dẫn, thay vì đổi chỗ menu đầu;
  - "Back" đổi thành "Start over".
- **Tenant chưa cấu hình danh mục:** không có chip Popular products, phần còn lại như trên.
- **Ngay sau deploy, trước khi bạn nhập cấu hình trên console production:**
  - chưa có chip Popular products;
  - Exchange / Return vẫn trả lời bằng copy đang có trên production.
- **Shopify:** thêm tối đa khoảng 44 lần gọi Admin API mỗi giờ, chỉ đọc.
- Không có SQL. Không gửi push / email / SMS.

## 7. Kiểm thử

- `tsc` cho api / widget / web / e2e; unit test API (sanitize giữ `categories`, kiểm tra collection, service popular: cache, timeout, collection lạ); `node --test apps/widget/test/*.mjs`; `i18n:check`; `radius:check`; `vite build`.
- Boot API thật (`Nest application successfully started`) vì đổi kiểu entity.
- Gọi thử `/products/popular` local với Shopify thật của IVY (token local).
- `@T10` xanh hết, lặp ×3; cổng CI mới ×2; toàn bộ desktop so với 88 / 12.
- Ảnh chụp EN / KO đối chiếu 1006:5588; ảnh console bảng danh mục.

## 8. Xin bạn xác nhận

1. **Duyệt kế hoạch này?** Duyệt thì mình sửa code, test, rồi push. Push là production tự cập nhật.
2. **Thứ tự các bước:**
   - **a (khuyến nghị):** chủ đề trước, đúng frame mới `1006:5588`. Chip **Popular products** mở 11 danh mục, chọn danh mục thì hiện sản phẩm.
   - **b:** danh mục trước (frame cũ `993:2207`). Chọn danh mục rồi mới tới chủ đề: Popular products · Usage · Ingredients… Exchange / Return khi đó nằm sau một bước chọn danh mục không liên quan.
3. **Câu trả lời Exchange / Return cho IVY:**
   - **a (khuyến nghị):** theo trang chính sách thật trên ivyusa.com: **10 ngày kể từ khi nhận**, chưa mở, chưa dùng, còn nguyên bao bì, phí gửi trả $6.95, yêu cầu qua account.ivyusa.com. Sửa luôn câu **Cancel order** theo ivyusa.com (email hello@ivyusa.com), vì chip Cancel order nằm ngay dưới.
   - **b:** câu trong thiết kế: 7 ngày, chưa mở. Lệch trang chính sách của IVY.
   - Cả hai cách đều là copy tenant: mình seed cho local / CI, còn production bạn nhập trên console theo GUIDE.
4. **Restock alert:**
   - **a (khuyến nghị):** giữ như hiện tại: gửi câu hỏi cho AI, AI trả lời theo KB. **Không** đăng ký báo hàng về. Mình ghi gap mới: báo hàng về thật cần biết khi nào Shopify có hàng lại, nên làm thành task riêng.
   - **b:** ẩn chip cho tới khi có báo hàng về thật. Lệch thiết kế.

Trả lời ví dụ: `1. ok  2. a  3. a  4. a`
