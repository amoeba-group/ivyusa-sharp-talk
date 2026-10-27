# RPT-261027 — 위젯: 닫기(X) 때 상담 피드백 안내

- REQ/PLN/TCR `*-261027-Widget-Close-Feedback-Prompt.md` (승인 D1~D6 권장안)
- PR #775 → main `d955b1c1`

## 변경 요약
| # | 내용 |
|---|---|
| D1 | 진행 중 대화(AI·상담원, 대기열 제외) + 고객 메시지 있음 + 미평가일 때만 X 클릭 시 안내 |
| D2·D3 | 하단 시트 "상담피드백을 남기시면 서비스 개선에 도움이 됩니다." — [피드백 남기기](종료 + 만족도 카드, 패널 유지) / [그냥 닫기](종료 + 닫기) / [앞으로 안 보기](저장 + 종료 + 닫기) |
| D4 | '앞으로 안 보기'는 localStorage `ivy.closeFeedback.off.{shop}`(브라우저·상점 단위) |
| D5 | `tenants.close_feedback_prompt`(기본 1), 콘솔 위젯 설정 토글, 세션 ensure로 전달 |
| D6 | 헤더 X만 해당(트리거 모드 바깥 클릭·Esc·앱 닫기는 그대로) |

## 파일
- **API**: `tenant/{entity/tenant.entity, dto/request/tenant.request, dto/response/tenant.response, tenant.mapper, tenant.service}`, `session/{session.service(.spec), session.mapper}`
- **공유 타입**: `packages/types/src/api/widget.types.ts`
- **위젯**: `store/widgetStore`, `hooks/{useSession, useChat}`, `components/{widget/WidgetPanel, chat/ChatTab}`, `i18n/locales/*.ts` 6개 언어
- **콘솔**: `settings/{SettingsPage, settings.service, settings.hooks}`, i18n `settings` 6개 언어
- **SQL**: `sql/261027-close-feedback-prompt.sql`, `sql/artefacts.tsv`

## 테스트
TCR 참조. api 277개 묶음 2,759건, 위젯 node --test 59건, tsc 3종, i18n:check, radius:check, CI 통과. 로컬 위젯으로 시나리오 6개 확인.

## 배포 상태
| 환경 | 마이그레이션 | 코드 | 검증 |
|---|---|---|---|
| 스테이징 | ✅ 10/27 선적용(`close_feedback_prompt` 추가, 전 테넌트 1) | ✅ main `d955b1c1` → `deploy-staging.sh` | API healthy, 부팅 1회, ERROR·Unknown column 0, 위젯 번들에 `closeFeedback` 포함 |
| 프로덕션 | ✅ 배포 전 선적용(`close_feedback_prompt` 추가, 테넌트 1개 = 1) | ✅ 10/27 17:33 KST 전체 백업 `~/backups/sharptalk-production/20261027-1733-pre-261027-takeover-close-feedback/db_sharptalk.sql` → `production` ff `6a1ed92d..0d750a0e`(#773·#775 함께) → `deploy-self-hosted.sh`(applied 116, check-migrations OK) | api/web/widget 재생성, healthy, 부팅 1회, ERROR·Unknown column 0, 위젯 번들에 `closeFeedback` 포함 |

## 미검증·후속
- 스테이징·프로덕션 실제 상점 화면에서의 클릭 확인은 하지 않았다(열린 위젯은 새로고침해야 새 코드).
- 이 기능이 켜지면 안내가 뜬 X 닫기는 상담을 종료한다. 상담원 응대 중 고객이 닫아도 종료된다(대기열 제외). 원하지 않는 테넌트는 콘솔에서 끈다.
