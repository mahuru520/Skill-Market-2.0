# Skills 技能整理（含内网API外网迁移方案）

> 共 25 个技能。当前内网不可用，原调用内网 API 的 5 个技能（comfyui-image-generation、comfyui-video-generation、contract-review、invoice-ocr、ragflow-knowledge-qa）改为通过外网网关 `https://ai.ospreyai.cn` 获取等效能力；其余技能不受影响。
>
> 网关关键信息：地址 `https://ai.ospreyai.cn`，鉴权 `Bearer Token`（new-api 的 `sk-xxx`）。ComfyUI 仅需网关 `Authorization`；Dify/RAGFlow 还需 `X-Authorization: Bearer <后端token>`。AI 接口限流 10 次/分/IP（突发 5）。

---

## 一、需迁移的内网 API 技能（5 个，含修改方案与代码）

### 1. comfyui-image-generation

1. **技能名称**：comfyui-image-generation
   **技能作用**：ComfyUI文生图并下载图片

2. **运行方式**：调用API

3. **API详情**（仅当为"调用API"时填写）：
   - 原调用网络环境：内网
   - 原调用的接口地址（URL）：`http://192.168.1.236:8188`
   - 原调用流程说明：提交工作流（POST /prompt）→ 轮询队列（GET /queue）→ 查历史获取文件名（GET /history）→ 下载图片（GET /view）

   【修改方案】
   - 修改原因：内网 192.168.1.236 不可用，改为通过外网网关 ai.ospreyai.cn 获取等效的 ComfyUI 文生图能力
   - 目标环境：切换至外网 API 网关 `https://ai.ospreyai.cn`
   - 具体实现操作：
     ① 配置环境变量 `GW=https://ai.ospreyai.cn`、`API_KEY=sk-xxx`
     ② 提交接口由 `:8188/prompt` 改为 `$GW/api/v1/ai/image/generate`，请求体 `prompt` 工作流 JSON 保持不变
     ③ 所有请求增加 `Authorization: Bearer $API_KEY` 头（ComfyUI 无需后端 X-Authorization）
     ④ 队列查询改 `GET /api/v1/ai/queue`；下载改 `GET /api/v1/ai/image/view/?filename=`
     ⑤ 端到端验证生成+下载，并加入 429 限流退避
   - 注意事项：原 `/history` 一次返回全部历史，网关为 `GET /api/v1/ai/tasks/{prompt_id}` 按任务查，需自行记录 prompt_id；AI 接口限流 10 次/分/IP（突发 5）

4. **原技能需修改的代码（关键部分）**

   【修改前代码】
   ```bash
   curl -s -X POST "http://192.168.1.236:8188/prompt" \
     -H "Content-Type: application/json" -d '{"prompt":{...}}'
   curl -s "http://192.168.1.236:8188/queue"
   curl -s "http://192.168.1.236:8188/history"
   curl -s "http://192.168.1.236:8188/view?filename=output_00001_.png" -o /data/file/output.png
   ```

   【修改后代码】
   ```bash
   export GW="https://ai.ospreyai.cn"
   export API_KEY="sk-xxx"
   # 提交文生图任务(请求体 prompt 工作流 JSON 不变)
   curl -s -X POST "$GW/api/v1/ai/image/generate" \
     -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
     -d '{"prompt":{...}}'
   # 轮询队列
   curl -s "$GW/api/v1/ai/queue" -H "Authorization: Bearer $API_KEY"
   # 下载图片
   curl -s "$GW/api/v1/ai/image/view/?filename=output.png" \
     -H "Authorization: Bearer $API_KEY" -o /data/file/output.png
   ```

---

### 2. comfyui-video-generation

1. **技能名称**：comfyui-video-generation
   **技能作用**：ComfyUI图生视频并下载mp4

2. **运行方式**：调用API

