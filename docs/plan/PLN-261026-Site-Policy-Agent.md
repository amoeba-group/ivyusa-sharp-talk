# PLN-261026 — 웹사이트 정책 분석 에이전트

- 근거: `docs/analysis/REQ-261026-Site-Policy-Agent.md`
- 브랜치: `session/kb-site-policy-agent` → `feature/kb-site-policy-agent`
- **스키마 변경 없음**(SQL 0건) · 신규 npm 의존성 없음(D1-A 기준)
- ⚠️ 승인 전 구현 착수 금지

## 1. 개념

새 수집기를 만들지 않고 **기존 AI 인제스트에 세 번째 원천 `website`를 붙인다**.
탐색(discover)만 새 단계이고, 분석·검수·보드 게시·감사는 파일/영상 경로를 그대로 쓴다.

```
discover (동기, ≤20s)          ingest/site (202 + 폴링, 기존 작업 큐)          ingest/approve (기존)
URL ─▶ 홈·sitemap·알려진 경로 ─▶ 후보[] ─▶ 운영자 선택 ─▶ 페이지별 fetch→본문 추출→LLM ─▶ 초안[] ─▶ 보드 게시
```

## 2. 결정 사항 (권장안 ★)

| # | 결정 | 선택지 | 권장 |
|---|---|---|---|
| D1 | SPA(브라우저 렌더링) 사이트 처리 | **A** 정적 HTTP만 + 본문 부족 판정·안내(이 페이지는 브라우저 렌더링 필요 → 텍스트 붙여넣기/파일 임포트) / **B** 헤드리스 Chromium 사이드카 컨테이너(browserless 등, 이미지 +~400MB, 메모리 상시 점유) 1차에 포함 | ★A로 1차 출시 → go2joy처럼 SPA 사이트가 실제로 막히면 B를 별도 PLN으로. 단, **go2joy 정책 본문은 1차에서 자동으로 읽히지 않음**(REQ §4 실측) |
| D2 | 흐름 | 한 번에 끝까지(자동 선택) / ★2단계(후보 확인 → 분석) | ★2단계 — 엉뚱한 페이지(블로그·채용)에 LLM 비용을 쓰지 않고, 운영자가 놓친 URL을 직접 추가 가능 |
| D3 | 재실행 중복 | 무조건 생성 / 같은 제목 skip(B4 선례) / ★검수 화면에 "보드에 같은 제목 있음" 배지 + 기본 체크 해제 | ★배지 — 정책이 바뀌어 다시 넣고 싶은 경우를 막지 않으면서 실수 중복은 막음 |
| D4 | 진입 카드 위치·번호 | Sources를 2번으로 밀고 새 카드를 1번 / ★번호 없는 "빠른 시작" 카드(Sources 위) | ★번호 없음 — ProcessGuide 단계·앵커·매뉴얼 캡처를 바꾸지 않음 |
| D5 | 주소 기억 | 새 컬럼 / ★`tenants.storefront_url` 기본값 + 입력값은 저장 안 함 | ★스키마 0건. 비어 있으면 빈 입력란 |
| D6 | 보드 문서 메타 | 태그 `site-policy` · 그룹 기본 counsel · category1=LLM이 기존 카테고리 우선 매핑 · 출처 페이지 URL 링크 첨부(초안별) | 그대로 |
| D7 | 비용 계측 | ★`function=SUMMARY`, `feature='knowledge_site_policy'` | 사용량 화면에서 파일 임포트와 구분 |

## 3. 와이어프레임

### 3-1. `/knowledge` — Sources 위 새 카드

```
┌ 지식 관리 ───────────────────────────────────────────────────────────────┐
│ [ProcessGuide …]                                                         │
├──────────────────────────────────────────────────────────────────────────┤
│ 🌐 웹사이트 정책 분석                                                     │
│ 쇼핑몰·서비스 주소를 넣으면 반품·배송·개인정보·약관 페이지를 찾아          │
│ 보드 문서 초안으로 만듭니다. 게시 전 반드시 검수합니다.                    │
│ ┌──────────────────────────────────────────────┐ [ 사이트 분석 ]          │
│ │ https://ivyusa.com                           │                          │
│ └──────────────────────────────────────────────┘                          │
│ (분석 중이면) ▓▓▓▓▓░░░ 3/5 페이지 분석 중 · [진행 보기]                   │
├──────────────────────────────────────────────────────────────────────────┤
│ ① 소스                                              [ 소스 추가 ]        │
│ …(기존)                                                                  │
```

