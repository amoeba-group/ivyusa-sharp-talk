# RPT-261027 — 응대 후 만족도 요청·자동 종료 / 상담원 연결 지연 안내·콜백 요청

- REQ/PLN/TCR `*-261026-Chat-Auto-Close.md` (D3·D4 권장안 승인, 회원 연락처 안내·입력 가림 반영)
- PR #752 → main `e9d00ce9` · 후속 #753 `3b3c8e33`(무음 종료 기준) · #754 `90a5b5aa`(설정 카드 배치)

## 변경 요약
| 항목 | 내용 |
|---|---|
| 만족도 요청 → 종료 (A1~A4) | `tenants.chat_close_policy`. AI·상담원 응대 후 N분 무응답이면 만족도 요청, M분 더 지나면 종료 안내 후 종료. 진행 중 평가 제출 시 감사 인사 후 즉시 종료. 문구 3종 테넌트 편집(`/settings/widget`), 발화 시 모더레이션 통과분만 사용 |
| 연결 지연 (B1~B3) | `handoff_config.queueTimeout`. 재알림은 기존대로. N분 미수락이면 지연 안내 후 AI 복귀(waiting→ai_active), 알람 `expired`. 업무시간 외 요청은 즉시 안내 |
| 콜백 요청 (B4~B7) | `handoff_config.callback` + `callback_requests`. 안내 아래 칩 → 위젯 카드(회원 연락처 마스킹 / 이메일·전화 별도 입력, 기본 가림 + 👁). AES-GCM 저장, 알람센터 콜백 탭·대화방 배너, [보기] 열람 감사, 개인정보 삭제 연동 |
| 오류 코드 | E5151–E5155 |

## 후속 수정 (스테이징 실측에서 발견)
| PR | 결함 | 수정 |
|---|---|---|
| #753 | 정책 저장 시각 이전에 마지막 메시지가 있는 대화를 모두 무음 종료. go2joy 파트너 대화 919(정책 저장 71초 전 AI 답변)가 안내 없이 종료됨 | 기준을 `since − (요청 대기 + 종료 대기)`로 변경 — 정책 시계로도 이미 닫혔을 대화만 무음 종료. 회귀 테스트 추가 |
| #754 | 설정 카드 분 입력칸이 전체 폭으로 늘어나고 "분"이 다음 줄로 떨어짐(`Input`은 `w-full`, `cn`은 병합 안 함) | 폭 래퍼(`w-24`)로 감쌈 |

## 파일
- types: `packages/types/src/common/chat-close.ts`(+spec)
- API: `domain/callback/*`(신규), `chat/{chat.service, chat.mapper, chat.controller, idle-conversation.service, chat-close.util}.ts`, `agent/{agent-alert-reminder, agent-alert, alert-center}.service.ts`, `ai-engine/{ai-config.service, handoff-router.service}.ts`, `tenant/*`, `privacy/*`, `error-code.constant.ts` + 신규 spec 6종
- web: `settings/ChatCloseCard.tsx`, `ai-settings/HandoffSection.tsx`, `alerts/{CallbackRequestsTab, CallbackParts, callbacks.*}`, `live-chat/CallbackBanner.tsx` 외, 로케일 6개 언어
- widget: `components/chat/{CallbackCard, ChatTab}.tsx`, `services/chatService.ts`, 로케일 6개 언어
- SQL: `sql/261026-chat-close-callback.sql`

## 테스트
- API 272 suites / 2,722 tests(신규 40) + #753 회귀 1건, 위젯 59/59, i18n·radius 검사, 빌드, CI 3회 통과
- 로컬 실 DB 통합 IT-1~12 (TCR §3)
- 스테이징 go2joy 실측 (TCR §5 갱신)
  - 위젯: AI 답변 후 3분 → 만족도 요청(진행 중 설문 카드 표시) → 3분 → 종료 안내·종료 화면 ✅
  - 위젯: 요청 후 진행 중 평가 제출 → "평가해 주셔서 감사합니다" → "소중한 의견 감사합니다. 상담을 종료합니다." → 종료 화면 ✅
  - 콘솔: 채팅 종료 조건 카드·상담원 연결 지연 안내·콜백 설정 저장값 표시 ✅, 알람센터 콜백 탭(빈 목록) ✅
  - 정책 켤 때 방치 대화 232건 무음 종료(로그 200+31+1), 진행 중이던 2건(918·919) 포함 → #753으로 수정

## 배포 상태
| 환경 | 마이그레이션 | 코드 | 검증 |
|---|---|---|---|
| 스테이징 | ✅ 10/27 10:54 KST 선적용(백업 `~/backup-pre-261026-20261027-105403.sql`) | ✅ `e9d00ce9` → `3b3c8e33` → `90a5b5aa` | 매번 `successfully started`, 컨테이너 재생성, 신규 라우트 401 |
| 프로덕션 | ✅ 10/27 11:46 KST 선적용(백업 `~/backups/sharptalk-production/20261027-chatclose`, db+uploads) | ✅ `production` ff `a6623717..31ffa9f4` → `check-migrations` OK → `deploy-self-hosted.sh` | api/web/widget 재생성(healthy), `successfully started` 1회, ERROR 0, health 200, `/callback-requests`·`/tenants/chat-close-policy` 401. 테넌트 ivyusa뿐·정책 없음 → 동작 변화 0 |

스테이징 go2joy 설정: 종료 정책 3분/3분, 지연 안내 3분(재알림 1분), 콜백 이메일·전화 켬. 변경 전 ai-config는 로컬 스크래치에 보관.

## 미검증·후속
- **콜백 카드 화면·Chrome 비밀번호 저장 창**: 실제 상담원 연결이 필요해 go2joy 담당자에게 알람이 갑니다. 실측 시점을 정해 진행해야 합니다.
- 업무시간 외 + 콜백 경로 미실측.
- 위젯에 이전 대화의 "상담 내용 선택" 패널이 새 대화 아래에 남아 보임 — 기존 동작이며 이번 변경과 무관(확인 필요).
- 기존 결함: `useUpdateAiConfig` 토스트 영문 하드코딩·오류 토스트 자동 닫힘.
