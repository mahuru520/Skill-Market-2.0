# ComfyUI 图片生成

通过公网网关 `https://ai.ospreyai.cn` 使用 ComfyUI 进行文生图，覆盖工作流提交、状态查询和 PNG 图片下载。

## Overview

本技能提供基于 ComfyUI 的图片生成能力，通过外网网关鉴权调用，适合需要稳定提交 workflow、轮询任务状态并将图片保存到用户目录的场景。

所有 API 均需 Bearer Token 鉴权（`Authorization: Bearer sk-xxx`）。

## Quick Start

```bash
export GW="https://ai.ospreyai.cn"
export API_KEY="sk-your-api-key"

# 1. 提交 workflow
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/ai/image/generate" \
  -H "Content-Type: application/json" \
  -d '{"prompt":{...}}'

# 2. 查询任务状态
curl -s -H "Authorization: Bearer $API_KEY" "$GW/api/v1/ai/tasks/{prompt_id}"

# 3. 下载输出图片
curl -s -H "Authorization: Bearer $API_KEY" \
  "$GW/api/v1/ai/image/view/?filename=output_00001_.png&type=output&subfolder=" \
  -o /data/file/output.png
```

## Directory Structure

```
comfyui-image-generation/
├── SKILL.md
├── README.md
└── references/
    ├── overview.md
    ├── workflow-submit.md
    ├── queue-history-download.md
    ├── parameters-prompts.md
    ├── examples.md
    └── troubleshooting.md
```

## When to Use

- **comfyui-image-generation**：文生图、任务状态查询、图片下载
- **comfyui-video-generation**：图生视频或视频工作流

## Verification

- `/api/v1/ai/image/generate` 提交成功，返回 `prompt_id`
- `/api/v1/ai/tasks/{prompt_id}` 状态 `completed: true`
- PNG 成功下载到 `/data/file/`（注意 `subfolder` 为空字符串）

## References

- `references/overview.md`
- `references/workflow-submit.md`
- `references/queue-history-download.md`
- `references/parameters-prompts.md`
- `references/examples.md`
- `references/troubleshooting.md`
