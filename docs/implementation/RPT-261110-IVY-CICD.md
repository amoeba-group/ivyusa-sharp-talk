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
| `ivy-autodeploy.sh`: 23 tình huống (origin giả + API giả, Alpine) | **23/23 pass**: idle, run đang chạy, chờ duyệt, CI fail (chỉ ghi log một lần), gate bị skip, thiếu SQL → quay lại, SQL đã áp → tự deploy (approval cache), deploy fail, file tracked bị sửa, sai nhánh, lệch nhánh, API sập, `--status` |
| `ivy-autodeploy.sh --dry-run` với **API GitHub thật** (clone đặt lùi một commit) | `would deploy fb6ce1c7 … over 82f6288`, checkout không đổi |
| Cổng e2e ở local (`@smoke\|@T00\|@T13`) | 10/10 xanh |
| `check-migrations --check` + `radius:check` trên Linux (`node:20-alpine`) | xanh. Trên Windows đỏ là do công cụ → BUG-012 |
| **GitHub Actions run [42745220139](https://github.com/amoeba-group/ivyusa-sharp-talk/actions/runs/42745220139)** trên `fb6ce1c7` | ✅ `verify` 2.7 phút · ✅ `e2e gate` 2.2 phút (seed OK, health ok, **10 passed**) · ✅ `deploy-gate` |

## 3. Trạng thái deploy

| Mục | Trạng thái |
|---|---|
| Commit | `fb6ce1c7` trên `deploy/talk-ivyusa` (đã push; trước đó là `82f6288d`) |
| CI | Xanh (run 42745220139) |
| Environment `talk-ivyusa-production` | GitHub **tự tạo khi chạy lần đầu, không có rule nào**. **Giữ nguyên như vậy**: ngày 2026-11-10 chủ dự án quyết định không cần duyệt, push mà CI xanh là deploy (PLN D2). |
| Server `talkaibotprd01` | **Chưa cài timer**, vì cần SSH và `secrets/` không có trong bản clone. Hiện vẫn deploy bằng tay. Commit này chỉ đụng CI/script/tài liệu, **không đổi code app**, nên production không cần deploy lại → **T00-e (3)** (GUIDE §2.3) |
| SQL / migration | Không có |
| talk.ivyusa.com | Không đổi |

## 4. Ghi chú

- `deploy-gate` qua ngay khi CI xanh, đúng thiết kế vì không có reviewer. **Ngay khi cài timer (T00-e (3)), mọi push lên `deploy/talk-ivyusa` mà CI xanh sẽ tự lên production.** Vì vậy SQL phải áp trước khi push.
- Repo public (BUG-013) là lý do chọn kiểu server tự kéo. Nếu repo chuyển sang private, server cần token hoặc deploy key cho `git fetch` và token đọc Actions.
- Khi hoàn thành một task IVY, thêm `|@Tnn` vào `test:ci` (TASKS §0).
