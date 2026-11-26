<!-- Source of the IVY test guide (PLN-261125-IVY-PRD-v1-Phase5 §3). Each section: English first, then Korean. -->

# IVY TalkTalk — Test guide · 테스트 가이드

Version 1.2 · 26 November 2026 · testing from Friday 27 November 2026
버전 1.2 · 2026년 11월 26일 · 11월 27일(금)부터 테스트

## 1. Project information · 프로젝트 정보

| | |
|---|---|
| What to test<br>테스트 대상 | The TalkTalk widget (notifications and chat) on ivyusa.com, and its admin console<br>ivyusa.com의 TalkTalk 위젯(알림·채팅)과 관리자 콘솔 |
| Widget<br>위젯 | ivyusa.com → bell icon in the header (the widget loads from talk.ivyusa.com)<br>ivyusa.com 헤더의 벨 아이콘 (위젯은 talk.ivyusa.com에서 불러옵니다) |
| Test environment<br>테스트 환경 | Preview of the Shopify theme **"Ivyusa Talk Staging Theme"**: Shopify admin → Online Store → Themes → Ivyusa Talk Staging Theme → Preview, or the preview link from the PM<br>Shopify 테마 **'Ivyusa Talk Staging Theme'** 미리보기: Shopify 관리자 → 온라인 스토어 → 테마 → Ivyusa Talk Staging Theme → 미리보기, 또는 PM이 보내는 미리보기 링크 |
| Admin console<br>관리자 콘솔 | https://talk.ivyusa.com/user/ivyusa |
| Login<br>로그인 | Provided by the PM<br>PM이 따로 전달합니다 |
| Languages<br>언어 | EN (default) · ES · KO · VI · JA · ZH |
| Reference<br>기준 문서 | IVY PRD v1.0 — the PRD column of the checklist (N-01, C-01 …)<br>IVY PRD v1.0 — 체크리스트의 PRD 열(N-01, C-01 등) |
| Problems<br>문제 보고 | To our PM (section 5)<br>PM에게 (5장) |

## 2. Before you start · 테스트 전 준비

### 2.1 Your setup · 테스터 준비

1. Test on a computer (Chrome, Edge or Safari) and on a phone.
2. Open the theme preview and sign in to ivyusa.com with a **test** customer account that has recent orders. Without signing in, order screens first ask you to **Verify your identity**. For guest checks, use a private window.
3. Tap the bell → **Chat** → **Accept** on the privacy notice. The chat buttons work only after that.
4. Use test accounts only. **Delete my data** cannot be undone.
5. The console is the live system. Change settings only when the PM asks. Send test campaigns only to **Specific customers** with your own test email — never to **All customers**.
6. For now, a change made in Shopify (new order, shipping, cancel, refund) reaches the widget within about 30 minutes.
7. For delivery checks (items 5, 9, 12–14, 18), use orders shipped with **UPS or USPS**. Orders shipped with Amazon Logistics, or with no carrier, never get a delivery status from Shopify (section 4).

---

1. 컴퓨터(Chrome, Edge, Safari)와 휴대폰에서 모두 테스트해 주세요.
2. 테마 미리보기를 열고, 최근 주문이 있는 **테스트용** 고객 계정으로 ivyusa.com에 로그인합니다. 로그인하지 않으면 주문 화면에서 먼저 **Verify your identity**(본인 인증)를 요청합니다. 비회원 확인은 시크릿 창에서 하세요.
3. 벨 → **Chat**(채팅) → 개인정보 처리 안내에서 **Accept**(동의). 동의해야 채팅 버튼이 동작합니다.
4. 테스트 계정만 사용하세요. **Delete my data**(내 데이터 삭제)는 되돌릴 수 없습니다.
5. 콘솔은 운영 시스템입니다. PM이 요청할 때만 설정을 바꾸세요. 테스트 캠페인은 **Specific customers**(특정 고객)에 본인 테스트 이메일만 넣어 보내고, **All customers**(전체 고객)는 절대 쓰지 마세요.
6. 지금은 Shopify의 변경(새 주문, 발송, 취소, 환불)이 위젯에 반영되기까지 최대 30분 정도 걸립니다.
7. 배송 확인(5, 9, 12–14, 18번)은 **UPS 또는 USPS**로 발송된 주문으로 하세요. Amazon Logistics로 발송되었거나 택배사 정보가 없는 주문에는 Shopify의 배송 상태가 들어오지 않습니다(4장).

### 2.2 To do on IVY's side · IVY 측 준비 사항

| # | What · 할 일 | Why · 이유 | Who · 담당 |
|---|---|---|---|
| 1 | Shopify → Settings → Customer accounts → turn on **Self-serve returns and cancellations**, including cancellations<br>Shopify → 설정 → 고객 계정 → **Self-serve returns and cancellations**(셀프 반품·취소) 켜기, 취소 포함 | The Cancel order answer sends shoppers to account.ivyusa.com/orders to request a cancellation<br>'Cancel order' 답변이 account.ivyusa.com/orders로 안내해 고객이 직접 취소를 요청합니다 | IVY (Shopify admin) |
| 2 | Bedrock Guardrail: send its ID and version, and add the `bedrock:ApplyGuardrail` permission to the EC2 server role<br>Bedrock Guardrail ID·버전 전달, EC2 서버 역할에 `bedrock:ApplyGuardrail` 권한 추가 | IVY IT asked for the AI's answers to be checked before real customers use it<br>실제 고객 사용 전 AI 답변 검사(IVY IT 요청) | IVY IT |
| 3 | Klaviyo and Yotpo API keys: IVY types them into the console (Tenant Settings → Marketing & Helpdesk). Never send keys by email or chat<br>Klaviyo·Yotpo API 키: IVY가 콘솔(Tenant Settings → Marketing & Helpdesk)에 직접 입력. 이메일·채팅으로 보내지 마세요 | Klaviyo: keep marketing opt-outs in step. Yotpo: send reviews there<br>Klaviyo: 마케팅 수신 거부 동기화. Yotpo: 리뷰 연동 | IVY |
| 4 | Let Shopify webhooks through the load balancer (ALB)<br>로드밸런서(ALB)에서 Shopify 웹훅 허용 | Order and delivery changes then arrive at once instead of up to 30 minutes later<br>주문·배송 변경이 최대 30분 늦지 않고 바로 반영됩니다 | IVY IT |
| 5 | Amazon delivery status: tell us whether it can reach Shopify (for example through a tracking app that writes it back), and what the parcels with no carrier are<br>Amazon 배송 상태: Shopify에 넣을 수 있는지(예: 배송 상태를 Shopify에 기록하는 배송 추적 앱), 그리고 택배사 정보가 없는 발송 건이 무엇인지 알려 주세요 | 73% of parcels (Amazon Logistics or no carrier) never get a status: they stay In Transit, with no Delivered alert and no review request (section 4)<br>발송 건의 73%(Amazon Logistics, 택배사 없음)는 배송 상태가 들어오지 않아 계속 In Transit으로 남고, 배송완료 알림과 리뷰 요청이 없습니다(4장) | IVY |

