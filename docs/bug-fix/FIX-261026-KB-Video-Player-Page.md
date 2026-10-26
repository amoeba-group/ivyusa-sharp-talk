# FIX-261026 "Watch video"가 Chrome에서 빈 탭만 엶 — `.mov`(video/quicktime) 다운로드 전환

- 작성일: 2026-10-26 · 대상: go2joy(테넌트 4) 위젯 출처 "Watch video" · 관련: FIX-261023(블록 ID 재지정), PLN-261006-KB-Video-Links
- 상태: **1단계(B) 재생 페이지 — 본 PR**. 2단계(A) mp4 사본 보관은 Go2Joy 동의 후 별도 진행

## 1. 증상

FIX-261023 배포 후에도 위젯 "Knowledge referenced → ▶ Watch video"(예: Video 21,
`kb-videos/2641?t=4&sig=…`)를 누르면 **새 탭이 비어 있고 영상이 나오지 않는다**.
Go2Joy 재현 영상(Drive, 2026-10-23 09:24 녹화)은 FIX-261023 이전의 503 화면이었고, 이번 증상은 그와 다르다.

## 2. 원인 (헤드리스 Chrome 156 실측으로 확정)

| 단계 | 결과 |
|---|---|
| ① `GET /api/v1/kb-videos/2641` | 302 → Notion S3 서명 URL (정상) |
| ② S3 | 206, `Content-Type: video/quicktime`, `.mov` (정상) |
| ③ Chrome 새 탭 이동 | 문서 요청 `ERR_ABORTED` → **`downloadWillBegin`**, 탭은 `about:blank` |
| `canPlayType('video/quicktime')` | `""` (mp4 = `probably`) |

Chrome/Edge는 **`Content-Type`만으로** 탭에서 보여줄지 정한다. 같은 바이트를 `video/mp4`로 주면 재생되고,
`<video>` 요소 안에서는 `.mov` 그대로도 재생된다(H.264 Main + AAC LC, 63편 전수 확인).

- 영상 63편 중 **58편이 `.mov`**(macOS 화면 녹화), 5편(Video 0, 42~45)은 `.mp4`라 원래 재생됨.
- 기존 검증(`kb-video-check`, curl 302/206)은 "링크가 살아 있다"까지만 보았고 **"브라우저가 재생한다"는 보지 않았다.**

## 3. 수정 (1단계 B — 코드만, 데이터·스키마 변경 없음)

`kb-videos/:id`가 결과 URL이 **영상 파일**(경로 확장자 `.mov/.mp4/.m4v/.webm/.ogv`)이면 302 대신
`<video controls playsinline src="…">` + "Download video" 링크로 된 **재생 페이지(200 HTML)** 를 응답한다.
YouTube 같은 영상 *페이지* URL은 종전대로 302.

| 파일 | 변경 |
|---|---|
| `apps/api/src/domain/knowledge/kb-video-page.ts` | 신규 — `isVideoFileUrl`, `renderVideoPage`(속성 이스케이프, `no-referrer`, 재생 실패 시 안내) |
| `apps/api/src/domain/knowledge/kb-video.controller.ts` | 성공 시 파일→재생 페이지, 그 외→302 |
| `apps/api/src/domain/knowledge/kb-video-page.spec.ts` | 신규 — 판별·렌더·이스케이프 4건 |

- 링크 주소·서명·캐시(Redis `kbvideo:*`)·서비스 로직 불변 → **이미 나간 답변의 링크도 배포 즉시 고쳐진다.**
- helmet CSP 비활성 상태라 S3 미디어 로드 차단 없음.
- 한계: 2.8K/60fps 원본을 그대로 스트리밍(최대 82MB, Video 41). 모바일 용량은 2단계(1080p mp4 사본, 샘플 기준 약 1/13)에서 해결.

## 4. 검증

- 단위: `kb-video` 2개 스위트 15건 통과, `turbo typecheck --filter=@sharptalk/api` 통과.
- 로컬 Chrome: 실제 S3 URL로 렌더한 페이지 — Video 21(2860×1534, 18.1초)·Video 41(82MB, 27.8초) `readyState=3`, 오류 없음, 다운로드 전환 없음.
- 스테이징: §6 배포 후 같은 링크 `kb-videos/2641`을 Chrome으로 실측.

## 5. 재발 방지

- **"302/200 = 재생됨"이 아니다.** 영상·첨부 링크 검증은 실제 브라우저에서 `<video>.readyState ≥ 1`
  또는 "다운로드로 전환되지 않음"까지 본다(헤드리스 Chrome + CDP `Browser.setDownloadBehavior{eventsEnabled}`로 자동 확인 가능).
- 사용자 업로드 미디어를 새 탭으로 직접 보내지 말고, 형식에 상관없는 재생 페이지를 거친다.

## 6. 배포 상태

| 항목 | 상태 |
|---|---|
| PR | (기록 예정) |
| 마이그레이션 | 없음 |
| 스테이징 | (기록 예정) |
| 프로덕션 | 영상 문서 0건 — 동작 영향 없음, 다음 프로덕션 배포에 동승 |
