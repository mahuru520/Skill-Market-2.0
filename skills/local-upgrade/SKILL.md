---
name: local-upgrade
description: 升级本地项目目录中的 OpenClaw 网关（非全局安装）。当用户要求升级当前项目目录的网关、升级本地 openclaw、或升级非全局网关时使用。注意：不是升级系统全局安装的 OpenClaw。
---

# 本地网关升级

本技能用于升级当前项目目录中通过 npm 安装的 OpenClaw 网关。

## 适用场景

- 用户说"升级本地网关"、"升级当前项目的 openclaw"
- 用户说"升级非全局网关"
- 当前网关是通过 `npm install openclaw` 安装的（非 git clone）

## 升级步骤

### 1. 检查当前版本和最新版本

```bash
npm view openclaw version
```

在项目目录执行：
```bash
cd <项目目录>/app/core
npm view openclaw version
```

### 2. 停止运行中的网关

使用 gateway 工具重启网关（会停止当前进程）：
```json
{
  "action": "restart",
  "note": "停止网关以便升级"
}
```

如果重启不起作用，手动杀掉 node 进程：
```bash
powershell -Command "Get-Process | Where-Object {\$_.Name -like '*node*'} | Select-Object Id,ProcessName"
# 找到 gateway 进程 ID，然后
powershell -Command "Stop-Process -Id <PID> -Force"
```

### 3. 执行升级

```bash
npm install openclaw@latest
```

在项目目录执行：
```bash
cd <项目目录>/app/core
npm install openclaw@latest
```

### 4. 重启网关

使用 gateway 工具：
```json
{
  "action": "restart",
  "note": "重启网关以应用新版本"
}
```

## 注意事项

- 必须在项目目录的 `app/core` 下执行 npm install
- 如果遇到 EBUSY 错误（文件被锁定），说明网关仍在运行，需要先停止
- 升级完成后验证版本：`openclaw status` 或查看 session_status
