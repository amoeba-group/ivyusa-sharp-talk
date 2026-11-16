# PLN-261116 — IVY T16 · Deploy talk.ivyusa.com & smoke production

| | |
|---|---|
| Trạng thái | 🟨 **Chờ duyệt** (§6) |
| Task | [ivy-docs/TASKS.md T16](../../ivy-docs/TASKS.md) · BUG-004 · BUG-005 |
| TC | TC-16-01..03 ([e2e/tests/16-prod-smoke.spec.ts](../../e2e/tests/16-prod-smoke.spec.ts)), chỉ đọc, `E2E_TARGET=prod` |
| Migration | **Không có SQL** từ T12 tới nay (SQL của T11 đã áp ngày 2026-11-13) |
| UI | **Không đổi UI.** Chỉ vận hành và tài liệu |

## 1. Khảo sát (2026-11-16)

| Mục | Kết quả |
|---|---|
| Nhánh | `deploy/talk-ivyusa` = `0ded01c5`, khớp remote |
| CI | Run `43810433622` xanh: verify · e2e gate 132/132 · **deploy-gate** |
| Code chờ lên production | T15 (`8f264e88`) + sửa BUG-031 (`1a9bc75f`, `3b0263e8`). Commit T15 chưa từng có `deploy-gate` xanh, nên production còn ở bản T14 / T13-2a cho tới khi server kéo `0ded01c5` |
| Server đã deploy chưa | **Không biết.** Server không ghi commit status lên GitHub (T00-e (2): chưa có token), nên từ ngoài không thấy kết quả |
| `talk.ivyusa.com` từ máy dev | `/api/v1/health`, `/widget/`, `/widget/embed.js` đều **403** (`awselb`) — BUG-004 vẫn mở |
| Quyền vào server | Máy dev không có: không có `secrets/`, không có AWS CLI / SSM plugin, không có khoá SSH |
| Tài liệu lệch (BUG-005) | "production chưa deploy / host TBD" còn ở `SPEC.md` §12.1, §12.2, §14 · `README.md` §8 · `CLAUDE.md` §6 · `CONFIG.md` (dòng "no production host recorded"). `deploy/profiles/SharpTalk-USA-IVY/CHECKLIST.md` chưa tick mục nào |

**Kết luận:** bước 1 (SQL) và bước 2 (deploy) của T16 không cần làm gì thêm. Bước 3 và 4 cần một người có quyền vào server, hoặc một máy trong allowlist. Bước 5 (tài liệu) làm được ngay ở máy dev.

## 2. Kế hoạch

**A — Xác minh trên server (người có quyền SSM làm, khoảng 5 phút, chỉ đọc).** Vào `talkaibotprd01` bằng AWS SSM, user `appops`:

```bash
cd /docker/apps/talktalk
git log --oneline -1                          # mong đợi 0ded01c5
bash scripts/ivy-autodeploy.sh --status       # mốc "đã deploy" + kết quả chu kỳ gần nhất
tail -n 40 ~/ivy-autodeploy.log
docker ps --format 'table {{.Names}}\t{{.Status}}'      # tuổi container api / widget
docker logs --tail 200 <container api> 2>&1 | grep -c 'successfully started'
curl -s localhost:<cổng edge>/api/v1/health
```

Gửi lại kết quả các lệnh trên (không có secret trong đó). Theo CLAUDE.md §7: không tin exit code; cần boot log, tuổi container và HTTP status.

**B — Smoke production (TC-16-01..03).** Một trong hai:
- **B1:** thêm IP của máy dev vào allowlist của ALB, rồi máy dev chạy `cd e2e && npm run test:prod`.
- **B2:** người đang ở mạng được phép chạy lệnh đó và gửi kết quả.

Test chỉ đọc: health, `/widget/`, `embed.js`, mở panel. Không gửi chat, không đổi consent.

**C — Tài liệu (máy dev, sau A và B).**
- RPT `docs/implementation/RPT-2611xx-IVY-T16-Deploy-Smoke.md`: SHA, run CI, trạng thái server, kết quả TC-16.
- Điền dòng "Server" còn treo trong RPT T15.
- BUG-005: sửa các chỗ ở §1 thành "production = talk.ivyusa.com, EC2 `talkaibotprd01`, nhánh `deploy/talk-ivyusa`, push = deploy". Chỉ ghi điều đã xác minh ở A.
- `CHECKLIST.md` của IVY: tick những mục A và B chứng minh được (host, domain, deploy, health). Mục chưa kiểm thì để trống.
- TASKS (T16 → ✅), TEST-CASES §T16, BUGS (004 theo kết quả B, 005 → Fixed).

**D — Không làm trong T16:** cấu hình console production của T01 / T02 / T08 / T12, quyền PCD của T04, T00-b, T00-c, BUG-021. Đây là việc của chủ dự án hoặc task riêng.

## 3. Thay đổi

| Phần | File | Nội dung |
|---|---|---|
| Docs | `SPEC.md`, `README.md`, `CLAUDE.md`, `CONFIG.md` | BUG-005: trạng thái production thật |
| Docs | `deploy/profiles/SharpTalk-USA-IVY/CHECKLIST.md` | Tick mục đã xác minh |
| Docs | ivy-docs (TASKS, TEST-CASES, BUGS), RPT T16, RPT T15 | Kết quả |
| Code / SQL / e2e | — | Không đổi |

## 4. Ảnh hưởng phụ

- Chỉ đổi tài liệu: push sẽ fast-forward server, **không build, không restart** (GUIDE CI/CD §1 bước 4).
- `CLAUDE.md`, `README.md`, `SPEC.md`, `CONFIG.md` dùng chung với nhánh `main` và các tenant khác (KR, Go2Joy). Chỉ sửa câu nói về production của IVY; staging và các profile khác giữ nguyên. Không đụng `main`.
- Thêm IP vào allowlist (B1) là thay đổi hạ tầng AWS của IVY, do người quản trị AWS làm.

## 5. Rủi ro

- Nếu A cho thấy server **chưa** ở `0ded01c5` hoặc deploy lỗi: dừng, đọc `~/sharptalk-deploy-*.log`, xử lý theo GUIDE CI/CD §5 và §9. Không sửa tay trên server khi chưa hỏi.
- Nếu không ai chạy được B: T16 dừng ở ⛔ với TC-16 "chưa chạy", BUG-004 giữ Open.

## 6. Xin bạn xác nhận

1. **Duyệt kế hoạch này?**
2. **Xác minh server (A):**
   - **a (khuyến nghị):** bạn (hoặc người có quyền SSM) chạy các lệnh ở A rồi dán kết quả.
   - **b:** bỏ qua A, chỉ dựa vào smoke B.
3. **Smoke production (B):**
   - **a:** thêm IP máy dev vào allowlist, máy dev chạy `test:prod`.
   - **b:** bạn chạy `npm run test:prod` từ mạng được phép và gửi kết quả.
   - **c:** chưa làm được lúc này; T16 để ⛔ và ghi lý do.
4. **Sửa tài liệu BUG-005 (C)** ở 4 file dùng chung: **a** làm cùng T16 · **b** chỉ sửa trong ivy-docs, để 4 file kia cho sau.

Trả lời ví dụ: `1. ok  2. a  3. b  4. a`
