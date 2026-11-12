# PLN-261112 — IVY T05 · Notifications: Promo (coupon / sự kiện, mã coupon, link)

| | |
|---|---|
| Trạng thái | 🟨 **Chờ duyệt.** Chưa sửa code. Câu hỏi ở §7 |
| Task | [ivy-docs/TASKS.md T05](../../ivy-docs/TASKS.md) · SPEC SCR-IVY-07 · G-09 · Q-16 |
| Figma | `1006:5284` (EN), `1007:1978` (KO), `993:1618`, bộ icon `993:1254`. Figma MCP vẫn hết lượt gọi; dựa vào SPEC SCR-IVY-07, §4 (màu icon) và màn hiện tại. Nếu cần, mình xin ảnh như T04 |
| TC | TC-05-01..04 ([e2e/tests/05-promo.spec.ts](../../e2e/tests/05-promo.spec.ts)), baseline **0/4** |
| Migration | **Không có** nếu chọn §7-2a. Có (2 cột `notifications`) nếu chọn §7-2b |
| Deploy | Push → CI → server tự deploy. Đổi `apps/api`, `apps/widget`, `apps/web` (console), `packages/types` |

## 1. Hiện trạng → mục tiêu

Khuyến mãi là thông báo loại `event`, do màn **Campaigns** trong console gửi tới mọi khách của tenant. Nội dung campaign là JSON (`message`, `channel`, `link`). Bảng `notifications` không có khái niệm coupon.

| | Thiết kế / SPEC | Hiện tại |
|---|---|---|
| 2 loại | **Coupon** (icon quà, nền navy `#1A2E6B`) · **Sự kiện** (icon lấp lánh, nền magenta `#E91E8C`) | Chỉ đoán theo link: có link → nền đỏ `#FF385C`; không link → nền xám đen. Cùng một loại `event` |
| Nội dung | Tiêu đề **đậm** + mô tả | Có |
| Mã coupon | Hiện mã (vd. `SCHOOL20`) + nút **Copy code** | Không có. Console không có ô nhập mã |
| Bấm thẻ có link | Mở trang (tab mới), ví dụ `ivyusa.com/collections/mad-shade` | Chỉ đánh dấu đã đọc. `linkUrl` không mở được |
| Test-id | `promo-item` (+`data-kind`), `promo-icon`, `coupon-code` (SPEC §9) | Chưa có |
| TC-05-04 | Đọc URL tab mới | Đọc ngay khi tab vừa mở nên luôn ra chuỗi rỗng, cùng lỗi BUG-017 của T03 |

## 2. Quyết định thiết kế

**D1 — Loại và mã coupon nhập trong console, ở màn Campaigns** (Q-16).
- Form tạo / sửa campaign thêm 2 ô:
  - **Loại**: Sự kiện (mặc định, giữ đúng hành vi hiện tại) / Coupon;
  - **Mã coupon**: chỉ hiện khi chọn Coupon, bắt buộc, chữ / số / `-` / `_`, tối đa 32 ký tự.
- Lưu trong JSON nội dung campaign (`content.kind`, `content.couponCode`), không cần cột mới cho campaign.
- Mã coupon là nội dung gửi ra ngoài, nên đi qua `ModerationService` cùng lúc với tiêu đề và nội dung khi gửi (CLAUDE.md §2):
  - bị chặn → cả campaign không gửi, như hiện tại;
  - bị sửa / che (mask) → cũng chặn, vì gửi một mã đã bị sửa là gửi mã sai. Ghi audit.

**D2 — Thông báo biết nó thuộc campaign nào** (§7-2a, khuyến nghị).
- Mỗi thông báo campaign ghi `ref_type = 'campaign'`, `ref_id = id campaign`. Hai cột này đã có, đã có index.
- Khi khách mở danh sách, API đọc loại và mã từ campaign. Tra theo lô, chỉ campaign của **đúng tenant**.
- Để khách không thấy mã thay đổi sau khi đã nhận, **loại và mã bị khoá sau khi campaign đã gửi**:
  - console làm mờ 2 ô, kèm dòng "Không đổi được sau khi đã gửi";
  - API trả 400 nếu cố đổi.

**D3 — Thẻ promo trong widget** (chip Promo; layout 3 tab hiện tại là chip Event).
- Icon tròn theo loại:
  - **coupon**: quà trắng trên nền navy `#1A2E6B`;
  - **sự kiện**: lấp lánh trắng trên nền magenta `#E91E8C`.
  - Thông báo cũ (gửi trước deploy, chưa có loại): có link → sự kiện, không link → coupon, giống cách đoán hiện nay nhưng đổi sang màu thiết kế.
- Tiêu đề đậm, mô tả, thời gian như các dòng khác (BR-05).
- **Coupon có mã**: một ô viền đứt hiện mã (`coupon-code`) và nút **Copy code**:
  - copy được → toast "Code copied", tự tắt (dùng toast của T07);
  - không copy được → toast lỗi, đóng tay.
