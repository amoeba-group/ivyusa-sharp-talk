# TCR-261028 — 상담원 응대 메시지 이름·아이콘 + 마이페이지 프로필 아이콘

- PLN: `docs/plan/PLN-261028-Agent-Profile-Avatar.md`

## 1. 단위 테스트
| # | 대상 | 케이스 | 결과 |
|---|---|---|---|
| U1 | TenantAssetService | 800×400 JPG → `tenants/1/profile/{uuid}.webp`, 256×256 WebP(파일 실측) | ✅ |
| U2 | TenantAssetService | design 영역 + avatar, profile 영역 + icon → E5085 | ✅ |
| U3 | TenantAssetService | `.png` 이름의 SVG(스크립트 포함) → E5081 | ✅ |
| U4 | UserProfileService | 업로드 → profile/avatar로 저장, users.avatar_asset_uuid 갱신, 감사 `user.profile_updated` | ✅ |
| U5 | UserProfileService | 교체 시 이전 자산 삭제, 이전 자산 삭제가 실패해도 업로드는 성공 | ✅ |
| U6 | UserProfileService | 삭제: 없으면 쓰기 없음, 있으면 NULL + 자산 삭제 | ✅ |
| U7 | UserProfileService | 표시 이름 trim, 공백만 → NULL, 같은 이름은 감사 없음 | ✅ |
| U8 | UserProfileService | 다른 테넌트의 사용자 → E5002, 저장 안 함 | ✅ |
| U9 | staffAvatars | 상담원 발신자만, 쿼리 1회, 아이콘 없는 사람은 제외, 상담원 없으면 쿼리 없음 | ✅ |
| U10 | ChatMapper | 대화 응답: 상담원별 자기 아이콘, AI·고객은 null / 이전 대화(thread)에도 포함 | ✅ |

실행 결과
- `jest src/domain/user src/domain/tenant-asset src/domain/chat src/domain/agent src/domain/session`: 전부 통과
- `tsc`: api, web, widget 모두 오류 0
- `npm run i18n:check`: 6개 언어 complete

## 2. 통합 시나리오(로컬 API + 콘솔 5181 + 위젯 5182)
| # | 시나리오 | 결과 |
|---|---|---|
| I1 | `GET /users/me/profile` → `PATCH display_name " Dev Tester "` → 이름 "Dev Tester" | ✅ |
| I2 | `POST /users/me/avatar`(900×600 JPG) → `/public/widget/asset/:uuid?v=1`이 200 `image/webp` 256×256으로 응답 | ✅ |
| I3 | SVG 업로드 → E5081 | ✅ |
| I4 | 위젯(ivyusa, 기본 디자인)에서 상담원 연결 → 상담원 답장 → 이름 줄 앞에 20px 아이콘 + "Dev Tester"(D4) | ✅ |
| I5 | 아바타 줄 디자인으로 임시 전환, 공통 호칭 "IVY Support" 설정 → 상담원 아이콘 + 실명 "Dev Tester"가 공통 호칭보다 우선(D2·D3) | ✅ |
| I6 | 콘솔 상담원 메시지 전송 응답에 `senderAvatar` 포함 | ✅ |
| I7 | 마이페이지: 아이콘 64px 미리보기, [삭제] → 기본 아이콘 + 성공 토스트, 사이드바 아이콘·이름 즉시 갱신 | ✅ |
| I8 | 시스템 관리자(admin): 프로필 편집 영역 숨김(코드 경로 `!isAdmin`) | 코드 확인 |

임시로 바꾼 데이터(테넌트 1 디자인·호칭, dev@ 이름, 시험 대화 2건)는 원래대로 돌렸다.

## 3. 엣지 케이스
- 5MB를 넘는 파일: 콘솔에서 업로드 전에 거부하고 토스트를 띄운다. 서버에서도 multer 5MB 제한과 E5082로 막는다.
- 픽셀 수 8000px 초과: E5083. 폰 사진(4000px 안팎)은 통과한다.
- 이름 없는 상담원: 위젯은 공통 호칭을 쓰고, 그것도 없으면 이름을 표시하지 않는다(이메일 미노출).
- 아이콘만 있고 이름이 없을 때, 기본 디자인에서는 이름 줄이 없어 아이콘도 표시되지 않는다(이전과 같음).
- 상담원이 아이콘을 지우면 과거 메시지에서도 다음 폴링부터 아이콘이 사라진다(응답할 때마다 조회).
