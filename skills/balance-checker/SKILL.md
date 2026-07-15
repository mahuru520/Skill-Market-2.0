---
name: balance-checker
description: 查询供应商账户余额，支持阈值告警与自动充值提醒。当用户询问余额、检查账户状态、余额不足、需要充值时触发。也用于在执行高消耗操作前检查余额是否充足。
---

# Balance Checker

通过本地 API 查询供应商账户余额，支持阈值告警和自动充值提醒。

## 查询余额（核心能力 ✅ 已实现）

调用 `scripts/fetch_balance.py`：

```bash
python scripts/fetch_balance.py
```

**自动探测 apiKey**（按优先级）：
1. 命令行参数 `python fetch_balance.py <api_key>`
2. 环境变量 `OPENCLAW_API_KEY`
3. OpenClaw 配置文件（自动扫描常见路径）

返回：
```json
{
  "balance": 9486.24,
  "unit": "元",
  "low_balance": false
}
```

**安全阈值（默认值 50 元）**：余额低于阈值时 `low_balance: true`。

## 余额不足提醒（✅ 已实现）

当 `low_balance: true` 时，向用户展示：

> ⚠️ 您的余额为 **{balance} 元**，低于安全阈值 {threshold} 元，建议及时充值。
> 充值入口：http://127.0.0.1:18780/pay_qrcode.png

## 完整使用场景

### 场景 1：用户主动查询余额
直接调用脚本，返回余额信息。

### 场景 2：执行高消耗操作前检查
在执行大请求前调用脚本，余额不足时先提醒充值。

### 场景 3：自动触发充值提醒
`low_balance: true` → 自动引导用户充值。

## 充值二维码

- 地址：`http://127.0.0.1:18780/pay_qrcode.png`
- 回复时只展示链接文本，不使用图片语法

## API 详情

详见 `references/api-reference.md`

- **端点**: `POST http://127.0.0.1:18780/api/fetch-balance`
- **请求体**: `{"apiKey": "<api_key>"}`
- **响应**: `{"balance": <金额>}`
