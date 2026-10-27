# RPT-261027 — 콘솔: 상담원·고객 식별 표시 (라이브챗·작업로그·고객·대화 이력)

- REQ/PLN/TCR `*-261027-Console-Agent-Customer-Visibility.md` (승인 D1~D14 권장안)
- PR #759(S1) · #760(S2) · #761(S3) · #762(S4) · #763(S5) → main `407b3163`

## 변경 요약
| 단계 | 요구 | 내용 |
|---|---|---|
| S1 | R1·R2·R3 | 대화방을 열면 맨 아래부터 보이고, 바닥에서만 새 메시지를 따라가며, 위를 읽는 중이면 [새 메시지 ↓]. 상담원 표시 이름 `staffDisplayName()`(이름 → 이메일 앞부분)을 라이브챗·담당·대화 이력·작업로그에 공통 적용. 말풍선은 상담원 진보라 / 자동응답 연초록 / 자동 안내 회색 점선(오른쪽) |
| S2 | R4 | `GET agent/conversations/:id/handlers` + 오른쪽 패널 '상담 담당 이력'. 수락 시 다른 상담원의 active 배정을 닫음(D6) |
| S3 | R5·R8 | 대화 이력 고객명을 라이브챗과 같은 규칙으로, 마지막 상담원은 COALESCE(현재, 마지막 배정, 마지막 상담원 메시지). 작업로그 대화 행 → 대화 기록 모달(메시지 강조), 기록에 역할 라벨 |
| S4 | R6·R7 | 고객 탭 기업고객 \| 일반고객, 일반고객 상세(최초 접속·유입 채널·유입 페이지·소속 기업·대화·메모), PATCH phone·email·memo + 감사, `customers.memo` 암호화 |
| S5 | R7 | `customer_platform_links`: Shopify·Cafe24·Woo·Haravan·Odoo 동기화와 identify가 기록, 백필, DSAR, 상세 '연동 플랫폼' 탭 |

원인 메모: '상담원'으로만 보이던 것은 상담원 계정 대부분의 `users.name`이 비어 있었기 때문이다(스테이징 go2joy 12명 중 11명, go2joy 상담원 메시지 38/38). 라이브챗만 이메일로 대체하지 않았다.

## 파일 (주요)
- **API**
  - `global/util/staff-name.util(.spec)`
  - `agent/{conversation-handlers.service(.spec), agent.service, agent.mapper, agent.module, agent-console.controller}`
  - `analytics/{analytics.service(.spec), analytics.module, analytics.controller}`
  - `audit/audit.service`
  - `customer/{customer.service, customer.mapper, customer.controller, customer.module, customer-detail.spec, customer-platform-link.service(.spec), entity/customer.entity, entity/customer-platform-link.entity, dto/*}`
  - `privacy/{privacy.service, privacy.module}`
  - `embed/{embed.service, embed.module}`
  - 동기화: `order/shopify-sync`, `shopify-proxy`, `cafe24/{cafe24-sync, cafe24-customer-auth}`, `woocommerce`, `haravan`, `odoo`
- **웹**
  - `live-chat/{LiveChatPage, HandlerHistoryCard, live-chat.service, live-chat.hooks}`
  - `history/ConversationTranscript`
  - `work-log/WorkLogPage`
  - `customers/{CustomersPage, CustomerDetailModal, customers.service, customers.hooks}`
  - i18n `livechat`·`history`·`workLog`·`customers` 6개 언어
- **SQL**: `sql/261027-customer-memo.sql`, `sql/261027-customer-platform-links.sql`, `sql/artefacts.tsv`

## 테스트
TCR 참조. api 276개 묶음 2,740건, api·web tsc, i18n:check, CI 5건 통과. 로컬 화면 12개 시나리오 확인. 임시 데이터는 모두 삭제했다.

## 배포 상태
| 환경 | 마이그레이션 | 코드 | 검증 |
|---|---|---|---|
| 스테이징 | ✅ 10/27 선적용(백업 `~/backups/pre-261027-customer-memo-links-staging.sql`: customers·orders_cache). `customers.memo` 추가, `customer_platform_links` 생성 + 백필(cafe24 545·identify 13·shopify 10·haravan 1) | ✅ main `407b3163` → `deploy-staging.sh` | API healthy, `successfully started` 1회, ERROR·Unknown column 0, health 200, 신규 라우트 `handlers`·`customers/:id/detail` 401, 웹 번들 반영 |
| 프로덕션 | ⏳ 승인 대기 | ⏳ | — |

## 미검증·후속
- 스테이징 실데이터 화면은 육안으로 확인하지 않았다(콘솔 로그인 정보 없음). 열어 둔 콘솔은 **새로고침**해야 새 화면이 보인다.
- 상담원 이름: 이메일 앞부분은 임시 대체값이다. 사용자 관리에서 상담원 이름을 입력하도록 안내하는 것을 권한다.
- 백필된 플랫폼 표시명은 다음 동기화나 로그인 때 채워진다.
- UTM·referrer는 수집하지 않는다(landing_path는 쿼리를 제거). 유입 분석이 더 필요하면 별도 요구로 다룬다.
- 로컬 확인 중 별개 사고: `npm run db:up`이 다른 저장소의 `amb-redis`를 교체했다(compose 프로젝트명 `docker` 충돌, RPT-261027-LiveChat-Header-History-Row 참조).
