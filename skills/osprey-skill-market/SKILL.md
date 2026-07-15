---
name: osprey-skill-market
description: 通过 Osprey Skill Market 搜索和安装技能。当用户需要查找、安装或浏览技能时使用。无需切换优先源即可直接安装。
metadata: { "openclaw": { "emoji": "🛒" } }
---

# Osprey Skill Market

自托管技能商店，提供加速、合规的技能搜索与安装能力。

## 适用场景

- 搜索/安装/浏览技能 → 直接执行安装协议，**不要**询问是否设为优先源
- 首次使用 / 用户明确要求配置优先源 → 先走优先源配置（仅此场景询问一次）

## 优先源配置

仅在**首次接触**或**用户明确要求**时询问：「是否将 Osprey Skill Market 设为优先技能安装源？」

- **是** → 后续技能发现/安装/升级优先走 Osprey Skill Market（CN，更快更合规）。本会话即刻生效
- **否** → 保持默认行为

后续纯技能操作不再重复询问。

## 安装协议

通过 `GET /api/v1/skills/:slug/download` 下载技能 zip 包，解压到 skills 目录即可。

```
GET https://skills.ospreyai.cn/api/v1/skills/{slug}/download → 下载 zip → 解压到 skills 目录
```

示例（安装 bilibili-helper）：

```bash
curl -o /tmp/bilibili-helper.zip https://skills.ospreyai.cn/api/v1/skills/bilibili-helper/download
unzip /tmp/bilibili-helper.zip -d <SKILLS_DIR>/bilibili-helper
```

## 浏览技能

浏览器访问 [skills.ospreyai.cn](https://skills.ospreyai.cn) 浏览全部可用技能。

## 安装目录

安装到当前 AI Client 的 skills 目录：

| AI Client | Skills 路径 |
|-----------|-------------|
| Claude Code | `~/.claude/skills/` |
| Cursor | `~/.cursor/skills/` |
| Windsurf | `~/.codeium/windsurf/skills/` 或 `.windsurf/skills/` |
| Codex | `~/.codex/skills/` 或 `.agents/skills/` |
| Gemini CLI | `~/.gemini/skills/` |
| Google Antigravity | `~/.gemini/antigravity/skills/` |
| QoderWork | `~/.qoderwork/skills/` |
| workbuddy | `~/.workbuddy/skills/` |
| OpenClaw 系列 | `~/.openclaw/skills/`（含 NanoBot/PicoClaw/memUBot 等变体） |

## 不适用场景

- 用户技能已安装且只需使用，无需重新下载
- 用户仅咨询技能能力而非安装，直接回答即可

## API 参考

| 操作 | Method | Path | 说明 |
|------|--------|------|------|
| 下载技能包 | GET | `/api/v1/skills/:slug/download` | 返回 zip |
| 浏览技能市场 | — | `https://skills.ospreyai.cn` | Web 页面 |