3. **API详情**（仅当为"调用API"时填写）：
   - 原调用网络环境：内网
   - 原调用的接口地址（URL）：`http://192.168.1.236:8188`
   - 原调用流程说明：上传输入图片（POST /upload/image）→ 提交视频工作流（POST /prompt）→ 轮询队列（GET /queue）→ 查历史并下载视频（GET /view）

   【修改方案】
   - 修改原因：内网 192.168.1.236 不可用，改为通过外网网关 ai.ospreyai.cn 获取等效的 ComfyUI 图生视频能力
   - 目标环境：切换至外网 API 网关 `https://ai.ospreyai.cn`
   - 具体实现操作：
     ① 配置环境变量 `GW=https://ai.ospreyai.cn`、`API_KEY=sk-xxx`
     ② 图片上传由 `:8188/upload/image` 改为 `$GW/api/v1/upload`
     ③ 视频提交由 `:8188/prompt` 改为 `$GW/api/v1/ai/video/generate`，请求体保持不变
     ④ 所有请求增加 `Authorization: Bearer $API_KEY`；下载改 `GET /api/v1/ai/image/view/?filename=&type=output`
     ⑤ 验证上传→提交→下载全链路，大文件注意分段与限流
   - 注意事项：视频生成耗时较长（1–2 分钟）叠加外网延迟体感更长；中文文件名需 URL 编码；限流 10 次/分/IP

4. **原技能需修改的代码（关键部分）**

   【修改前代码】
   ```bash
   curl -s -X POST "http://192.168.1.236:8188/upload/image" \
     -F "image=@/data/file/input.png" -F "type=input"
   curl -s -X POST "http://192.168.1.236:8188/prompt" \
     -H "Content-Type: application/json" -d '{"prompt":{...}}'
   curl -s "http://192.168.1.236:8188/queue"
   curl -s "http://192.168.1.236:8188/view?filename=video/output.mp4&subfolder=video&type=output" -o /data/file/output.mp4
   ```

   【修改后代码】
   ```bash
   export GW="https://ai.ospreyai.cn"
   export API_KEY="sk-xxx"
   # 上传输入图片
   curl -s -X POST "$GW/api/v1/upload" \
     -H "Authorization: Bearer $API_KEY" -F "image=@/data/file/input.png"
   # 提交图生视频工作流(请求体 prompt 工作流 JSON 不变)
   curl -s -X POST "$GW/api/v1/ai/video/generate" \
     -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
     -d '{"prompt":{...}}'
   # 轮询队列
   curl -s "$GW/api/v1/ai/queue" -H "Authorization: Bearer $API_KEY"
   # 下载视频
   curl -s "$GW/api/v1/ai/image/view/?filename=video/output.mp4&type=output" \
     -H "Authorization: Bearer $API_KEY" -o /data/file/output.mp4
   ```

---

### 3. contract-review（dify-contract-review）

1. **技能名称**：contract-review（dify-contract-review）
   **技能作用**：调用Dify工作流审核合同风险

2. **运行方式**：调用API

3. **API详情**（仅当为"调用API"时填写）：
   - 原调用网络环境：内网
   - 原调用的接口地址（URL）：`http://192.168.1.236/v1`
   - 原调用流程说明：上传合同文件（POST /files/upload 获取 upload_file_id）→ 运行合同审核工作流（POST /workflows/run，Bearer 鉴权，超时 1800s）→ 解析返回 outputs → 保存审核报告

   【修改方案】
   - 修改原因：内网 192.168.1.236 不可用，Dify 改走外网网关 ai.ospreyai.cn
   - 目标环境：切换至外网 API 网关 `https://ai.ospreyai.cn`
   - 具体实现操作：
     ① 配置网关 key `sk-xxx` 与 Dify 后端 token（原 `app-xxx`）
     ② 优先验证网关是否透传 `POST /v1/workflows/run`：若透传则仅替换地址+加双 token（最小改动）
     ③ 若网关未透传 workflows/run，则在 Dify 内将"工作流型"应用改发布为"对话型/chatflow"，改调 `POST /api/v1/ai/workflow/chat-messages`
     ④ 鉴权头：网关 `Authorization: Bearer sk-xxx` + 后端 `X-Authorization: Bearer app-xxx`（网关自动转为后端 Authorization）
     ⑤ 保留 timeout=1800 与结果落盘逻辑
   - 注意事项：网关文档仅列出 Dify 的 chat-messages，未明确 workflows/run 是否透传，需实测确认；chatflow 改造会改变入参结构（inputs/file → query），合同审核依赖文件输入，改造量中等；限流 10 次/分/IP 易触发 429，长合同需重试