### 2.3 Not on yet (not a bug) · 아직 켜지지 않은 기능 (버그 아님)

- **Bedrock Guardrail.** The AI (Claude, in IVY's own AWS account) is on since 25 November: Haiku for the quick replies and the wording, Sonnet for answers from the knowledge base, and Haiku checks every AI and staff reply before it is sent. IVY's Guardrail is added when IVY sends its ID (2.2).
- **Email form outside business hours (E-02):** switched on, but works only after IVY's support hours are set in the console.
- **Klaviyo and Yotpo:** after IVY enters the keys (2.2).
- **Cancelling on account.ivyusa.com:** after IVY's Shopify setting (2.2).

---

- **Bedrock Guardrail.** AI(IVY AWS 계정의 Claude)는 11월 25일부터 켜져 있습니다. 빠른 답변과 문장 작성은 Haiku, 지식베이스 기반 답변은 Sonnet, 그리고 모든 AI·상담원 답변은 발송 전에 Haiku가 검사합니다. IVY의 Guardrail은 IVY가 ID를 보내면 추가됩니다(2.2).
- **업무 시간 외 이메일 양식(E-02):** 켜져 있지만, 콘솔에 IVY 상담 시간이 설정되어야 동작합니다.
- **Klaviyo·Yotpo:** IVY가 키를 입력한 뒤(2.2).
- **account.ivyusa.com에서 직접 취소:** IVY의 Shopify 설정 뒤(2.2).

## 3. Test checklist · 테스트 체크리스트

Do the steps, compare with "Expect". If the result is different, report it with the item number (section 5).
순서대로 해 보고 '결과'와 비교하세요. 다르면 항목 번호와 함께 보고해 주세요(5장).

### 3.1 Notifications · 알림

Bell → **Notifications**. Chips: **Order** · **Delivery** · **Promo** · **Review**.
벨 → **Notifications**(알림). 칩: **Order**(주문) · **Delivery**(배송) · **Promo**(프로모) · **Review**(리뷰).

| No. | PRD | Do · 방법 | Expect · 결과 |
|---|---|---|---|
| 1 | N-01 | Open **Order**.<br>**Order**(주문) 칩을 엽니다. | Unread cards under **New**, highlighted with a red dot; read cards under **Recent**. Newest first; an empty group is hidden. Read cards stay listed for 30 days.<br>읽지 않은 카드는 **New**(새 알림)에 배경색·빨간 점으로, 읽은 카드는 **Recent**(최근 알림)에 표시. 최신순, 빈 그룹은 숨김. 읽은 카드는 30일 동안 표시. |
| 2 | N-01 | Tap an unread card, then **Back**. Close the widget and open it again.<br>읽지 않은 카드를 누른 뒤 **Back**(뒤로). 위젯을 닫았다 다시 엽니다. | **Order Detail** opens. Back in the list, the card is no longer highlighted but stays in New; after reopening it is in Recent. Opening the widget alone marks nothing as read.<br>**Order Detail**(주문 상세)이 열림. 목록으로 돌아오면 강조는 사라지지만 New에 남고, 다시 열면 Recent로 이동. 위젯을 여는 것만으로는 읽음 처리되지 않음. |
| 3 | N-01 | Check the time on each card.<br>카드별 시간 표시를 확인합니다. | **Just now** · **N min ago** · **N hours ago** (1–23 hours) · **N days ago** (24 hours or more, rounded down: 47 hours = 1 day ago). No "Yesterday", no dates.<br>**Just now**(방금 전) · **N min ago**(N분 전) · **N hours ago**(N시간 전, 1–23시간) · **N days ago**(N일 전, 24시간 이상, 내림 — 47시간 = 1일 전). 'Yesterday'나 날짜는 표시하지 않음. |
| 4 | N-01 | Compare the red number on the bell and on the Notifications tab with the New group.<br>벨과 Notifications(알림) 탭의 빨간 숫자를 New 그룹과 비교합니다. | The number counts cards in New (at most 1 per order) and unread review requests (item 12), and disappears at 0. The bell also counts unread staff replies in Chat.<br>숫자 = New의 카드 수(주문당 최대 1) + 읽지 않은 리뷰 요청(12번), 0이면 사라짐. 벨 숫자에는 채팅의 읽지 않은 상담원 답변도 포함. |
| 5 | N-01 | Wait until one of your orders gets a new status (e.g. In Transit → Delivered).<br>주문 상태가 바뀔 때까지 기다립니다(예: In Transit → Delivered). | A new card for that order appears at the top of New; the older card of the same order moves to Recent by itself.<br>그 주문의 새 카드가 New 맨 위에 생기고, 같은 주문의 이전 카드는 자동으로 Recent로 이동. |
| 6 | N-06 | Phone: press and hold a card (about half a second). Computer: right-click it. Choose **Delete**.<br>휴대폰: 카드를 0.5초쯤 길게 누름. 컴퓨터: 오른쪽 클릭. **Delete**(삭제) 선택. | A small menu with Delete opens; the card goes with "1 notification deleted". Esc or a tap outside closes the menu without deleting; holding does not open the order.<br>Delete(삭제) 메뉴가 열리고 카드가 삭제되며 '1 notification deleted'(알림 1건을 삭제했습니다) 표시. Esc나 바깥을 누르면 삭제 없이 닫힘. 길게 눌러도 주문이 열리지 않음. |
| 7 | N-06 | **Select** → tick cards → **Delete Selected Notifications**. Then **Delete All Notifications**.<br>**Select**(선택) → 카드 선택 → **Delete Selected Notifications**(선택 알림 삭제). 이어서 **Delete All Notifications**(전체 알림 삭제). | Selected cards go, with a message. Delete All asks first inside the widget (**Cancel** / **Delete**) and clears only the chip you are on (Order or Promo).<br>선택한 카드가 삭제되고 안내 표시. 전체 삭제는 위젯 안에서 먼저 확인(**Cancel** 취소 / **Delete** 삭제)하며, 보고 있는 칩(Order 또는 Promo)만 삭제. |
| 8 | N-02 | Look at an order on your account that is new, or cancelled or fully refunded in Shopify.<br>새 주문, 또는 Shopify에서 취소·전액 환불된 주문을 확인합니다. | Order shows a card per order: **Confirmed**, **Cancelled** or **Refunded**. Tap → Order Detail. A partial refund does not change the status.<br>*Note: only changes from the last 48 hours create an alert. Recent orders (30 days) are listed; only orders placed in the last 24 hours start in New.*<br>Order(주문)에 주문별 카드: **Confirmed**(결제완료) · **Cancelled**(주문취소) · **Refunded**(환불완료). 누르면 주문 상세. 부분 환불은 상태가 바뀌지 않음.<br>*참고: 최근 48시간 안의 변경만 알림이 생깁니다. 최근 30일 주문이 표시되며, 24시간 이내 주문만 New로 시작합니다.* |
| 9 | N-03 | Wait for an order to ship or be delivered.<br>주문이 발송되거나 배송완료될 때까지 기다립니다. | A new card in Order with the delivery status (e.g. **In Transit**, **Delivered**). Tap → Order Detail.<br>*Note: use a UPS or USPS order (2.1, point 7).*<br>Order(주문)에 배송 상태 카드 추가(예: **In Transit** 배송중, **Delivered** 배송완료). 누르면 주문 상세.<br>*참고: UPS·USPS 주문으로 확인하세요(2.1의 7번).* |
| 10 | N-04 | Get a test campaign sent to your email (item 39), then open **Promo**.<br>본인 이메일로 테스트 캠페인을 받은 뒤(39번) **Promo**(프로모)를 엽니다. | The campaign is listed. Coupon: its code with **Copy code** → "Code copied". Event with a link: opens in a new tab.<br>캠페인 표시. 쿠폰: 코드와 **Copy code**(코드 복사) → 'Code copied'(코드를 복사했습니다). 링크가 있는 이벤트: 새 탭으로 열림. |
| 11 | N-05 | Open **Review** → **⭐ Write Review** on a product.<br>**Review**(리뷰) → 상품의 **⭐ Write Review**(리뷰 쓰기). | Delivered products not yet reviewed are listed. Write Review opens the product page on ivyusa.com or a review form in the widget. After sending: "Thanks for your review!"<br>배송완료되었고 아직 리뷰하지 않은 상품 목록. 리뷰 쓰기를 누르면 ivyusa.com 상품 페이지 또는 위젯 안 리뷰 작성 화면이 열림. 등록 후 'Thanks for your review!'(리뷰를 남겨 주셔서 감사합니다!). |
| 12 | N-05 | From 30 November: use an account with a UPS or USPS order delivered 7–14 days ago.<br>11월 30일부터: UPS 또는 USPS로 발송되어 7–14일 전에 배송완료된 주문이 있는 계정을 사용합니다. | The red number on the bell and tab goes up by 1. In **Review**, the requested product is at the top, highlighted with a red dot. **⭐ Write Review** opens the review; the highlight goes and the number drops (sending a review does the same). One request per order; none for cancelled or refunded orders or for customers who turned off marketing (item 35).<br>*Note: checked every hour. Only deliveries recorded since 25 November count, so most requests start around 2 December. Sending reviews to Yotpo comes after the Yotpo key.*<br>벨과 탭의 빨간 숫자가 1 늘어남. **Review**(리뷰)에서 요청된 상품이 맨 위에 배경색·빨간 점으로 표시. **⭐ Write Review**(리뷰 쓰기)를 누르면 리뷰 화면이 열리고, 강조가 사라지며 숫자가 줄어듦(리뷰를 등록해도 같음). 주문당 1회. 취소·환불 주문과 마케팅 수신을 거부한 고객(35번)은 제외.<br>*참고: 1시간마다 확인합니다. 11월 25일 이후 기록된 배송완료만 해당되어 대부분의 요청은 12월 2일경부터 시작됩니다. Yotpo 연동은 Yotpo 키 입력 후.* |

### 3.2 Order detail & delivery · 주문 상세 · 배송

| No. | PRD | Do · 방법 | Expect · 결과 |
|---|---|---|---|
| 13 | N-03 | Open **Delivery**. On a shipped order, tap **Track Order**.<br>**Delivery**(배송)를 엽니다. 발송된 주문에서 **Track Order**(배송조회). | One card per order with 4 steps **Preparing → Processing → In Transit → Delivered**: done steps blue, later steps grey. Orange "Your order is on the way!" while shipping; black "Your order is Delivered!" once delivered. Track Order opens the carrier's tracking page in a new tab. Cards with unread alerts are highlighted and sorted New / Recent.<br>*Note: Amazon Logistics orders stay at In Transit (section 4).*<br>주문별 카드, 4단계 **Preparing → Processing → In Transit → Delivered**(발송준비 → 배송시작 → 배송중 → 배송완료): 지난 단계 파란색, 남은 단계 회색. 배송 중 주황색 'Your order is on the way!'(고객님께 배송중입니다!), 배송완료 후 검은색 'Your order is Delivered!'(배송이 완료되었습니다.). 배송조회는 택배사 조회 페이지를 새 탭으로 엶. 읽지 않은 알림이 있는 카드는 강조되고 New / Recent로 나뉨.<br>*참고: Amazon Logistics 주문은 In Transit에 머뭅니다(4장).* |
| 14 | N-03 | Open an order (tap a card in Order) → tap the truck icon next to the order number.<br>Order의 카드를 눌러 주문 상세를 열고 → 주문번호 옆 트럭 아이콘을 누릅니다. | Order Detail shows the items and the total. The truck has an orange dot while the order is on its way. Tap → Delivery opens with this order's card first and outlined. The status label stays next to it.<br>주문 상세에 상품과 합계 표시. 배송 중이면 트럭에 주황색 점. 누르면 Delivery(배송)로 이동, 이 주문 카드가 맨 위에 테두리로 강조. 상태 라벨은 그대로 표시. |
| 15 | E-01 | In Order Detail tap **Email us about this order**, fill in, **Send Message**.<br>주문 상세에서 **Email us about this order**(이 주문에 대해 이메일 문의) → 작성 → **Send Message**(문의 보내기). | Chat opens with the contact form showing "Order IVY-xxxxx". The email to hello@ivyusa.com has "— order IVY-xxxxx" in the subject and an "Order:" line; console Inquiries shows the order number.<br>채팅 탭에 'Order IVY-xxxxx'(주문 IVY-xxxxx)가 표시된 문의 양식이 열림. hello@ivyusa.com 메일 제목에 '— order IVY-xxxxx', 본문에 'Order:' 줄. 콘솔 Inquiries(문의)에 주문번호 표시. |

### 3.3 Chat quick menu · 채팅 빠른 메뉴

| No. | PRD | Do · 방법 | Expect · 결과 |
|---|---|---|---|
| 16 | C-01 | Open **Chat**.<br>**Chat**(채팅) 탭을 엽니다. | A greeting from IVY Beauty ("Hi! This is IVY Beauty. How can I help you?") and the buttons 💰 **Payment check** · 🚚 **Delivery inquiry** · 📦 **Stock inquiry** · 😊 **Exchange & Refund** · ✨ **Product inquiry** · 💬 **Feedback** · 🤝 **Contact Support**, plus 💼 **Affiliate** at the end. Button names follow the widget language.<br>IVY Beauty 인사말('안녕하세요! IVY Beauty입니다. 무엇을 도와드릴까요?')과 버튼 💰 **Payment check**(결제 확인) · 🚚 **Delivery inquiry**(배송 문의) · 📦 **Stock inquiry**(재고 문의) · 😊 **Exchange & Refund**(교환 및 환불) · ✨ **Product inquiry**(제품문의) · 💬 **Feedback**(피드백) · 🤝 **Contact Support**, 마지막에 💼 **Affiliate**(제휴). 버튼 이름은 위젯 언어를 따름. |
| 17 | C-01 | Tap 💰 **Payment check**.<br>💰 **Payment check**(결제 확인). | A card for your latest order — number, date, items, total and **Paid**, **Payment pending**, **Cancelled** or **Refunded** — with one line explaining it. Buttons **Track delivery** · **Contact Support** · **Start over**. Not signed in: **Verify your identity** first.<br>최근 주문 카드(주문번호, 날짜, 상품, 합계, **Paid** 결제완료 / **Payment pending** 결제대기 / **Cancelled** 주문취소 / **Refunded** 환불완료)와 설명 한 줄. 버튼 **Track delivery**(배송 조회) · **Contact Support** · **Start over**(처음으로). 로그인 전이면 먼저 **Verify your identity**(본인 인증). |
| 18 | C-01 | Tap 🚚 **Delivery inquiry**.<br>🚚 **Delivery inquiry**(배송 문의). | Signed in: the 4-step tracker of your latest order on its way (or of your latest order) and a line such as "IVY-xxxxx is on its way." Buttons **Shipping policy** · **Contact Support** · **Start over**. Not signed in: the shipping policy answer.<br>로그인 시: 배송 중인 최근 주문(없으면 최근 주문)의 4단계 트래커와 'IVY-xxxxx 주문이 배송 중이에요.' 같은 문장. 버튼 **Shipping policy**(배송 정책) · **Contact Support** · **Start over**(처음으로). 로그인 전: 배송 정책 안내. |
| 19 | C-01 | Tap 📦 **Stock inquiry** → type part of a product name (e.g. "gel") → **Search** → pick a product. Also try a name that does not exist.<br>📦 **Stock inquiry**(재고 문의) → 상품명 일부 입력(예: gel) → **Search**(검색) → 상품 선택. 없는 이름도 입력해 봅니다. | Up to 5 products on sale to pick from, then a card with **In stock** or **Out of stock** and a line of advice. Buttons **Check another product** · **Contact Support** · **Start over**. Unknown name: 'No product on sale matches "…". Try another name.'<br>판매 중인 상품 최대 5개 중 선택 → **In stock**(재고 있음) 또는 **Out of stock**(품절) 카드와 안내 문장. 버튼 **Check another product**(다른 상품 확인) · **Contact Support** · **Start over**(처음으로). 없는 이름: 일치하는 판매 상품이 없다는 안내. |
| 20 | C-01 | Tap 😊 **Exchange & Refund**, then its buttons.<br>😊 **Exchange & Refund**(교환 및 환불) → 이어지는 버튼을 눌러 봅니다. | A short answer with **Cancel an order** · **Refund policy & timeline** · **Return / exchange an item** · **Talk to an agent** and **Start over**. Return / exchange gives IVY's return policy (10 days after delivery, unopened, request at account.ivyusa.com).<br>*Note: these answers are prepared texts — please flag any line that does not match IVY's policy.*<br>짧은 답변과 **Cancel an order**(주문 취소) · **Refund policy & timeline**(환불 정책·소요기간) · **Return / exchange an item**(반품·교환) · **Talk to an agent**(상담원 연결), **Start over**(처음으로). 반품·교환은 IVY 반품 정책(수령 후 10일, 미개봉, account.ivyusa.com에서 신청).<br>*참고: 미리 작성된 답변입니다. IVY 정책과 다른 문장이 있으면 알려 주세요.* |
| 21 | C-01 · C-04 · A-01–A-04 | Tap ✨ **Product inquiry** → **Popular products** → a category (e.g. Nails).<br>✨ **Product inquiry**(제품문의) → **Popular products**(인기상품) → 카테고리(예: Nails). | Choices **Popular products** · **How to use** · **Ingredients** · **Exchange / Return** · **Restock alert** · **Start over**. Popular products lists 11 categories (Hair … K-Beauty). A category shows "Here are our most popular Nails products 👇", up to 3 product cards (in stock only; tap opens the product page), "See all Nails on ivyusa.com", and a short AI introduction under the cards.<br>*Note: How to use, Ingredients and Restock alert are answered by the AI. Category names are English in every language (design).*<br>선택지 **Popular products**(인기상품) · **How to use**(제품 사용법) · **Ingredients**(성분 문의) · **Exchange / Return**(교환 / 반품) · **Restock alert**(재입고 알림) · **Start over**(처음으로). 인기상품 → 카테고리 11개(Hair … K-Beauty). 카테고리 선택 → 'Nails 인기상품입니다 👇', 상품 카드 최대 3개(재고 있는 상품만, 누르면 상품 페이지), 'ivyusa.com에서 Nails 전체 보기', 카드 아래 AI의 짧은 소개 문장.<br>*참고: 제품 사용법·성분 문의·재입고 알림은 AI가 답합니다. 카테고리 이름은 모든 언어에서 영문입니다(디자인 기준).* |
| 22 | C-01 | Tap 💬 **Feedback** → **Send feedback** with the box empty → then write something and send.<br>💬 **Feedback**(피드백) → 빈 칸으로 **Send feedback**(의견 보내기) → 내용을 쓰고 다시 보내기. | Empty: "Write a few words first." With text: "Thank you — your feedback reached our team." Saved in console Inquiries as Feedback; no email goes to CS.<br>빈 칸: 'Write a few words first.'(내용을 입력해 주세요.) 내용 입력: 'Thank you — your feedback reached our team.'(감사합니다. 의견이 저희 팀에 전달되었습니다.) 콘솔 Inquiries(문의)에 Feedback(피드백)으로 저장, CS 메일은 없음. |
| 23 | C-01 · E-01 | Tap 🤝 **Contact Support** → send once with an empty or wrong field → fill in Name, Email, Message → **Send Message**.<br>🤝 **Contact Support** → 빈 칸·잘못된 값으로 한 번 보내 보기 → 이름·이메일·문의 내용 입력 → **Send Message**(문의 보내기). | The form opens straight away. Errors show under the wrong fields. Signed in: name and email are filled in. Sent: a **YOUR INQUIRY** card and "Your message has been sent successfully." hello@ivyusa.com receives it with the last 20 chat messages and a link to the chat in the console; console Inquiries lists it.<br>양식이 바로 열림. 잘못된 칸 아래 오류 표시. 로그인 시 이름·이메일 자동 입력. 발송 후 **YOUR INQUIRY**(나의 문의) 카드와 'Your message has been sent successfully.'(문의가 정상적으로 접수되었습니다.). hello@ivyusa.com 메일에 최근 채팅 20건과 콘솔 대화 링크 포함, 콘솔 Inquiries(문의)에 표시. |
| 24 | C-01 | Tap **Start over** under any answer.<br>답변 아래 **Start over**(처음으로). | "What else can I help you with?" and the buttons again, at the bottom of the chat.<br>'What else can I help you with?'(무엇을 더 도와드릴까요?)와 버튼이 대화 맨 아래에 다시 표시. |
| 25 | C-02 · C-04 | Type a question and send it (e.g. "How long does a refund take?"). Then type "Recommend your most popular product" and tap a category button. Last, ask whether a product is in stock, by its name (e.g. "Is [product name] in stock?").<br>질문을 직접 입력해 보냅니다(예: 'How long does a refund take?'). 이어서 'Recommend your most popular product'를 입력하고 카테고리 버튼을 누릅니다. 마지막으로 상품 이름으로 재고를 물어봅니다(예: '[상품 이름] 재고 있나요?'). | "Writing a reply…" while waiting, then an AI answer in the widget language from IVY's knowledge base (a few seconds). The recommendation question gets category buttons — a category you named comes first — and a button shows that category's popular products, as in item 21. A question the AI cannot answer offers a person. A product question is answered with the store's current stock and price, and the products the answer is about show under it as cards (picture, name, In stock / Out of stock, price; tap opens the product page), at most 3.<br>기다리는 동안 'Writing a reply…'(답변을 작성 중입니다…), 이후 IVY 지식베이스에 근거한 AI 답변이 위젯 언어로 표시(몇 초). 추천 질문에는 카테고리 버튼이 나오고(질문에 나온 카테고리가 맨 앞), 버튼을 누르면 21번처럼 그 카테고리의 인기상품이 표시. AI가 답할 수 없는 질문은 상담원 연결을 안내. 상품 질문에는 현재 재고·가격으로 답하고, 답변 아래에 해당 상품 카드(사진, 이름, 재고 있음/품절, 가격, 누르면 상품 페이지)가 최대 3개 표시. |

### 3.4 Cancel order answer · 주문 취소 안내

| No. | PRD | Do · 방법 | Expect · 결과 |
|---|---|---|---|
| 26 | C-03 | 😊 **Exchange & Refund** → **Cancel an order** (or ✨ Product inquiry → **Exchange / Return** → **Cancel order**). Tap the link in the answer.<br>😊 **Exchange & Refund**(교환 및 환불) → **Cancel an order**(주문 취소) (또는 ✨ 제품문의 → **Exchange / Return**(교환 / 반품) → **Cancel order**(주문 취소)). 답변 속 링크를 누릅니다. | An answer telling you to sign in to your IVY account (the link opens account.ivyusa.com/orders), open the order and request a cancellation — or to email hello@ivyusa.com if that option is not there. The AI words it, so the sentences can vary a little; the link and the email are always these. The chat itself never cancels an order.<br>*Note: the cancel option on the account page appears after IVY's Shopify setting (2.2).*<br>IVY 계정에 로그인해(링크는 account.ivyusa.com/orders) 주문을 열고 취소를 요청하라는 안내, 그 항목이 없으면 hello@ivyusa.com으로 이메일하라는 안내. AI가 문장을 다듬으므로 표현은 조금씩 다를 수 있지만 링크와 이메일은 항상 같음. 채팅이 직접 주문을 취소하지는 않음.<br>*참고: 계정 페이지의 취소 요청 항목은 IVY의 Shopify 설정 후 표시됩니다(2.2).* |
| 27 | C-03 | Under the Cancel order answer, tap **View my orders**.<br>주문 취소 답변 아래 **View my orders**(내 주문 보기). | "Here are your most recent orders 👇", order cards (tap → Order Detail), then "Do you need anything else?" with **Track delivery** · **Cancel order** · **Start over**.<br>'Here are your most recent orders 👇'(주문 내역을 조회해드릴게요! 최근 주문입니다 👇), 주문 카드(누르면 주문 상세), 'Do you need anything else?'(더 도움이 필요하신가요?)와 **Track delivery**(배송 조회) · **Cancel order**(주문 취소) · **Start over**(처음으로). |

### 3.5 End of chat & satisfaction · 상담 종료 · 만족도

| No. | PRD | Do · 방법 | Expect · 결과 |
|---|---|---|---|
| 28 | S-01 | Tap 💼 **Affiliate** → **End**.<br>💼 **Affiliate**(제휴) → **End**(종료). | "…How was your chat today?" and the card **Please rate your satisfaction** with 4 faces — **Dissatisfied** · **Neutral** · **Satisfied** · **Very satisfied** — and **Skip**.<br>'…상담은 어떠셨나요?'와 **Please rate your satisfaction**(상담 만족도를 선택해주세요) 카드: **Dissatisfied**(불만족) · **Neutral**(보통) · **Satisfied**(만족) · **Very satisfied**(매우 만족) · **Skip**(건너뛰기). |
| 29 | S-01 | Tap a face. Reload the page and open Chat again.<br>얼굴 하나를 누릅니다. 페이지를 새로고침하고 채팅을 다시 엽니다. | "Thank you for your feedback", then **The chat has ended** / "Thank you for chatting with us!" and **Start a new chat**. After reload the chosen face is still lit (the others dimmed) and you are not asked again.<br>'Thank you for your feedback'(소중한 의견 감사합니다) → **The chat has ended**(상담이 종료되었습니다) / 'Thank you for chatting with us!'(이용해 주셔서 감사합니다!)와 **Start a new chat**(새 상담 시작하기). 새로고침 후에도 선택한 얼굴만 밝게 표시되고 다시 묻지 않음. |
| 30 | S-01 | Start another chat, End it, and tap **Skip**.<br>새 대화를 시작해 다시 종료하고 **Skip**(건너뛰기). | The chat has ended, with no rating. **Start a new chat** appears only after you rate or skip.<br>평가 없이 상담 종료. **Start a new chat**(새 상담 시작하기)은 평가하거나 건너뛴 뒤에만 표시. |
| 31 | S-01 | Tap **Start a new chat**, wait a few seconds, reload the page.<br>**Start a new chat**(새 상담 시작하기) → 몇 초 대기 → 새로고침. | Only the greeting and the buttons remain; the old chat does not come back, even after reload. The next button or message starts a new chat.<br>인사말과 버튼만 남고, 새로고침해도 이전 대화가 다시 나타나지 않음. 다음 버튼·메시지부터 새 상담 시작. |
| 32 | S-01 | Get an answer (e.g. 😊 Exchange & Refund, or a typed question), then do nothing.<br>답변을 하나 받은 뒤(예: 😊 교환 및 환불 또는 질문 입력) 아무것도 하지 않습니다. | About 5 minutes after the last reply, a message asks you to rate the chat and the faces appear. About 3 minutes later, with no answer, a closing message and The chat has ended. Rating within those 3 minutes closes the chat with a thank-you.<br>마지막 답변 약 5분 뒤 평가 요청 메시지와 만족도 카드 표시. 이후 약 3분 동안 응답이 없으면 종료 안내와 '상담이 종료되었습니다'. 3분 안에 평가하면 감사 인사 후 종료. |
| 33 | S-01 | In the middle of a chat, close the widget with **✕**.<br>대화 도중 **✕**로 위젯을 닫습니다. | A small prompt may appear: **Leave feedback** · **Just close** · **Don't show this again**. Each one ends the chat; Leave feedback shows the rating card.<br>**Leave feedback**(피드백 남기기) · **Just close**(그냥 닫기) · **Don't show this again**(앞으로 안 보기) 안내가 나타날 수 있음. 어느 것을 눌러도 상담이 종료되며, 피드백 남기기를 누르면 만족도 카드 표시. |

### 3.6 Settings & privacy · 설정 · 개인정보

| No. | PRD | Do · 방법 | Expect · 결과 |
|---|---|---|---|
| 34 | S-02 | **⚙** → **Chat & AI consent** → **Withdraw consent** → tap again to confirm. Go to Chat, then give consent again.<br>**⚙** → **Chat & AI consent**(채팅·AI 동의) → **Withdraw consent**(동의 철회) → 한 번 더 눌러 확정. 채팅 탭으로 간 뒤 다시 동의합니다. | Before: "Consent given — On {date} · Notice version {n}". After withdrawing, chat and AI stop at once and Chat asks for consent again. **Give consent again** or **Accept** turns it back on.<br>철회 전: 'Consent given'(동의함), 날짜, 'Notice version'(안내문 버전). 철회하면 채팅·AI가 즉시 중단되고 채팅 탭이 다시 동의를 요청. **Give consent again**(다시 동의하기) 또는 **Accept**(동의)로 복구. |
| 35 | S-02 · N-04 | **Do not send me marketing messages**: check it is off on an account that never changed it, then turn it on. Then get a test campaign sent to you (item 39).<br>**Do not send me marketing messages**(마케팅 메시지 수신 거부): 한 번도 바꾸지 않은 계정에서는 꺼져 있는지 확인한 뒤 켭니다. 그다음 테스트 캠페인을 받아 봅니다(39번). | Off by default: promos and review requests appear in the widget (marketing email and SMS need the customer's consent). Turned on: "Preference saved." The campaign does not reach you, not even in Promo, and review requests stop. Order and delivery alerts continue. Set it back as needed after the test.<br>기본값은 꺼짐: 위젯에 프로모션과 리뷰 요청이 표시됩니다(마케팅 이메일·SMS는 고객 동의가 있어야 발송). 켜면: 'Preference saved.'(설정을 저장했습니다.) 캠페인이 Promo에도 오지 않고 리뷰 요청도 중단. 주문·배송 알림은 계속. 테스트 후 필요에 맞게 되돌리기. |
| 36 | S-02 | Turn on **CCPA: Do not sell or share my personal information**.<br>**CCPA: Do not sell or share my personal information**(CCPA: 내 개인정보를 판매하거나 공유하지 않음) 켜기. | Stays on after reopening. Email, SMS and web-push messages stop for the account; in-widget order and delivery alerts stay; promos and review requests stop.<br>다시 열어도 켜진 상태 유지. 이메일·SMS·웹 푸시 중단, 위젯의 주문·배송 알림은 유지, 프로모션·리뷰 요청은 중단. |
| 37 | S-02 | **Download my data (JSON)**. Last, and only on a spare test account: **Delete my data** → tap again to confirm.<br>**Download my data (JSON)**(내 데이터 다운로드 (JSON)). 맨 마지막에, 여분 테스트 계정에서만: **Delete my data**(내 데이터 삭제) → 한 번 더 눌러 확정. | A JSON file with your data downloads (signed-in customers only). Delete: "Your personal data has been anonymized." This cannot be undone, and that email can no longer send contact forms.<br>내 데이터 JSON 파일 다운로드(로그인 고객만). 삭제: 'Your personal data has been anonymized.'(개인정보가 익명화되었습니다.) 되돌릴 수 없으며, 그 이메일로는 더 이상 문의 양식을 보낼 수 없음. |
| 38 | S-03 | **🌐** → each language: English · Español · 한국어 · Tiếng Việt · 日本語 · 简体中文. Reload.<br>**🌐** → 언어별로 선택: English · Español · 한국어 · Tiếng Việt · 日本語 · 简体中文. 새로고침. | The whole widget switches at once (tabs, chips, buttons, delivery steps, answers) and keeps the language after reload. Nothing is cut off; Korean does not break lines inside a word. By design, Korean keeps "Contact Support" in English, and category names are English everywhere.<br>위젯 전체(탭, 칩, 버튼, 배송 단계, 답변)가 바로 바뀌고 새로고침 후에도 유지. 글자 잘림 없음, 한국어는 단어 중간에서 줄바꿈하지 않음. 디자인상 한국어 화면에서도 'Contact Support'와 카테고리 이름은 영문. |

### 3.7 Admin console · 관리자 콘솔

Sign in at https://talk.ivyusa.com/user/ivyusa. This is the live system: change settings only with the PM.
https://talk.ivyusa.com/user/ivyusa 에서 로그인. 운영 시스템이므로 설정 변경은 PM과 상의한 뒤에만 하세요.

| No. | PRD | Do · 방법 | Expect · 결과 |
|---|---|---|---|
| 39 | N-04 | **Campaigns** → **New campaign** → **Send to**: **Specific customers** → your test email(s), one per line → save → **Send**.<br>**Campaigns**(캠페인) → **New campaign**(새 캠페인) → **Send to**(받는 사람): **Specific customers**(특정 고객) → 테스트 이메일을 한 줄에 하나씩 → 저장 → **Send**(발송). | After saving, emails that are not customers of the shop are listed. Only the listed customers get it (Promo, item 10). Customers who turned off marketing or chose "Do not sell or share" are skipped. Never use **All customers** for a test.<br>저장 후 쇼핑몰 고객이 아닌 이메일 목록 표시. 입력한 고객만 수신(Promo, 10번). 마케팅 수신 거부·'판매·공유 거부' 고객은 제외. 테스트에 **All customers**(전체 고객)는 절대 쓰지 마세요. |
| 40 | E-01 | **Inquiries** (left menu), after items 15, 22 and 23.<br>왼쪽 메뉴 **Inquiries**(문의) (15·22·23번 이후). | Your forms with **Type** and **Order** columns; filter **All** / **Inquiries** / **Feedback**. Open one: order number, Feedback label, **Open conversation #…**, **Reply by email**, **Mark answered**.<br>보낸 양식이 **Type**(유형) · **Order**(주문) 열과 함께 표시, 필터 **All**(전체) / **Inquiries**(문의) / **Feedback**(피드백). 열면 주문번호, 피드백 표시, **Open conversation #…**(대화 #… 열기), **Reply by email**(이메일로 답변), **Mark answered**(답변 완료로 표시). |
| 41 | A-01–A-04 | With the PM: **AI Settings** → **Recommended products** (below Scenario buttons) → a category (e.g. Nails), Type **Popular** → **Admin Selected** → search and add 3 products, reorder, set a period → **Save**. Check **What customers see now**, then item 21. Afterwards switch back to **AI Auto**.<br>PM과 함께: **AI Settings**(AI 설정) → **Recommended products**(추천 상품, 시나리오 버튼 아래) → 카테고리(예: Nails), 유형 **Popular**(인기) → **Admin Selected**(관리자 선택) → 상품 3개 검색·추가, 순서 조정, 기간 설정 → **Save**(저장). **What customers see now**(지금 고객에게 보이는 상품) 확인 후 21번 확인. 끝나면 **AI Auto**(AI 자동)로 되돌리기. | "Recommended products saved." The preview and the widget show your picks in your order, at most 3, out-of-stock ones skipped; **Change history** records the edit. AI Auto ranks by the last 30 days of sales and review scores. If all picks are out of stock, or the period has ended, AI Auto takes over.<br>*Note: types Recommended and New can be saved now; the chat does not use them yet.*<br>'Recommended products saved.'(추천 상품을 저장했습니다.) 미리보기와 위젯에 선택한 순서대로 최대 3개(품절 제외), **Change history**(변경 이력)에 기록. AI 자동은 최근 30일 판매량과 리뷰 점수로 순위를 매김. 선택 상품이 모두 품절이거나 기간이 끝나면 AI 자동으로 전환.<br>*참고: Recommended(추천)·New(신상품) 유형도 지금 저장할 수 있지만, 채팅에서는 아직 쓰이지 않습니다.* |
| 42 | N-05 | **Tenant Settings** → **Marketing & Helpdesk** → **Review requests**.<br>**Tenant Settings**(테넌트 설정) → **Marketing & Helpdesk**(마케팅·헬프데스크) → **Review requests**(리뷰 요청). | **Ask for a review after delivery** is on; **Days after delivery** = 7 (allowed 1–60). The rules say each order is asked once, and customers who opted out of marketing and cancelled or refunded orders are skipped. Check only.<br>**Ask for a review after delivery**(배송 완료 후 리뷰 요청하기) 켜짐, **Days after delivery**(배송 완료 후 일수) = 7(1–60). 주문마다 1회, 마케팅 수신 거부 고객과 취소·환불 주문 제외 안내. 확인만. |
| 43 | S-01 | **Statistics** → **Satisfaction** → **By session**, after item 29.<br>**Statistics**(통계) → **Satisfaction**(만족도) → **By session**(세션별) (29번 이후). | Your chat with its rating; **Answered by** = AI (Agent if staff replied); **Email form** = Sent when a contact form was sent from that chat.<br>내 대화와 평점, **Answered by**(응답 주체) = AI(상담원이 답했으면 Agent 상담원), 그 대화에서 문의 양식을 보냈으면 **Email form**(이메일 문의) = Sent(접수됨). |
| 44 | S-01 | **Tenant Settings** → **Widget** → **Chat close conditions**.<br>**Tenant Settings**(테넌트 설정) → **Widget**(위젯 설정) → **Chat close conditions**(채팅 종료 조건). | On: rating request 5 minutes after the last answer, close 3 minutes later. Check only.<br>사용 켜짐: 마지막 답변 5분 뒤 평가 요청, 그 3분 뒤 종료. 확인만. |

## 4. Known limits and what comes next · 알려진 제한 사항과 다음 단계

| Item · 항목 | Now · 현재 | Next · 다음 |
|---|---|---|
| AI answers (C-02)<br>AI 답변 | On since 25 November: Claude answers typed questions from the knowledge base in the shopper's language, and words the prepared answers and the lines beside cards — steps, numbers and links stay as written.<br>11월 25일부터 켜짐: Claude가 입력한 질문에 지식베이스로 고객 언어로 답하고, 미리 작성된 답변과 카드 옆 안내를 다듬음 — 단계·숫자·링크는 그대로. | IVY's Guardrail before real customers use it; answers tuned from your test feedback.<br>실제 고객 사용 전 IVY Guardrail 적용, 테스트 의견을 반영해 답변 조정. |
| Product suggestions (A-01–A-04, C-04)<br>상품 추천 | Popular products per category, up to 3, with an AI introduction. A typed question such as "what's popular?" offers the category buttons.<br>카테고리별 인기상품 최대 3개와 AI 소개 문장. '인기 상품 알려줘' 같은 질문에는 카테고리 버튼. | The Recommended and New types in the chat.<br>추천·신상품 유형을 채팅에서 사용. |
| Typed product questions (C-02)<br>상품 질문 직접 입력 | Since 26 November: for the products it finds, the AI reads the store's stock and price and shows them as cards under its answer (at most 3, item 25). A color sold as a separate product that the AI does not find is not confirmed: use 📦 **Stock inquiry**.<br>11월 26일부터: AI가 찾은 상품의 재고·가격을 매장에서 읽어 답하고, 답변 아래에 상품 카드로 표시(최대 3개, 25번). 별도 상품으로 판매되는 색상을 AI가 찾지 못하면 확인해 주지 않으니 📦 **Stock inquiry**(재고 문의)를 이용하세요. | Also search the store with the shopper's own words, so such colors are found.<br>고객이 입력한 단어로도 매장을 검색해 이런 색상도 찾도록 개선. |
| Talk to an agent, outside hours (E-02)<br>상담원 연결, 업무 시간 외 | No support hours are set, so Talk to an agent always goes to IVY staff in console Live Chat.<br>상담 시간이 설정되지 않아 상담원 연결은 항상 콘솔 Live Chat(실시간 상담)의 IVY 상담원에게 연결 요청됨. | Once IVY's hours are set, outside them the chat offers **Email us**: the contact form with the order and the recent chat.<br>IVY 상담 시간 설정 후, 시간 외에는 **Email us**(이메일 문의) → 주문과 최근 대화가 첨부된 문의 양식. |
| Klaviyo (S-02) | The marketing choice is saved in TalkTalk only.<br>마케팅 수신 선택은 TalkTalk에만 저장. | Kept in step with Klaviyo after IVY enters the key.<br>IVY가 키를 입력하면 Klaviyo와 동기화. |
| Yotpo (N-05) | Write Review opens the product page or the widget's form.<br>리뷰 쓰기는 상품 페이지 또는 위젯 양식으로 열림. | After IVY enters the key: reviews go to Yotpo, and Yotpo ratings count in AI Auto.<br>IVY가 키를 입력하면 리뷰가 Yotpo로 전송되고, Yotpo 평점이 AI 자동 추천에 반영. |
| Order and delivery updates (N-02, N-03)<br>주문·배송 반영 | Up to about 30 minutes after Shopify.<br>Shopify 변경 후 최대 약 30분. | Near real time once IVY IT lets Shopify webhooks through the ALB.<br>IVY IT가 ALB에서 Shopify 웹훅을 허용하면 거의 실시간. |
| Delivery status of Amazon parcels (N-03, N-05)<br>Amazon 발송 건의 배송 상태 | Parcels shipped with Amazon Logistics or with no carrier (73% of IVY's parcels) get no delivery status from Shopify. They stay In Transit, with no Delivered alert and no review request. UPS and USPS parcels update normally.<br>Amazon Logistics 또는 택배사 정보 없이 발송된 건(IVY 발송 건의 73%)은 Shopify에서 배송 상태를 받지 못합니다. 계속 In Transit으로 표시되고 배송완료 알림과 리뷰 요청이 없습니다. UPS·USPS 발송 건은 정상적으로 갱신됩니다. | If Amazon's status reaches Shopify (2.2, item 5), this works with no change. Otherwise we agree another rule with IVY, for example showing Shipped and asking for a review N days after shipping.<br>Amazon 상태가 Shopify에 들어오면(2.2의 5번) 변경 없이 동작합니다. 아니면 IVY와 다른 규칙을 정합니다(예: Shipped로 표시하고 발송 N일 후 리뷰 요청). |
| Cancel order (C-03)<br>주문 취소 | The link opens account.ivyusa.com/orders.<br>링크는 account.ivyusa.com/orders로 연결. | The cancel request option appears after IVY's Shopify setting.<br>IVY의 Shopify 설정 후 취소 요청 항목 표시. |
| 💼 Affiliate button<br>💼 제휴 버튼 | 8th button at the end of the menu.<br>메뉴 마지막의 8번째 버튼. | Removed once the AI's affiliate answers are confirmed.<br>AI의 제휴 문의 답변이 확인되면 제거. |
| Restock alert<br>재입고 알림 | Sent to the AI as a question; no back-in-stock message yet.<br>AI에게 질문으로 전달될 뿐, 재입고 알림 발송은 아직 없음. | — |
| Coupons (N-04)<br>쿠폰 | One code per campaign; no personal coupon per customer yet.<br>캠페인당 코드 1개, 고객별 개인 쿠폰은 아직 없음. | — |
| Addresses in Order Detail<br>주문 상세의 주소 | Billing and shipping addresses show only if Shopify lets the app read addresses; otherwise those blocks are hidden.<br>Shopify가 앱의 주소 열람을 허용한 경우에만 청구지·배송지 표시, 아니면 해당 블록 숨김. | — |
| Form limit<br>양식 제한 | Up to 5 forms (contact + feedback) per hour from one browser session.<br>한 브라우저 세션에서 1시간에 최대 5건(문의 + 피드백). | — |

## 5. How to report a problem · 문제 보고 방법

Send each problem to our PM, one problem per message. Please include:

1. Item number from this guide (e.g. "Item 19"), or the screen name if it is not in the guide
2. Screenshot or a short screen recording
3. Date and time with your time zone (e.g. "Nov 27, 10:42 AM ET")
4. Page URL (store page or console page)
5. Order number, if it is about an order
6. Device and browser (e.g. "iPhone 15 · Safari", "Windows · Chrome")
7. Widget language (EN, ES, KO, VI, JA, ZH)
8. What you did, what you expected, what you saw

Never put passwords or API keys in a report.

---

문제는 한 건씩 PM에게 보내 주세요. 다음 내용을 포함해 주세요.

1. 이 가이드의 항목 번호(예: '19번'). 가이드에 없는 화면이면 화면 이름
2. 스크린샷 또는 짧은 화면 녹화
3. 날짜·시간과 시간대(예: '11/28 00:42 KST')
4. 페이지 URL(쇼핑몰 또는 콘솔 페이지)
5. 주문 관련이면 주문번호
6. 기기와 브라우저(예: 'iPhone 15 · Safari', 'Windows · Chrome')
7. 위젯 언어(EN, ES, KO, VI, JA, ZH)
8. 한 일, 예상한 결과, 실제 결과

비밀번호나 API 키는 보고에 절대 넣지 마세요.

**Example · 예시**

```
Item · 항목:        19 · Stock inquiry
When · 일시:        Nov 27, 10:42 AM ET
URL:               https://ivyusa.com/collections/nails (theme preview)
Order · 주문:       —
Device · 기기:      iPhone 15 · Safari
Language · 언어:    KO
Did · 한 일:        Typed "gel", tapped Search
Expected · 예상:    Up to 5 products to pick from
Saw · 실제:         "I can't check stock right now…" (screenshot attached)
```
