---
name: dify-contract-review
description: Use when performing contract risk analysis or reviewing contract documents by calling the Dify workflow API via the public gateway. Triggered when user provides a contract file (PDF, Word, etc.) and requests risk assessment, clause analysis, or contract review reports.
---

# Dify Contract Review Skill

## Overview

Calls the Dify workflow `合同审核报告all_in_one` via the public gateway `https://ai.ospreyai.cn` to perform automated contract risk analysis. The workflow accepts a contract file and returns a structured risk assessment report.

**Gateway:** `https://ai.ospreyai.cn`
**Workflow:** 合同审核报告all_in_one
**Auth (双 Token, 缺一不可):**
- `Authorization: Bearer $API_KEY` — 网关层鉴权（new-api key，形如 `sk-xxx`）
- `X-Authorization: Bearer $DIFY_TOKEN` — 后端 Dify 鉴权（Dify 应用 API Key，形如 `app-xxx`，在 Dify Web 界面生成）
**Timeout:** 1800 seconds (30 minutes) — MUST be set on every workflow run call
**Output dir:** `/data/file/contract_review_results/` — all result files saved here

## Environment Variables

```bash
export GW="https://ai.ospreyai.cn"
export API_KEY="sk-your-api-key"
export DIFY_TOKEN="app-xxxxxx"
```

## Gateway API Endpoints

| Endpoint | Method | Desc |
|----------|--------|------|
| `/api/v1/ai/workflow/files/upload` | POST | 上传合同文件，返回 upload_file_id |
| `/api/v1/ai/workflow/workflows/run` | POST | 运行合同审核工作流 |
| `/api/v1/ai/workflow/parameters` | GET | 获取工作流入参表单 |

> 注意：路径为 `/api/v1/ai/workflow/workflows/run`（`workflow` 出现两次），不是 `/v1/workflows/run`，也不是对话型 `/chat-messages`（此应用是工作流型，调 chat-messages 会报 `not_chat_app`）。

## Two-Step Process

```
Step 1: Upload file  →  POST /api/v1/ai/workflow/files/upload  →  get upload_file_id
Step 2: Run workflow →  POST /api/v1/ai/workflow/workflows/run →  get review report → save to output dir
```

## Step 1 — Upload Contract File

```python
import requests

GW_URL          = "https://ai.ospreyai.cn"
API_KEY         = "sk-your-api-key"
DIFY_TOKEN      = "app-xxxxxx"
HEADERS         = {"Authorization": f"Bearer {API_KEY}", "X-Authorization": f"Bearer {DIFY_TOKEN}"}
WORKFLOW_TIMEOUT = 1800  # 30 minutes — contract review can be slow, never use default timeout

def upload_file(file_path: str) -> str:
    """Upload contract file via gateway, returns upload_file_id."""
    with open(file_path, "rb") as f:
        resp = requests.post(
            f"{GW_URL}/api/v1/ai/workflow/files/upload",
            headers=HEADERS,
            files={"file": (file_path, f, "application/octet-stream")},
            data={"user": "contract-reviewer"}
        )
    resp.raise_for_status()
    return resp.json()["id"]  # upload_file_id
```

Supported file types: PDF, DOC, DOCX, TXT

## Step 2 — Run Workflow

```python
def run_contract_review(upload_file_id: str) -> dict:
    """Run contract review workflow via gateway, returns output dict."""
    payload = {
        "inputs": {
            "ContractFile": {
                "transfer_method": "local_file",
                "upload_file_id": upload_file_id,
                "type": "document"
            }
        },
        "response_mode": "blocking",
        "user": "contract-reviewer"
    }
    resp = requests.post(
        f"{GW_URL}/api/v1/ai/workflow/workflows/run",
        headers={**HEADERS, "Content-Type": "application/json"},
        json=payload,
        timeout=WORKFLOW_TIMEOUT  # REQUIRED: 30 min, contract review LLM chains take long
    )
    resp.raise_for_status()
    return resp.json()
```

## Complete Example

