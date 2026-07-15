# Embedding 配置：多供应商接入指南

## 原理

OpenClaw builtin memory 通过 HTTP 调用远程兼容 OpenAI `/v1/embeddings` 接口的 provider。

**任何兼容 OpenAI Embedding API 的服务都可以用**，只需配置 `baseUrl` 和 `apiKey`，`provider` 始终为 `"openai"`（内置别名，非自定义 ID）。

## 支持的供应商

### ospreyai（当前推荐）

| 端点 | baseUrl | 模型 |
|------|---------|------|
| mini-tokens（默认） | `https://mini-tokens.ospreyai.cn/v1` | `bge_m3` |
| open | `https://open.ospreyai.cn/v1` | `bge_m3` |
| 内网测试 | `http://192.168.1.236:20083/v1` | `bge_m3` |

### OpenAI 官方

```json
"remote": {
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-..."
}
```
模型：`text-embedding-3-small`（1536 dims）或 `text-embedding-3-large`（3072 dims）

### Azure OpenAI

```json
"remote": {
  "baseUrl": "https://<your-resource>.openai.azure.com/v1",
  "apiKey": "<your-key>"
}
```
注意：Azure 可能需要额外 header `api-version: 2024-02-01`，如有报错需查 Azure 文档。

### Cohere

```json
"remote": {
  "baseUrl": "https://api.cohere.ai/v1",
  "apiKey": "<your-key>"
}
```
模型：`embed-english-v3.0` 或 `embed-multilingual-v3.0`

### 本地 Embedding Server

任何跑着兼容 OpenAI 接口的 embedding 服务（如 text-embedding-inference、LocalAI 等）都可以：

```json
"remote": {
  "baseUrl": "http://192.168.1.100:8080/v1",
  "apiKey": "not-needed"
}
```

## 接入步骤（通用）

### 1. 确认 API 可用

```bash
curl -X POST <baseUrl>/embeddings \
  -H "Authorization: Bearer <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{"model":"<model>","input":"测试"}'
```

期望：返回 200，`data[0].embedding` 长度为你期望的维度数（bge_m3 是 1024）。

### 2. 修改 openclaw.json

在 `agents.defaults` 下添加（不在 `models.providers` 下！）：

```json
"memorySearch": {
  "enabled": true,
  "provider": "openai",
  "model": "<模型名>",
  "remote": {
    "baseUrl": "<baseUrl>",
    "apiKey": "<apiKey>"
  }
}
```

**关键**：`provider` 必须是 `"openai"`，不能是其他值。

### 3. 物理重启 Gateway

热重载（SIGUSR1）不更新 plugin 实例缓存，必须物理重启：

```bash
# Windows
taskkill /F /IM node.exe
Start-Sleep 3
openclaw gateway start
```

### 4. 验证

```bash
openclaw memory status --deep
# Embeddings: ready ✅
```

### 5. 触发索引

```bash
openclaw memory index --agent main --force
```

## embedding_cache

同段文本不会重复请求 API，结果缓存到 `embedding_cache` 表，key 为文本内容 hash。更换供应商后需要 `--force` 重建索引。

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| Embeddings: not ready | plugin 缓存旧 URL | 物理重启 gateway |
| hits: 0 | 向量是旧 provider 建 | `memory index --force` |
| 429 rate limit | API 限速 | 等一会，或加 backoff |
| invalid option | provider 值不对 | 必须是 `"openai"` |
| 维度不匹配 | 模型换了 | `--force` reindex |
