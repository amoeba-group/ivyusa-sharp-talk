# RPT-261027 — 라이브챗 대화방 헤더: 이전 대화·통합 줄 분리·강조

- REQ/PLN/TCR `*-261027-LiveChat-Header-History-Row.md` (승인 D1~D6 권장안)
- PR #750 → main `a6623717`

## 변경 요약
| 항목 | 내용 |
|---|---|
| 강조 줄 | "이 고객의 이전 대화 N건"과 통합 진입점을 정보 줄에서 분리했다. 정보 줄과 액션 줄 사이에 `primary-50` 배경과 테두리를 가진 줄로 둔다 |
| 버튼화 | 이전 대화를 텍스트 링크에서 `Button sm secondary`(History 아이콘)로 바꿨다. "통합 N ▾" 알약 배지는 같은 버튼 크기로 맞추고 primary 테두리를 유지했다 |
| 노출 | 두 진입점이 모두 없으면 줄을 숨긴다(`has-[>button]:flex`). 구분선은 둘 다 있을 때만 보인다(`first:hidden last:hidden`) |
| [기업] 배지 | `CompanyThreadButton`에서 분리해 정보 줄에 남겼다 |

## 파일
- `apps/web/src/domain/live-chat/{LiveChatPage, CompanyThreadButton, MergeRoomControl}.tsx`
- `docs/{analysis/REQ, plan/PLN, test/TCR}-261027-LiveChat-Header-History-Row.md`

## 테스트
- web tsc, i18n:check, CI 통과
- 로컬 화면 4가지 경우와 통합 모달 실행(TCR). 임시 데이터는 원복했다

## 배포 상태
| 환경 | 마이그레이션 | 코드 | 검증 |
|---|---|---|---|
| 스테이징 | 없음 | ✅ 10/27 main `a6623717` → `deploy-staging.sh` | API healthy, `successfully started` 1회, ERROR 0, health 200, LiveChatPage 번들에 새 클래스 포함 |
| 프로덕션 | 없음(`check-migrations` OK) | ✅ 10/27 `production` ff `853e1dc8..a6623717`(#749 문서 동승) → `deploy-self-hosted.sh` | api/web/widget 재생성, healthy, 부팅 1회, ERROR 0, health 200, 번들 반영 |

## 미검증·후속
- 스테이징·프로덕션 실데이터 화면은 육안으로 확인하지 않았다(로컬 확인으로 대체). 열어 둔 콘솔 탭은 **새로고침**해야 새 화면이 보인다.
- 로컬 작업 중 `npm run db:up`이 다른 저장소(ambManagement)의 `amb-redis`를 교체·삭제했다. 두 compose 프로젝트명이 모두 `docker`였기 때문이다. 볼륨이 남아 있어 복구했고 데이터도 유지됐다. 근본 수정(compose `name:` 지정)은 별도 작업으로 남긴다.
