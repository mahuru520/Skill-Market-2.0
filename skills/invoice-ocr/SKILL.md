---
name: dify-invoice-ocr
description: 使用 Dify 工作流经公网网关进行发票 OCR 识别。支持上传 PDF/图片文件，调用 Dify API 进行发票识别，并输出 CSV/JSON 格式结果。用于：(1) 批量识别发票文件 (2) 提取发票信息 (3) 将发票数据导出为 CSV
---

# Dify 发票 OCR 识别

经公网网关 `https://ai.ospreyai.cn` 调用 Dify 工作流批量识别发票（PDF/图片），提取发票信息并导出为 CSV。

## 鉴权（双 Token，缺一不可）

所有请求必须同时携带：

- `Authorization: Bearer $API_KEY` — 网关层鉴权（new-api key，形如 `sk-xxx`）
- `X-Authorization: Bearer $DIFY_TOKEN` — 后端 Dify 鉴权（Dify 应用 API Key，形如 `app-xxx`，在 Dify Web 界面生成）

## 配置

运行前修改 `scripts/dify_invoice.py` 中的配置：

```python
DIFY_BASE_URL = "https://ai.ospreyai.cn"          # 网关地址（固定）
API_KEY = "sk-your-api-key"                        # 网关 new-api key
AUTH_TOKEN = "app-sCfow3LXjbKqFMzJOqI5aTcA"        # Dify 应用 API Key（X-Authorization）
USER = "invoice-bot"
```

## 网关 API 端点

| Endpoint | Method | Desc |
|----------|--------|------|
| `/api/v1/ai/workflow/files/upload` | POST | 上传发票 PDF/图片，返回 upload_file_id |
| `/api/v1/ai/workflow/workflows/run` | POST | 运行发票识别工作流（blocking） |
| `/api/v1/ai/workflow/workflows/tasks/{task_id}` | GET | 异步任务状态查询 |
| `/api/v1/ai/workflow/parameters` | GET | 获取工作流入参表单 |

> 注意：路径为 `/api/v1/ai/workflow/workflows/run`（`workflow` 出现两次），不是 `/v1/workflows/run`。

## 使用方法

```bash
# 命令行运行
python dify_invoice.py "发票目录路径"
```

或修改代码中的 `invoice_dir` 变量指定发票目录。

## 输出

- `result/md/*.md` - 各个发票的识别结果
- `result/json/*.json` - JSON 格式结果
- `result/invoices.csv` - 合并的 CSV 文件

## CSV 字段

- filename, invoice_title, invoice_number, issue_date
- buyer_name, buyer_tax_id, seller_name, seller_tax_id
- item_name, item_quantity, item_unit_price, item_amount
- item_tax_rate, item_tax_amount
- total_exclusive_tax, total_tax, total_inclusive_tax
- total_in_words, remarks, issuer