4. **原技能需修改的代码（关键部分）**

   【修改前代码】
   ```python
   BASE_URL = "http://192.168.1.236/v1"
   API_KEY  = "app-CMEOoWabwlsqPUWtYwFXlsO8"
   HEADERS  = {"Authorization": f"Bearer {API_KEY}"}

   # 上传合同文件
   resp = requests.post(f"{BASE_URL}/files/upload", headers=HEADERS,
       files={"file": (file_path, f, "application/octet-stream")},
       data={"user": "contract-reviewer"})
   file_id = resp.json()["id"]

   # 运行合同审核工作流
   resp = requests.post(f"{BASE_URL}/workflows/run",
       headers={**HEADERS, "Content-Type": "application/json"},
       json={"inputs": {"ContractFile": {"transfer_method": "local_file",
              "upload_file_id": file_id, "type": "document"}},
             "response_mode": "blocking", "user": "contract-reviewer"},
       timeout=1800)
   outputs = resp.json()["data"]["outputs"]
   ```

   【修改后代码】（按网关透传 workflows/run 的最小改动；若不透传见注意事项改 chatflow）
   ```python
   GW            = "https://ai.ospreyai.cn"
   GATEWAY_KEY   = "sk-xxx"                          # 网关 new-api key
   DIFY_TOKEN    = "app-CMEOoWabwlsqPUWtYwFXlsO8"    # Dify 后端 token
   HEADERS = {
       "Authorization":   f"Bearer {GATEWAY_KEY}",    # 网关鉴权
       "X-Authorization": f"Bearer {DIFY_TOKEN}",    # 后端鉴权(网关转 Authorization)
   }

   # 上传合同文件(走网关)
   resp = requests.post(f"{GW}/v1/files/upload", headers=HEADERS,
       files={"file": (file_path, f, "application/octet-stream")},
       data={"user": "contract-reviewer"})
   file_id = resp.json()["id"]

   # 运行合同审核工作流(走网关,超时不变)
   resp = requests.post(f"{GW}/v1/workflows/run",
       headers={**HEADERS, "Content-Type": "application/json"},
       json={"inputs": {"ContractFile": {"transfer_method": "local_file",
              "upload_file_id": file_id, "type": "document"}},
             "response_mode": "blocking", "user": "contract-reviewer"},
       timeout=1800)
   outputs = resp.json()["data"]["outputs"]
   ```

---

### 4. invoice-ocr（dify-invoice-ocr）

1. **技能名称**：invoice-ocr（dify-invoice-ocr）
   **技能作用**：Dify批量识别发票并导出CSV

2. **运行方式**：调用API

3. **API详情**（仅当为"调用API"时填写）：
   - 原调用网络环境：内网
   - 原调用的接口地址（URL）：`http://192.168.1.236/v1`
   - 原调用流程说明：上传 PDF/图片发票 → 调用 Dify 识别 API（Bearer 鉴权）→ 输出 MD/JSON/CSV 结果

   【修改方案】
   - 修改原因：内网 192.168.1.236 不可用，Dify 发票识别改走外网网关
   - 目标环境：切换至外网 API 网关 `https://ai.ospreyai.cn`
   - 具体实现操作：
     ① 修改 `scripts/dify_invoice.py` 中的配置：`DIFY_BASE_URL` 改为网关地址
     ② 鉴权改为网关 `Authorization: Bearer sk-xxx` + 后端 `X-Authorization: Bearer app-xxx`
     ③ 优先验证网关是否透传 `/v1/workflows/run`；不透传则把发票识别 Dify 应用改为 chatflow，改调 `/api/v1/ai/workflow/chat-messages`
     ④ 批量循环中加入限流退避（10 次/分），避免 429
     ⑤ 输出落盘逻辑（result/md、result/json、result/invoices.csv）保持不变
   - 注意事项：批量发票易触发限流，需串行+退避；chatflow 改造会改变入参结构；网关是否透传 workflows/run 需实测确认

