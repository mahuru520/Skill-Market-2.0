# 架构：memory_search 全链路解析

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Gateway 进程                          │
│                                                         │
│  memory plugin                                          │
│  ├── chunker: 文件 → 200-500字/块                        │
│  ├── embedder: HTTP → ospreyai bge_m3                   │
│  ├── indexer:  → sqlite-vec (vec0.dll)                  │
│  └── searcher: query → ANN → ranking                    │
│                                                         │
│  sqlite-vec 扩展                                        │
│  └── CREATE VIRTUAL TABLE vec0 USING vec0(...)          │
│      (实际表名: chunks_vec，依赖 vec0.dll 加载)           │
│                                                         │
│  dreaming 插件                                          │
│  └── cron 3:00 AM → corpus → diary → candidate → index  │
└─────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
  HTTP POST (147ms)              Session JSONL
  ospreyai bge_m3               session-corpus/
  mini-tokens.ospreyai.cn/v1           YYYY-MM-DD.txt
```

## 向量生命周期

### 阶段 1：索引（写入）

```
文件修改 → dirty tracking
    ↓
dirty 文件列表
    ↓
逐文件 chunk 切分（保留 path/line_start/line_end）
    ↓
查 embedding_cache（用 text hash）
    ├─ 命中 → 直接用缓存向量
    └─ 未命中 → HTTP POST → ospreyai → 写入缓存 + vec 表
    ↓
sqlite-vec HNSW 索引重建（或增量更新）
```

**触发时机**：
- `memory index --force`（手动，全量）
- Gateway 启动，`onSessionStart: true`（增量 dirty）
- 定时 dirty check（自动）
- dreaming 生成新文件 → dirty → 自动 index

### 阶段 2：查询（读出）

```
memory_search tool 被调用
    ↓
config 读取（baseUrl, apiKey, model）
    ↓
query 文本 → HTTP POST → ospreyai bge_m3 → query 向量 (147ms)
    ↓
sqlite-vec HNSW ANN search（本地，无网络）
    ↓
top-K rowids → chunks 表 lookup
    ↓
vectorScore × textScore 加权排序
    ↓
返回 { results: [{path, snippet, score}], debug: {searchMs, hits} }
```

## 关键配置字段

```json
"memorySearch": {
  "enabled": true,          // 开关
  "sources": ["memory"],    // 索引来源（memory 或 custom）
  "provider": "openai",     // 固定 "openai"，非 provider ID
  "model": "bge_m3",        // embedding 模型名
  "remote": {
    "baseUrl": "https://mini-tokens.ospreyai.cn/v1",
    "apiKey": "<key>"
  },
  "sync": {
    "onSearch": false,      // 搜索前 check dirty（默认关）
    "onSessionStart": true  // 启动时 check dirty（默认开）
  }
}
```

## 重要：provider 字段

`provider: "openai"` 不是自定义 provider ID，而是内置 provider 别名。

- `provider: "openai"` 时，gateway 走 `memorySearch.remote` override 路径
- **不要**在 `models.providers` 下创建同名配置，会冲突
- `api` 字段只支持 `openai-completions`，不支持 `openai`（会在 `memorySearch.remote` 上报 invalid option）

## 索引重建注意事项

1. `memory index --force` 需要独占 DB 锁，gateway 运行时会 EBUSY
2. 解决方案：kill gateway → reindex → 重启，或用 gateway 进程 kill 后快速抢跑
3. 物理重启比热重载（SIGUSR1）更可靠：plugin 实例缓存问题需要进程重启

## memory_search vs QMD

| | builtin memory_search | QMD |
|---|---|---|
| 向量引擎 | sqlite-vec | QMD 自管 |
| Embedding | ospreyai 远程 API | 本地 GGUF（需下载） |
| 配置复杂度 | 低（1处 config） | 高（改源码） |
| 代码文件索引 | ❌ 仅 .md | ✅ AST 分块 |
| 集成度 | OpenClaw 原生 | sidecar，平行运行 |

建议：只用 .md 记忆 → builtin memory_search。代码语义搜索 → QMD。
