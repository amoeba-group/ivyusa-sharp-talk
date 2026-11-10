# RPT-261110 — CI/CD cho `deploy/talk-ivyusa` → talk.ivyusa.com

Kế hoạch: [PLN-261110-IVY-CICD](../plan/PLN-261110-IVY-CICD.md) · Runbook: [GUIDE-261110-IVY-CICD](../guide/GUIDE-261110-IVY-CICD.md) · Task: ivy-docs/TASKS.md T00-d (xong) / T00-e (chờ).

> Production của IVY chạy từ `deploy/talk-ivyusa`, **không phải `main`**.

## 1. Thay đổi

| File | Nội dung |
|---|---|
| `.github/workflows/ivy-ci-cd.yml` (mới) | Workflow *IVY CI/CD* cho push/PR vào `deploy/talk-ivyusa`: `verify` (gọi `ci.yml`) · `e2e gate` (MySQL/Redis/RabbitMQ/Qdrant bằng dev compose → seed → API `dist` + widget `vite preview` → `test:ci`, lỗi thì upload report/log) · `deploy-gate` (chỉ khi push, environment `talk-ivyusa-production`) |
| `.github/workflows/ci.yml` | Thêm `workflow_call` + bước `i18n:check` |
| `scripts/ivy-autodeploy.sh` (mới) | Chu kỳ server tự kéo: fetch → hỏi GitHub về `deploy-gate` của tip → ff-only → `deploy-self-hosted.sh --check` (fail thì `reset --keep` về commit cũ, thử lại sau) → deploy → commit status (nếu có token). Hỗ trợ `--dry-run`, `--status` |
| `scripts/ivy-autodeploy-install.sh` (mới) | Cài systemd service (oneshot, 45 phút) + timer (2 phút), kiểm tra nhánh/nhóm docker/công cụ; hỗ trợ `--uninstall` |
| `e2e/package.json`, `e2e/playwright.config.ts` | Script `test:ci` = `@smoke\|@T00\|@T13`; thêm reporter `github` khi chạy trong Actions |
| `docs/guide/GUIDE-261110-IVY-CICD.md`, `docs/plan/PLN-261110-IVY-CICD.md` (mới) | Runbook + kế hoạch |
| `ivy-docs/{TASKS,ARCHITECTURE,BUGS,TEST-CASES}.md`, `CLAUDE.md` §8 | Quy trình mới, T00-d/T00-e, BUG-012 (kiểm tra đỏ trên Windows), BUG-013 (repo public) |

## 2. Kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| `actionlint` 1.7.12 (`ivy-ci-cd.yml`, `ci.yml`) | sạch |
| `shellcheck` (2 script) | sạch (đã sửa 1 SC2155) |
| `ivy-autodeploy.sh`: 30 tình huống (origin giả + API giả, Alpine) | **30/30 pass**: idle, run đang chạy, chờ duyệt, CI fail (chỉ ghi log một lần), gate bị skip, thiếu SQL → quay lại, SQL đã áp → tự deploy (approval cache), deploy fail, file tracked bị sửa, sai nhánh, lệch nhánh, API sập, `--status`, và (`d4aea80f`) chỉ đổi tài liệu → chỉ fast-forward; tài liệu đè lên một deploy code bị fail → vẫn deploy; `.md` được phục vụ dưới `apps/` → deploy |
| `ivy-autodeploy-install.sh --cron` (`c7bdeb98`): 12 tình huống (`debian:12-slim`) | **12/12 pass**: cài, cài lại không trùng và giữ job khác, gỡ, gỡ khi chỉ có dòng của mình, cron thật chạy script, từ chối root / người không sở hữu checkout / sai nhánh. Đã sửa lỗi lần cài đầu thất bại khi user chưa có crontab (`pipefail`) |
| `ivy-autodeploy.sh --dry-run` với **API GitHub thật** (clone đặt lùi một commit) | `would deploy fb6ce1c7 … over 82f6288`, checkout không đổi |
| Cổng e2e ở local (`@smoke\|@T00\|@T13`) | 10/10 xanh |
| `check-migrations --check` + `radius:check` trên Linux (`node:20-alpine`) | xanh. Trên Windows đỏ là do công cụ → BUG-012 |
| **GitHub Actions run [42745220139](https://github.com/amoeba-group/ivyusa-sharp-talk/actions/runs/42745220139)** trên `fb6ce1c7` | ✅ `verify` 2.7 phút · ✅ `e2e gate` 2.2 phút (seed OK, health ok, **10 passed**) · ✅ `deploy-gate` |

## 3. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Commit | `fb6ce1c7` (CI/CD) → `c175e30d` (bỏ bước duyệt) → `c7bdeb98` (`--cron`) → `d4aea80f` (bỏ qua build khi chỉ đổi tài liệu), tất cả trên `deploy/talk-ivyusa` |
| CI | Xanh (run 42745220139, 42745738605, 42751458546, …) |
| Environment `talk-ivyusa-production` | GitHub **tự tạo khi chạy lần đầu, không có rule nào**. **Giữ nguyên như vậy**: ngày 2026-11-10 chủ dự án quyết định không cần duyệt, push mà CI xanh là deploy (PLN D2). |
| Server `talkaibotprd01` | 2026-11-10, chủ dự án làm qua SSM theo GUIDE §2.3:<br>• `/docker/apps/talktalk` fast-forward `ff9bb663` → `d4aea80f`. Diff `apps packages docker sql` trống, nên container (build từ `ff9bb663`) không cần đổi.<br>• `--dry-run` báo `up to date`, exit 0.<br>• **`ivy-autodeploy-install.sh --cron` đã cài** (user `appops`, không có sudo), crontab `*/2`, log `~/ivy-autodeploy.log`.<br>Thử trọn vòng: commit chỉ sửa tài liệu này sẽ được fast-forward mà không build lại |
| SQL / migration | Không có |
| talk.ivyusa.com | Không đổi |

## 4. Ghi chú

- `deploy-gate` qua ngay khi CI xanh, đúng thiết kế vì không có reviewer. **Cron đã cài, nên từ giờ mọi push lên `deploy/talk-ivyusa` mà CI xanh sẽ tự lên production.** Vì vậy SQL phải áp trước khi push.
- Đường build/restart thật (`deploy-self-hosted.sh` do cron gọi) sẽ chạy lần đầu ở commit có code app đầu tiên (T01). Lần đó cần theo dõi `~/ivy-autodeploy.log` và `~/sharptalk-deploy-*.log`.
- Repo public (BUG-013) là lý do chọn kiểu server tự kéo. Nếu repo chuyển sang private, server cần token hoặc deploy key cho `git fetch` và token đọc Actions.
- Khi hoàn thành một task IVY, thêm `|@Tnn` vào `test:ci` (TASKS §0).