### 3-2. 모달 1단계 — 정책 페이지 후보

```
┌ 웹사이트 정책 분석 ─────────────────────────────────────────── [×] ┐
│ https://ivyusa.com · 후보 6개 찾음 (홈 링크 4 · sitemap 2)         │
│ 저장 그룹 [상담 ▾]                                                 │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ [✓] Refund policy        /policies/refund-policy      반품·환불 │ │
│ │ [✓] Shipping policy      /policies/shipping-policy    배송      │ │
│ │ [✓] Privacy policy       /policies/privacy-policy     개인정보  │ │
│ │ [✓] Terms of service     /policies/terms-of-service   약관      │ │
│ │ [ ] FAQ                  /pages/faq                   FAQ       │ │
│ │ [ ] robots.txt 차단      /pages/legal          ⚠ 수집 불가      │ │
│ └────────────────────────────────────────────────────────────────┘ │
│ URL 직접 추가 [ https://ivyusa.com/pages/...        ] [추가]        │
│                                     [취소]  [ 선택한 4개 분석 ]    │
└────────────────────────────────────────────────────────────────────┘
```
후보 0개 → "정책 페이지를 찾지 못했습니다. URL을 직접 추가하세요." (입력란만 남김)

### 3-3. 모달 2단계 — 진행

```
│ 분석 중 ▓▓▓▓▓▓░░░░ 2/4 페이지                                       │
│ ✓ Refund policy      초안 3                                         │
│ ✓ Shipping policy    초안 2                                         │
│ ⚠ Privacy policy     본문이 부족합니다(브라우저 렌더링 사이트로 보임) │
│ … Terms of service                                                  │
```

### 3-4. 모달 3단계 — 검수 (기존 AI 임포트 검수 화면 재사용 + 2열 추가)

```
│ 초안 7개 · 선택 6                                                   │
│ [✓] 반품 가능 기간과 조건   [반품/환불 ▾]  🔗/policies/refund-policy │
│ [ ] 환불 처리 기간  ⚠ 보드에 같은 제목 있음   🔗/policies/refund-…   │
│ [✓] 배송비와 무료배송 기준  [배송 ▾]       🔗/policies/shipping-…   │
│   ▸ (펼치면 제목·카테고리·본문 편집 — 기존과 동일)                   │
│                                  [취소]  [ 보드에 6개 게시 ]        │
```
게시 성공 → 토스트 "보드에 6개 게시했습니다" + [보드에서 보기]. 실패 → 오류 토스트(수동 닫기).

## 4. 단계별 작업

### S1. API — 수집 유틸 (`domain/knowledge/site/`)
- `safe-fetch.util.ts`: `assertPublicUrl` 재사용(공용 위치로 export만 정리), `redirect:'manual'` 최대 3홉·홉마다 재검사,
  타임아웃 10s, 본문 2MB 상한(스트림 중단), `content-type: text/html|application/xhtml|text/xml`만,
  UA `Mozilla/5.0 (compatible; SharpTalkBot/1.0; +https://sharptalk.amoeba.site)`, 429면 `Retry-After`(≤5s) 1회 재시도.
- `robots.util.ts`: `User-agent: *`·`SharpTalkBot` 그룹의 Disallow/Allow 최장 일치(작은 파서, 실패=허용).
- `html-text.util.ts`: 본문 추출(우선순위 `main` > `article` > `[role=main]` > `.rte|.policy|.shopify-policy__body` > `body`),
  script/style/noscript/nav/header/footer/form/svg 제거, 블록 태그 → 줄바꿈, 헤딩 → `#`, `li` → `- `, 표 → MD 표,
  엔티티 디코드, `<title>` 반환. **본문 부족 판정**: 추출 텍스트 < 400자 또는 링크 텍스트 비율 > 60%.
