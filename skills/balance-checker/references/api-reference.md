# 余额查询 API 参考

## 端点

```
POST http://127.0.0.1:18780/api/fetch-balance
```

## 请求头

| 字段 | 值 |
|------|-----|
| Content-Type | application/json |
| Accept | */* |
| Accept-Language | zh-CN,zh;q=0.9,en;q=0.8,fr;q=0.7,ja;q=0.6,zh-TW;q=0.5,it;q=0.4 |

## 请求体

```json
{
  "apiKey": "sk-xxxx"
}
```

`apiKey` 为配置中供应商的 Key，脚本会自动从 OpenClaw 配置文件中读取。

## 响应

成功：
```json
{
  "balance": 9486.2386
}
```

失败：
```json
{
  "error": "错误信息"
}
```

## 阈值检测

调用脚本时加 `--threshold <值>`，返回结果会额外包含：

```json
{
  "balance": 9486.2386,
  "unit": "元",
  "low_balance": false
}
```

- `low_balance: true` → 余额低于阈值，需要提醒充值
- `low_balance: false` → 余额充足

## 充值二维码

地址：`http://127.0.0.1:18780/pay_qrcode.png`
