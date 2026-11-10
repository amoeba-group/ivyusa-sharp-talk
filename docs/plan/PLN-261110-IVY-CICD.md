# PLN-261110 — CI/CD cho `deploy/talk-ivyusa` → talk.ivyusa.com

| | |
|---|---|
| Trạng thái | **Đã duyệt** trong chat ngày 2026-11-10 ("Hãy viết CI/CD cho dự án này và push lên…") |
| Phạm vi | Hạ tầng: GitHub Actions, script phía server, tài liệu. **Không ảnh hưởng UI** (không wireframe) · **không migration** |
| Nhánh | `deploy/talk-ivyusa` = production IVY. **Không bao giờ dùng `main`** |
| REQ / TCR | Gộp vào §1 và §5 vì phạm vi nhỏ. Kết quả chạy thật nằm trong RPT-261110-IVY-CICD |
| Runbook | [GUIDE-261110-IVY-CICD](../guide/GUIDE-261110-IVY-CICD.md) |

## 1. Hiện trạng → mục tiêu

| | Hiện trạng | Mục tiêu |
|---|---|---|
| CI | `ci.yml` chỉ chạy cho `main`/`production` → push lên `deploy/talk-ivyusa` **không được kiểm tra gì** | Mọi push/PR vào `deploy/talk-ivyusa`: verify (typecheck · env · migration manifest · radius · **i18n** · test · build) + **e2e gate** Playwright |
| E2E | Chỉ chạy tay ở local | Chạy trong CI với stack thật (MySQL/Redis/RabbitMQ/Qdrant + seed + API + widget bản build) |
| CD | SSH vào EC2 → `git pull` → `bash scripts/deploy-self-hosted.sh` bằng tay | Push → CI xanh → **người duyệt bấm Approve** → server tự deploy trong ≤ 2 phút |
| Migration | Áp tay trước khi deploy | Không đổi (áp tay). Nếu quên, deploy **tự dừng trước khi động vào container** rồi tự tiếp tục khi SQL đã áp |

Ràng buộc phát hiện khi khảo sát:
- Repo **public**, là fork, và PR từ fork chỉ cần duyệt với người đóng góp lần đầu.
- talk.ivyusa.com nằm sau ELB có allowlist (BUG-004).
- `secrets/` không có trong bản clone.
- Server không bắt buộc có Node (`check-migrations.sh`).

## 2. Quyết định thiết kế

**D1 — CD theo kiểu server tự kéo (pull-based).** Timer trên EC2 hỏi GitHub API xem tip có `deploy-gate` thành công chưa, rồi tự deploy.

Các phương án khác bị loại:
- **Self-hosted runner trên EC2:** PR từ fork có thể chạy code với quyền docker trên production.
- **SSH push:** phải mở cổng 22 cho dải IP của GitHub, và khóa SSH nằm trên GitHub.
- **SSM/OIDC:** cần quyền IAM AWS của IVY. Có thể chuyển sang sau mà không phải sửa CI.

**D2 — Duyệt bằng GitHub Environment `talk-ivyusa-production`** (required reviewer + branch policy chỉ cho `deploy/talk-ivyusa`). Job `deploy-gate` là tín hiệu duy nhất server tin. Job này chỉ chạy khi `event=push` trên đúng nhánh, nên PR từ fork không bao giờ mở được cổng.

**D3 — Dùng lại `ci.yml` qua `workflow_call`** thay vì chép lại các bước, để chỉ có một định nghĩa "build-green" cho cả hai nhánh. Thêm `i18n:check` vào đó (CLAUDE.md yêu cầu, trước đây CI chưa chạy).

**D4 — Cổng e2e là danh sách tag đang xanh** (`test:ci` = `@smoke|@T00|@T13`). Không chạy hết 75 test, vì 49 test đỏ là thiết kế chưa làm. Mỗi task hoàn thành thì thêm tag của nó.

**D5 — E2E chạy trên bản build của widget** (`vite preview`), không phải dev server, để kiểm tra đúng thứ được ship.

