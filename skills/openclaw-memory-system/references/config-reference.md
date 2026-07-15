# 完整配置参考

## openclaw.json 记忆系统相关配置

### memorySearch（必须）

```json
"agents": {
  "defaults": {
    "memorySearch": {
      "enabled": true,
      "sources": ["memory"],
      "provider": "openai",
      "model": "bge_m3",
      "remote": {
        "baseUrl": "https://mini-tokens.ospreyai.cn/v1",
        "apiKey": "<ospreyai API key>"
      },
      "sync": {
        "onSearch": false,
        "onSessionStart": true
      }
    }
  }
}
```

### memory backend

```json
"memory": {
  "backend": "builtin",
  "citations": "on"
}
```

### dreaming

```json
"plugins": {
  "entries": {
    "memory-core": {
      "config": {
        "dreaming": {
          "enabled": true,
          "schedule": "0 3 * * *",
          "limit": 10,
          "minScore": 0.8,
          "minRecallCount": 3,
          "minUniqueQueries": 3,
          "recencyHalfLifeDays": 14,
          "maxAgeDays": 30
        }
      },
      "enabled": true
    }
  }
}
```

## 对话式配置（用 gateway config 命令）

```bash
# 查看当前配置
openclaw gateway config.get agents.defaults.memorySearch

# 查看 memory 状态
openclaw memory status --deep

# 触发 reindex
openclaw memory index --agent main --force

# 测试向量搜索（tool 层）
memory_search({ query: "测试内容" })
```

## 关键路径

| 资源 | 路径 |
|------|------|
| 配置文件 | `$OPENCLAW_HOME/.openclaw/openclaw.json` |
| 向量 DB | `$OPENCLAW_HOME/.openclaw/memory/main.sqlite` |
| vec 扩展 | `$OPENCLAW_CORE/node_modules/sqlite-vec-windows-x64/vec0.dll` |
| Workspace | `$OPENCLAW_HOME/.openclaw/workspace/` |
| 记忆文件 | `workspace/memory/` |
| Session corpus | `workspace/memory/.dreams/session-corpus/` |
| 画像文件 | `workspace/HONCHO.md` |
| 心跳配置 | `workspace/HEARTBEAT.md` |

## cron 表达式

| 表达式 | 含义 |
|--------|------|
| `0 3 * * *` | 每天 3:00 AM（dreaming） |
| `*/30 * * * *` | 每 30 分钟（heartbeat） |

时区：`Asia/Shanghai`（config 或 cron expr 中指定 `tz: "Asia/Shanghai"`）。

## 文件权限

```
workspace/
├── HONCHO.md       - 画像（Heartbeat 迭代）
├── HEARTBEAT.md    - 心跳任务清单
├── DREAMS.md       - 诗化日记（dreaming 自动写）
├── MEMORY.md       - 长期记忆（deep sleep promotion）
└── memory/
    ├── YYYY-MM-DD.md        - 每日日记（每次 session 后手写）
    └── dreaming/
        ├── light/           - 候选记忆
        ├── rem/             - 主题反射
        ├── deep/            - 高置信度记忆
        └── session-corpus/  - session 原文
```
