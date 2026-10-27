# RPT-261027 — 라이브챗: 말풍선 구분·콜백/피드백 표시·통합 히스토리 모달

- REQ/PLN/TCR `*-261027-LiveChat-Thread-Events-History.md` (승인 D1~D6 권장안)
- PR #766 → main `3d7546b9`

## 변경 요약
| 요구 | 내용 |
|---|---|
| R1 | 고객 말풍선 흰 배경 + 회색 테두리, 자동응답 emerald-100 + 초록 테두리, 자동 안내 amber 점선. 대화 기록 화면도 동일 |
| R2 | 대화 흐름 안 해당 시각에 콜백 요청 카드(채널·마스킹 연락처·상태·처리자·소요)와 고객 피드백 카드(별점·해결·사유·의견). 대화 상세 응답에 `callbacks`·`feedback`(통합 대화방이면 방 전체) |
| R3 | 담당 이력에 콜백 요청·완료/취소(처리자·소요 시간)·피드백 이벤트 |
| R4 | 카드는 최근 6건 + [전체 히스토리 보기]. `GET agent/conversations/:id/history`가 방 전체 대화 이력 + 세션 통합 이벤트(`merged_room_sessions` + 감사 `merged_room.*`)를 반환. 모달 필터 전체/담당/콜백/피드백/세션 통합, 줄마다 세션 라벨 |

이전에는 고객 피드백(CSAT 별점·해결·사유·의견)이 라이브챗 어디에도 보이지 않았고, 콜백은 헤더에 처리 중인 1건만 보였다.

## 파일
- **API**: `agent/{conversation-handlers.service(.spec), agent.mapper, agent.module, agent-console.controller}`
- **웹**: `live-chat/{LiveChatPage, HandlerHistoryCard, ThreadEventCard(신규), live-chat.service, live-chat.hooks}`, `history/ConversationTranscript`, i18n `livechat` 6개 언어
- **SQL**: 없음

## 테스트
TCR 참조. api 276개 묶음 2,743건, api·web tsc, i18n:check, CI 통과. 로컬 화면 5개 시나리오를 확인했고, 임시 데이터는 삭제하고 통합은 해제했다.

## 배포 상태
| 환경 | 마이그레이션 | 코드 | 검증 |
|---|---|---|---|
| 스테이징 | 없음 | ✅ 10/27 main `3d7546b9` → `deploy-staging.sh` | API healthy, 부팅 1회, ERROR 0, 신규 라우트 `history` 401, 번들에 새 말풍선·이벤트 카드·모달 포함 |
| 프로덕션 | 없음(`check-migrations` OK) | ✅ 10/27 14:53 KST `production` ff `b4989cec..cdb21bba`(#765 문서, #767 RPT, #768 FIX 동승), 직전 전체 백업 `~/backups/sharptalk-production/20261027-1453-pre-261027-thread-events/db_sharptalk.sql` → `deploy-self-hosted.sh`(applied 115) | api/web/widget 재생성, healthy, 부팅 1회, ERROR 0, health 200, 신규 라우트 `history` 401, 번들에 새 말풍선·더보기 위치 보정 포함 |

## 미검증·후속
- 스테이징·프로덕션 실데이터 화면은 육안으로 확인하지 않았다(콘솔은 새로고침 필요).
- `audit_logs.target`에 인덱스가 없어 모달의 세션 통합 조회는 테이블 스캔이다. 모달을 열 때만 실행되므로 현재 규모에서는 허용했고, 감사 로그가 커지면 `(tenant_id, target)` 인덱스를 검토한다.

## 후속
- FIX-261027-LiveChat-Load-Older-Anchor(#768): '이전 대화 더보기' 후 보던 메시지 위치 유지. 같은 배포로 스테이징·프로덕션에 반영했다.
