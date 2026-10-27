# TCR-261027 — 위젯: 닫기(X) 때 상담 피드백 안내

- PLN `docs/plan/PLN-261027-Widget-Close-Feedback-Prompt.md` (승인 D1~D6 권장안)

## 단위 테스트
| 대상 | 케이스 |
|---|---|
| `session.service.spec` (+1, 기존 기대값 갱신) | 세션 안내 응답에 `closeFeedbackPrompt`(기본 true), 테넌트가 끄면 false |

api 전체 277개 묶음 2,759건, 위젯 `node --test` 59건, api·web·widget tsc, `i18n:check`, `radius:check` 통과.

## 화면 시나리오 (로컬 위젯 iframe 시험 페이지, ivyusa, compact)
| # | 시나리오 | 결과 |
|---|---|---|
| 1 | 동의 → 질문 전송 → X → 하단 시트("Leaving feedback on this chat helps us improve our service." + 피드백 남기기·그냥 닫기·다시 보지 않기) | ✅ |
| 2 | [피드백 남기기] → 상담 종료, 패널 유지, "This conversation has ended" + 만족도 카드 바로 표시 | ✅ |
| 3 | 종료된 대화에서 X → 안내 없이 바로 닫힘 | ✅ |
| 4 | 새 질문 → X → 시트 → [앞으로 안 보기] → 종료 + 닫힘, localStorage `ivy.closeFeedback.off.{shop}`=1 | ✅ |
| 5 | 그 뒤 새 질문 → X → 안내 없이 바로 닫힘 | ✅ |
| 6 | 콘솔 설정 API: `close_feedback_prompt` false/true 저장·응답 반영 | ✅ |

## 확인하지 못한 것
- [그냥 닫기]는 [앞으로 안 보기]와 같은 경로(종료 + 닫기, 저장만 없음)라 별도 화면 확인은 생략했다.
- 상담원 대기 중(`waiting`)에는 시트가 뜨지 않는 조건은 코드(`askOnClose`)로만 확인했다.
- 콘솔 설정 화면의 토글은 타입 검사와 API로 확인했고, 화면 클릭은 하지 않았다.
