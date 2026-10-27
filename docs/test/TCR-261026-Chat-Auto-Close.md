# TCR-261026 — 응대 후 만족도 요청·자동 종료 / 상담원 연결 지연 안내·콜백 요청

- REQ: `docs/analysis/REQ-261026-Chat-Auto-Close.md` · PLN: `docs/plan/PLN-261026-Chat-Auto-Close.md`
- 기준 브랜치: `session/chat-auto-close` (origin/main `a6623717` 기준)

## 1. 단위 테스트 (신규 40건)

| 파일 | 케이스 | 결과 |
|---|---|---|
| `packages/types/src/common/chat-close.spec.ts` | 정책 정규화(기본값·범위·문구 키), 언어별 정확 일치 문구, 이메일·전화 마스킹, 전화 정규화 | 7/7 ✅ |
| `apps/api/.../chat/chat.service.close-policy.spec.ts` | 진행 중 평가→감사 문구→종료·배정 해제 / 테넌트 문구는 모더레이션 통과 시만, 차단·게이트 없음=기본 문구 / 정책 없는 테넌트의 래치(“더 도와드릴 일?”)는 평가 거부 409 / 요청 안 된 대화 거부 / `canRate` 진행 중·중복 방지 | 7/7 ✅ |
| `apps/api/.../chat/idle-conversation.policy.spec.ts` | AI 응대 후 무응답→만족도 요청 / 고객이 마지막이면 건너뜀 / 정책 이전 대화 무음 종료(`before_policy`) / 요청 후 무응답→종료 안내+종료(`csat_timeout`) / 요청 후 고객 메시지→래치 해제 / 정책 테넌트는 플랫폼 규칙에서 WAITING만 남김 | 6/6 ✅ |
| `apps/api/.../agent/agent-alert-reminder.queue-timeout.spec.ts` | 시간 초과→AI 복귀·알람 `expired`·지연 안내+콜백 칩 / 콜백 꺼짐=칩 없음 / 조회 조건(경과·미배정·waiting·이메일 제외) / 다른 틱이 선점=무동작 / 설정 없음=무동작 | 5/5 ✅ |
| `apps/api/.../ai-engine/ai-config.queue-callback.spec.ts` | 지연 시간 ≤ 재알림·범위 밖 거부(E5151), 문구 정리, 콜백 채널 정리·중복 제거, 미설정 키 무변경 | 4/4 ✅ |
| `apps/api/.../callback/callback.service.spec.ts` | 전화 정규화 저장·마스킹 안내·알람 대상(이전 대상+매니저)·평문 미노출 / 서명 회원 연락처 서버 조회 / claimed는 회원 아님 / 옵션 마스킹 / 꺼짐·미허용 채널·동의 없음·형식 오류 거부 / 삭제 요청 주소 409 / 타인 대화 404 / 재요청=기존 건 갱신 | 8/8 ✅ |
| `apps/api/.../chat/chat.service.off-hours-callback.spec.ts` | 업무시간 외+콜백: 안내+칩, 미인계, 호출 없음, AI 유지 / 위젯 버튼 동일 / 업무시간 내=기존 인계 | 3/3 ✅ |

전체: API **272 suites / 2,722 tests 통과**(기존 700건 포함 회귀 없음), 위젯 node test 59/59, types 7/7.

## 2. 정적 검사·빌드

| 항목 | 결과 |
|---|---|
| `npm run i18n:check` (6개 언어) | ✅ complete |
| `npm run radius:check` | ✅ clean |
| `apps/api` `tsc --noEmit` · `nest build` | ✅ |
| `apps/web` `tsc --noEmit` · `vite build` | ✅ |
| `apps/widget` `tsc --noEmit` · `vite build` | ✅ |
| `npm run migrations:manifest` | ✅ `sql/artefacts.tsv` 갱신 |

## 3. 통합 시나리오 (로컬 실 DB + 실 부팅, 2026-10-27)

로컬 MySQL에 `sql/261026-chat-close-callback.sql` 적용 → API `DB_SYNCHRONIZE=false`로 부팅(`Nest application successfully started`, 신규 라우트 5개 매핑). 시험 테넌트 9901(정책 1분/1분, 지연 1분, 콜백 이메일·전화)로 실측 후 데이터 삭제.

| # | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| IT-1 | AI 답변 2분 경과(A) | 만족도 요청 1회, `idle_prompt_at` 기록, 감사 `chat.csat_prompted` | ✅ |
| IT-2 | 고객이 마지막 발화(B) | 아무것도 안 함 | ✅ |
| IT-3 | 정책 저장 이전에 멈춘 대화(C) | 무음 종료, 감사 `before_policy` | ✅ |
| IT-4 | 상담원 대기(D) | 정책 순회 대상 아님 | ✅ |
| IT-5 | IT-1 후 1분 무응답 | 종료 안내 + `ended`, 감사 `csat_timeout` | ✅ |
| IT-6 | 진행 중 요청 상태에서 `GET /chat/conversation` → `POST /chat/csat` | `canRate=true` → 평가 저장, “소중한 의견 감사합니다. 상담을 종료합니다.” + `ended`, 이후 `canRate=false` | ✅ |
| IT-7 | 대기 + 알람 2분 경과(지연 1분) | `ai_active` 복귀, 알람 `expired`, 지연 안내 + `callback_request` 칩(위젯 응답 `quickReplies` 확인), 감사 `chat.queue_timeout` | ✅ |
| IT-8 | `GET /callback/options`(게스트) | `{enabled:true, channels:[email,phone], member:[]}` | ✅ |
| IT-9 | 동의 전 `POST /callback` | E3003 | ✅ |
| IT-10 | 동의 후 전화 입력 `+84 90-123 4521` | 저장(암호화 40B), 안내 “…+84 90*****21(으)로 연락드릴게요.”, `callback_request` 알람, 감사(연락처 미기록) | ✅ |
| IT-11 | 이메일 `bad` / 게스트의 `member` | E5153 / E5154 | ✅ |
| IT-12 | 콘솔 `GET /callback-requests` 무인증 | 401(배포 확인 기준) | ✅ |

## 4. 엣지 케이스 메모

- 정책 테넌트의 상담원 응대(`agent`) 대화에서 **고객이 마지막으로 말하고 상담원이 답하지 않으면** 정책 순회는 건드리지 않음(답을 받아야 할 사람에게 평가를 묻지 않음). 7일 경과 시 무음 종료. 기존 30분 “더 도와드릴 일?” 규칙은 정책 테넌트의 대기(`waiting`)에만 남음.
- 테넌트 편집 문구는 발화 시 모더레이션 통과분만 사용, 차단·장애 시 기본 문구(고객은 항상 안내를 받음).
- 회원 연락처가 이메일·전화 둘 다면 위젯이 하나를 고르게 함(요청 1건 = 연락처 1개).
- 콜백 연락처 [보기]는 `conversation.handle` 보유자 전원(콜백 처리 당사자) + 열람마다 감사 + 분당 30회 제한. 고객 프로필 전체 공개(`customer.pii_reveal`)와는 별개.

## 5. 스테이징 go2joy 실측 (2026-10-27)

| # | 항목 | 결과 |
|---|---|---|
| ST-1 | AI 답변 후 3분 → 만족도 요청, 진행 중 설문 카드 표시 | ✅ |
| ST-2 | 요청 후 3분 무응답 → 종료 안내 → 종료 화면 | ✅ (01:59:27 → 02:02:32 → 02:06:01) |
| ST-3 | 진행 중 평가 제출 → 감사 문구 → 즉시 종료 | ✅ |
| ST-4 | 정책 켤 때 방치 대화 무음 종료 | ✅ 232건, 단 진행 중 2건 포함 → #753 수정(기준 `since − 대기합`) |
| ST-5 | 콘솔 설정 3곳 저장값 표시, 알람센터 콜백 탭 | ✅ (카드 분 입력 배치 → #754) |

### 남은 검증

- 위젯 화면: 만족도 카드가 진행 중에 뜨고 평가 후 감사 상태 유지 → 종료 표시, 콜백 카드 ①/② 화면, 입력칸 기본 가림·👁 토글, **Chrome 비밀번호 저장 제안 미발생**.
- 콘솔: 채팅 종료 조건 카드 저장 왕복·토스트, 상담원 연결 설정 지연 안내·콜백 저장 왕복(기존 설정 보존), 알람센터 콜백 탭·대화방 배너·알람 모달 문구.
- 업무시간 외 + 콜백 경로 실측(업무시간 설정 필요).