4. **原技能需修改的代码（关键部分）**

   【修改前代码】
   ```python
   # scripts/dify_invoice.py 配置段
   DIFY_BASE_URL = "http://192.168.1.236/v1"   # Dify 服务器地址
   AUTH_TOKEN    = "your-api-key"               # API Key
   USER          = "invoice-bot"

   headers = {"Authorization": f"Bearer {AUTH_TOKEN}"}
   resp = requests.post(f"{DIFY_BASE_URL}/workflows/run",
       headers={**headers, "Content-Type": "application/json"},
       json={"inputs": {...}, "response_mode": "blocking", "user": USER})
   ```

   【修改后代码】
   ```python
   # scripts/dify_invoice.py 配置段
   DIFY_BASE_URL = "https://ai.ospreyai.cn/v1"  # 改为外网网关
   GATEWAY_KEY   = "sk-xxx"                      # 网关 new-api key
   DIFY_TOKEN    = "your-app-key"                # Dify 后端 token
   USER          = "invoice-bot"

   headers = {
       "Authorization":   f"Bearer {GATEWAY_KEY}",   # 网关鉴权
       "X-Authorization": f"Bearer {DIFY_TOKEN}",    # 后端鉴权
   }
   resp = requests.post(f"{DIFY_BASE_URL}/workflows/run",
       headers={**headers, "Content-Type": "application/json"},
       json={"inputs": {...}, "response_mode": "blocking", "user": USER})
   # 若网关不透传 workflows/run: 改用 POST /api/v1/ai/workflow/chat-messages(chatflow)
   ```

---

### 5. ragflow-knowledge-qa

1. **技能名称**：ragflow-knowledge-qa
   **技能作用**：RAGFlow企业知识库问答检索

2. **运行方式**：调用API

3. **API详情**（仅当为"调用API"时填写）：
   - 原调用网络环境：内网
   - 原调用的接口地址（URL）：`http://192.168.150.202:1280`
   - 原调用流程说明：POST /api/v1/datasets/{知识库ID}/chunks（Bearer 鉴权）→ 解析返回 chunk.content → 基于检索内容回答用户问题

   【修改方案】
   - 修改原因：内网 192.168.150.202 不可用，RAGFlow 知识库改走外网网关
   - 目标环境：切换至外网 API 网关 `https://ai.ospreyai.cn`
   - 具体实现操作：
     ① 配置网关 key `sk-xxx` 与 RAGFlow 后端 token（原 `ragflow-xxx`）
     ② 检索接口由 `/api/v1/datasets/{id}/chunks` 改为网关 `POST /api/v1/rag/chats`
     ③ 鉴权头：网关 `Authorization: Bearer sk-xxx` + 后端 `X-Authorization: Bearer ragflow-xxx`
     ④ 请求体改传 `question` + `dataset_ids`（替代原 document_ids/chunks 直接取切片）
     ⑤ 解析返回的生成回答；若需纯切片原文，改用 `bge-m3`（POST /api/v1/embed/embeddings）+ 本地向量库自建检索
   - 注意事项：网关 `/rag/chats` 返回的是"检索+生成"的回答，非原始 chunk 切片，行为与原纯检索不同；若下游依赖 chunk 原文需改走 embedding 自建方案

4. **原技能需修改的代码（关键部分）**

   【修改前代码】
   ```bash
   curl -s -X POST "http://192.168.150.202:1280/api/v1/datasets/e8192f4e03cc11f1b8700ed4340b7097/chunks" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ragflow-IwNmU1NDBjYTY2NDExZjA5MWZkM2FkND" \
     -d '{"question":"用户问题","document_ids":[],"top_k":5}'
   ```

   【修改后代码】
   ```bash
   export GW="https://ai.ospreyai.cn"
   export API_KEY="sk-xxx"
   export RAGFLOW_TOKEN="ragflow-IwNmU1NDBjYTY2NDExZjA5MWZkM2FkND"
   # 走网关 RAG 问答(检索+生成)
   curl -s -X POST "$GW/api/v1/rag/chats" \
     -H "Authorization: Bearer $API_KEY" \
     -H "X-Authorization: Bearer $RAGFLOW_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"question":"用户问题","dataset_ids":["e8192f4e03cc11f1b8700ed4340b7097"],"top_k":5}'
   # 若需纯切片原文:改用 POST $GW/api/v1/embed/embeddings + 本地向量库自建检索
   ```

---

## 二、不受内网影响、保持原状的技能（20 个）

> 以下技能调用的是外网服务或纯本地运行，内网不可用不影响其使用，无需修改方案。

### 6. list-models
1. **技能名称**：list-models
   **技能作用**：查询并配置供应商可用模型
2. **运行方式**：调用API
3. **API详情**（仅当为"调用API"时填写）：
   - 原调用网络环境：外网 / 内网（随供应商 baseUrl 配置）
   - 原调用的接口地址（URL）：`<供应商baseUrl>/models`（如 `https://mini-tokens.ospreyai.cn/api/OspreyAi/RequestModel/v1/models`）
   - 原调用流程说明：读取配置获取 baseUrl 与 apiKey → GET /models（Bearer 鉴权）→ 解析返回模型列表 → 对比已配置模型并可写入配置

