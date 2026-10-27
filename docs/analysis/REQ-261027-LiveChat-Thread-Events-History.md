# REQ-261027 — 라이브챗: 말풍선 구분·콜백/피드백 표시·통합 히스토리 모달

## 요구사항 (2026-10-27)
https://shoptalk.amoeba.site/live-chat
- R1 대화창에서 자동응답과 고객 메시지의 배경색을 구분한다.
- R2 콜백 요청과 사용자 피드백도 대화창에 표시한다.
- R3 콜백 요청을 처리했는지도 히스토리에 표시한다.
- R4 핸들링 히스토리에 세션 통합 히스토리도 넣는다. '전체 히스토리 보기' 모달로 처리한다.

## AS-IS (PLN-261027-Console-Agent-Customer-Visibility 배포 후)
| # | 현재 | 근거 |
|---|---|---|
| R1 | 고객 `bg-gray-100`(왼쪽), 자동응답 `bg-emerald-50 + border-emerald-200`(오른쪽). 둘 다 옅은 색이라 나란히 있으면 차이가 약하다. 자동 안내는 `bg-gray-50` 점선이라 고객과 같은 회색 계열이다 | `LiveChatPage.tsx` 말풍선 클래스 |
| R2 | 콜백 요청(`callback_requests`: 채널·연락처(암호화)·상태 requested/done/canceled·처리자·처리 시각)은 헤더 `CallbackBanner`에 **열린 요청 1건만** 보이고, 대화 흐름에는 없다. 고객 피드백(대화의 `csat_rating`·`csat_resolved`·`csat_reason`·`csat_comment`·`csat_rated_at`)은 라이브챗 어디에도 보이지 않는다(통계에만 집계) | `callback.controller.ts`, `conversation.entity.ts:60-80` |
| R3 | 상담 담당 이력(`GET agent/conversations/:id/handlers`)은 시작·연결 요청·배정·이관·반환·종료만 다룬다. 콜백 요청·처리는 없다 | `conversation-handlers.service.ts` |
| R4 | 담당 이력은 선택한 대화 1건만 다룬다. 세션 통합 이력은 `merged_room_sessions`(합류 시각·추가자·자동/수동·뺀 세션)과 감사 로그(`merged_room.created/sessions_added/session_removed/dissolved/auto_join/auto_joined`)에 있지만 보이지 않는다. 카드에 전체를 펼쳐 볼 방법이 없다 | `merged-room.service.ts` |

## TO-BE
- 고객 말풍선과 자동응답 말풍선을 한눈에 구분되는 색과 형태로 바꾼다.
- 대화 흐름 안 해당 시각에 '콜백 요청' 카드와 '고객 피드백' 카드를 넣는다.
- 담당 이력에 콜백 요청·처리(완료/취소, 처리자, 소요 시간)와 피드백을 넣는다.
- 담당 이력 카드는 최근 몇 건만 보여주고 **[전체 히스토리 보기]** 모달을 연다. 모달은 통합 대화방 전체(각 대화의 담당 이력 + 세션 통합 이벤트)를 시간순으로 보여주고 종류별로 필터한다.

## 갭
| # | 갭 |
|---|---|
| G1 | 말풍선 색 구분이 약하다 |
| G2 | 대화 상세 응답에 콜백·피드백이 없다 |
| G3 | 담당 이력에 콜백·피드백 이벤트가 없다 |
| G4 | 통합 대화방 단위 이력 API와 모달이 없다 |

## 제약
- 콜백 연락처는 마스킹해서 보여준다. 원문은 기존 `callback-requests/:id/contact`(감사 기록)로만 본다.
- 피드백 의견(`csat_comment`)은 저장할 때 이미 PII 마스킹되어 있으므로 그대로 보여준다.
- 테넌트 필터를 지킨다. 통합 대화방 이력은 같은 방의 대화만 다룬다.
- 스키마 변경은 없어야 한다(기존 테이블만 읽기).
