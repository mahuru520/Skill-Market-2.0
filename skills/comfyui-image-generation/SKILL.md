---
name: comfyui-image-generation
description: 通过公网网关使用 ComfyUI API 进行文生图。覆盖工作流提交、队列/任务状态查询、PNG 图片下载的完整流程。
metadata:
  version: "2.0"
  category: image-generation
triggers:
  - 文生图
  - 图片生成
  - comfyui 生图
  - comfyui image
  - text-to-image
  - prompt
  - 队列
  - 任务状态
---

# ComfyUI 图片生成

## Overview

通过公网网关 `https://ai.ospreyai.cn` 使用 ComfyUI 进行文生图，覆盖工作流提交、状态查询和 PNG 图片下载。

使用 **z_image_bf16（百度文生图）** 模型，支持 1024×1024 高分辨率图片生成，30 步采样约 30 秒完成。

所有 API 均需 Bearer Token 鉴权（`Authorization: Bearer sk-xxx`）。

## Quick Start

```bash
export GW="https://ai.ospreyai.cn"
export API_KEY="sk-your-api-key"

# 1. 提交图片生成工作流
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/ai/image/generate" \
  -H "Content-Type: application/json" \
  -d '{"prompt":{...}}'

# 2. 查询任务状态
curl -s -H "Authorization: Bearer $API_KEY" "$GW/api/v1/ai/tasks/{prompt_id}"

# 3. 下载生成的图片
curl -s -H "Authorization: Bearer $API_KEY" \
  "$GW/api/v1/ai/image/view/?filename=output_00001_.png&type=output&subfolder=" \
  -o output.png
```

## Task Routing

| 场景 | 动作 |
|------|------|
| 首次生成图片 | → Route A: Submit & Generate |
| 需要查看任务是否完成 | → Route B: Check Status |
| 需要获取或下载 PNG | → Route C: Download |
| 需要调优提示词、尺寸或参数 | → Route D: Tune Parameters |
| 需要排查服务、节点、模型或文件问题 | → Route E: Troubleshoot |

## Route A: Submit & Generate

### 服务信息

- 网关地址: `https://ai.ospreyai.cn`
- 提交接口: `POST /api/v1/ai/image/generate`
- 鉴权方式: `Authorization: Bearer sk-xxx`
- 无需后端 Bearer Token，网关 Bearer Token 即可

### 基本流程

1. 直接提交文生图工作流（无需上传图片）
2. 工作流包含 10 个节点：
   - `CLIPLoader` — 加载 Lumina2 的 CLIP 文本编码器
   - `VAELoader` — 加载 VAE 解码器
   - `UNETLoader` — 加载 UNet 去噪主模型
   - `CLIPTextEncode` × 2 — 正向/负向提示词编码
   - `EmptySD3LatentImage` — 生成空 latent
   - `KSampler` — 采样去噪（核心节点）
   - `ModelSamplingAuraFlow` — 采样偏移调整
   - `VAEDecode` — VAE 解码 latent → 像素图
   - `SaveImage` — 保存图片为 PNG

### 提交工作流

```bash
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/ai/image/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": {
      "62": {"inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "lumina2", "device": "default"}, "class_type": "CLIPLoader"},
      "63": {"inputs": {"vae_name": "ae.safetensors"}, "class_type": "VAELoader"},
      "66": {"inputs": {"unet_name": "z_image_bf16.safetensors", "weight_dtype": "default"}, "class_type": "UNETLoader"},
      "67": {"inputs": {"text": "A cute puppy sitting on grass, sunny day, photorealistic", "clip": ["62", 0]}, "class_type": "CLIPTextEncode"},
      "68": {"inputs": {"width": 1024, "height": 1024, "batch_size": 1}, "class_type": "EmptySD3LatentImage"},
      "69": {"inputs": {"seed": 12345, "steps": 30, "cfg": 4.5, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1, "model": ["70", 0], "positive": ["67", 0], "negative": ["71", 0], "latent_image": ["68", 0]}, "class_type": "KSampler"},
      "70": {"inputs": {"shift": 3, "model": ["66", 0]}, "class_type": "ModelSamplingAuraFlow"},
      "71": {"inputs": {"text": "blurry, low quality, distorted, deformed, ugly", "clip": ["62", 0]}, "class_type": "CLIPTextEncode"},
      "65": {"inputs": {"samples": ["69", 0], "vae": ["63", 0]}, "class_type": "VAEDecode"},
      "9": {"inputs": {"filename_prefix": "output", "images": ["65", 0]}, "class_type": "SaveImage"}
    }
  }'
```

