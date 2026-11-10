# GUIDE-261110 — CI/CD cho talk.ivyusa.com

> **Production của IVY USA (talk.ivyusa.com) chạy từ nhánh `deploy/talk-ivyusa`, KHÔNG phải `main`.**
> Kế hoạch & lý do thiết kế: [PLN-261110-IVY-CICD](../plan/PLN-261110-IVY-CICD.md).
> File liên quan: [`.github/workflows/ivy-ci-cd.yml`](../../.github/workflows/ivy-ci-cd.yml) ·
> [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) ·
> [`scripts/ivy-autodeploy.sh`](../../scripts/ivy-autodeploy.sh) ·
> [`scripts/ivy-autodeploy-install.sh`](../../scripts/ivy-autodeploy-install.sh) ·
> [`scripts/deploy-self-hosted.sh`](../../scripts/deploy-self-hosted.sh).

## 1. Luồng chạy

```
git push deploy/talk-ivyusa
   │
   ▼  GitHub Actions — workflow "IVY CI/CD"
   ├─ verify      typecheck · env:check · migration manifest · radius · i18n · test · build   (ci.yml)
   ├─ e2e gate    MySQL/Redis/RabbitMQ/Qdrant + seed + API + widget bản build → Playwright test:ci
   └─ deploy-gate environment talk-ivyusa-production → không có bước duyệt: tự qua khi verify + e2e xanh (chỉ khi push)
                      │
                      ▼  EC2 talkaibotprd01 — systemd timer, mỗi 2 phút
                  scripts/ivy-autodeploy.sh
                   1. git fetch; HEAD đã chứa tip → không làm gì
                   2. hỏi GitHub: run của đúng commit tip có deploy-gate = success?
                   3. fast-forward → deploy-self-hosted.sh --check (config + SQL còn thiếu)
                        └ fail → quay checkout về commit cũ, 2 phút sau thử lại
                   4. deploy-self-hosted.sh (build, up, kiểm health/widget/console/boot log)
                   5. (nếu có token) ghi commit status "deploy/talk.ivyusa.com"
```

- **PR vào `deploy/talk-ivyusa`**: chỉ chạy `verify` + `e2e gate`, không bao giờ deploy.
- **Push lên `deploy/talk-ivyusa` = deploy production**, miễn là CI xanh. Không có bước duyệt; quyết định của chủ dự án ngày 2026-11-10.
- **Chỉ commit ở đầu nhánh (tip) được deploy.** Push mới sẽ huỷ run cũ, nên production luôn theo code mới nhất.
- **Không dùng `[skip ci]` trên nhánh này**: tip không có deploy-gate xanh thì không bao giờ được deploy.
- GitHub không thể kết nối vào server. Server tự kéo bản mới; xem lý do ở §8.

## 2. Thiết lập một lần

### 2.1 GitHub — bước duyệt: KHÔNG dùng (không cần làm gì)

Theo quyết định ngày 2026-11-10, CI xanh là tự deploy, không cần ai bấm duyệt. Environment `talk-ivyusa-production` đã được GitHub tự tạo, không có rule nào, và **giữ nguyên như vậy**. Nó vẫn có ích: GitHub ghi lịch sử deploy ở mục *Deployments*.

Nếu sau này muốn bật lại bước duyệt, không cần sửa code:
- Đăng nhập bằng tài khoản có quyền admin repo (hiện là `conghau0401`).
- Vào https://github.com/amoeba-group/ivyusa-sharp-talk/settings/environments → `talk-ivyusa-production`.
- **Required reviewers**: thêm người duyệt, bỏ chọn *Prevent self-review*.
- **Deployment branches and tags**: chọn *Selected branches* rồi thêm `deploy/talk-ivyusa`.

### 2.2 (Tuỳ chọn) Token GitHub cho server

Tạo **fine-grained personal access token** tại `GitHub → Settings → Developer settings → Fine-grained tokens`:
- Repository access: *Only select repositories* → `amoeba-group/ivyusa-sharp-talk`
- Permissions: **Actions: Read-only**, **Commit statuses: Read and write**

Lưu token vào `/etc/ivy-autodeploy.env` trên server (installer tạo sẵn file này với quyền 600): `IVY_GITHUB_TOKEN=github_pat_...`.

| Không có token | Có token |
|---|---|
| Vẫn chạy được: repo public, giới hạn 60 request/giờ, mỗi chu kỳ tốn tối đa 2 request khi có commit mới | Giới hạn 5000/giờ |
| Kết quả deploy chỉ xem được trên server (`journalctl`, `--status`) | Commit trên GitHub hiện ✓/✗ `deploy/talk.ivyusa.com` |

### 2.3 Server (EC2 `talkaibotprd01`)

Thông tin vận hành thực tế (khảo sát ngày 2026-11-10):
- Truy cập server qua **AWS SSM Session Manager**, rồi `cd ~ && exec /bin/bash`.
- User deploy: **`appops`**, thuộc nhóm `docker`, **không có sudo**.
- Thư mục deploy: **`/docker/apps/talktalk`**, chủ sở hữu `appops`.
- Remote `origin` = `https://github.com/amoeba-group/ivyusa-sharp-talk.git`.

