# PLN-261119 — Trả lời khách bằng Claude qua AWS Bedrock của IVY

| | |
|---|---|
| Trạng thái | ✅ **Đã duyệt** 2026-11-19: `1. ok 2. a 3. ok` (bật cho khách sau khi duyệt kho kiến thức; chia việc theo bảng 3.2). Đã làm: [RPT](../implementation/RPT-261119-IVY-AWS-Bedrock-Claude.md) |
| Nguồn | Email IVY USA IT Cloud (anh Andrew), 2026-11-19 — lưu cục bộ ở `ivy-docs/Bedrock_Access.md`, **không commit** (ARN có số tài khoản AWS của IVY; repo public) |
| Phạm vi | `apps/api` (adapter AI mới), `packages/types`, `apps/web` (form engine), `docker/self-hosted/.env.self-hosted.example` |
| Migration | **Không** — cột `ai_engines.provider` là chuỗi tự do |

## 1. Hiện trạng

- Production trả lời khách bằng **AI giả lập** (Built-in Stub): câu soạn sẵn, không có mô hình thật.
- Cổng AI (`AiGatewayService`) chọn engine theo (tenant × chức năng) rồi gọi adapter của nhà cung cấp: `stub`, `anthropic` (API key của Anthropic), `openai`, `voyage` (embedding). Adapter lỗi thì lùi về stub và đánh dấu `degraded`, để chatbot chuyển khách sang nhân viên thay vì bịa câu trả lời.
- Chưa có cách gọi AWS Bedrock.

## 2. IVY đã cấp gì

| Mục | Giá trị |
|---|---|
| Region | `us-east-1` |
| Chatbot chính | Claude Sonnet 5.5, qua *application inference profile* (ARN) → biến `BEDROCK_SONNET_MODEL_ARN` |
| Việc ngắn, phân loại | Claude Haiku 5.5, qua ARN → biến `BEDROCK_HAIKU_MODEL_ARN` |
| Xác thực | IAM Role của EC2 `talkaibotprd01`. **Không có khoá**; IVY yêu cầu không đưa khoá AWS vào code hay `.env`. Đã kiểm 2026-11-19: container `sharptalk_api` lấy được role `talk-ivyusa-bedrock` qua IMDS |
| Cách gọi | Converse API (`@aws-sdk/client-bedrock-runtime`), `modelId` = ARN; gọi thẳng bằng tên mô hình bị chặn |
| Về sau | IVY bật Bedrock Guardrails trước khi chạy thật → code phải nhận được `guardrailConfig` |
| Chi phí | Cảnh báo khi vượt $200/tháng (chỉ thông báo, không chặn). Đổi mô hình hay region phải hỏi IVY |

Đã đối chiếu với tài liệu chính thức:

- **Converse nhận ARN inference profile làm `modelId`:** "If you use an inference profile, specify the inference profile ID or its ARN".
- **Tham số trong Converse:** `guardrailConfig` gồm `guardrailIdentifier`, `guardrailVersion`, `trace`; tham số riêng của mô hình đặt trong `additionalModelRequestFields`; số token nằm ở `usage.inputTokens` / `usage.outputTokens`.
- **Đường gọi kiểu Messages của Anthropic trên Bedrock** (endpoint Mantle) không nói gì về inference profile.

Vì vậy chọn đúng đường IVY đã thử: **Converse**.

## 3. Thiết kế

### 3.1 Adapter `bedrock` (backend, không đổi giao diện khách)

`apps/api/src/infrastructure/external/ai/adapters/bedrock.adapter.ts`, cùng giao diện `AiAdapter` với các adapter khác.

