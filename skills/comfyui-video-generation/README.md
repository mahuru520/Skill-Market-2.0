# ComfyUI 视频生成

通过公网网关 `https://ai.ospreyai.cn` 使用 ComfyUI 将图片转换为视频，覆盖图片上传、工作流提交、状态查询和 MP4 下载。

## Overview

本技能提供基于 ComfyUI 的图生视频能力，通过外网网关鉴权调用，适合需要稳定上传输入图、执行视频工作流并将结果保存到用户目录的场景。

所有 API 均需 Bearer Token 鉴权（`Authorization: Bearer sk-xxx`）。

## Quick Start

```bash
export GW="https://ai.ospreyai.cn"
export API_KEY="sk-your-api-key"

# 1. 上传输入图片
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/upload" \
  -F "image=@input.png" -F "overwrite=true"

# 2. 提交视频 workflow
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/ai/video/generate" \
  -H "Content-Type: application/json" \
  -d '{"prompt":{...}}'

# 3. 下载输出 mp4
curl -s -H "Authorization: Bearer $API_KEY" \
  "$GW/api/v1/ai/image/view/?filename=output.mp4&subfolder=video&type=output" \
  -o /data/file/output.mp4
```

## Directory Structure

```
comfyui-video-generation/
├── SKILL.md
├── README.md
└── references/
    ├── overview.md
    ├── upload-and-submit.md
    ├── queue-history-download.md
    ├── parameters-prompts.md
    ├── examples.md
    └── troubleshooting.md
```

## When to Use

- **comfyui-image-generation**：文生图
- **comfyui-video-generation**：图生视频或视频工作流

## Verification

- `/api/v1/upload` 上传成功，返回 `name` 值
- `/api/v1/ai/video/generate` 提交成功，`node_errors` 为空
- `/api/v1/ai/tasks/{prompt_id}` 状态 `completed: true`
- MP4 成功下载到 `/data/file/`（注意 `subfolder=video`）

## References

- `references/overview.md`
- `references/upload-and-submit.md`
- `references/queue-history-download.md`
- `references/parameters-prompts.md`
- `references/examples.md`
- `references/troubleshooting.md`
