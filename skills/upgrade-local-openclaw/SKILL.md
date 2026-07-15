---
name: upgrade-local-openclaw
description: "升级网关 / 升级 OpenClaw 的标准技能。触发条件：(1) 用户说‘升级网关’、‘升级 OpenClaw’、‘更新 gateway’；(2) 用户希望优先升级当前项目目录中的本地 openclaw，而不是系统全局版本；(3) 需要判断应该升级本地依赖还是全局安装。默认策略：优先升级当前工作目录 app/core 下的本地 openclaw，仅当用户明确要求‘全局升级’、‘系统版本升级’时才处理全局安装。"
metadata: { "openclaw": { "emoji": "🦞" } }
---

# 升级本地 OpenClaw / 网关技能

## 目标

当用户要求“升级网关”或“升级 OpenClaw”时，默认执行：

1. **优先升级当前工作目录中的本地版本**
2. **不要默认升级系统全局版本**
3. 升级完成后，重启当前目录对应的 Gateway 进程
4. 向用户明确说明升级的是“当前目录版本”还是“全局版本”

## 默认规则（必须遵守）

### 1) 优先级

当用户说：

- 升级网关
- 升级 OpenClaw
- 更新 gateway
- 更新 OpenClaw 版本

默认理解为：

**升级当前项目目录中的本地 openclaw 依赖版本**，通常是：

```bash
<当前项目>/app/core/node_modules/openclaw
```

而不是：

```bash
/usr/local/lib/node_modules/openclaw
```

### 2) 只有以下情况才允许走全局升级

只有当用户明确提到以下意思时，才升级全局版本：

- 全局升级
- 系统版本升级
- 升级全局 openclaw
- 升级 `/usr/local/lib/node_modules/openclaw`
- 升级机器上所有项目共用的 openclaw

如果用户表述含糊，**默认按本地版本处理**。

### 3) 版本判断原则

判断本地 OpenClaw 版本时，优先读取：

```bash
app/core/node_modules/openclaw/package.json
```

读取其中的 `version` 字段。

**不要把 `VERSION.txt` 当作 openclaw 版本号。**
`VERSION.txt` 属于启动脚本/整包版本，不等于本地 `openclaw` 依赖版本。

## 标准执行流程

## 第一步：确认当前项目目录

优先使用当前工作目录，定位：

```bash
app/core/package.json
app/core/node_modules/openclaw/package.json
```

如果当前目录下没有 `app/core/package.json`，先告诉用户“当前目录不是可直接升级本地 openclaw 的项目目录”，再询问是否切换目录或改为全局升级。

## 第二步：确认本地安装状态

检查：

```bash
app/core/package.json
app/core/node_modules/openclaw/package.json
app/core/pnpm-lock.yaml
app/core/package-lock.json
```

判断：

- 是否存在本地 `openclaw`
- 当前版本是多少
- 当前项目更适合使用 `pnpm` 还是 `npm`

推荐规则：

- 有 `pnpm-lock.yaml` → 优先用 `pnpm`
- 否则有 `package-lock.json` → 用 `npm`
- 都没有时，优先尝试与当前项目已有习惯一致；若无法判断，再明确告知用户

## 第三步：执行本地升级

在当前项目的 `app/core` 目录中执行。

### 方法 A：pnpm（优先）

```bash
cd /path/to/project/app/core
pnpm update openclaw
```

### 方法 B：npm

```bash
cd /path/to/project/app/core
npm update openclaw
```

## 第四步：验证升级结果

优先用以下方式验证：

```bash
cat app/core/node_modules/openclaw/package.json
```

或读取其中的 `version` 字段。

必要时可辅助检查：

```bash
cd /path/to/project/app/core
npm list openclaw
```

## 第五步：重启当前目录对应的网关

如果当前项目的 Gateway 使用的是该目录下的本地 `openclaw`，升级后应重启，让新版本生效。

常见做法：

- 如果项目有自己的配置中心/API：调用项目内的 restart 接口
- 如果由启动脚本托管：写入对应 action 或调用项目脚本提供的重启方式
- 如果由当前进程直接托管：停止后重新启动当前目录下的 gateway

## 给用户的说明模板

执行完后要明确说明：

- 本次升级的是 **当前目录中的本地 openclaw**
- **没有修改系统全局版本**
- 当前本地版本从什么升级到了什么
- 是否已经完成网关重启

示例：

> 已将当前目录 `app/core` 下的本地 openclaw 从 `2026.4.2` 升级到 `2026.4.11`，未修改系统全局版本，并已重启当前项目的 Gateway。

## 全局升级（仅在用户明确要求时）

只有用户明确要求升级全局版本时，才使用以下方式之一：

```bash
npm update -g openclaw
```

或：

```bash
pnpm add -g openclaw@latest
```

执行前必须向用户说明：

- 这会影响机器上的全局 OpenClaw
- 可能影响多个项目
- 不等同于当前目录本地版本升级

## 常见问题

| 问题 | 原因 | 处理方式 |
|------|------|----------|
| 升级后版本没变 | 已经是最新版本 | 明确告诉用户当前目录本地版本已是最新 |
| 升级后网关没变化 | 网关未重启 | 重启当前目录对应的 Gateway |
| 点击升级无反应 | 配置中心还是旧进程 | 重启配置中心并重新加载接口 |
| npm 权限错误 | 缓存目录权限问题 | 优先改用 pnpm；必要时再修复 npm 缓存权限 |
| 用户说“升级网关” | 语义含糊 | 默认按“升级当前目录中的本地 openclaw”处理 |

## 禁止事项

以下行为默认不要做：

- 不要把“升级网关”直接理解成“升级全局 openclaw”
- 不要默认执行 `npm update -g openclaw`
- 不要把 `VERSION.txt` 当作本地 openclaw 版本来源
- 不要在未确认的情况下覆盖整个项目目录
- 不要把“整包升级”和“本地依赖升级”混为一谈

## 验收标准

满足以下条件才算完成：

- 已确认当前目录是否存在 `app/core`
- 已优先尝试升级当前目录中的本地 `openclaw`
- 已明确区分“本地版本”和“全局版本`
- 已通过 `node_modules/openclaw/package.json` 验证版本
- 已根据当前项目运行方式完成网关重启或明确说明未重启原因
