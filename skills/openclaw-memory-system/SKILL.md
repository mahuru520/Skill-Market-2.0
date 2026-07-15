---
name: openclaw-memory-system
description: OpenClaw 记忆系统全套配置技能。包含向量搜索（memory_search）、梦境自动记忆（dreaming）、用户画像（Honcho）三大模块的安装、配置、调优和故障排查。当用户说"配置记忆系统"、"开启梦境"、"设置用户画像"、"配置向量搜索"、"memory_search 不工作"时触发。
---

# OpenClaw 记忆系统

一套完整的记忆系统：向量语义搜索 + 自动化梦境记忆 + 用户行为画像。

## 快速安装（三步）

### Step 1：配置向量 Embedding

在 `openclaw.json` 的 `agents.defaults` 下添加：

```json
"memorySearch": {
  "enabled": true,
  "sources": ["memory"],
  "provider": "openai",
  "model": "bge_m3",
  "sync": {
    "onSearch": false,
    "onSessionStart": true
  },
  "remote": {
    "baseUrl": "https://mini-tokens.ospreyai.cn/v1",
    "apiKey": "<你的 embedding API key>"
  }
}
```

**支持的 Embedding 供应商**（见下方参考列表）

重启 gateway 让 plugin 实例初始化。验证：

```
openclaw memory status --deep
# Embeddings: ready  ✅
```

### Step 2：触发首次索引

```bash
openclaw memory index --agent main --force
```

275 chunks × 1024 维向量，耗时 1-2 分钟。

### Step 3：开启梦境（可选）

在 `plugins.entries.memory-core.config` 下：

```json
"dreaming": {
  "enabled": true,
  "schedule": "0 3 * * *",
  "limit": 10,
  "minScore": 0.8
}
```

## 支持的 Embedding 供应商

任何兼容 OpenAI `/v1/embeddings` 接口的 provider 均可使用。

| 供应商 | baseUrl 示例 | 说明 |
|--------|-------------|------|
| **ospreyai (mini-tokens)** | `https://mini-tokens.ospreyai.cn/v1` | pooki 当前配置 |
| ospreyai (open) | `https://open.ospreyai.cn/v1` | 同供应商，不同端点 |
| OpenAI 官方 | `https://api.openai.com/v1` | 需 OpenAI key |
| Azure OpenAI | `https://<资源>.openai.azure.com/v1` | 需 Azure 配置 |
| Cohere | `https://api.cohere.ai/v1` | 需 Cohere key |
| 本地 Embedding Server | `http://192.168.1.236:20083/v1` | 内网部署的兼容服务 |

更换供应商只需改 `baseUrl` 和 `apiKey`，`provider` 始终为 `"openai"`。

## 支持的 Embedding 模型

模型名通过 `model` 字段指定，需与供应商支持的模型名一致。

常用模型：`bge_m3`、`text-embedding-3-small`、`text-embedding-3-large`、`embed-english-v3.0`

## Reference 文件索引

- **架构**：see [references/architecture.md](references/architecture.md)
- **Embedding 配置与供应商列表**：see [references/embedding-setup.md](references/embedding-setup.md)
- **Dreaming 梦境**：see [references/dreaming.md](references/dreaming.md)
- **Honcho 画像**：see [references/honcho.md](references/honcho.md)
- **完整配置**：see [references/config-reference.md](references/config-reference.md)
