# RPT-261026 — 웹사이트 정책 분석 에이전트

- 문서: REQ/PLN/TCR-261026-Site-Policy-Agent (PLN §7 D8 = 구현 중 추가 승인)
- PR **#745** → main **`f60850ff`** (squash, 2026-10-26)
- 스키마 변경 없음 · 신규 의존성 없음 · env 추가 없음

## 1. 변경 요약

`/knowledge` ① 소스 위에 번호 없는 **웹사이트 정책 분석** 카드를 추가했습니다(master/director).

1. 주소 입력 → 탐색(동기): 홈 링크 · sitemap(상품·컬렉션·블로그 하위 맵 제외) · Shopify/Cafe24 알려진 경로에서 후보를 찾습니다.
   - 6개 언어 키워드로 분류하고, 같은 사이트 URL만 받습니다.
   - 종류별 라운드로빈으로 정렬합니다. 홈이 실패해도 sitemap과 robots로 계속합니다.
2. 후보 선택: 기본은 종류별 대표 1개이고, URL을 직접 추가할 수 있습니다. robots.txt 차단 후보는 **운영자가 "우리가 운영하는 사이트"를 확인한 경우에만** 선택할 수 있습니다(D8).
3. 분석(202 + 폴링): 기존 AI 인제스트 작업 큐에 `sourceKind=website`로 들어갑니다.
   - 페이지마다 본문 영역을 추출하고, 홈 템플릿 줄을 빼서 SPA 껍데기는 "본문 부족"으로 판정합니다.
   - 정책 전용 프롬프트를 씁니다(숫자·조건은 원문 그대로). 사용량 feature는 `knowledge_site_policy`입니다.
4. 검수: 기존 AI 임포트 검수 목록(`IngestDraftReview`로 분리해 공용)을 씁니다. 초안마다 출처 링크가 붙고, 보드에 같은 제목이 있으면 배지를 달고 기본 선택에서 뺍니다.
5. 게시: 보드 문서에 `ai-import`·`site-policy` 태그와 해당 페이지 링크가 첨부됩니다. 링크는 이 작업이 실제로 읽은 URL만 허용합니다. 감사 기록은 `knowledge.site_ingested`(+`ownerConfirmed`, 페이지별 `robotsOverridden`)입니다.

보안: 리다이렉트를 수동으로 따라가며 **홉마다** `assertPublicUrl`을 다시 검사합니다. https만 허용하고, 3MB·10초·최대 3홉 상한을 둡니다. 429는 1회 재시도하고, EUC-KR도 디코드합니다.

오류 코드: E5110(주소 거부) · E5111(열 수 없음) · E5112(다른 사이트 섞임) · E5113(읽을 본문 없음).

## 2. 파일

| 구분 | 파일 |
|---|---|
| API 신규 | `domain/knowledge/site/{safe-fetch,robots,html-text,policy-discover}.util.ts` (+spec 4), `knowledge-ingest.site.spec.ts`, `__fixtures__/site-{shopify-refund-policy,go2joy-policy-spa,go2joy-home}.html` |
| API 수정 | `knowledge-ingest.service.ts`(discoverSite/startSite/approve website 분기/정책 프롬프트), `knowledge-ingest-job.service.ts`(pages·ownerConfirmed·IngestReporter), `knowledge.controller.ts`(라우트 2), `dto/request/knowledge.request.ts`, `board/board.service.ts`(`titlesInGroup`), `error-code.constant.ts` |
| Web 신규 | `SitePolicyAgent.tsx`(카드+모달), `IngestDraftReview.tsx` |
| Web 수정 | `AiIngestModal.tsx`(공용 검수 사용), `KnowledgePage.tsx`, `knowledge.{service,hooks}.ts`, `i18n/locales/{en,es,ko,vi,ja,zh}/knowledge.json`(`site.*`) |
| 문서 | REQ/PLN/TCR-261026, SPEC §7.5 |

## 3. 테스트

- api **265 suites / 2,680 tests** 통과(신규 53), CI `typecheck · test · build` 통과
- tsc(api·web), nest/vite build, i18n:check, radius:check, env:check 통과
- 로컬 E2E (TCR §3·§4·§6)
  - go2joy: 정책 페이지 3개 중 2개 수집, SPA 1개는 본문 부족
  - ivyusa: `/policies/refund-policy`를 소유 확인 후 읽어 보드 게시·링크·감사까지 DB에서 확인
  - 콘솔 3단계 화면 확인

## 4. 배포 상태

| 환경 | 상태 | 확인 |
|---|---|---|
| 스테이징 `shoptalk.amoeba.site` | ✅ 2026-10-26 19:27 KST, `f60850ff`(`git pull --ff-only` + `deploy-staging.sh`) | API 부팅 로그 `successfully started` 1회, RestartCount 0, StartedAt 10:27:57Z · `POST /knowledge/ingest/site/discover`·`/ingest/site` **401**(=배포됨) · health 200 · dist에 `site/policy-discover.util.js`, web 번들 `KnowledgePage-*.js`에 `ownerConfirm` 포함 |
| 마이그레이션 | 해당 없음 | SQL·엔티티 변경 없음 |
| 프로덕션 | ⏳ 미배포 | `production` 브랜치 반영 대기 |

> 배포 직후 공개 URL 확인에서 health까지 404가 나왔는데, 컨테이너가 다시 만들어지던 순간이었습니다. 약 20초 뒤 200/401로 정상 확인했습니다. 배포 직후 확인은 서버 내부(`localhost:8080`)와 StartedAt을 함께 보면 오판을 피할 수 있습니다.

### 스테이징 IP 실측 (API 컨테이너 안에서 빌드 산출물 직접 실행)

| 대상 | 결과 |
|---|---|
| discover `https://ivyusa.com` | 홈 정상(로컬과 달리 429 없음), Shopify 판별, 후보 20(1.5s), `/policies/*` 4건 robots 차단 표시 |
| discover `https://go2joy.vn` | `/vi-vn` 리다이렉트, 후보 3(0.9s) |
| `ivyusa.com/pages/returns-refunds` | 200, 8,052자, heading "Return Policy", thin=false |
| `ivyusa.com/policies/refund-policy` | 200, 6,831자, thin=false (소유 확인 시 경로) |
| `ivyusa.com/pages/shipping-policy` | 200, 3,327자, thin=false |

남은 확인: 스테이징 콘솔에서 운영자가 실제 LLM 엔진으로 분석·게시하는 화면 실측(로컬은 스텁 엔진이라 폴백 초안만 확인함).

## 5. 후속 후보 (범위 밖)

- 헤드리스 렌더링(D1-B): go2joy `/vi-vn/policy`처럼 본문을 브라우저에서 그리는 정책 페이지
- 정책 변경 감지(주기적 재분석 + diff)
- Shopify 연동 테넌트는 Admin API `policies`로 직접 조회(robots 무관·고정밀)
- PDF 약관 링크 → 파일 임포트 자동 연결
