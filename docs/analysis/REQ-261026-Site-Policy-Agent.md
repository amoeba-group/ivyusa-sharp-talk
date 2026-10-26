# REQ-261026 — 웹사이트 정책 분석 에이전트 (URL → 정책 페이지 → Smart Knowledge Board)

- 요청일: 2026-10-26
- 요청: `/knowledge` 화면의 **Sources 위에** 쇼핑몰·서비스 웹사이트 주소 입력란을 두고, 그 주소에
  접속해 사이트의 **정책 페이지들**(반품·환불·배송·개인정보·이용약관 등)을 찾아 분석한 뒤
  **Smart Knowledge Board** 문서로 작성하는 에이전트를 구현한다.
- 관련: REQ-260829-Knowledge-Page-Enhancements(AI 인제스트), REQ-260829-Smart-Knowledge-Board,
  PLN-260910-Knowledge-Page-Workflow-Layout

## 1. AS-IS

| 영역 | 현황 | 근거 |
|---|---|---|
| AI 인제스트 | 파일(pdf/docx/xlsx/csv/md)·YouTube 자막 → LLM 초안 → 운영자 검수 → **보드 게시**(`ai-import` 태그) | `knowledge-ingest.service.ts`, `AiIngestModal.tsx` |
| 작업 큐 | 테넌트당 인메모리 작업 1개, 202 응답 후 폴링(`/knowledge/ingest/status`), 승인은 작업을 소비함 | `knowledge-ingest-job.service.ts` |
| 원본 연결 | 승인한 보드 문서마다 원본 첨부(파일=공유 사본 1벌, 유튜브=링크) | `attachOriginal()` |
| SSRF 가드 | `assertPublicUrl()`: https 강제, DNS 조회 후 사설·루프백·링크로컬·메타데이터 IP 차단 | `tenant/ecommerce-probe.util.ts` |
| 사이트 주소 | `tenants.storefront_url`(nullable) 존재 | `tenant.entity.ts:78` |
| HTML 파서 | **없음** — API 의존성에 cheerio/jsdom 등 없음 | `apps/api/package.json` |
| 웹페이지 수집 | **없음** — URL을 넣으면 정책을 읽어오는 경로가 없어 운영자가 정책 문구를 복사→파일로 저장→업로드하고 있음 | — |

## 2. TO-BE

1. 운영자가 `/knowledge` 맨 위(Sources 카드 위) **웹사이트 정책 분석** 카드에 주소를 넣는다
   (기본값=`tenants.storefront_url`).
2. 에이전트가 사이트를 **탐색**해 정책 페이지 후보를 찾는다: 홈 링크(앵커 텍스트·경로 키워드,
   6개 언어), `sitemap.xml`, 플랫폼별 잘 알려진 경로(Shopify `/policies/*`, Cafe24 이용안내 등).
3. 운영자가 후보 목록을 확인해 고르고(체크 해제·URL 직접 추가 가능) **분석**을 시작한다.
4. 페이지마다 본문을 추출해 LLM이 **정책 주제별 문서 초안**으로 나눈다(원문 언어 유지,
   기간·금액·조건 숫자 그대로, 없는 사실은 만들지 않음).
5. 기존 AI 임포트와 **같은 검수 화면**에서 초안을 고치고 고른 뒤 승인하면 보드에 게시된다
   (`site-policy` 태그 + 해당 정책 페이지 URL 첨부 링크). KB 채택은 기존 보드 검토 절차를 따른다.

## 3. 갭 분석

