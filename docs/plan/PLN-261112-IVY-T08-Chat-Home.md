# PLN-261112 — IVY T08 · Chat home (lời chào IVY, 7 nút trả lời nhanh có emoji, ô nhập)

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt 2026-11-12** và đã làm, xem [RPT-261112-T08](../implementation/RPT-261112-IVY-T08-Chat-Home.md). Trả lời §7: (1) ok; (2) **a**, placeholder là trường tenant; (3) **a**, hướng dẫn nhập console ([GUIDE](../guide/GUIDE-261112-IVY-Chat-Home-Config.md)); (4) chủ dự án gửi ảnh thiết kế |
| Task | [ivy-docs/TASKS.md T08](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-10 · G-12, G-13, G-14 · BR-11 · Q-07, Q-13, Q-14 |
| Figma | `1008:2291` (KO), `993:1993` (EN). Figma MCP vẫn hết lượt gọi; dựa vào SPEC. Xin ảnh bản EN ở §7-4 |
| TC | TC-08-01..05 ([e2e/tests/08-chat-home.spec.ts](../../e2e/tests/08-chat-home.spec.ts)), hiện **1/5** (chỉ TC-08-05, hỏi đáp qua API thật) |
| Migration | **Không có**. `emoji` nằm trong cột JSON `scenario_buttons` có sẵn |
| Deploy | Push → CI → server tự deploy. Đổi `apps/widget`, `apps/api`, `apps/web` (console), `packages/types` |

## 1. Hiện trạng → mục tiêu

Phần lớn màn Chat đã là **cấu hình theo tenant**:
- lời chào: `widgetCopy.firstVisit` / `loginGreeting`;
- nút trả lời nhanh: AI Settings → scenario buttons;
- kiểu nút: `quickReplyStyle` chip / card;
- vị trí thanh công bố AI: `disclosurePlacement`.

T08 thêm phần còn thiếu trong code, rồi đặt cấu hình cho IVY.

| | Thiết kế / SPEC | Hiện tại |
|---|---|---|
| Lời chào | "안녕하세요! IVY Beauty입니다. 무엇을 도와드릴까요?" (EN theo Q-07: "Hi! This is IVY Beauty. How can I help you?") | Mặc định chung "Hi! Welcome to {shop}…" |
| 7 nút | Chip **trắng, viền 1px, emoji đầu**, xếp wrap: 💰 Payment check · 🚚 Delivery inquiry · 📦 Stock inquiry · 😊 Exchange & Refund · ✨ Product inquiry · 💬 Feedback · 🤝 Contact Support | Lưới 2 cột pill xanh, hoặc thẻ có icon lucide. **Nút không có trường emoji** |
| Ô nhập | "**Ask Anything**", nút gửi tròn xanh, mờ khi trống | "Type a message…" (chữ i18n chung, tenant không đổi được). Nút gửi đã mờ khi trống ✅ |
| Thanh công bố AI | Không vẽ (Q-13: giữ vì pháp lý, thu gọn 1 dòng dưới ô nhập) | Có sẵn tuỳ chọn `disclosurePlacement: bottom` = đúng Q-13, chỉ cần bật |
| Nút đính kèm | Không thấy trong thiết kế (Q-14: giữ) | Có ✅ |
| Test-id | `quick-replies` | Chưa có |

## 2. Quyết định thiết kế

**D1 — Nút trả lời nhanh có `emoji`** (G-12, BR-11).
- Trường mới, không bắt buộc, trong mỗi scenario button: tối đa 16 ký tự, đủ cho emoji ghép như 🤝🏻. Lưu cùng cột JSON hiện có, nên không có migration.
- API trả `emoji` cho widget.
- Console → AI Settings → mỗi nút có thêm ô **Emoji** cạnh ô nhãn.
- Nút cũ không có emoji vẫn chạy như cũ.

**D2 — Kiểu "card" thành chip theo thiết kế.** Kiểu này vốn là "kiểu IVY" từ PLN-260916 P4.
- Nền trắng, viền 1px, bo tròn hẳn, chữ 13px.
- Có emoji thì emoji đứng đầu; không có thì giữ icon lucide như hiện tại.
- Xếp wrap theo độ dài chữ, không chia cột.
- Kiểu "chip" (pill xanh, 2 cột) giữ nguyên cho tenant khác.
- Khung chứa có `data-testid="quick-replies"`.

**D3 — Placeholder ô nhập do tenant đặt** (G-13; xem §7-2).
- Trường mới `widgetCopy.composerPlaceholder`, 6 ngôn ngữ, sửa trong console → Settings → Widget copy, cạnh lời chào.
- Tenant để trống thì vẫn dùng "Type a message…" như hiện tại.

**D4 — Cấu hình IVY** (giá trị cụ thể ở §4):
- lời chào 6 ngôn ngữ;
- 7 nút + emoji + nhãn 6 ngôn ngữ (EN theo Q-07);
- kiểu nút "card";
- placeholder "Ask Anything";
- thanh công bố AI ở dưới ô nhập (Q-13).

Đặt vào **seed** (preset IVY của T01), nên DB local và CI có đúng cấu hình IVY và test chạy trên đó. Seed chỉ áp khi **tạo tenant mới**: **production không tự đổi**, xem §7-3.

**D5 — Không đổi:**
- nút đính kèm (Q-14);
- nút gửi mờ khi trống (đã có);
- hành động của từng nút (Delivery inquiry → tra cứu giao hàng, Exchange & Refund → huỷ / hoàn, Product inquiry → menu sản phẩm, Contact Support → liên hệ, còn lại gửi câu hỏi). Nội dung các nhánh thuộc T09–T12.

## 3. Wireframe (tab Chat, 380px)

```
┌──────────────────────────────────────┐
│ Hi, Kiho                🌐 EN  ⚙  ✕ │
├──────────────────┬───────────────────┤
│ Notifications ②  │      Chat         │
├──────────────────┴═══════════════════┤
│ (🤖) Hi! This is IVY Beauty.         │  ← lời chào tenant
│      How can I help you?             │
│                                      │
│ ( 💰 Payment check ) ( 🚚 Delivery inquiry ) │
│ ( 📦 Stock inquiry ) ( 😊 Exchange & Refund ) │  ← chip trắng viền 1px, wrap
│ ( ✨ Product inquiry ) ( 💬 Feedback )        │
│ ( 🤝 Contact Support )                        │
│                                      │
├──────────────────────────────────────┤
│ 📎 ( Ask Anything               ) (➤)│  ← ➤ mờ khi trống
│  This chat is AI-powered · Terms     │  ← 1 dòng, chữ 10px (Q-13)
└──────────────────────────────────────┘
```

**Console → AI Settings → Scenario buttons (mỗi dòng):**
```
│ Emoji [💰] Label [Payment check        ] Action [Send a message ▾] [on] │
```

## 4. Giá trị cấu hình IVY (seed, và dùng cho production theo §7-3)

**Lời chào** (`firstVisit` = `loginGreeting`, vì thiết kế không gọi tên):

| | |
|---|---|
| EN | Hi! This is IVY Beauty. How can I help you? |
| KO | 안녕하세요! IVY Beauty입니다. 무엇을 도와드릴까요? |
| ES | ¡Hola! Somos IVY Beauty. ¿En qué podemos ayudarte? |
| VI | Xin chào! Đây là IVY Beauty. Chúng tôi có thể giúp gì cho bạn? |
| JA | こんにちは！IVY Beautyです。どのようなご用件でしょうか？ |
| ZH | 您好！这里是 IVY Beauty。有什么可以帮您？ |

**Placeholder:** EN Ask Anything · KO 무엇이든 물어보세요 · ES Pregunta lo que quieras · VI Hỏi bất cứ điều gì · JA 何でも聞いてください · ZH 随便问问

**7 nút** (thứ tự thiết kế):

| Emoji | EN (Q-07) | KO (Figma) | Hành động |
|---|---|---|---|
| 💰 | Payment check | 결제 확인 | gửi câu hỏi |
| 🚚 | Delivery inquiry | 배송 문의 | `delivery_status` |
| 📦 | Stock inquiry | 재고 문의 | gửi câu hỏi |
| 😊 | Exchange & Refund | 교환 및 환불 | `cancel_refund` |
| ✨ | Product inquiry | 제품문의 | `product_help` |
| 💬 | Feedback | 피드백 | gửi câu hỏi |
| 🤝 | Contact Support | Contact Support | `contact_support` |

ES / VI / JA / ZH dịch theo EN và đi kèm trong seed.

## 5. Thay đổi

| File | Nội dung |
|---|---|
| `packages/types` (`widget.types.ts`, `widget-copy.ts`) | `ScenarioButtonResponse.emoji?`; `composerPlaceholder` trong `WIDGET_COPY_DEFAULTS` + chuẩn hoá |
| `apps/api/.../ai-engine` (DTO, entity type, `sanitize`, mapper) | Nhận, lưu và trả `emoji` (cắt khoảng trắng, ≤ 16 ký tự) |
| `apps/api/.../tenant`, `session` | `composerPlaceholder` trong widget copy: lưu, trả về console và widget |
| `apps/api/src/database/seed.runner.ts` | Preset IVY: lời chào, placeholder, `quickReplyStyle: card`, `disclosurePlacement: bottom`, 7 nút + emoji |
| `apps/widget/.../chat/ScenarioMenu.tsx` | Kiểu card = chip trắng; emoji đầu; `data-testid="quick-replies"` |
| `apps/widget/.../chat/ChatTab.tsx` | Placeholder từ `widgetCopy.composerPlaceholder`, không có thì dùng i18n |
| `apps/web/.../ai-settings/AiSettingsPage.tsx` | Ô **Emoji** cho mỗi nút |
| `apps/web/.../settings/SettingsPage.tsx` | Ô **Composer placeholder** (6 ngôn ngữ) cạnh lời chào |
| i18n console ×6 | Nhãn 2 ô mới |
| Jest / unit | API giữ / cắt / bỏ emoji; chuẩn hoá placeholder; widget chọn placeholder |
| `e2e/package.json` | Thêm `@T08` khi xanh hết |

## 6. Ảnh hưởng phụ

- **Code có hiệu lực ngay sau deploy, nhưng màn Chat của IVY chỉ đổi khi production có cấu hình §4** (§7-3). Trước đó, widget production vẫn như hiện tại.
- **Tenant khác:**
  - kiểu "chip" không đổi;
  - kiểu "card" đổi sang chip trắng tròn: nút bo tròn và nhỏ hơn, vẫn có icon;
  - không đặt placeholder thì vẫn "Type a message…".
- **App mobile:** `emoji` là trường thêm vào, app cũ bỏ qua.
- Không có SQL, không có migration, không gửi push / email / SMS.

## 7. Xin bạn xác nhận

1. **Duyệt kế hoạch này?** Duyệt thì mình sửa code, test, rồi push. Push là production tự cập nhật.
2. **Placeholder "Ask Anything":**
   - **a (khuyến nghị):** trường mới trong console (Widget copy, 6 ngôn ngữ). Tenant khác vẫn "Type a message…".
   - **b:** đổi chữ mặc định cho mọi tenant thành "Ask anything". Ít code hơn, nhưng đổi chữ của tenant khác.
3. **Đưa cấu hình §4 lên production thế nào?** Seed không chạy lại trên production.
   - **a (khuyến nghị):** mình viết hướng dẫn từng bước kèm giá trị để copy, bạn nhập trong console: Settings (lời chào, placeholder, kiểu nút, vị trí công bố AI) và AI Settings (7 nút). Console tự kiểm tra dữ liệu. Mất khoảng 15 phút.
   - **b:** mình viết 1 file SQL cập nhật cấu hình của tenant IVY, bạn chạy trên DB production (có bước sao lưu và hoàn tác). Nhanh và đúng từng chữ, nhưng bỏ qua bước kiểm tra của console.
4. **Ảnh Figma bản EN** (không bắt buộc): nếu tiện, gửi giúp frame **`993:1993`** (https://www.figma.com/design/fviVlvtkuHYU0Agre1daTr/?node-id=993-1993), để mình đặt cỡ chip cho khớp (ví dụ mỗi hàng mấy nút ở 380px).

Trả lời ví dụ: `1. ok  2. a  3. a` (+ ảnh nếu có)