Điều kiện chung:
- Checkout ở nhánh `deploy/talk-ivyusa` và không có file tracked bị sửa.
- `git fetch origin` chạy được mà không hỏi mật khẩu.
- User deploy thuộc nhóm `docker`.
- Có `git`, `curl`, `python3` và `flock`.

```bash
cd /docker/apps/talktalk                   # thư mục deploy
git status -sb                             # nhánh deploy/talk-ivyusa, không có file sửa
git fetch origin
git log --oneline HEAD..origin/deploy/talk-ivyusa   # xem server đang thiếu commit nào
git merge --ff-only origin/deploy/talk-ivyusa       # lấy script CI/CD
#   Nếu các commit vừa lấy có thay đổi code app → chạy deploy tay một lần như trước:
#   bash scripts/deploy-self-hosted.sh
bash scripts/ivy-autodeploy.sh --dry-run   # chỉ báo, không deploy gì

# Không có sudo (talkaibotprd01 / appops): crontab của chính user, mỗi 2 phút
bash scripts/ivy-autodeploy-install.sh --cron
crontab -l | grep ivy-autodeploy

# Có sudo: systemd timer
# sudo bash scripts/ivy-autodeploy-install.sh && systemctl list-timers ivy-autodeploy.timer
```

Installer kiểm tra: đúng nhánh, user không phải root, sở hữu checkout và thuộc nhóm docker, có đủ `git`/`curl`/`python3`/`flock`.
- **`--cron`:** thêm một dòng `*/2 * * * *` (đánh dấu `# ivy-autodeploy`) vào crontab của user, và không đụng tới các job khác. Env nằm ở `~/.config/ivy-autodeploy.env` (600), log ở `~/ivy-autodeploy.log`. Hai lần chạy không bao giờ chồng nhau nhờ `flock`.
- **systemd:** tạo `ivy-autodeploy.service` (oneshot, timeout 45 phút) và `ivy-autodeploy.timer` (mỗi 2 phút). Env nằm ở `/etc/ivy-autodeploy.env`, log trong journald.

## 3. Làm việc hằng ngày

1. Push lên `deploy/talk-ivyusa`. Chỉ cần làm vậy; các bước sau chạy tự động.
2. GitHub → **Actions** → run *IVY CI/CD*: `verify` + `e2e gate` chạy khoảng 3 phút. Xanh thì `deploy-gate` tự qua. Đỏ thì **không deploy**, production giữ bản cũ.
3. Trong vòng khoảng 2 phút sau khi `deploy-gate` xanh, server bắt đầu deploy. Build lại image mất vài phút.
4. Kiểm tra kết quả:
   - Commit status `deploy/talk.ivyusa.com` (nếu có token).
   - Hoặc trên server: `tail -n 50 ~/ivy-autodeploy.log` (cron) hoặc `journalctl -u ivy-autodeploy -n 50` (systemd) · `bash scripts/ivy-autodeploy.sh --status` · log chi tiết của từng lần deploy `~/sharptalk-deploy-*.log`.
   - Kiểm tra sau deploy theo CLAUDE.md §7: boot log, tuổi container, HTTP status của route mới.

E2E bị đỏ thì tải artifact `e2e-report-*` của run. Artifact gồm Playwright report, trace và log API/widget.

## 4. Khi có migration SQL

Quy tắc không đổi: **áp SQL lên DB production trước, rồi mới deploy code** (CLAUDE.md §7, PR cần mục `## Migration`).

- Thứ tự đúng: backup → áp SQL từ `sql/` vào `sharptalk_mysql` → **rồi mới push**. Vì không có bước duyệt, push chính là lệnh deploy.
- Nếu lỡ push trước khi áp SQL: `deploy-self-hosted.sh --check` sẽ fail, checkout **quay về commit cũ** (khớp với container đang chạy) và commit status ở trạng thái *pending "Waiting: deploy check failed"*. Áp SQL xong thì chu kỳ kế tiếp tự deploy, không cần làm gì thêm.
- Kiểm tra SQL nào còn thiếu: `MYSQL_CONTAINER=sharptalk_mysql bash scripts/check-migrations.sh`.

## 5. Deploy fail và rollback

Khi deploy fail, commit status chuyển sang *failure* và log nằm ở `~/sharptalk-deploy-*-<sha>.log`. Checkout **vẫn ở commit mới** và hệ thống không tự rollback, vì stack có thể đã chạy dở cùng thay đổi schema; việc này cần người quyết định.