| # | 갭 | 필요한 것 |
|---|---|---|
| G1 | 웹페이지를 가져오는 코드 없음 | 안전한 fetch 유틸: 리다이렉트 **매 홉마다** SSRF 재검사, 타임아웃, 응답 크기 상한, `text/html`만, robots.txt 준수 |
| G2 | 정책 페이지를 찾는 로직 없음 | 후보 탐색 + 점수화(키워드 6개 언어·경로·sitemap), 같은 사이트(호스트)만 |
| G3 | HTML → 본문 텍스트 변환 없음 | 의존성 없는 추출 유틸: script/style/nav/header/footer 제거, `<main>`/`<article>`/`.rte` 우선, 블록 태그 → 줄바꿈, 엔티티 디코드, 표는 마크다운 표로 |
| G4 | 인제스트 원천이 file/youtube 두 종뿐 | `sourceKind='website'` + 초안별 출처 URL(`IngestDraft.sourceUrl`) |
| G5 | 재실행 시 보드에 같은 정책이 중복 게시됨 | 검수 화면에 "보드에 같은 제목 있음" 표시 + 기본 체크 해제 |
| G6 | `/knowledge` 상단에 진입점 없음 | Sources 위 카드 + 탐색/분석 모달 |

## 4. 실측 (2026-10-26, 결정에 직접 영향)

| 사이트 | 결과 | 시사점 |
|---|---|---|
| `go2joy.vn/vi-vn/policy` (Nuxt) | HTTP 200·49KB인데 추출 텍스트는 **1,096자, 메뉴·푸터뿐**. 본문은 브라우저에서 API로 받아 그림(`__NUXT_DATA__`에도 없음) | **정적 수집만으로는 SPA 정책 본문을 못 읽음** → 본문 부족 판정 + 안내가 필요하고, 해결하려면 헤드리스 브라우저가 필요(D1) |
| `ivyusa.com/policies/refund-policy` (Shopify) | 짧은 UA → **429**, 브라우저형 UA → 200·510KB, 텍스트 14.8K자 중 대부분이 상단 메뉴 | 본문 영역 우선 추출(G3) 필수, UA·재시도 정책 실측 필요 |
| `go2joy.vn` 홈 | 정책 링크 `/vi-vn/policy`, `/vi-vn/complaint-handling-policy` 발견 | 링크 탐색 자체는 SPA에서도 동작(SSR된 메뉴) |

## 5. 사용자 흐름

```
[카드] 주소 입력 → [사이트 분석] ─▶ 탐색(≤20초) ─▶ 후보 목록(체크) ─▶ [선택한 N개 분석]
   ─▶ 진행률(페이지 i/N) ─▶ 초안 검수(기존 화면 + 출처 URL·중복 표시) ─▶ [보드에 게시]
   ─▶ 토스트 + [보드에서 보기] ─▶ (기존) 보드 검토 → KB 채택
```

## 6. 제약·비기능

- **보안**: 테넌트가 입력한 URL을 서버가 요청하므로 SSRF가 핵심 위험. https만 허용하고, 리다이렉트는
  수동으로 따라가며 홉마다 `assertPublicUrl`, 같은 사이트(eTLD+1 근사: 입력 호스트와 그 `www.` 짝)만 허용.
- **예의**: robots.txt Disallow 준수, 실행당 최대 페이지 수 상한, 요청 간 간격, 정직한 UA(봇 식별 + 연락처).
- **무저장 원칙 유지**: 승인 전 초안은 메모리에만 존재(D4-1 선례). 원문 HTML은 저장하지 않고 URL만 남긴다.
- **비용**: 페이지당 LLM 1~2회(12K자 청크). 계측 feature를 분리해 사용량 화면에서 구분.
- **스키마 변경 없음**(설계 목표) → 마이그레이션 불필요.
- 권한: 기존 인제스트와 동일한 `KNOWLEDGE_SOURCE_MANAGE`.
- i18n 6개 언어, 모든 실행·게시에 토스트.

## 7. 범위 밖 (후속)

- 주기적 재분석·정책 변경 감지(diff) 알림
- 로그인이 필요한 페이지, PDF로 링크된 약관(1차는 HTML만. PDF 링크는 후보에 "파일 임포트 사용" 안내)
- Shopify Admin API `policies` 직접 조회(연동된 Shopify 테넌트 한정 고정밀 경로) — 후보로 기록