```python
import requests
import json
from pathlib import Path
from datetime import datetime

GW_URL          = "https://ai.ospreyai.cn"
API_KEY         = "sk-your-api-key"
DIFY_TOKEN      = "app-xxxxxx"
HEADERS         = {"Authorization": f"Bearer {API_KEY}", "X-Authorization": f"Bearer {DIFY_TOKEN}"}
WORKFLOW_TIMEOUT = 1800  # 30 minutes
OUTPUT_DIR       = Path("/data/file/contract_review_results")

def review_contract(file_path: str) -> Path:
    """Review a contract file via gateway and save the report. Returns the saved report path."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Upload file
    with open(file_path, "rb") as f:
        upload_resp = requests.post(
            f"{GW_URL}/api/v1/ai/workflow/files/upload",
            headers=HEADERS,
            files={"file": (file_path, f, "application/octet-stream")},
            data={"user": "contract-reviewer"}
        )
    upload_resp.raise_for_status()
    file_id = upload_resp.json()["id"]
    print(f"File uploaded: {file_id}")

    # 2. Run workflow (timeout=1800 is REQUIRED — review can take 10-20 min)
    run_resp = requests.post(
        f"{GW_URL}/api/v1/ai/workflow/workflows/run",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={
            "inputs": {
                "ContractFile": {
                    "transfer_method": "local_file",
                    "upload_file_id": file_id,
                    "type": "document"
                }
            },
            "response_mode": "blocking",
            "user": "contract-reviewer"
        },
        timeout=WORKFLOW_TIMEOUT  # MUST set — default timeout will cause failure
    )
    run_resp.raise_for_status()
    result = run_resp.json()
    outputs = result["data"]["outputs"]

    # 3. Save result to output directory
    stem = Path(file_path).stem
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = OUTPUT_DIR / f"{stem}_审核报告_{timestamp}.json"
    out_path.write_text(json.dumps(outputs, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Report saved: {out_path}")
    return out_path

# Usage
review_contract("contract.pdf")
```

## Response Structure

```json
{
  "task_id": "fc9ae445-...",
  "workflow_run_id": "0312844a-...",
  "data": {
    "id": "0312844a-...",
    "status": "succeeded",
    "outputs": {
      "text": "合同审核报告内容..."
    },
    "elapsed_time": 12.5,
    "total_tokens": 3200,
    "total_steps": 5
  }
}
```

Key field: `result["data"]["outputs"]` — contains the actual review report.

> status 可能返回 `succeeded` / `partial-succeeded` / `failed`。`partial-succeeded` 时 outputs 仍可能有内容（如 IsPassed/msg），但应检查工作流内部节点是否报错。

## Streaming Mode (for long contracts)

For large contracts where blocking may time out, use streaming:

```python
def review_contract_streaming(file_path: str) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    file_id = upload_file(file_path)  # same upload step

    resp = requests.post(
        f"{GW_URL}/api/v1/ai/workflow/workflows/run",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={
            "inputs": {
                "ContractFile": {
                    "transfer_method": "local_file",
                    "upload_file_id": file_id,
                    "type": "document"
                }
            },
            "response_mode": "streaming",
            "user": "contract-reviewer"
        },
        stream=True,
        timeout=WORKFLOW_TIMEOUT  # REQUIRED even in streaming mode
    )
    for line in resp.iter_lines():
        if line and line.startswith(b"data:"):
            event = json.loads(line[5:])
            if event.get("event") == "workflow_finished":
                outputs = event["data"]["outputs"]
                stem = Path(file_path).stem
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                out_path = OUTPUT_DIR / f"{stem}_审核报告_{timestamp}.json"
                out_path.write_text(json.dumps(outputs, ensure_ascii=False, indent=2), encoding="utf-8")
                return out_path
```

## Quick Reference

| Parameter | Value |
|-----------|-------|
| Gateway URL | `https://ai.ospreyai.cn` |
| Upload endpoint | `POST /api/v1/ai/workflow/files/upload` |
| Run endpoint | `POST /api/v1/ai/workflow/workflows/run` |
| Parameters endpoint | `GET /api/v1/ai/workflow/parameters` |
| File variable name | `ContractFile` |
| Transfer method | `local_file` |
| File type | `document` |
| Response mode | `blocking` (default) or `streaming` |
| **Timeout** | **`1800` seconds (30 min) — REQUIRED on every call** |
| **Output directory** | **`/data/file/contract_review_results/`** |
| Auth (网关) | `Authorization: Bearer sk-xxx` |
| Auth (后端 Dify) | `X-Authorization: Bearer app-xxx` |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Skipping upload step, passing file path directly | Always upload first to get `upload_file_id` |
| Using `/v1/workflows/run` or `/chat-messages` | 工作流型应用用 `/api/v1/ai/workflow/workflows/run`；对话型才用 `/chat-messages` |
| Missing `X-Authorization` 后端 token | 网关需双 token：`Authorization`(网关) + `X-Authorization`(Dify) |
| Wrong variable name (`file` instead of `ContractFile`) | Use exact name `ContractFile` |
| Missing `type: "document"` in file object | Include `"type": "document"` in the file dict |
| Using `Content-Type` header on upload request | Do NOT set `Content-Type` for multipart upload — let requests set it |
| **No timeout or short timeout set** | **Always pass `timeout=1800` — default will fail on long contracts** |
| **Not saving output to the designated directory** | **Always write results to `/data/file/contract_review_results/`** |
| Output directory not existing | Call `OUTPUT_DIR.mkdir(parents=True, exist_ok=True)` before saving |