**响应：**

```json
{
  "prompt_id": "0871f625-65f6-4d2f-abd8-0b248dafa58f",
  "number": 99
}
```

**使用前需修改：**

| 节点 | 字段 | 修改为 |
|------|------|--------|
| 67 | text | 你的正向提示词（英文效果更佳） |
| 71 | text | 负向提示词（可保持默认） |
| 69 | seed | 任意整数（不同值生成不同图片） |
| 9 | filename_prefix | 输出文件名前缀 |

### 节点说明

| 节点 ID | class_type | 功能 |
|---------|-----------|------|
| 62 | CLIPLoader | 加载 Lumina2 的 CLIP 模型（文本编码器） |
| 63 | VAELoader | 加载 VAE 解码器，将 latent 解码为像素图 |
| 66 | UNETLoader | 加载 UNet 去噪主模型 `z_image_bf16` |
| 67 | CLIPTextEncode | 正向提示词编码，传递给 KSampler 的 positive |
| 68 | EmptySD3LatentImage | 生成空 latent，设定输出图片宽高和批次 |
| 69 | KSampler | 采样去噪核心节点，控制 seed/steps/cfg 等生成参数 |
| 70 | ModelSamplingAuraFlow | 为 Lumina2 模型调整 shift 采样偏移 |
| 71 | CLIPTextEncode | 负向提示词编码，传递给 KSampler 的 negative |
| 65 | VAEDecode | 将 KSampler 输出的 latent 解码为像素图像 |
| 9 | SaveImage | 保存图片为 PNG，设置输出文件名前缀 |

### 关键参数

| 节点 | 字段 | 说明 | 示例值 |
|------|------|------|--------|
| 67 | text | 正向提示词（英文效果更佳） | `"A cute puppy sitting on grass"` |
| 71 | text | 负向提示词 | `"blurry, low quality, distorted"` |
| 68 | width / height | 图片尺寸 | 1024 × 1024 |
| 69 | seed | 随机种子（不同值生成不同图片） | 12345 |
| 69 | steps | 采样步数（越高越精细） | 25-35 |
| 69 | cfg | CFG 强度 | 4-7 |
| 9 | filename_prefix | 输出文件名前缀 | `"output"` |

### 输出图片参数

- **分辨率**: 默认 1024 × 1024
- **格式**: PNG
- **输出路径**: `subfolder=""`（空字符串）, `type=output`

See `references/workflow-submit.md` for details.

## Route B: Check Status

### 查询队列

```bash
curl -s -H "Authorization: Bearer $API_KEY" "$GW/api/v1/ai/queue"
```

**响应：**

```json
{
  "queue_running": [[99, "0871f625-...", {...}]],
  "queue_pending": []
}
```

- `queue_running` 不为空 → 任务正在执行
- `queue_pending` 不为空 → 任务排队等待

### 查询任务状态

```bash
curl -s -H "Authorization: Bearer $API_KEY" "$GW/api/v1/ai/tasks/{prompt_id}"
```

**进行中：**

```json
{
  "0871f625-...": {
    "status": {"status_str": "success", "completed": false},
    "outputs": {}
  }
}
```

**已完成：**

