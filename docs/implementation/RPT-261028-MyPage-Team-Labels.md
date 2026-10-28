# RPT-261028 — 마이페이지 팀·업무 라벨 표시

- REQ/PLN/TCR: `REQ-261028-MyPage-Team-Labels`, `PLN-261028-MyPage-Team-Labels`, `TCR-261028-MyPage-Team-Labels`
- 결정: 권한 그대로, 안내 문구 없음(그래서 [사용자 관리] 링크도 넣지 않음)
- PR: #780 → main `f715da33`

## 변경 내용
- **API**
  - `GET /users/me/profile`에 `unit {id, name} | null`과 `labels [{code, name}]`를 추가했다.
  - 둘 다 사용자 테넌트로 한정해 매번 조회한다.
  - 프로필 변경 응답(표시 이름, 아이콘)에도 같은 필드를 넣어, 콘솔 캐시가 비지 않게 했다(`UserProfileController.view`).
- **콘솔 마이페이지**
  - 프로필 카드에 **팀** 줄을 추가했다.
  - **업무 라벨**은 토큰의 코드(`consult`) 대신 테넌트가 정한 이름으로 보인다. 코드는 마우스를 올리면 보인다.
  - 값이 없으면 "미지정"이나 "없음"으로 표시한다.
  - i18n 6개 언어.

## 파일
- `apps/api/src/domain/user/{user-profile.service,user-profile.controller,user-profile.mapper}.ts`
- `apps/api/src/domain/user/dto/response/user-profile.response.ts`
- `apps/api/src/domain/user/user-profile.service.spec.ts`
- `apps/web/src/domain/my-page/{MyPage.tsx,profile.service.ts}`
- `apps/web/src/i18n/locales/*/mypage.json`

## 테스트
- `jest src/domain/user` 34건을 통과했다.
- tsc는 api·web 모두 오류 0이고, `i18n:check`도 통과했다. CI도 통과했다.
- 로컬에서 API 응답과 마이페이지 화면을 확인했다(팀 "South Center", 라벨 Counsels·회계·운영).

## 배포 상태
| 환경 | SQL | 코드 | 검증 |
|---|---|---|---|
| 스테이징 | 없음 | ✅ `f715da33` | API healthy, 부팅 1회, ERROR 0, `/users/me/profile` 401, 콘솔 번들에 `teamNone` |
| 프로덕션 | 없음 | ⏳ | 요청 시 배포. #778(SQL `261028-user-avatar.sql` 선적용 필요)과 함께 나간다 |
