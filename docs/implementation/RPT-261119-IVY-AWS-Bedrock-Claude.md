# RPT-261119 — Claude qua AWS Bedrock của IVY

Kế hoạch: [PLN-261119-IVY-AWS-Bedrock-Claude](../plan/PLN-261119-IVY-AWS-Bedrock-Claude.md), duyệt 2026-11-19 `1. ok 2. a 3. ok`.

Nguồn: email IVY USA IT Cloud, lưu cục bộ ở `ivy-docs/Bedrock_Access.md` và **không commit**, vì ARN có số tài khoản AWS của IVY. Đã kiểm 2026-11-19: container `sharptalk_api` lấy được IAM Role `talk-ivyusa-bedrock` qua IMDS.

## 1. Thay đổi

| Phần | Nội dung | File |
|---|---|---|
| Adapter | Provider `bedrock`: Converse API, `modelId` = ARN inference profile lấy từ env (`sonnet` → `BEDROCK_SONNET_MODEL_ARN`, `haiku` → `BEDROCK_HAIKU_MODEL_ARN`, hoặc ARN đầy đủ). Xác thực bằng IAM Role, **không khoá**; region lấy từ `AWS_REGION` (mặc định `us-east-1`). **Không gửi `temperature`**, vì Sonnet 5.5 / Haiku 5.5 trả 400. `maxTokens` tối thiểu 4096 vì phần suy nghĩ tính vào đó. `effort` theo từng chức năng qua `additionalModelRequestFields.output_config`. `guardrailConfig` khi có `BEDROCK_GUARDRAIL_ID`. Chỉ lấy khối `text`. Lỗi AWS thành một dòng có mã HTTP để console xếp loại đúng (403 auth, 404/"model identifier" model, 429 rate limit, thiếu IAM role "not configured" auth). Kết quả ghi model là `sonnet` / `haiku`, không ghi ARN | `infrastructure/external/ai/adapters/bedrock.adapter.ts` |
| Cổng AI | Đăng ký adapter (tham số tuỳ chọn ở cuối, như các bổ sung trước); truyền `effort` từ tham số của chức năng; Bedrock lỗi vẫn lùi về stub và đánh dấu `degraded` | `ai-gateway.service.ts`, `ai.module.ts`, `ai-adapter.interface.ts` |
| Engine không khoá | `KEYLESS_PROVIDERS = {bedrock}`: không báo "no key", tạo ra là bật, sửa không bị tắt, Test connection gọi thật thay vì dừng ở "no API key" | `engine-health.ts`, `domain/ai-engine/tenant-ai-engine.service.ts` |
| Nhà cung cấp | `AI_PROVIDER.BEDROCK`; tenant được tự thêm engine `bedrock`; trang AI Engines của admin hệ thống cũng có | `packages/types`, `tenant-ai-engine.service.ts`, `admin/AiEnginesPage.tsx` |
| Console | Form engine: chọn **AWS Bedrock** thì chỉ còn chọn Sonnet / Haiku, kèm dòng giải thích đăng nhập bằng IAM Role; ẩn endpoint và API key. 6 ngôn ngữ | `settings/AiEngineCard.tsx`, `locales/*/settings.json` |
| Thư viện | `@aws-sdk/client-bedrock-runtime@^3.1172.0` cho `apps/api`. `package-lock.json` chỉ **thêm** 27 gói (`npm install --package-lock-only`); `npm install` thường đổ lỗi trên máy Windows này (arborist `reading 'location'`) | `apps/api/package.json`, `package-lock.json` |
| Cấu hình | `AWS_REGION`, `BEDROCK_SONNET_MODEL_ARN`, `BEDROCK_HAIKU_MODEL_ARN`, `BEDROCK_GUARDRAIL_ID`, `BEDROCK_GUARDRAIL_VERSION` vào template self-hosted (`env:check` xanh) và bảng biến môi trường của `CONFIG.md` | `docker/self-hosted/.env.self-hosted.example`, `CONFIG.md` |

Không có SQL: `ai_engines.provider` là chuỗi tự do.

## 2. Kiểm thử

