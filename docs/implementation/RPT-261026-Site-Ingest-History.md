# RPT-261026 — 웹사이트 정책 분석 진행 히스토리

- 문서: REQ/PLN/TCR-261026-Site-Ingest-History (권장안 D1~D5 승인)
- PR **#748** → main **`853e1dc8`** (squash, 2026-10-26)
- 스키마 변경 없음(감사 로그 재사용) · 신규 의존성·env 없음

## 1. 변경 요약

- **기록**
  - 분석 실행마다 시작·완료·실패를 감사 로그에 남깁니다: `knowledge.ingest_started|finished|failed`. metadata에는 jobId, 사이트, 페이지 요약, 초안 수, 오류 코드가 들어갑니다. 초안 본문은 저장하지 않습니다.
  - 기존 게시 감사(`knowledge.site_ingested` / `file_ingested`)에 jobId를 추가했습니다.
  - 파일·영상·웹사이트 인제스트 모두 기록합니다(D2).
- **작업 큐**: 실행자(`startedBy`)와 수명주기 이벤트 리스너를 추가했습니다. 리스너가 실패해도 작업은 계속됩니다.
- **조회**: `IngestHistoryService`가 감사 행(최근 500)을 jobId로 묶고, 메모리에 있는 작업과 대조해 상태를 판정합니다.
  - 상태 6종: 진행 중 · 검수 대기(+만료 시각) · 게시 완료 · 미게시(만료) · 실패 · 중단(재시작)
  - 실행자 이름은 테넌트 범위에서 조회하고, 이름이 없으면 이메일을 씁니다.
  - jobId가 없는 과거 게시 행은 "이력 기능 이전"으로 표시합니다.
- **API**: `GET /knowledge/ingest/history?kind=&limit=`(최대 50), `GET /knowledge/ingest/history/:jobId` — `KNOWLEDGE_SOURCE_MANAGE`
- **콘솔**
  - 웹사이트 카드 아래 "최근 분석" 5건, [전체 보기] 50건
  - 상세 모달: 타임라인·실행자, 페이지별 결과, 게시 문서 링크, 진행 보기/검수하기
  - 카드의 기존 한 줄 상태는 목록으로 대체했습니다.

## 2. 파일

| 구분 | 파일 |
|---|---|
| API 신규 | `domain/knowledge/ingest-history.service.ts` (+spec) |
| API 수정 | `knowledge-ingest-job.service.ts`, `knowledge-ingest.service.ts`, `knowledge.controller.ts`, `knowledge.module.ts`(User forFeature·provider), 기존 스펙 2개 |
| Web 신규 | `domain/knowledge/IngestHistory.tsx` |
| Web 수정 | `SitePolicyAgent.tsx`, `knowledge.{service,hooks}.ts`, `i18n/locales/*/knowledge.json`(`siteHistory.*` 추가, 미사용 `site.runningLine/readyLine` 삭제) |
| 문서 | REQ/PLN/TCR-261026-Site-Ingest-History, SPEC §7.5 |

## 3. 테스트

- api **2,689 tests** 통과(신규 9), CI `typecheck · test · build` 통과
- 로컬 E2E(TCR §2)
  - 이력 이전 게시 2건 legacy 표시
  - 실행 중 API를 재시작하면 "중단"으로 표시
  - 콘솔에서 검수 대기 → 게시 완료, 상세 타임라인과 문서 #13 링크

## 4. 배포 상태

| 환경 | 상태 | 확인 |
|---|---|---|
| 스테이징 `shoptalk.amoeba.site` | ✅ 2026-10-26 20:29 KST, `853e1dc8` (`git pull --ff-only` + `deploy-staging.sh`) | `successfully started` 1회, RestartCount 0(StartedAt 11:29:37Z), ERROR 0 · `GET /knowledge/ingest/history` **401**(내부·공개) · health 200 · 번들 `KnowledgePage-*.js`에 `siteHistory` |
| 프로덕션 `sharptalk.amoeba.site` | ✅ 2026-10-26 20:30 KST, `production` e4be67f9..853e1dc8 (ff) + `deploy-self-hosted.sh` | configuration·마이그레이션 게이트 OK, `successfully started` 1회, RestartCount 0(StartedAt 11:30:46Z), 최근 5분 ERROR 0 · history **401**(내부 :8081·공개) · health 200 · 번들에 `siteHistory` |
| 마이그레이션 | 해당 없음 | SQL·엔티티 변경 없음 |

## 5. 알려진 한계·후속

- 10/26 #745 배포 후 이 기능 배포 전까지의 실행은 게시 감사만 있어 "이력 기능 이전"으로 표시됩니다. 소급할 수 없습니다.
- 초안은 여전히 메모리 1시간 보존입니다(D3). "미게시(만료)"가 자주 보이면 초안 DB 저장과 검수 재개를 별도 PLN으로 진행합니다.
- 파일·영상 임포트 이력도 이미 기록되고 있습니다. 화면(AI 임포트 모달)은 필요할 때 붙입니다.