- `policy-discover.util.ts`: 후보 수집(홈 `<a>` + `sitemap.xml`(색인 1단계까지, URL 500개 상한) + 알려진 경로 HEAD/GET 확인:
  Shopify `/policies/{refund,shipping,privacy,terms-of-service}-policy`, Cafe24 `/member/agreement.html`·`/member/privacy.html`·
  `/board/...` 제외), 같은 호스트(+`www.` 짝)만, 점수=키워드(6개 언어 사전: refund/return/shipping/delivery/privacy/terms/policy/
  exchange/환불/반품/교환/배송/개인정보/약관/이용안내/chính sách/đổi trả/hoàn tiền/vận chuyển/điều khoản/bảo mật/返品/配送/
  プライバシー/利用規約/退货/配送/隐私/条款/reembolso/devolución/envío/privacidad/términos), 정규화 URL 중복 제거, 상위 20개.
  분류 라벨(refund/shipping/privacy/terms/payment/faq/other)은 화면 배지용.

### S2. API — 서비스·라우트
- `KnowledgeIngestService.discoverSite(tenantId, url)` → `{ site, candidates[{url,title,kind,source,robotsBlocked}] }`
  (동기, 전체 20s 예산).
- `startSite(tenantId, urls[], docGroup)`: 1~10개, 각 URL 같은 사이트 재검증 → 기존 `jobs.start(sourceKind:'website')`;
  페이지별 fetch → 추출 → 본문 부족이면 페이지 경고만 남기고 다음 페이지 → `analyze()`(정책 전용 system 프롬프트, D7 feature).
  전 페이지 실패 시 작업 실패(E5113).
- `IngestDraft`에 `sourceUrl?: string`, `IngestJob`에 `pages?: {url,title,status,drafts,warning}[]` 추가(진행·경고 표시).
- 상태 응답에 초안별 `duplicateOnBoard`(보드 같은 그룹·같은 제목 존재) 계산.
- `approve()`: `sourceKind==='website'`이면 태그 `site-policy`, 첨부 = 초안 자신의 `sourceUrl` 링크
  (기존 `attachments.addLink`), 감사 `knowledge.site_ingested`(사이트·페이지 수·게시 수).
- 라우트: `POST /knowledge/ingest/site/discover`, `POST /knowledge/ingest/site` — `@RequireCapability(KNOWLEDGE_SOURCE_MANAGE)`.
  DTO(snake): `DiscoverSiteRequest{site_url}`, `IngestSiteRequest{urls[], doc_group?}`. 승인 DTO에 `source_url?` 허용.
- 오류 코드 E5110~E5113: `SITE_URL_REJECTED`(https 아님·사설 주소·형식) / `SITE_UNREACHABLE`(타임아웃·4xx/5xx·HTML 아님) /
  `SITE_URL_FOREIGN`(다른 사이트 URL 섞임) / `SITE_NO_CONTENT`(선택한 페이지 전부 본문 없음). 거부 시 `logger.warn`.
- 기존 `GET /knowledge/ingest/status`, `POST /knowledge/ingest/approve` 그대로(작업 1개 공유 — 파일 임포트 중이면 E5069).

### S3. 콘솔
- `SitePolicyCard.tsx`(Sources 위, 번호 없음) + `SitePolicyModal.tsx`(후보 → 진행 → 검수). 검수 목록은 `AiIngestModal`의
  초안 편집 부분을 `IngestDraftReview` 컴포넌트로 분리해 양쪽이 공유(출처·중복 열은 props로).
- hooks: `useDiscoverSite`, `useIngestSite`(+기존 `useIngestStatus`, `useApproveIngest`), 쿼리키에 tenantId.
- 기본 URL = 테넌트 설정의 `storefrontUrl`(기존 조회 훅 재사용).
- i18n `knowledge` 네임스페이스 6개 언어(카드·모달·후보 라벨 7종·E5110~E5113 메시지), `npm run i18n:check`.
- 토스트: 탐색 실패/후보 0, 분석 시작, 게시 성공/실패.

### S4. 테스트·문서·배포
- TCR-261026, RPT-261026. 매뉴얼(지식 관리 문서)에 절 추가는 RPT 이후 별도.
- 배포: SQL 없음 → 스테이징 배포 후 `/knowledge/ingest/site/discover` 401 확인(=배포됨), ivyusa·go2joy 실측.

## 5. 영향 분석

