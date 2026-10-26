# PLN-261026 — 웹사이트 정책 분석 진행 히스토리

- 근거: `docs/analysis/REQ-261026-Site-Ingest-History.md`
- ⚠️ 승인 전 구현 착수 금지

## 1. 개념

실행 한 번 = 작업 id(`job.id`, uuid) 하나입니다. 그 수명주기의 이벤트를 **감사 로그(`audit_logs`)에 남기고, 작업 id로 묶어** 이력을 만듭니다.
선례는 "소스 전환 내역"(#429)입니다. 거기서도 실행 이력을 감사 로그 metadata로 재구성했고 새 테이블을 만들지 않았습니다.

| 이벤트(action) | 시점 | metadata |
|---|---|---|
| `knowledge.ingest_started` | 작업 시작 | jobId, sourceKind, sourceLabel, site, docGroup, pages[url], ownerConfirmed |
| `knowledge.ingest_finished` | 초안 준비 완료 | jobId, drafted, pages[url·title·status·drafts·detail], truncated |
| `knowledge.ingest_failed` | 실패 | jobId, error(코드), pages[…] |
| `knowledge.site_ingested` (기존) | 게시 | **+ jobId** (기존 필드 유지) |

상태 판정(서버 계산):

| 상태 | 조건 |
|---|---|
| 진행 중 | 메모리 작업 id 일치 + running |
| 검수 대기 | 메모리 작업 id 일치 + ready (만료 시각 표시) |
| 게시 완료 | 게시 이벤트 있음 |
| 미게시(만료) | finished는 있으나 게시 없음 + 메모리에 없음 |
| 실패 | failed 이벤트 |
| 중단 | started만 있음 + 메모리에 없음 (서버 재시작·배포) |

## 2. 결정 사항 (권장안 ★)

| # | 결정 | 선택지 | 권장 |
|---|---|---|---|
| D1 | 저장소 | ★**A 감사 로그 재사용**(스키마 0, 선례 #429) / B 새 테이블 `kb_ingest_runs`(SQL 마이그레이션 → 스테이징·프로덕션 선적용 필요) | ★A — 요구는 "진행 여부 확인"이고, 감사 로그로 충분합니다. 조회는 `tenant_id` 인덱스 + action 필터 + 최근 N건이라 가볍습니다 |
| D2 | 기록 범위 | 웹사이트만 / ★모든 인제스트(파일·영상·웹사이트) 기록 + **화면은 웹사이트 카드만** | ★ — 기록은 작업 큐 한 곳에서 하므로 비용이 같습니다. AI 임포트 모달의 이력 화면은 필요할 때 후속으로 붙입니다 |
| D3 | 초안 보존 | ★현행(메모리, 1시간) 유지 + 이력에 "만료 시각"과 "미게시(만료)" 표시 / 초안까지 DB에 저장해 언제든 검수 재개(D1-B 필수) | ★현행 — 승인 전 초안은 지식이 아니라는 원칙을 유지합니다. 만료가 잦다고 확인되면 B를 별도 PLN으로 진행합니다 |
| D4 | 목록 크기 | ★카드에 최근 5건 + [전체 보기] 모달에 최근 50건 | ★ |
| D5 | 실행자 표시 | ★사용자 이름(없으면 이메일) — 테넌트 사용자 테이블 조회 | ★ |

## 3. 와이어프레임

### 3-1. 카드 (기존 입력 아래에 "최근 분석" 추가)

```
┌ 🌐 웹사이트 정책 분석 ──────────────────────────────────────────────────┐
│ 쇼핑몰·서비스 주소를 넣으면 … 게시 전에 반드시 검수합니다.               │
│ [ https://ivyusa.com                              ] [ 사이트 분석 ]     │
│                                                                        │
│ 최근 분석                                                  [전체 보기] │
│ ● 진행 중     ivyusa.com  2/4 페이지      김운영 · 10/26 19:40  [보기]  │
│ ◐ 검수 대기   go2joy.vn   초안 6 · 20:41까지  김운영 · 10/26 19:41 [검수]│
│ ✓ 게시 완료   ivyusa.com  6/8건 게시      dev · 10/26 15:02     [상세]  │
│ ⚠ 미게시      go2joy.vn   초안 6 · 검수 시간 만료  kim · 10/25  [상세]  │
│ ✕ 실패        shop.com    읽을 본문 없음(E5113)    dev · 10/24  [상세]  │
│ ⏸ 중단        shop.com    서버 재시작으로 중단      dev · 10/23  [상세]  │
└────────────────────────────────────────────────────────────────────────┘
```
이력이 없으면 "아직 분석 기록이 없습니다."

### 3-2. 상세 모달

```
┌ 분석 상세 — ivyusa.com ─────────────────────────────────────── [×] ┐
│ 상태 ✓ 게시 완료 · 그룹 상담 · 우리 사이트 확인 ✓                     │
│                                                                      │
│ 19:40:02  시작        김운영 · 페이지 4개                              │
│ 19:41:30  분석 완료   초안 8 · 페이지 3/4 성공                         │
│ 19:45:11  보드 게시   6건 · 김운영                                    │
│                                                                      │
│ 페이지                                                                │
│ [초안 3] Refund policy        /policies/refund-policy  (robots 확인)  │
│ [초안 3] Shipping policy      /policies/shipping-policy               │
│ [초안 2] Returns & refunds    /pages/returns-refunds                  │
│ [열 수 없음] FAQ              /pages/faq   HTTP 429                    │
│                                                                      │
│ 게시된 보드 문서  #12 #13 #14 #15 #16 #17  → 보드에서 보기             │
│ (진행 중·검수 대기면 하단에 [진행 보기]/[검수하기])                     │
│                                                         [닫기]       │
└──────────────────────────────────────────────────────────────────────┘
```
10/26 이전 실행은 게시 기록만 있어 "이 실행은 이력 기능 이전에 실행되어 시작·완료 기록이 없습니다"라고 표시합니다.

## 4. 단계별 작업

### S1. API
- `KnowledgeIngestJobService.start()`가 meta에 `actorUserId`를 받고 `onEvent` 콜백을 호출합니다(started/finished/failed). `KnowledgeIngestService`가 이 콜백을 받아 `revisions.recordAudit`로 기록합니다(fail-open).
  - 작업 큐는 감사 의존성 없이 순수하게 유지합니다.
- `startFile/startVideo/startSite`에 actorUserId를 전달합니다(컨트롤러에서 `actor.userId`).
- `approve()`의 게시 감사 metadata에 `jobId`를 추가합니다(파일·영상 `knowledge.file_ingested`도 동일).
- `GET /knowledge/ingest/history?kind=website&limit=5|50` → `IngestRunSummary[]`
  - 내용: jobId, status, sourceKind, sourceLabel, startedAt, finishedAt, publishedAt, startedBy{name}, pagesTotal, pagesOk, drafted, saved, error, expiresAt
  - 조회 방식: `audit_logs`에서 tenant + action IN(4종)을 최근순 최대 500행 읽은 뒤 jobId로 묶습니다. 메모리 작업과 대조해 진행 중·검수 대기를 판정합니다.
  - jobId가 없는 과거 게시 감사는 "이력 이전" 행으로 표시합니다.
- `GET /knowledge/ingest/history/:jobId` → 상세(이벤트 타임라인, pages, boardDocumentIds, ownerConfirmed). 다른 테넌트의 jobId는 404.
- 권한: `KNOWLEDGE_SOURCE_MANAGE`. 실행자 이름은 users(tenant 범위)에서 일괄 조회합니다.
- 새 오류 코드 없음(없는 jobId는 기존 `RESOURCE_NOT_FOUND`).

### S2. 콘솔
- `SitePolicyCard`에 `IngestHistoryList`(최근 5건, 진행 중이 있으면 상태 폴링에 맞춰 갱신) 추가.
- `IngestRunDetailModal`(타임라인·페이지·게시 문서 링크·진행 보기/검수하기 버튼), [전체 보기] 모달(50건).
- 분석 시작·게시·실패 시 이력 쿼리를 무효화합니다. 쿼리 키에 tenantId를 포함합니다.
- i18n `knowledge.siteHistory.*` 6개 언어. 상태 6종, 타임라인 라벨, 이력 이전 안내.

### S3. 테스트·문서·배포
- 단위: 이벤트 기록(시작/완료/실패, 기록 실패 시에도 작업 계속), 상태 판정 6종(메모리 대조 포함), jobId 없는 과거 행, 테넌트 격리, 실행자 이름.
- TCR/RPT-261026-Site-Ingest-History. SQL 없음 → 스테이징 배포 후 `/knowledge/ingest/history` 401 확인 → 프로덕션.

## 5. 영향 분석

| 영역 | 영향 | 대응 |
|---|---|---|
| 작업 큐 | start meta에 actor·이벤트 콜백 추가 | 선택 인자 → 기존 스펙 호출 무변경 |
| 감사 로그 | 실행당 행 2~3개 추가(시작+완료/실패+게시) | 수동 실행이라 양이 적음. 기존 감사 화면에도 노출되며, 액션명이 명확해 오히려 추적성이 올라감 |
| 파일·영상 임포트 | 기록만 추가, 화면 무변경 | — |
| 성능 | 이력 조회는 최근 500행 상한 | `idx_audit_tenant` 사용 |
| 스키마 | 없음 | — |
