# Dreaming 梦境系统

## 是什么

每天自动从 session 对话中提取关键事件、主题规律，生成候选记忆并向量化入库。模仿人类睡眠时巩固记忆的过程。

## 处理流程

```
每天 3:00 AM（cron "0 3 * * *"）
    ↓
读取 session JSONL 文件
    ↓
session-corpus/YYYY-MM-DD.txt（每晚 3:00 写入）
    ↓
┌─ Light Sleep: 候选记忆提取
│   ├─ 按主题聚合对话片段
│   ├─ confidence: 0.58~0.62（边界）
│   └─ 标记 staged → 等待后续提升
│
├─ REM Sleep: 主题反射
│   ├─ 跨记忆的主题词频率分析
│   ├─ "user 出现 N 次" 等元模式
│   └─ confidence: 0.80~1.00（高置信）
│
└─ Deep Sleep: 持久真理提炼
    ├─ 高置信度候选 → promotion
    └─ 直接写入 MEMORY.md
```

## 产物

| 文件 | 位置 | 内容 |
|------|------|------|
| `session-corpus/YYYY-MM-DD.txt` | `workspace/memory/.dreams/` | 当天对话原文提取 |
| `memory/dreaming/light/YYYY-MM-DD.md` | `workspace/memory/dreaming/light/` | 候选记忆列表 |
| `memory/dreaming/rem/YYYY-MM-DD.md` | `workspace/memory/dreaming/rem/` | 主题反射 |
| `memory/dreaming/deep/YYYY-MM-DD.md` | `workspace/memory/dreaming/deep/` | 高置信度记忆 |
| `DREAMS.md` | `workspace/` | 诗化日记（可关闭） |

## 配置

在 `plugins.entries.memory-core.config` 下：

```json
"dreaming": {
  "enabled": true,
  "schedule": "0 3 * * *",
  "limit": 10,                  // 每晚最多处理候选数
  "minScore": 0.8,              // promotion 最低置信度
  "minRecallCount": 3,          // 最小召回次数才可 promotion
  "minUniqueQueries": 3,        // 最小不同查询数
  "recencyHalfLifeDays": 14,    // 新记忆权重衰减半衰期
  "maxAgeDays": 30              // 最长保留旧记忆天数
}
```

## 关键机制

### Candidate（候选记忆）
- 由 Light Sleep 从 session corpus 提取
- 包含：主题、confidence、evidence 引用（来源文件和行号）、recalls 计数
- 状态：`staged` → 等待 REM 处理或 promotion

### Promotion（提升）
- Deep Sleep 将高置信度候选写入 `MEMORY.md`
- `minScore: 0.8` 以上才 promotion
- 写入后 candidates 清空

### Recall Store（召回存储）
- 追踪每个候选的记忆强度
- `spaced repetition`：基于 recencyHalfLifeDays 衰减
- 长期未召回的候选自动降级

## 手动触发

```bash
# 手动运行 dreaming（测试用）
openclaw dream
```

## 查看当前状态

```bash
openclaw memory status --deep
# Dreaming: 0 3 * * * · limit=10 · minScore=0.8 · ...
# Dream corpus: .../memory/.dreams/session-corpus
# Dream diary present: yes/no
```

## 关闭 dreaming

```json
"dreaming": {
  "enabled": false
}
```

注意：关闭后 session corpus 仍写入（由 cron 控制），但不会生成 dreaming diary。

## 诗化日记（DREAMS.md）

每晚生成的诗化文本，记录当天记忆处理过程和内心独白。可读性强，但占用 token。关闭方式：在 `dreaming` 配置中无相关选项，实际由 `dreamingDiary` 字段控制（需查源码确认）。

当前 pooki 的配置下已开启，每天自动写入。