| Bộ | Kết quả |
|---|---|
| `bedrock.adapter.spec.ts` (SDK giả, không gọi mạng) | ARN theo alias và ARN đầy đủ; thiếu env → lỗi loại "model"; không gửi `temperature`; `maxTokens` ≥ 4096; `effort` hợp lệ thì gửi, sai thì bỏ; `guardrailConfig` chỉ khi có env; chỉ lấy khối `text`; region; 5 loại lỗi AWS xếp đúng loại; gộp vai trò hội thoại |
| `ai-gateway.bedrock.spec.ts` | Chức năng `rag` đi tới Bedrock với `effort` / `max_tokens` của chức năng, không khoá; Bedrock lỗi → stub, `degraded` |
| `tenant-ai-engine.bedrock.spec.ts` | Bedrock tạo ra là bật, sửa vẫn bật, Test connection gọi adapter không khoá; Anthropic không khoá vẫn bị chặn |
| `engine-health.spec.ts` | Bedrock không khoá không phải "no key"; "model identifier" → "model" |
| AI gateway + ai-engine | 212/212 |
| Khởi động API thật trên máy | `Nest application successfully started` |
| Console trên máy | Form Bedrock: Name / Provider / Model (Sonnet 5.5 — main chatbot · Haiku 5.5 — quick tasks) + dòng IAM Role; tạo qua API → `enabled`; Test connection → `model`: "BEDROCK_SONNET_MODEL_ARN is not set on the server" (máy không có AWS, đúng như mong đợi); engine thử đã xoá |
| Typecheck API, console; `i18n:check`; `env:check` | Sạch |

Không gọi Bedrock thật từ máy local: máy không có IAM Role. Gọi thật là bước 3 ở mục 3, chạy trong container production.

## 3. Trạng thái triển khai

Cập nhật 2026-11-25. Các bước làm trong ngày ghi chi tiết ở [RPT giai đoạn 4](RPT-261125-IVY-PRD-v1-Phase4.md) và [RPT giai đoạn 5](RPT-261125-IVY-PRD-v1-Phase5.md) của PRD v1.

| Bước | Ai | Trạng thái |
|---|---|---|
| 1. Thêm `AWS_REGION`, `BEDROCK_SONNET_MODEL_ARN`, `BEDROCK_HAIKU_MODEL_ARN` vào `docker/self-hosted/.env.self-hosted` trên `talkaibotprd01` | Chủ dự án | ✅ 2026-11-25, trước deploy `5bbd4e48` |
| 2. Push → CI → tự deploy | Tôi | ✅ Code Bedrock (`d2073407`) lên production cùng `01aaf899` lúc 06:25 UTC, khi chưa có `.env` nên chưa dùng. Env có hiệu lực từ deploy `5bbd4e48` lúc 07:35 UTC |
| 3. Console → Settings → AI engines: tạo "Claude Sonnet 5.5 · Bedrock" (model Sonnet) và "Claude Haiku 5.5 · Bedrock" (model Haiku) → **Test connection** cả hai | Tôi, chủ dự án đồng ý | ✅ 2026-11-25: Sonnet (#3) Test OK 796 ms, Haiku (#4) Test OK 858 ms (RPT giai đoạn 4, bước 9) |
| 4. Đo `effort` / `maxTokens` trên câu hỏi thật | Tôi | 🟡 Đã đo thời gian trả lời trên production ([TCR giai đoạn 5 §3](../test/TCR-261125-IVY-PRD-v1-Phase5.md), RPT giai đoạn 5 bước 5): kịch bản 1,1–1,2 giây; câu hỏi kho kiến thức 3,1 giây, 4,5 giây khi có kiểm duyệt AI; câu dưới thẻ 1,3–1,8 giây, 2,3–2,9 giây khi có kiểm duyệt AI. **Chưa chỉnh tham số:** không đặt `effort`; `max_tokens` 512 / 1024 được adapter nâng lên 4096. Chỉnh theo góp ý của đợt IVY test |
| 5. Duyệt kho kiến thức | Chủ dự án / PM | ⏳ Chưa ghi nhận. Chủ dự án cho bật AI trước (2026-11-25); kho kiến thức được kiểm trong đợt IVY test từ 2026-11-27 |
| 6. AI settings: gán chức năng | Tôi, theo lệnh chủ dự án | ✅ 2026-11-25, khác kế hoạch ban đầu: `chat` → Haiku, `rag` → Sonnet, `moderation` → Haiku; `coach` kế thừa Sonnet; `summary` / `assist` vẫn Stub (RPT giai đoạn 5, bước 3 và 5) |
| 7. Báo IVY test và cấu hình Guardrail | Chủ dự án | 🟡 Đã ghi trong hướng dẫn test ([GUIDE-261125](../guide/GUIDE-261125-IVY-Test-Guide.md) §2.2 mục 2): IVY gửi Guardrail ID + version, cấp `bedrock:ApplyGuardrail` cho role EC2. Chờ gửi hướng dẫn cho IVY và IVY trả lời |
| 8. Có Guardrail: thêm `BEDROCK_GUARDRAIL_ID`, `BEDROCK_GUARDRAIL_VERSION` vào `.env.self-hosted` → deploy lại API → kiểm AI vẫn trả lời | Chủ dự án, tôi | ⏳ Tới lúc đó, kiểm duyệt AI chỉ dùng tiêu chí an toàn chung (chủ dự án quyết 2026-11-25) |