- **Có link**: bấm thẻ mở link ở tab mới và đánh dấu đã đọc. Widget chỉ mở link `https://`, campaign cũng đã kiểm tra lúc gửi.
- **Không có link**: bấm thẻ chỉ đánh dấu đã đọc, như hiện tại.
- Chế độ chọn & xoá (T07) giữ nguyên trên chip Promo: đang chọn thì bấm thẻ là tick, không mở link và không có nút Copy.

**D4 — Ngoài phạm vi T05:**
- **Coupon riêng cho từng khách** (mỗi người một mã khác nhau): xem §7-3.
- **Icon theo nhóm khách** (subscription / IVY member / Beautizen / Round, ghi chú Figma `0:1`): chưa có dữ liệu nhóm khách trong campaign. Ghi lại cho sau.
- Mã coupon không được thêm vào email / SMS. Kênh ngoài hiện vẫn là giả lập.

**D5 — Sửa TC-05-04:** giả lập trang ivyusa.com và chờ tab mới điều hướng xong rồi mới đọc URL, giống fix BUG-017.

## 3. Wireframe

**a) Widget, chip Promo (380px)**
```
├──────────────────────────────────────┤
│ (Order)(Delivery)[Promo](Review) Select│
├──────────────────────────────────────┤
│ Today's                              │
│ (🎁) Your exclusive 10% off coupon   •│  ← nền navy · chấm đỏ = chưa đọc
│      has arrived!                    │
│      Available today only!           │
│      ┌ ─ ─ ─ ─ ┐ ┌───────────┐       │
│      │  IVY10  │ │ Copy code │       │  ← coupon-code + nút Copy
│      └ ─ ─ ─ ─ ┘ └───────────┘       │
│      3h ago                          │
├──────────────────────────────────────┤
│ (✨) Mad Shade                        │  ← nền magenta · bấm = mở link tab mới
│      Buy one Get One 50% OFF today ! │
│      3h ago                          │
├──────────────────────────────────────┤
│ Yesterday's                          │
│ (🎁) BACK TO SCHOOL                  │
│      Buy one Get One CODE:SCHOOL20   │
│      ┌ ─ ─ ─ ─ ─ ┐ ┌───────────┐     │
│      │ SCHOOL20  │ │ Copy code │     │
│      └ ─ ─ ─ ─ ─ ┘ └───────────┘     │
│      Yesterday                       │
├──────────────────────────────────────┤
│      ┌──────────────────────┐        │
│      │ ✓ Code copied        │        │  ← toast, tự tắt ~3 giây
│      └──────────────────────┘        │
└──────────────────────────────────────┘
```

**b) Console → Campaigns → New campaign (modal)**
```
┌ New campaign ───────────────────────────────┐
│ Name         [Back to school              ] │
│ Channel      [email ▾]                      │
│ Type         (•) Event   ( ) Coupon         │  ← mới
│ Coupon code  [SCHOOL20                    ] │  ← mới, chỉ khi chọn Coupon
│              Letters, numbers, - and _ ·    │
│              up to 32 characters            │
│ Message      [Buy one Get One CODE:SCHOOL20]│
│ Link         [URL ▾]                        │
│ URL          [https://ivyusa.com/pages/... ]│
│                          [Cancel]  [Save]   │
└─────────────────────────────────────────────┘
```
Campaign đã gửi: ô **Type** và **Coupon code** mờ, kèm dòng "Can't be changed after sending". Các ô khác vẫn sửa được như hiện tại. Lưu thành công / lỗi đã có toast.

## 4. Thay đổi (theo §7-2a)

| File | Nội dung |
|---|---|
| `packages/types` | `NOTIFICATION_REF.CAMPAIGN`, `PROMO_KIND` (`event` / `coupon`), `NotificationResponse.kind?`, `couponCode?`. Kiểm tra mã coupon (regex dùng chung API + console) |
| `apps/api/.../campaign/campaign.service.ts` | Kiểm tra `kind` / `couponCode` khi tạo / sửa; khoá sau khi gửi (400); moderation mã khi gửi; `notify()` kèm `refType 'campaign'` + `refId` |
| `apps/api/.../notification/` | Khi trả danh sách: đọc loại + mã của các campaign được nhắc tới, một truy vấn theo lô, cùng tenant. Thông báo cũ → `kind: null` |
| `apps/api/.../global/constant/error-code.constant.ts` | Mã lỗi cho "mã coupon không hợp lệ" / "không đổi được sau khi gửi" (khối Exxxx tiếp theo) |
| `apps/widget/.../NotificationIcon.tsx`, `tailwind.config` | Icon theo `kind`, màu `#1A2E6B` / `#E91E8C` |
| `apps/widget/.../NotificationsTab.tsx` (`Row`) | Thẻ promo: `promo-item` + `data-kind`, `promo-icon`, ô mã + Copy code (toast), mở link |
| `apps/widget/src/lib/` (mới) | `promoKind(n)`: loại từ API, hoặc đoán cho thông báo cũ; `safeLink(url)`: chỉ `https://`. Có unit test |
| `apps/web/src/domain/campaigns/CampaignsPage.tsx` + i18n `campaigns` ×6 | 2 ô Type / Coupon code, khoá khi đã gửi |
| `apps/widget/src/i18n/locales/*.ts` ×6 | "Copy code", "Code copied", "Couldn't copy the code" |
| `e2e/tests/05-promo.spec.ts` | Sửa TC-05-04 (D5). Thêm: thông báo cũ không có loại vẫn hiện đúng màu; Copy lỗi → toast lỗi |
| Jest | Campaign: kiểm tra mã, khoá sau khi gửi, moderation chặn / che mã, `refType` khi gửi. Notification: gắn loại + mã đúng tenant, campaign của tenant khác không lộ, campaign bị xoá → `kind` null |
| `e2e/package.json` | Thêm `@T05` vào `test:ci` khi xanh hết |