### 7. mail
1. **技能名称**：mail
   **技能作用**：通过SMTP/IMAP收发邮件
2. **运行方式**：调用API（邮件服务器协议）
3. **API详情**（仅当为"调用API"时填写）：
   - 原调用网络环境：外网
   - 原调用的接口地址（URL）：阿里企业邮箱 SMTP `smtp.qiye.aliyun.com:465` / IMAP `imap.qiye.aliyun.com:993`；腾讯企业邮箱 SMTP `smtp.exmail.qq.com:465` / IMAP `imap.exmail.qq.com:993`
   - 原调用流程说明：问答引导配置邮箱 → SMTP 鉴权发送邮件 / IMAP 鉴权接收邮件

### 8. vision-ocr
1. **技能名称**：vision-ocr
   **技能作用**：视觉大模型图片OCR文字识别
2. **运行方式**：调用API
3. **API详情**（仅当为"调用API"时填写）：
   - 原调用网络环境：外网（ospreyai 视觉模型）
   - 原调用的接口地址（URL）：ospreyai 视觉模型端点（由 OpenClaw 配置/环境变量自动获取）
   - 原调用流程说明：脚本调用视觉 LLM API（自动获取 API Key，默认模型 qwen3-vl-30b）→ 识别图片返回纯文本 → 可选保存为 .md/.txt

### 9. whisper-transcribe
1. **技能名称**：whisper-transcribe
   **技能作用**：音频转录文本并生成会议纪要
2. **运行方式**：调用API
3. **API详情**（仅当为"调用API"时填写）：
   - 原调用网络环境：外网
   - 原调用的接口地址（URL）：`https://mini-tokens.ospreyai.cn/v1/audio/transcriptions`
   - 原调用流程说明：POST 音频文件（Bearer 鉴权，model=whisper-1）→ 返回转录文本 → 校对并生成结构化会议纪要

### 10. md-to-pdf
1. **技能名称**：md-to-pdf
   **技能作用**：Markdown文档转换为PDF
2. **运行方式**：本地运行

### 11. minimax-docx
1. **技能名称**：minimax-docx
   **技能作用**：创建编辑排版Word文档
2. **运行方式**：本地运行

### 12. minimax-pdf
1. **技能名称**：minimax-pdf
   **技能作用**：高质量PDF生成填充重排
2. **运行方式**：本地运行

### 13. minimax-xlsx
1. **技能名称**：minimax-xlsx
   **技能作用**：Excel读取创建编辑与校验
2. **运行方式**：本地运行

### 14. model-price-updater
1. **技能名称**：model-price-updater
   **技能作用**：更新配置中的模型价格
2. **运行方式**：本地运行

### 15. openclaw-dingtalk-channel
1. **技能名称**：openclaw-dingtalk-channel
   **技能作用**：安装配置钉钉渠道接入
2. **运行方式**：本地运行

### 16. openclaw-feishu-plugin
1. **技能名称**：openclaw-feishu-plugin
   **技能作用**：安装配置飞书渠道接入
2. **运行方式**：本地运行

### 17. openclaw-qq-channel
1. **技能名称**：openclaw-qq-channel
   **技能作用**：接入QQ机器人渠道
2. **运行方式**：本地运行

### 18. openclaw-ui-customization
1. **技能名称**：openclaw-ui-customization
   **技能作用**：定制控制台UI品牌元素
2. **运行方式**：本地运行

### 19. openclaw-wecom-channel
1. **技能名称**：openclaw-wecom-channel
   **技能作用**：接入企业微信机器人渠道
2. **运行方式**：本地运行

### 20. pptx-generator
1. **技能名称**：pptx-generator
   **技能作用**：生成编辑读取PPT演示文稿
2. **运行方式**：本地运行

### 21. problem-solving-debug
1. **技能名称**：problem-solving-debug
   **技能作用**：系统性问题排查与根因分析
2. **运行方式**：本地运行

### 22. self-improving-agent
1. **技能名称**：self-improving-agent
   **技能作用**：记录学习错误修正持续自改进
2. **运行方式**：本地运行