| Việc | Cách làm |
|---|---|
| Client | `BedrockRuntimeClient({ region: AWS_REGION })`. SDK tự lấy quyền từ IAM Role; không đọc `apiKey` của engine |
| Mô hình | `engine.model` = `sonnet` / `haiku` → lấy ARN từ `BEDROCK_SONNET_MODEL_ARN` / `BEDROCK_HAIKU_MODEL_ARN`. Cũng nhận một ARN đầy đủ. Không viết cứng ARN hay tên mô hình trong code |
| Lời nhắc | `system` → `system: [{ text }]`. Tin nhắn → `{ role, content: [{ text }] }`; gộp các tin liền nhau cùng vai trò và bảo đảm tin đầu là của khách (phòng thủ, vì lịch sử chat có thể có hai tin khách liền nhau) |
| Tham số | Chỉ `inferenceConfig.maxTokens`. **Không gửi `temperature`**: theo tài liệu Anthropic, Sonnet 5.5 và Haiku 5.5 trả lỗi 400 với giá trị temperature khác mặc định — mẫu code trong email (temperature 0.3) sẽ lỗi. Adapter Anthropic hiện tại cũng đã bỏ tham số này vì cùng lý do |
| Mức suy nghĩ | Hai mô hình này mặc định *suy nghĩ* trước khi trả lời, và phần suy nghĩ tính vào `maxTokens`. Thêm tham số `effort` (đặt theo từng chức năng trong cấu hình AI của tenant), truyền qua `additionalModelRequestFields`. Giá trị cụ thể chốt ở bước đo (mục 5), không đoán trước |
| Kết quả | Chỉ lấy các khối `text`, bỏ khối suy nghĩ. Token từ `usage` → thống kê AI hiện có. Ghi log `stopReason` khi không phải `end_turn` |
| Guardrail | Có `BEDROCK_GUARDRAIL_ID` (+ `BEDROCK_GUARDRAIL_VERSION`) trong `.env` thì gửi `guardrailConfig`; không có thì không gửi. `stopReason = guardrail_intervened` được ghi log và trả câu IVY cấu hình cho trường hợp bị chặn. Kiểm duyệt riêng của dự án (ModerationService) vẫn chạy như cũ |
| Lỗi | Lỗi AWS (AccessDenied, Throttling, Validation…) → ném lỗi kèm tóm tắt, không kèm dữ liệu khách → cổng AI lùi về stub, ghi sức khoẻ engine, console hiện lý do |

Kèm theo:

- `AI_PROVIDER.BEDROCK = 'bedrock'` (`packages/types`).
- `TENANT_PROVIDERS` thêm `bedrock` để tenant tự tạo engine.
- Đăng ký adapter trong `AiGatewayService`.
- Thêm dependency `@aws-sdk/client-bedrock-runtime` cho `apps/api`.
- Thêm `AWS_REGION`, `BEDROCK_SONNET_MODEL_ARN`, `BEDROCK_HAIKU_MODEL_ARN`, `BEDROCK_GUARDRAIL_ID`, `BEDROCK_GUARDRAIL_VERSION` vào `docker/self-hosted/.env.self-hosted.example`, vì cổng `env:check` của CI đòi mọi biến code đọc phải có trong template.

### 3.2 Chia việc cho hai mô hình

| Chức năng AI | Engine |
|---|---|
| `rag`, `chat` (trả lời khách), `summary`, `assist`, `coach` | Claude Sonnet 5.5 · Bedrock |
| `moderation` (và các bước phân loại ngắn) | Claude Haiku 5.5 · Bedrock |
| `embedding` (tìm kiếm vector trong kho kiến thức) | Giữ nguyên. IVY chỉ mở 2 mô hình Claude, và Claude không làm embedding; muốn dùng embedding của AWS phải xin IVY |

Việc chia đặt trong console (AI settings của tenant), không viết cứng.

### 3.3 Console — form thêm engine

Chọn nhà cung cấp **AWS Bedrock** thì form đổi: ô mô hình chọn Sonnet / Haiku; không có ô API key và endpoint; một dòng giải thích cách xác thực.

```
┌─ Add AI engine ───────────────────────────────────────┐
│ Name      [ Claude Sonnet 5.5 · Bedrock          ]    │
│ Provider  [ AWS Bedrock                    ▾ ]        │
│ Model     ( ● Sonnet 5.5 — main chatbot )             │
│           ( ○ Haiku 5.5 — quick tasks    )            │
│           Uses the inference profile set on the       │
│           server (BEDROCK_SONNET_MODEL_ARN).          │
│                                                       │
│ ⓘ Signs in with the server's AWS IAM role — no key.   │
│                                                       │
│                         [ Cancel ]  [ Save ]          │
└───────────────────────────────────────────────────────┘
```

