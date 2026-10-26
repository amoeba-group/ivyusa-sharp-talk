# TCR-261026 — 웹사이트 정책 분석 진행 히스토리

- 근거: REQ/PLN-261026-Site-Ingest-History (권장안 D1~D5 승인)
- 실행일: 2026-10-26 (로컬, 워크트리 브랜치 `session/kb-site-ingest-history`)

## 1. 단위 테스트

| 파일 | 케이스 | 결과 |
|---|---|---|
| `ingest-history.service.spec.ts` | 상태 6종 판정(게시·만료·실패·중단·검수 대기+만료 시각·진행 중) · 최근 활동순 · 이름 없으면 이메일 · jobId 없는 과거 게시 = legacy · kind 필터(파일/영상 제외) · 감사·사용자 조회 tenant 범위 · 상세(타임라인 실행자, 기록된 페이지, 보드 문서 id 문자열화) · 없는 jobId → E5002 | ✅ 6 |
| 같은 파일 `KnowledgeIngestJobService events` | started→finished · failed · 리스너가 throw/reject해도 작업은 ready | ✅ 3 |
| `knowledge-ingest.site.spec.ts` (수정) | 게시 감사를 액션명으로 찾음 + **게시 감사에 jobId 포함** | ✅ |
| `knowledge-ingest.service.spec.ts` (수정) | 수명주기 행을 제외하고 기존 게시 감사 검증 유지 | ✅ |

전체: `apps/api` **2,689 tests 통과**(신규 9). tsc(api·web), nest/vite build, i18n:check(6개 언어 `siteHistory.*`), radius:check 통과.

## 2. 통합 (로컬 API + 콘솔, AI=stub)

| # | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| H1 | 기능 이전 게시 2건(ivyusa·go2joy) | "게시 완료 · n건 게시(이력 기능 이전)", 실행자=게시자 | ✅ |
| H2 | 분석 시작 직후 이력 조회 | running, 실행자 "Master Owner", 페이지 2 | ✅ |
| H3 | 실행 중 API 재시작 → 재조회 | **interrupted("서버 재시작으로 중단")**, jobId 유지 | ✅ |
| H4 | 콘솔: go2joy 2페이지 분석 → 모달 닫기 | 카드 첫 행 "검수 대기 · 초안 1 · 21:01까지 검수" + [검수하기] | ✅ |
| H5 | [검수하기] → 게시 | 행이 "게시 완료"로 바뀜(이력 쿼리 무효화) | ✅ |
| H6 | [상세] | 타임라인 시작 20:01:10 / 분석 완료 20:01:11(초안 1·페이지 1/2) / 보드 게시 20:01:33(1건), 페이지(본문 부족 371자, 초안 1), 게시 문서 #13 → 보드 링크 | ✅ |
| H7 | 만료(1시간 경과) | finished + 게시 없음 + 메모리 없음 → expired | 단위 테스트로 대체(1시간 대기 생략) |

## 3. 비고

- 카드의 기존 "분석 중/검수 대기" 한 줄 상태는 이력 목록의 진행 중·검수 대기 행으로 대체됐습니다(중복 표시 제거, 해당 i18n 키 2개 삭제).
- 이력 목록은 진행 중인 행이 있을 때만 3초 간격으로 갱신하고, 그 외에는 시작·게시 시 무효화로 갱신합니다.