```json
{
  "0871f625-...": {
    "status": {"status_str": "success", "completed": true},
    "outputs": {
      "9": {
        "images": [
          {"filename": "output_00001_.png", "subfolder": "", "type": "output"}
        ]
      }
    }
  }
}
```

> 图片生成通常需要 20-40 秒（取决于 GPU 和队列情况）。

See `references/queue-history-download.md` for details.

## Route C: Download

下载前先从任务状态中获取输出文件信息（`filename`, `subfolder`, `type`），然后通过查看接口下载。

```bash
# 下载 PNG 图片（注意 subfolder 为空字符串）
curl -s -H "Authorization: Bearer $API_KEY" \
  "$GW/api/v1/ai/image/view/?filename=output_00001_.png&type=output&subfolder=" \
  -o output.png
```

**关键点：**

- 图片输出的 `subfolder` 为空字符串（视频是 `video`，注意区别）
- 图片输出的 `type` 为 `output`
- 下载的是 PNG 格式，可直接查看

- 建议保存到用户目录：`/data/file/`

See `references/queue-history-download.md` for details.

## Route D: Tune Parameters

| 参数 | 节点 | 建议 |
|------|------|------|
| 正向提示词 | 67 text | 英文效果更稳定，描述越具体越好 |
| 负向提示词 | 71 text | 默认可保持；可补充不想出现的元素 |
| 图片尺寸 | 68 width/height | 默认 1024×1024；正方形效果最佳 |
| 采样步数 | 69 steps | 25-35，30 为推荐值；越高越精细但越慢 |
| CFG 强度 | 69 cfg | 4-7，4.5 为推荐值；过高会导致过饱和 |
| 随机种子 | 69 seed | 不同值生成不同图片；相同种子可复现 |
| 采样器 | 69 sampler_name | 推荐 `res_multistep` |
| 调度器 | 69 scheduler | 推荐 `simple` |
| 采样偏移 | 70 shift | 默认 3；增大偏移更锐利，减小更平滑 |

See `references/parameters-prompts.md` for details.

## Route E: Troubleshoot

| 问题 | 排查方法 |
|------|---------|
| 工作流提交报 `value_not_in_list` | 模型文件名不正确，检查 UNet/CLIP/VAE 名称是否与服务器一致 |
| 工作流提交报 `return_type_mismatch` | 节点间连接类型不匹配，检查节点输出→输入的链接是否正确 |
| 任务长时间未完成 | 检查 `/api/v1/ai/queue` 是否有排队任务；GPU 可能忙碌 |
| 下载图片返回空 | 检查 `subfolder` 是否为空字符串（视频是 `video`，图片是空） |
| 401 鉴权失败 | 检查 Bearer Token 是否有效：`curl -H "Authorization: Bearer sk-xxx" $GW/api/v1/ai/queue` |
| 429 请求被限流 | AI 接口 10次/分/IP，稍后重试 |
| 503 后端服务不可用 | 检查内网 ComfyUI 服务是否运行 |
| 图片质量不理想 | 优先使用英文提示词；steps 调整到 25-35；cfg 保持在 4-7；更换 seed 生成变体 |

See `references/troubleshooting.md` for details.

## Verification Checklist

- [ ] 工作流提交成功，返回 `prompt_id`
- [ ] 任务在 `/api/v1/ai/queue` 中执行完成
- [ ] 任务状态 `completed: true`，outputs 包含 PNG 文件信息
- [ ] 成功下载 PNG 文件（注意 `subfolder` 为空字符串）
- [ ] 图片可正常查看且分辨率符合配置

## References

- `references/overview.md` — 能力概览与服务假设
- `references/workflow-submit.md` — 工作流提交示例
- `references/queue-history-download.md` — 队列、历史与下载
- `references/parameters-prompts.md` — 参数与提示词建议
- `references/examples.md` — 完整示例
- `references/troubleshooting.md` — 常见问题与排查