- **Sửa tiếp (ưu tiên):** push bản sửa, đi theo luồng bình thường.
- **Revert:** `git revert <sha>` trên `deploy/talk-ivyusa` → push. Commit revert cũng qua CI rồi tự deploy.
- **Khẩn cấp trên server** (khi không chờ CI được):
  ```bash
  bash scripts/ivy-autodeploy-install.sh --cron --uninstall   # BẮT BUỘC dừng trước (systemd: sudo systemctl stop ivy-autodeploy.timer)
  git reset --keep <sha-tốt-trước-đó>
  bash scripts/deploy-self-hosted.sh
  # ... sau đó push một commit revert lên deploy/talk-ivyusa, rồi bật lại:
  bash scripts/ivy-autodeploy-install.sh --cron                # (systemd: sudo systemctl start ivy-autodeploy.timer)
  ```
  Lưu ý: server nhớ những commit đã qua `deploy-gate`. Nếu bật lại timer khi tip vẫn là commit lỗi, server sẽ deploy lại commit đó.

## 6. Tạm dừng hoặc gỡ

| Việc | cron (talkaibotprd01, không sudo) | systemd (có sudo) |
|---|---|---|
| Tạm dừng / gỡ | `bash scripts/ivy-autodeploy-install.sh --cron --uninstall` | `sudo systemctl stop ivy-autodeploy.timer` / `sudo bash scripts/ivy-autodeploy-install.sh --uninstall` |
| Bật lại | `bash scripts/ivy-autodeploy-install.sh --cron` | `sudo systemctl start ivy-autodeploy.timer` |
| Xem đang chạy | `crontab -l \| grep ivy-autodeploy` · `tail -f ~/ivy-autodeploy.log` | `systemctl list-timers ivy-autodeploy.timer` · `journalctl -u ivy-autodeploy -f` |
| Deploy tay như trước | Dừng trước, rồi `git pull --ff-only && bash scripts/deploy-self-hosted.sh` | như bên trái |

## 7. Cổng e2e (`test:ci`)

`e2e/package.json` → `test:ci` = `playwright test --project=desktop --grep "@smoke|@T00|@T13"`.
Cổng này chỉ gồm các test **đang xanh**. 49/75 test còn đỏ theo thiết kế, vì các task chưa làm (ivy-docs/TEST-CASES.md §0).
**Khi task Tnn xong** (toàn bộ TC xanh), thêm `|@Tnn` vào `test:ci` trong cùng commit (ivy-docs/TASKS.md §0).

## 8. Vì sao server tự kéo thay vì GitHub đẩy vào

Repo `amoeba-group/ivyusa-sharp-talk` là **public**.

| Cách | Vấn đề |
|---|---|
| Self-hosted runner trên EC2 | PR từ fork có thể sửa workflow để chạy code trên runner. Runner có quyền docker, tức tương đương root trên máy production. GitHub khuyến cáo không dùng self-hosted runner cho repo public. |
| SSH từ runner của GitHub | Phải mở cổng 22 cho toàn bộ dải IP của GitHub Actions (rất rộng, thay đổi liên tục), và khóa SSH nằm trên GitHub. |
| AWS SSM + OIDC | An toàn, nhưng cần quyền IAM trên tài khoản AWS của IVY (OIDC provider, role, instance profile). |
| **Server tự kéo (đang dùng)** | Không mở cổng vào, không lưu secret deploy trên GitHub, không chạy code từ fork. Đổi lại: trễ tối đa khoảng 2 phút, và kết quả chỉ hiện trên GitHub nếu có token (§2.2). |

Server chỉ deploy commit **tip của `deploy/talk-ivyusa`** có job `deploy-gate` thành công trong một run `event=push` của workflow `ivy-ci-cd.yml`. Run từ PR, kể cả PR từ fork, có `deploy-gate` bị skip, nên không bao giờ mở được cổng này.

## 9. Xử lý sự cố

| Triệu chứng (`~/ivy-autodeploy.log` / journalctl / `--status`) | Nguyên nhân · cách xử lý |
|---|---|
| `checkout is on 'X', expected 'deploy/talk-ivyusa'` | Ai đó đã checkout nhánh khác trên server → checkout lại `deploy/talk-ivyusa` |
| `tracked files are modified` | Có file bị sửa tay trên server → commit/discard (`git diff` để xem) |
| `have diverged` | Server có commit local (vd. deploy bằng git bundle khi chưa push được) → push commit đó lên GitHub hoặc reset về origin bằng tay; không bao giờ force |
| `gate unknown: error GitHub API…` | Mạng ra ngoài hoặc hết giới hạn 60/h → thêm token (§2.2) |
| `not deployable: run failure …` | CI đỏ ở tip → sửa và push lại |
| `waiting: deploy check failed` | Còn SQL chưa áp hoặc config thiếu → xem log, áp SQL (§4) |
| CI xanh nhưng không deploy | `crontab -l \| grep ivy-autodeploy` (hoặc `systemctl list-timers ivy-autodeploy.timer`); `bash scripts/ivy-autodeploy.sh --dry-run` |
| `another cycle is running` lặp lại vài lần | Một lần deploy đang build, lâu hơn 2 phút. Đây là bình thường, `flock` đang chặn chu kỳ chồng lên |