Nút **Test connection** sẵn có gọi Bedrock thật từ container: đây chính là bước "test từ Docker" IVY yêu cầu. Trang AI Engines của admin hệ thống thêm `bedrock` vào danh sách nhà cung cấp.

## 4. Lưu ý trước khi bật cho khách

1. **Kho kiến thức:** hiện có 5 tài liệu chính sách mẫu chưa ai kiểm. Bật AI thật thì Claude trả lời khách theo đúng nội dung này. Cần duyệt hoặc thay nội dung trước.
2. **Chi phí và tốc độ:** mỗi câu trả lời tốn token trên tài khoản AWS của IVY. Mức `effort` và `maxTokens` quyết định cả chi phí lẫn độ trễ; chốt bằng số đo (mục 5), không đoán.
3. **Đổi mô hình hay region phải hỏi IVY**, nên ARN và region chỉ nằm trong `.env` của server.

## 5. Các bước triển khai

| Bước | Ai làm | Việc | Thay đổi với khách |
|---|---|---|---|
| 1 | Chủ dự án | Thêm vào `docker/self-hosted/.env.self-hosted` trên `talkaibotprd01`: `AWS_REGION`, `BEDROCK_SONNET_MODEL_ARN`, `BEDROCK_HAIKU_MODEL_ARN` (tôi gửi đúng 3 dòng) — **trước** khi push | Không |
| 2 | Tôi | Code + test → push → tự deploy. Chưa engine nào dùng Bedrock | Không |
| 3 | Chủ dự án (tôi hướng dẫn) | Console → AI engines: tạo 2 engine Bedrock → **Test connection** cả hai | Không |
| 4 | Tôi | Đo trên 10–20 câu hỏi thật của IVY qua nút test / trợ lý cấu hình: độ dài, độ trễ, token theo từng mức `effort`; chốt `effort` + `maxTokens` cho từng chức năng | Không |
| 5 | Chủ dự án | Duyệt kho kiến thức (mục 4.1) | — |
| 6 | Chủ dự án | AI settings: gán chức năng → engine theo bảng 3.2 | **Khách bắt đầu nhận câu trả lời của Claude** |
| 7 | Chủ dự án | Báo IVY để họ test và cấu hình Guardrails → thêm `BEDROCK_GUARDRAIL_ID/VERSION` vào `.env` | Câu trả lời đi qua Guardrails |

Gỡ ra (rollback): gán lại các chức năng về engine cũ trong console, có hiệu lực ngay, không cần deploy.

## 6. Ảnh hưởng phụ

- Không đụng tenant khác: Bedrock chỉ chạy khi một engine `bedrock` được gán cho chức năng.
- Lỗi Bedrock (hết quyền, quá hạn mức…) không làm hỏng chat: cổng AI lùi về stub, chatbot chuyển khách sang nhân viên, console báo engine lỗi.
- Thêm một thư viện AWS vào API: image lớn hơn vài MB.

## 7. Kiểm thử

- **Unit, adapter:**
  - chọn ARN theo `sonnet` / `haiku` / ARN đầy đủ, báo lỗi rõ khi thiếu biến;
  - gộp tin cùng vai trò, tin đầu là của khách;
  - không gửi `temperature`;
  - chỉ lấy khối `text`;
  - lấy số token đúng;
  - có hoặc không có `guardrailConfig` theo `.env`;
  - lỗi AWS thành lỗi có tóm tắt.

  Tất cả dùng client AWS giả, không gọi mạng.
- **Unit, cổng AI:** engine `bedrock` được định tuyến; adapter lỗi thì lùi về stub.
- **Thật:** bước 3–4 ở mục 5, chạy từ container production.
- E2E của widget không đổi.

## 8. Cần chủ dự án quyết

1. **Duyệt thiết kế** (mục 3)?
2. **Khi nào bật cho khách** (bước 6):
   - **a.** Sau khi duyệt kho kiến thức. Khuyên dùng.
   - **b.** Ngay sau bước 4.
3. **Chia việc** theo bảng 3.2? (Sonnet cho trả lời khách, Haiku cho phân loại / kiểm duyệt.)