| 영역 | 영향 | 대응 |
|---|---|---|
| 기존 파일/영상 임포트 | `IngestDraft`·`IngestJob`에 선택 필드 추가, 검수 UI 컴포넌트 분리 | 선택 필드라 기존 응답 호환. 분리 후 파일 임포트 회귀 스모크 |
| 작업 큐 | 테넌트당 1개 공유 → 사이트 분석 중 파일 임포트 불가(E5069) | 의도된 동작(초안 저장소가 하나). 카드에 진행 중 표시 |
| SSRF | 새 외부 요청 표면 | 홉별 재검사·https·크기/시간 상한·같은 사이트 제한, 단위 테스트(사설 IP·리다이렉트 우회·`@`/IDN 호스트) |
| 외부 사이트 | 봇 차단(429/403)·약관 | robots 준수·상한 10페이지·간격 500ms, 실패는 페이지 경고로 |
| AI 비용 | 페이지당 1~2회 | 상한 10페이지·MAX_DRAFTS 100 재사용, feature 분리 계측 |
| 모더레이션 | 고객 발신 아님(보드 초안) | 해당 없음 — KB 채택 후 답변 경로는 기존 모더레이션 통과 |
| 스키마·마이그레이션 | 없음 | — |
| 권한 | 기존 `KNOWLEDGE_SOURCE_MANAGE` | 카드도 같은 조건으로 노출 |

## 6. 테스트 계획 (TCR에서 상세화)

- 단위: html-text(Shopify·go2joy·Cafe24 실 HTML 픽스처 → 본문만/부족 판정), discover(키워드 6개 언어·같은 호스트·sitemap 색인·
  중복 정규화), robots(최장 일치), safe-fetch(사설 IP·리다이렉트로 내부 이동·크기 초과·HTML 아님·429 재시도), 서비스(페이지 일부 실패
  계속·전부 실패 E5113·초안 sourceUrl·approve 태그/첨부/감사·중복 배지).
- 통합(로컬 API + 실사이트): ivyusa.com → 정책 4종 후보·초안 생성·보드 게시·첨부 링크. go2joy.vn → 후보 발견·본문 부족 경고(D1-A 예상 동작).
- 스텁 엔진(키 없음): 통짜 폴백 초안으로 끝까지 흐름 성립.
- 콘솔: 카드 → 모달 3단계 → 토스트 → 보드에서 보기, 파일 임포트 회귀.

## 7. 변경 승인 (2026-10-26, 구현 중 결정)

| # | 결정 | 근거 |
|---|---|---|
| D8 | **운영자가 "우리가 운영하는 사이트"임을 확인하면 robots.txt 차단 페이지도 읽는다.** 확인하지 않으면 기존대로 robots 준수(차단 경로는 요청하지 않음). 탐색 단계는 확인 여부와 관계없이 차단 경로를 요청하지 않고 목록에만 표시. | 구현 중 실측: Shopify 기본 robots.txt가 모든 봇에 `/policies/`를 Disallow → 표준 정책 4종이 수집 불가. robots.txt는 크롤러 대상 규약이고, 이 기능은 소유자가 요청 시점에 자기 페이지를 읽는 것. 사용자 승인(채팅). |

- API: `POST /knowledge/ingest/site`에 `owner_confirmed?: boolean`. 읽은 차단 페이지는 `pages[].robotsOverridden=true`, 서버 로그 1줄, 승인 감사 `knowledge.site_ingested`에 `ownerConfirmed` + 페이지별 `robotsOverridden`.
- 기본 선택 변경: 종류별 대표 1개(FAQ 제외). 확인을 체크하면 차단된 정책 후보를 앞에 추가(10개 상한 내), 해제하면 제거.

```
│ [✓] Refund policy   반품·환불  ⚠ robots.txt 차단 — 우리 사이트 확인 시 읽기 가능 │
│ …                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ [✓] 이 웹사이트는 우리가 운영하는 사이트입니다                            │ │
│ │     확인하면 robots.txt가 막아 둔 페이지 4개도 선택해 읽을 수 있습니다     │ │
│ │     (예: Shopify 기본 설정은 /policies/를 막습니다). 감사 로그에 남습니다. │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
진행/검수:  [초안 1] Return Policy
                    robots.txt 차단 페이지 — 운영자 확인으로 읽음
```
