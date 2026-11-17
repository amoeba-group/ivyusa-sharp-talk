# RPT-261117 — IVY T16 · Deploy talk.ivyusa.com & smoke production

Kế hoạch: [PLN-261116-IVY-T16](../plan/PLN-261116-IVY-T16-Deploy-Smoke.md), duyệt ngày 2026-11-17 (`1. ok 2. a 3. b 4. a`). Task: ivy-docs/TASKS.md T16.

**Trạng thái: ✅ deploy đã xác minh trên server; smoke production TC-16-01..03 xanh 3/3 (2026-11-17).**

## 1. Thay đổi

Không có code, không có SQL. Chỉ tài liệu:

| File | Nội dung |
|---|---|
| `README.md` §8, `SPEC.md` §12.1 / §12.2 / §14, `CLAUDE.md` §6, `CONFIG.md` §7 | BUG-005: ghi đúng hai production đang chạy (`sharptalk.amoeba.site`, `talk.ivyusa.com`); bộ template `docker/production/` chưa dùng |
| ivy-docs (TASKS, BUGS), PLN, RPT T15 | Trạng thái |

## 2. Xác minh trên server (2a)

Chủ dự án chạy trên `talkaibotprd01` (SSM, user `appops`, `/docker/apps/talktalk`) ngày 2026-11-17 và gửi ảnh màn hình.

| Kiểm tra | Kết quả |
|---|---|
| `git log --oneline -1` | `6cd25fe8` (HEAD = `origin/deploy/talk-ivyusa`) |
| `ivy-autodeploy.sh --status` → `deployed` | `3b0263e8`, 2026-11-16T05:24:49Z |
| `--status` → `last` | 2026-11-17T03:52:01Z, `6cd25fe8` fast-forward, không deploy (không đổi file chạy từ `3b0263e8`) |
| `~/ivy-autodeploy.log` | `8f264e88` và `1a9bc75f`: "not deployable: run failure" (đúng: CI đỏ thì không deploy). `3b0263e8`: "deploying … over 6bf9fcfc" → "deployed" (log `~/sharptalk-deploy-20261116-052402-3b0263e8.log`). `0ded01c5`, `6cd25fe8`: fast-forward, không deploy |
| `docker ps` | `sharptalk_widget`, `sharptalk_web`: Up 23 hours — khớp lần deploy 2026-11-16 05:24 UTC. `sharptalk_api`: Up 3 days (healthy). `nginx`, `rabbitmq`, `redis`, `qdrant`: Up 2 weeks. `mysql`: Up 2 weeks (healthy) |

**Kết luận:** production đang chạy code của `3b0263e8` = T15 + sửa BUG-031. Từ `6bf9fcfc` tới đó chỉ đổi `apps/widget`, nên container API không dựng lại là đúng.

**Chưa kiểm:** dòng `successfully started` trong boot log của API (API không khởi động lại trong lần deploy này; container báo healthy) và HTTP status từ ngoài (xem §3).

## 3. Smoke production (3b) — ✅ 3/3

Chạy trên máy dev ngày 2026-11-17 (khoảng 04:40 UTC), theo yêu cầu của chủ dự án.

| TC | Kết quả |
|---|---|
| TC-16-01 health 200, `status: ok` | ✅ (905ms). Chủ dự án cũng mở bằng Chrome: `status: ok`, 04:30:15 UTC |
| TC-16-02 `/widget/` 200, `/widget/embed.js` 200 + content-type javascript | ✅ (1.3s) |
| TC-16-03 bấm launcher → dialog "Support widget" | ✅ (6.6s) |

**Cách chạy khác với `npm run test:prod`:**
- `npm run test:prod` nguyên bản dừng ở `global-setup.ts`: bước này gọi health và `/widget/` bằng `fetch` của Node và nhận 403 (chủ dự án chạy và gửi ảnh).
- Máy dev không có proxy hay VPN, và Chrome trên cùng máy nhận 200. Tức production từ chối client không phải trình duyệt, không phải chặn theo IP như BUG-004 từng ghi.
- 3 test được chạy bằng `playwright test` với project `prod` có sẵn (Chromium), qua một file cấu hình tạm chỉ bỏ `globalSetup`. File tạm đã xoá, không commit. Nội dung test không đổi; test chỉ đọc.
- Việc sửa `global-setup.ts` cho `test:prod` chạy được nguyên bản: chưa làm, ghi ở BUG-004.

## 4. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| SQL | Không có |
| Code đang chạy trên production | `3b0263e8` (deploy 2026-11-16 05:24 UTC, tự động) |
| Tip của nhánh | `6cd25fe8` (chỉ tài liệu), CI run `44012687424` xanh, server đã fast-forward |
| TC-16-01..03 | ✅ 3/3 (2026-11-17, xem §3) |
| `deploy/profiles/SharpTalk-USA-IVY/CHECKLIST.md` | Tick 3 mục đã có bằng chứng: host, domain, deploy + health. Các mục khác chưa kiểm nên để trống |
| BUG-004 | Open: `npm run test:prod` nguyên bản vẫn dừng ở bước kiểm tra đầu |
| Cấu hình production (T01, T02, T08, T12), quyền PCD (T04) | Việc của chủ dự án, ngoài T16 |