### 23. skill-expansion
1. **技能名称**：skill-expansion
   **技能作用**：技能扩充规则与来源优先级
2. **运行方式**：本地运行

### 24. user-initialization
1. **技能名称**：user-initialization
   **技能作用**：首次使用初始化目录与技能
2. **运行方式**：本地运行

### 25. workdir-initialization
1. **技能名称**：workdir-initialization
   **技能作用**：初始化用户与系统工作目录
2. **运行方式**：本地运行

---

## 三、汇总

| 分类 | 数量 | 技能 |
|------|------|------|
| 内网API → 外网网关迁移 | 5 | comfyui-image-generation、comfyui-video-generation、contract-review、invoice-ocr、ragflow-knowledge-qa |
| 外网API（不变） | 4 | list-models、mail、vision-ocr、whisper-transcribe |
| 本地运行（不变） | 16 | md-to-pdf、minimax-docx、minimax-pdf、minimax-xlsx、model-price-updater、openclaw-dingtalk-channel、openclaw-feishu-plugin、openclaw-qq-channel、openclaw-ui-customization、openclaw-wecom-channel、pptx-generator、problem-solving-debug、self-improving-agent、skill-expansion、user-initialization、workdir-initialization |
| 合计 | 25 | — |

> 迁移可行性：ComfyUI 两个技能可近乎无损平移（接口对齐，先做验证）；RAGFlow 行为略变（检索→检索+生成，或改 embedding 自建）；Dify 两个技能需先确认网关是否透传 `/v1/workflows/run`，否则要把 Dify 应用从"工作流型"改为"对话型/chatflow"。

---

## 四、按计费情况分类

> 按**是否消耗付费的 AI 推理/生成资源**重新分类。计费指调用 LLM/Vision/语音/图像生成等推理接口、按次或按量计费；不计费指本地运行或仅做元数据查询/协议通信，不触发推理。编号沿用上文技能序号。

### 计费技能（7 个）

调用 AI 推理接口，按次/按量计费：

| 序号 | 技能 | 计费来源 |
|------|------|----------|
| 1 | comfyui-image-generation | 网关 ComfyUI 文生图（GPU 算力） |
| 2 | comfyui-video-generation | 网关 ComfyUI 图生视频（GPU，消耗更大） |
| 3 | contract-review | 网关 Dify 工作流（LLM 调用） |
| 4 | invoice-ocr | 网关 Dify 发票识别（Vision/LLM） |
| 5 | ragflow-knowledge-qa | 网关 RAGFlow 检索+生成（LLM） |
| 8 | vision-ocr | ospreyai 视觉大模型（Vision LLM） |
| 9 | whisper-transcribe | ospreyai Whisper 音频转录 |

### 不计费技能（18 个）

本地运行，或仅查询/协议通信，不消耗推理资源：

**查询/协议类（2 个）**

| 序号 | 技能 | 说明 |
|------|------|------|
| 6 | list-models | `GET /models` 元数据查询，不触发推理 |
| 7 | mail | SMTP/IMAP 邮箱协议，包年包月不按次计费 |

**本地运行类（16 个）**

| 序号 | 技能 | 序号 | 技能 |
|------|------|------|------|
| 10 | md-to-pdf | 18 | openclaw-ui-customization |
| 11 | minimax-docx | 19 | openclaw-wecom-channel |
| 12 | minimax-pdf | 20 | pptx-generator |
| 13 | minimax-xlsx | 21 | problem-solving-debug |
| 14 | model-price-updater | 22 | self-improving-agent |
| 15 | openclaw-dingtalk-channel | 23 | skill-expansion |
| 16 | openclaw-feishu-plugin | 24 | user-initialization |
| 17 | openclaw-qq-channel | 25 | workdir-initialization |

| 分类 | 数量 | 技能序号 |
|------|------|----------|
| 计费 | 7 | 1、2、3、4、5、8、9 |
| 不计费 | 18 | 6、7、10–25 |
| 合计 | 25 | — |

> 备注：
> 1. **minimax-docx / minimax-pdf / minimax-xlsx**：上文标注"本地运行"故归为不计费，但名称含 minimax。若实际是调用 MiniMax 文档生成 API 而非本地库实现，则应移入计费类，需确认其实现方式。
> 2. **list-models**：`/models` 接口一般不计费，但少数网关会对元数据请求也计费，视供应商策略而定。
