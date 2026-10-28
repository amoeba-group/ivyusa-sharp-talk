# RPT-261028 — 상담원 응대 메시지 이름·아이콘 + 마이페이지 프로필 아이콘

- REQ/PLN/TCR: `REQ-261028-Agent-Profile-Avatar`, `PLN-261028-Agent-Profile-Avatar`(D1~D7 권장안 승인), `TCR-261028-Agent-Profile-Avatar`
- PR: #778 → main `e5eec0a1`

## 변경 내용
- **프로필 아이콘 저장(D1)**
  - `users.avatar_asset_uuid`를 추가했다.
  - 테넌트 자산 저장소에 `profile` 영역과 `avatar` 종류를 추가했다(가운데를 정사각형으로 잘라 256 WebP로 저장, 원본 5MB·8000px까지, PNG/JPG/WEBP만, SVG 거부, 할당량 20MB).
  - 영역별로 받을 수 있는 종류를 정해(`AREA_KINDS`) design과 profile이 서로의 종류를 받지 못한다.
- **본인 전용 API(D5·D7)**
  - `GET/PATCH /users/me/profile`(`display_name`, 60자까지)
  - `POST/DELETE /users/me/avatar`
  - 교체하면 이전 자산을 지운다.
  - 변경할 때마다 감사 `user.profile_updated`를 남긴다.
- **메시지 응답**
  - 위젯 대화·이전 대화와 콘솔 대화·통합방·전송 응답에 `senderAvatar {uuid, version}`을 넣었다.
  - 메시지 페이지마다 사용자 조회는 1회다(`staffAvatars`).
- **위젯(D2~D4)**
  - 상담원 이름: 표시 이름 > 공통 호칭.
  - 상담원 아이콘: 본인 > 공통 아바타 > 기본.
  - 기본 디자인에서는 이름 줄 앞에 20px 아이콘을 붙인다.
- **콘솔(D5·D6)**
  - 마이페이지 프로필 카드: 64px 미리보기, 업로드·삭제, 표시 이름 저장, 토스트.
  - 라이브챗 상담원 말풍선과 사이드바 사용자 영역에 아이콘을 붙였다(사이드바는 표시 이름도).
  - i18n 6개 언어.

## 파일
- API
  - `user/{user-profile.controller,user-profile.service,user-profile.mapper,staff-avatar.util}.ts`
  - `user/dto/{request,response}/user-profile.*`
  - `user/entity/user.entity.ts`, `user/user.module.ts`
  - `tenant-asset/{entity/tenant-asset.entity,tenant-asset.service}.ts`
  - `chat/{chat.controller,chat.mapper,chat.service}.ts`
  - `agent/{agent-console.controller,agent.mapper,agent.service}.ts`
- 타입: `packages/types/src/api/widget.types.ts`
- 위젯: `components/chat/MessageBubble.tsx`
- 콘솔
  - `components/StaffAvatar.tsx`
  - `domain/my-page/{ProfileEditor.tsx,profile.service.ts,profile.hooks.ts,MyPage.tsx}`
  - `layouts/Sidebar.tsx`
  - `domain/live-chat/{LiveChatPage.tsx,live-chat.service.ts}`
  - `i18n/locales/*/mypage.json`
- SQL: `sql/261028-user-avatar.sql`, `sql/artefacts.tsv`
- 테스트: `user-profile.service.spec.ts`(신규), `tenant-asset.service.spec.ts`, `chat.mapper.spec.ts`

## 테스트
- 단위 테스트(user, tenant-asset, chat, agent, session)를 모두 통과했다.
- tsc는 api, web, widget 모두 오류 0이다. `i18n:check`는 complete이고, CI도 통과했다.
- 로컬 통합 시나리오 I1~I7을 통과했다(TCR 참조).

## 배포 상태
| 환경 | SQL | 코드 | 검증 |
|---|---|---|---|
| 스테이징 | ✅ 10/28 선적용(`avatar_asset_uuid` CHAR(36) NULL) | ✅ `e5eec0a1` | API healthy, 부팅 1회, ERROR 0, 마이그레이션 검사 OK, `GET /users/me/profile`·`POST /users/me/avatar` 401, health 200, 콘솔 번들에 `avatarUpload` |
| 프로덕션 | ⏳ | ⏳ | 요청 시 배포(SQL 선적용 → ff → deploy-self-hosted) |

## 후속·주의
- 스테이징 상담원 대부분은 `users.name`이 비어 있다. 상담원이 마이페이지에서 표시 이름을 정해야 위젯에 실명이 보이고, 그 전에는 공통 호칭이 그대로 나온다.
- go2joy는 표시 이름을 정한 상담원부터 "Go2Joy Support" 대신 실명으로 보인다(D2).
