---
name: ragflow-knowledge-qa
description: 通过公网网关调用 RAGFlow 企业知识库进行问答检索。当用户询问知识库相关内容、方案细节、产品信息时使用此技能。触发词：知识库问答、知识库检索、问答、查一下这个方案。
---

# RAGFlow 知识库问答

通过公网网关 `https://ai.ospreyai.cn` 调用 RAGFlow 企业知识库检索并回答问题。

## 鉴权（双 Token）

所有请求必须同时携带两个鉴权头，缺一不可：

- `Authorization: Bearer $API_KEY` — 网关层鉴权（new-api key，形如 `sk-xxx`）
- `X-Authorization: Bearer $RAGFLOW_TOKEN` — 后端 RAGFlow 鉴权（RAGFlow API Key，形如 `ragflow-xxx`，在 RAGFlow Web 界面生成）

```bash
export GW="https://ai.ospreyai.cn"
export API_KEY="sk-your-api-key"
export RAGFLOW_TOKEN="ragflow-xxxxxx"
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `GW` | 网关地址，固定 `https://ai.ospreyai.cn` |
| `API_KEY` | 网关 new-api key |
| `RAGFLOW_TOKEN` | RAGFlow 后端 API Key |
| `DATASET_ID` | 目标知识库 ID（通过下方接口查询获取） |

## 查询知识库列表

获取可用知识库及其 ID：

```bash
curl -s -H "Authorization: Bearer $API_KEY" \
  -H "X-Authorization: Bearer $RAGFLOW_TOKEN" \
  "$GW/api/v1/rag/datasets"
```

响应中每个知识库含 `id`、`name`、`document_count` 等字段，取目标库的 `id` 作为 `DATASET_ID`。

## 检索 API（推荐，返回原文切片）

```bash
curl -s -X POST "$GW/api/v1/rag/retrieval" \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Authorization: Bearer $RAGFLOW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "用户问题",
    "dataset_ids": ["'$DATASET_ID'"]
  }'
```

返回 `data.chunks` 数组，每个 chunk 含 `content`（原文切片）、`document_name`、`similarity` 等字段。

## 执行步骤

1. 提取用户问题
2. 调用 `/api/v1/rag/retrieval` 检索（`dataset_ids` 填目标知识库 ID）
3. 解析返回结果，提取 `chunk.content`
4. 基于检索内容回答用户问题
5. 可选：标注参考文档来源（`document_name`）

## 检索 + 生成 API（可选）

如需网关直接返回生成答案（而非仅返回切片原文），可调用：

```bash
curl -s -X POST "$GW/api/v1/rag/chats" \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Authorization: Bearer $RAGFLOW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "session-xxx",
    "question": "用户问题",
    "dataset_ids": ["'$DATASET_ID'"]
  }'
```

> 注意：`chats` 接口需提供唯一 `name`（会话名，重复会报 `Duplicated chat name`）；同步返回的 `answer` 可能为空，建议优先用 `retrieval` 自行组织回答。