**D6 — Kiểm tra trước khi động vào container.** Script fast-forward rồi chạy `deploy-self-hosted.sh --check`:
- Fail: `git reset --keep` về commit cũ để checkout luôn khớp với container đang chạy, rồi thử lại mỗi chu kỳ.
- Deploy fail sau khi đã build: **không tự rollback**, cần người quyết định.

**D7 — Chỉ deploy tip; nhớ approval theo SHA.** Push mới huỷ run cũ (`concurrency`). Approval được cache, nên khi đang chờ SQL thì không tốn thêm request API.

## 3. Các bước

| # | Việc | File |
|---|---|---|
| S1 | `ci.yml`: thêm `workflow_call` + bước `i18n:check` | `.github/workflows/ci.yml` |
| S2 | Workflow `IVY CI/CD`: verify · e2e gate · deploy-gate (environment) | `.github/workflows/ivy-ci-cd.yml` |
| S3 | `test:ci` + reporter `github` khi chạy trong Actions | `e2e/package.json`, `e2e/playwright.config.ts` |
| S4 | Script server tự kéo + installer systemd | `scripts/ivy-autodeploy.sh`, `scripts/ivy-autodeploy-install.sh` |
| S5 | Tài liệu: runbook, cập nhật ivy-docs, CLAUDE.md §8 | `docs/guide/GUIDE-261110-IVY-CICD.md`, `ivy-docs/*`, `CLAUDE.md` |
| S6 | **Thiết lập một lần, người có quyền làm:** environment reviewer (admin repo) · token (tuỳ chọn) · cài timer trên EC2 (SSH) | GUIDE §2 |

## 4. Ảnh hưởng phụ

- **`ci.yml` là file dùng chung với `main`:** chỉ thêm trigger `workflow_call` và một bước i18n. Trên nhánh này không có tác động gì khác. Nếu sau này merge sang `main`, bước i18n cũng chạy ở đó (hiện đang xanh).
- **Chi phí Actions:** repo public nên runner GitHub miễn phí. Mỗi push tốn khoảng 2 job song song, 10–15 phút.
- **Bảo mật:**
  - Không có secret deploy trên GitHub, không mở cổng vào server.
  - Token tuỳ chọn trên server chỉ có quyền Actions read và Commit statuses write cho đúng repo này.
  - Vẫn như trước: ai push được vào `deploy/talk-ivyusa` thì có thể đưa code lên production, nhưng giờ phải có người duyệt.
- **Deploy hiện tại:** `deploy-self-hosted.sh` không đổi. Deploy tay vẫn dùng được, nhưng nên dừng timer trong lúc làm.
- **Quy trình task IVY:** TASKS §0 có thêm bước "thêm `@Tnn` vào `test:ci`". T16 chuyển sang dùng pipeline này.
- **Không đụng UI, API, schema, i18n key.**

## 5. Kiểm thử (TCR)

| Mức | Ca | Cách |
|---|---|---|
| Lint | Workflow hợp lệ | `actionlint` (Docker) |
| Lint | Script shell | `shellcheck` (Docker) |
| Unit | 23 ca của `ivy-autodeploy.sh`: idle · run đang chạy · chờ duyệt · CI fail (chỉ log một lần) · gate bị skip · thiếu SQL → quay lại · SQL đã áp → tự deploy (approval cache) · deploy fail · file bị sửa · sai nhánh · lệch nhánh · API sập · `--status` | Container Alpine với origin giả + API GitHub giả + `deploy-self-hosted.sh` giả |
| Local | Cổng e2e `@smoke\|@T00\|@T13` | 10/10 xanh trên stack local |
| Local | `check-migrations --check`, `radius:check` | Xanh trên Linux. Trên Windows sai do CRLF và `URL.pathname` (BUG-012) |
| CI | Lần chạy đầu của `IVY CI/CD` trên GitHub | Ghi trong RPT |
| Server | `--dry-run` rồi cài timer trên EC2 | Việc S6, sau khi có quyền SSH |

## 6. Migration

Không có.
