# RPT-261027 — 라이브챗: 사람 상담원 대응 이력 · AI 자동응답 끄기/넘기기

- REQ/PLN/TCR `*-261027-LiveChat-Staff-Takeover-History.md` (승인 D1~D7 권장안)
- PR #773 → main `164e5665`

## 원인
스테이징 go2joy 방 1(대화 25건)에서 상담원(21, 61)은 **수락 없이 직접 답장**했다. 담당 이력은 배정 기록과 알람으로만 만들어서 그 상담원들이 빠졌다. 호출 대상과 확인자도 이름이 없었다. 상담원이 답장해도 AI가 계속 자동응답했고, AI에게 돌려주는 버튼은 수락한 대화에만 있었다.

## 변경 요약
| # | 내용 |
|---|---|
| D1 | 직접 답장 이벤트(첫 답장·답장 수), 상담원 목록에 포함 |
| D2 | 연결 요청 하나로 묶기 + 호출 대상·전체 호출, 요청 확인자 |
| D3 | 이력의 상담원 = 아이디(이름) (`staffLabel`) |
| D4 | `POST …/ai-pause`, [AI 자동응답 끄고 직접 대응] — 수락 없이 세션 자동응답 off, 이전 모드 감사 기록 |
| D5 | 자동응답 켜진 채 답장하면 입력창 위 안내 + [자동응답 끄기] |
| D6 | `POST …/ai-resume`, [답변 완료 · AI에게 넘기기] — 이전 모드 복원 + 핸드백 안내, 수락된 대화는 409 E5157 |
| D7 | 이력에 AI 자동응답 끔 / AI에게 넘김 / 설정 변경 |

## 파일
- **API**: `global/util/staff-name.util(.spec)`, `agent/{agent.service, agent.service.takeover.spec(신규), agent-console.controller, agent.mapper, conversation-handlers.service(.spec)}`, `global/constant/error-code.constant`(E5157)
- **웹**: `live-chat/{LiveChatPage, HandlerHistoryCard, live-chat.service, live-chat.hooks}`, i18n `livechat` 6개 언어

## 테스트
TCR 참조. api 277개 묶음 2,758건, api·web tsc, i18n:check, CI 통과. 로컬 화면 5개 시나리오를 확인했고 임시 데이터는 원복했다.

## 배포 상태
| 환경 | 마이그레이션 | 코드 | 검증 |
|---|---|---|---|
| 스테이징 | 없음 | ✅ 10/27 main `164e5665` → `deploy-staging.sh` | API healthy, 부팅 1회, ERROR 0, 신규 라우트 `ai-pause`·`ai-resume` 401, 번들 반영 |
| 프로덕션 | 없음 | ⏳ 승인 대기 | — |

## 미검증·후속
- 스테이징 실데이터 화면(방 1 전체 히스토리의 대응·호출·확인 표시)은 육안으로 확인하지 않았다. 콘솔은 새로고침이 필요하다.
- 자동응답 끔은 세션 단위 설정이다. 넘기지 않고 대화가 끝나면 그 세션은 끔 상태로 남는다(헤더 자동응답 설정에 '끔'으로 보임).
