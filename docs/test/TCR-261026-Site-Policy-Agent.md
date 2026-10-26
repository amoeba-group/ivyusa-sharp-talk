# TCR-261026 — 웹사이트 정책 분석 에이전트

- 근거: `docs/analysis/REQ-261026-Site-Policy-Agent.md`, `docs/plan/PLN-261026-Site-Policy-Agent.md`
- 실행일: 2026-10-26 (로컬 · 워크트리 `session/kb-site-policy-agent`)

## 1. 단위 테스트

| 파일 | 케이스 | 결과 |
|---|---|---|
| `site/html-text.util.spec.ts` | Shopify 정책 실 HTML(510KB→픽스처 208KB): 본문만, `10 days`·`$6.95` 원문 유지, MD 헤딩/목록, 메가메뉴 제거 · go2joy SPA: 홈 템플릿 차감 후 thin · 차감 없으면 템플릿 잔존 · `<main>` 우선+nav/header/footer 제거 · 동명 중첩 `<div>` 균형 · 표→MD 표(`\|` 이스케이프) · 링크 밀집=thin · 48,000자 절단 · 엔티티 · 헤딩(h1 > 첫 짧은 줄 > `<title>`) | ✅ 12 |
| `site/robots.util.spec.ts` | Shopify 기본 `/policies/` 차단 · 자기 봇 그룹 우선 · "bot" 부분일치 오인 없음 · 최장일치/Allow 동률/`$` · 빈 Disallow·쓰레기=허용 | ✅ 5 |
| `site/policy-discover.util.spec.ts` | 6개 언어 분류 8건 · 블로그/상품/에셋 제외 · sameSite(www 동일, 서브도메인·접미 위장 거부) · normalizeUrl(utm·#·`?`·말미 `/`) · 링크 추출(mailto/js/# 제외) · sitemap index · 종류 라운드로빈 · 차단 후보 후순위+상한 5 · go2joy 홈 실 HTML · **홈 429에도 sitemap+robots로 Shopify 판별, 차단 경로는 요청 없이 목록만** · 전부 실패=홈 오류 · 홈으로 리다이렉트되는 알려진 경로 제외 | ✅ 19 |
| `site/safe-fetch.util.spec.ts` | http·127.0.0.1·169.254.169.254·[::1] 요청 전 차단 · **리다이렉트로 사설 IP 이동 차단(홉별 재검사, redirect=manual)** · 상대 리다이렉트 최종 URL·봇 UA · 3홉 초과 · 429 1회 재시도/재실패 · PDF 거부 · 크기 상한 절단 · EUC-KR meta 디코드 · 헤더 charset 우선/미지 charset 폴백 | ✅ 8 |
| `knowledge-ingest.site.spec.ts` | 입력 정규화(도메인만→https, http/자격증명/호스트 없음=E5110) · 연결 실패 E5111/사설 E5110 · 다른 사이트 섞임 E5112 · 11페이지 거부 · 페이지 처리(robots 차단 미요청, 정책 프롬프트·feature `knowledge_site_policy`, 메뉴 미전달, 초안 sourceUrl, 보드 중복 배지) · SPA thin+403 → E5113, AI 미호출 · 스텁 폴백 초안(페이지 헤딩 제목) · 승인: `site-policy` 태그, 자기 페이지만 링크(외부 URL 거부), 감사 `knowledge.site_ingested`+pages | ✅ 7 |
| `knowledge-ingest.site.spec.ts` (D8 추가) | 소유 확인 시 차단 페이지 요청·`robotsOverridden`·감사 `ownerConfirmed` · 미확인 시 robots 상태·미요청 | ✅ 2 |

전체: `apps/api` **265 suites / 2,680 tests 통과**. 기존 파일·영상 인제스트 스펙(`knowledge-ingest.service.spec.ts`) 무수정 통과.

## 2. 정적 검사·빌드

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` api / web | ✅ |
| `nest build`, `vite build` | ✅ |
| `npm run i18n:check` (6개 언어 `knowledge.site.*`) | ✅ complete |
| `npm run radius:check`, `npm run env:check` | ✅ |
| 실 부팅 `node dist/main.js` | ✅ `Nest application successfully started` (엔티티 변경 없음) |

## 3. 통합 (로컬 API + 실사이트, AI=stub)

| # | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| I1 | discover `go2joy.vn` | `/vi-vn` 리다이렉트, 후보 3(policy·complaint·regulations) | ✅ 0.7s |
| I2 | discover `https://ivyusa.com` | Shopify 판별, `/pages/*` 후보 + `/policies/*` 4건 robots 차단 표시 | ✅ (홈 `/` 429 상태에서도 sitemap·robots로 성립) |
| I3 | discover `http://…`, `https://127.0.0.1` | E5110 | ✅ |
| I4 | discover 없는 도메인 | E5111 | ✅ |
| I5 | site ingest go2joy 3페이지 | policy=thin(371자), 민원처리=초안 1, 운영규정=초안 5(48K 절단 표시) | ✅ |
| I6 | approve 2건(1건은 외부 source_url 위조) | 보드 2건 `["ai-import","site-policy"]`, 링크 첨부 1건(자기 페이지만), 감사 `knowledge.site_ingested`+pages | ✅ DB 확인 |
| I7 | site ingest ivyusa 3페이지 | `/policies/*`=robots, `/pages/*`=초안 | ⚠️ **미완** — 테스트 중 반복 요청으로 로컬 IP가 ivyusa(Cloudflare)에 429 제한됨. 같은 페이지 HTML 픽스처로 단위 검증 완료, 실요청은 스테이징에서 재확인 필요 |

## 4. 콘솔 (로컬 web :5173, ko)

| # | 확인 | 결과 |
|---|---|---|
| U1 | 카드가 ① 소스 위, 번호 없음 (master) | ✅ |
| U2 | 주소 입력 → 모달 후보 목록(종류 배지·URL, 기본 선택 3) | ✅ |
| U3 | 분석 시작 토스트 → 진행(페이지별 대기 배지, 0/3) | ✅ |
| U4 | 검수: 페이지 상태(본문 부족·초안 n)+thin 안내, 절단 안내, 초안별 🔗 출처, 폴백 "검수 필요" 배지 | ✅ |
| U5 | 카드 상태줄 "분석 완료 — 검수 대기 초안 6건 · 검수하기"로 재개 | ✅ |
| U6 | 검수 행 레이아웃 — 출처 링크 별도 줄, "카테고리/본문 보기" 줄바꿈 방지 (기존 AI 임포트도 동일 컴포넌트) | ✅ 수정 후 확인 |
| U7 | staff/manager에게 카드 미노출 (`KNOWLEDGE_SOURCE_MANAGE`=master/director) | 코드 확인 (rank 게이트) |

## 5. 엣지·발견 사항

- **Shopify 기본 robots.txt는 모든 봇에 `/policies/`를 Disallow** → 승인안(robots 준수)대로 Shopify 표준 정책 4종은 "차단" 표시만 되고 수집되지 않음. 스토어가 `/pages/`에 별도 정책 페이지를 둔 경우(ivyusa)만 수집. → RPT에 결정 필요 사항으로 기록.
- go2joy는 REQ §4 예상보다 나음: `/vi-vn/policy`만 SPA이고 민원처리·운영규정은 SSR 본문이 있어 1차(정적 수집)로 읽힘.
- 홈 `/`만 429인 상점 방어(Cloudflare) 존재 → 홈 실패를 치명 오류로 두지 않고 sitemap·알려진 경로로 계속(설계 보강).
- 많은 사이트가 모든 페이지에 같은 `<title>`을 씀(go2joy) → 초안 제목은 본문 첫 h1/첫 짧은 줄 우선(설계 보강).
- I7 재시도(같은 날): curl 200 직후 서버 fetch 429, 이어 curl도 429 — UA 무관한 **IP 단위 버스트 제한**(Cloudflare)으로 판정. 대응: sitemap의 상품·컬렉션·블로그 하위 맵은 요청하지 않음(어차피 제외 대상, 요청 수 절감). 실사이트 확인은 스테이징 IP에서.

## 6. D8 — 운영자 소유 확인 시 robots 예외 (PLN §7)

| # | 확인 | 결과 |
|---|---|---|
| D8-1 | ivyusa 탐색 → Shopify 판별, `/policies/*` 4건 "robots.txt 차단 — 우리 사이트 확인 시 읽기 가능" 비활성, 확인 박스 표시("4개") | ✅ 콘솔 |
| D8-2 | 기본 선택 = 종류별 대표 4(cookie·shipping·terms·returns) — 이전 10개(브랜드별 개인정보 다수) 과다 선택 해소 | ✅ |
| D8-3 | 확인 체크 → 표준 정책 4건 자동 선택(총 8), 해제 시 제거 | ✅ |
| D8-4 | 2건 분석(`/policies/refund-policy` + `/pages/returns-refunds`) | ✅ 환불 정책 **실요청 성공**(8,631자, 초안 1, "운영자 확인으로 읽음") · 두 번째는 로컬 IP 429 → "열 수 없음 HTTP 429" 표시 |
| D8-5 | 게시 → 보드 문서 `site-policy` 태그 + `/policies/refund-policy` 링크, 감사 `ownerConfirmed:true`, `robotsOverridden:true` | ✅ DB 확인 |