**Nếu chọn §7-2b:** thêm `sql/migration_notification_promo.sql`: 2 cột `promo_kind`, `coupon_code` trong `notifications`, nullable. Loại và mã ghi thẳng vào từng thông báo lúc gửi, không cần tra campaign và không cần khoá. **SQL phải chạy trên DB production trước khi push**, vì production chạy `DB_SYNCHRONIZE=false`. Bạn chạy lệnh trên server; mình chuẩn bị lệnh và cách hoàn tác.

## 5. Ảnh hưởng phụ

- **Widget có hiệu lực ngay sau deploy:**
  - Thông báo khuyến mãi cũ đổi sang màu thiết kế. Thẻ có link mở được link.
  - Mã coupon chỉ có ở campaign tạo **sau** deploy, có chọn Coupon và nhập mã.
  - Layout 3 tab hiện tại: thẻ promo hiện ở tab Notifications → chip **Event** và chip **All**. Khi tab Orders tắt: chip **Promo**.
- **Console:** màn Campaigns của **mọi tenant** có thêm 2 ô. Mặc định "Event", nên campaign tạo như cũ vẫn chạy như cũ.
- **App mobile** dùng chung API:
  - `kind` và `couponCode` là trường thêm vào, app cũ bỏ qua.
  - Thông báo campaign mới có `refType: 'campaign'`. Code app không nằm trong repo này nên mình không kiểm tra được app xử lý giá trị lạ ra sao. Cần người làm app xác nhận.
- **Hiệu năng:** mỗi trang danh sách thêm tối đa 1 truy vấn theo khoá chính vào `campaigns`, chỉ khi trang có thông báo campaign.
- **Bảo mật:** campaign của tenant khác không bao giờ được tra (lọc `tenant_id`). Mã coupon không phải dữ liệu cá nhân.
- Không gửi push / email / SMS mới.

## 6. Kiểm thử

- `tsc` api / widget / web / types / e2e; Jest API campaign + notification; Jest `packages/types`; `node --test apps/widget/test/*.mjs`; `i18n:check` (widget + console); `radius:check` (container Linux); `vite build` widget + web.
- `@T05` xanh hết, lặp ×3; cổng CI mới ×2; toàn bộ desktop so với 65 / 26.
- **Tích hợp local (API + MySQL thật):**
  - tạo campaign Coupon trong console local, gửi;
  - widget local thấy thẻ navy có mã, Copy chạy;
  - sửa mã sau khi gửi → 400 + toast lỗi trong console;
  - tenant khác không thấy.
- Ảnh chụp EN / KO / VI: chip Promo, toast Copy; console modal.

## 7. Xin bạn xác nhận

1. **Duyệt kế hoạch này?** Duyệt thì mình sửa code, test, rồi push. Push là production tự cập nhật.
2. **Loại và mã coupon lưu ở đâu?**
   - **a (khuyến nghị):** lưu trong campaign; thông báo chỉ ghi nó thuộc campaign nào.
     - Không có SQL, không phải chạy gì trên server production.
     - Đổi lại: loại và mã bị **khoá sau khi campaign đã gửi**, để khách không thấy mã thay đổi.
   - **b:** lưu thẳng vào từng thông báo (2 cột mới).
     - Campaign sửa thoải mái sau khi gửi.
     - Phải **chạy SQL trên DB production trước khi push**: bạn chạy lệnh trên server, mình chuẩn bị lệnh và cách hoàn tác.
3. **Coupon riêng cho từng khách** (mỗi người một mã khác nhau)?
   - **a (khuyến nghị):** chưa làm. Một campaign = một mã, mọi khách nhận cùng mã. Mã riêng cần app Shopify có quyền tạo mã giảm giá (`write_discounts`) và một luồng tạo mã. Nên tách thành task riêng.
   - **b:** làm luôn trong T05. Cần bạn xin thêm quyền Shopify; T05 sẽ lớn hơn nhiều.

Trả lời ví dụ: `1. ok  2. a  3. a`
