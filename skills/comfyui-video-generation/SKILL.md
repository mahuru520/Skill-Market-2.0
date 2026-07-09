---
name: comfyui-video-generation
description: 通过公网网关使用 ComfyUI API 进行图生视频。覆盖图片上传、视频工作流提交、队列/任务状态查询、MP4 视频下载的完整流程。
metadata:
  version: "2.0"
  category: video-generation
triggers:
  - 图生视频
  - 视频生成
  - comfyui 视频
  - comfyui video
  - image-to-video
  - 上传图片
  - mp4
  - 队列
  - 任务状态
---

# ComfyUI 视频生成

## Overview

通过公网网关 `https://ai.ospreyai.cn` 使用 ComfyUI 将图片转换为视频，覆盖图片上传、工作流提交、状态查询和 MP4 下载。

使用 **Wan2.2 I2V + LightX2V 4步加速** 工作流，仅需 4 步采样即可生成约 5 秒视频（640x640, 16fps, 81帧）。

所有 API 均需 Bearer Token 鉴权（`Authorization: Bearer sk-xxx`）。

## Quick Start

```bash
export GW="https://ai.ospreyai.cn"
export API_KEY="sk-your-api-key"

# 1. 上传输入图片
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/upload" \
  -F "image=@input.png" -F "overwrite=true"

# 2. 提交视频工作流（完整 JSON 见下方 Route A）
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/ai/video/generate" \
  -H "Content-Type: application/json" \
  -d '{"prompt":{...}}'

# 3. 查询任务状态
curl -s -H "Authorization: Bearer $API_KEY" "$GW/api/v1/ai/tasks/{prompt_id}"

# 4. 下载 MP4 视频
curl -s -H "Authorization: Bearer $API_KEY" \
  "$GW/api/v1/ai/image/view/?filename=output.mp4&subfolder=video&type=output" \
  -o output.mp4
```

## Task Routing

| 场景 | 动作 |
|------|------|
| 首次生成视频 | → Route A: Upload & Generate |
| 需要查看任务是否完成 | → Route B: Check Status |
| 需要获取或下载 MP4 | → Route C: Download |
| 需要调优提示词、帧数或尺寸 | → Route D: Tune Parameters |
| 需要排查服务、节点、模型或文件问题 | → Route E: Troubleshoot |

## Route A: Upload & Generate

### 服务信息

- 网关地址: `https://ai.ospreyai.cn`
- 上传接口: `POST /api/v1/upload`
- 提交接口: `POST /api/v1/ai/video/generate`
- 鉴权方式: `Authorization: Bearer sk-xxx`

### 基本流程

1. 先上传输入图片到 ComfyUI
2. 再提交图生视频工作流
3. 工作流包含 16 个节点：
   - `LoadImage` — 加载已上传的输入图片
   - `WanImageToVideo` — 图像转视频核心节点
   - `CreateVideo` — 创建视频，设置帧率
   - `SaveVideo` — 保存视频为 MP4
   - 其他 12 个节点 — CLIP/VAE/UNet 加载、LoRA 加速、KSamplerAdvanced 采样等

### Step 1: 上传图片

```bash
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/upload" \
  -F "image=@/path/to/input.png" \
  -F "overwrite=true"
```

**响应：**

```json
{"name": "input.png", "subfolder": "", "type": "input"}
```

> 记住返回的 `name` 值，工作流中 `LoadImage` 节点需要使用。

最大文件大小: 50MB。推荐使用 PNG 格式。

### Step 2: 提交视频工作流

```bash
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/ai/video/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": {
      "84": {"inputs": {"clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan", "device": "default"}, "class_type": "CLIPLoader"},
      "85": {"inputs": {"add_noise": "disable", "noise_seed": 0, "steps": 4, "cfg": 1, "sampler_name": "euler", "scheduler": "simple", "start_at_step": 2, "end_at_step": 4, "return_with_leftover_noise": "disable", "model": ["103", 0], "positive": ["98", 0], "negative": ["98", 1], "latent_image": ["86", 0]}, "class_type": "KSamplerAdvanced"},
      "86": {"inputs": {"add_noise": "enable", "noise_seed": 42, "steps": 4, "cfg": 1, "sampler_name": "euler", "scheduler": "simple", "start_at_step": 0, "end_at_step": 2, "return_with_leftover_noise": "enable", "model": ["104", 0], "positive": ["98", 0], "negative": ["98", 1], "latent_image": ["98", 2]}, "class_type": "KSamplerAdvanced"},
      "87": {"inputs": {"samples": ["85", 0], "vae": ["90", 0]}, "class_type": "VAEDecode"},
      "89": {"inputs": {"text": "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸变的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走", "clip": ["84", 0]}, "class_type": "CLIPTextEncode"},
      "90": {"inputs": {"vae_name": "wan_2.1_vae.safetensors"}, "class_type": "VAELoader"},
      "93": {"inputs": {"text": "你的正向提示词（英文动作描述）", "clip": ["84", 0]}, "class_type": "CLIPTextEncode"},
      "94": {"inputs": {"fps": 16, "images": ["87", 0]}, "class_type": "CreateVideo"},
      "95": {"inputs": {"unet_name": "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "weight_dtype": "default"}, "class_type": "UNETLoader"},
      "96": {"inputs": {"unet_name": "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors", "weight_dtype": "default"}, "class_type": "UNETLoader"},
      "97": {"inputs": {"image": "你的图片.png"}, "class_type": "LoadImage"},
      "98": {"inputs": {"width": 640, "height": 640, "length": 81, "batch_size": 1, "positive": ["93", 0], "negative": ["89", 0], "vae": ["90", 0], "start_image": ["97", 0]}, "class_type": "WanImageToVideo"},
      "101": {"inputs": {"lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors", "strength_model": 1.0, "model": ["95", 0]}, "class_type": "LoraLoaderModelOnly"},
      "102": {"inputs": {"lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors", "strength_model": 1.0, "model": ["96", 0]}, "class_type": "LoraLoaderModelOnly"},
      "103": {"inputs": {"shift": 5.0, "model": ["102", 0]}, "class_type": "ModelSamplingSD3"},
      "104": {"inputs": {"shift": 5.0, "model": ["101", 0]}, "class_type": "ModelSamplingSD3"},
      "108": {"inputs": {"filename_prefix": "video/你的视频名", "format": "auto", "codec": "auto", "video-preview": "", "video": ["94", 0]}, "class_type": "SaveVideo"}
    }
  }'
```

**响应：**

```json
{"prompt_id": "03464627-3b48-43fe-91b9-ca7c779ba618", "number": 130, "node_errors": {}}
```

> `node_errors` 为空对象 `{}` 表示工作流校验通过。如有错误会在此列出。

**使用前需修改：**

| 节点 | 字段 | 修改为 |
|------|------|--------|
| 93 | text | 你的正向提示词（英文动作描述） |
| 97 | image | 上传图片返回的 `name` 值 |
| 108 | filename_prefix | 输出文件名前缀，如 `video/my_video` |

### 节点说明

| 节点 ID | class_type | 功能 |
|---------|-----------|------|
| 84 | CLIPLoader | 加载 Wan 的 CLIP 模型（文本编码器） |
| 85 | KSamplerAdvanced | 后半段采样（去噪，步骤 2→4） |
| 86 | KSamplerAdvanced | 前半段采样（加噪，步骤 0→2） |
| 87 | VAEDecode | VAE 解码 latent → 像素帧 |
| 89 | CLIPTextEncode | 负向提示词编码 |
| 90 | VAELoader | 加载 VAE 模型 |
| 93 | CLIPTextEncode | 正向提示词编码 |
| 94 | CreateVideo | 创建视频，设置帧率 |
| 95 | UNETLoader | 加载高噪声 UNet |
| 96 | UNETLoader | 加载低噪声 UNet |
| 97 | LoadImage | 加载已上传的输入图片 |
| 98 | WanImageToVideo | 图像转视频核心节点 |
| 101 | LoraLoaderModelOnly | 加载高噪声 LoRA（4步加速） |
| 102 | LoraLoaderModelOnly | 加载低噪声 LoRA（4步加速） |
| 103 | ModelSamplingSD3 | 低噪声模型采样偏移调整 |
| 104 | ModelSamplingSD3 | 高噪声模型采样偏移调整 |
| 108 | SaveVideo | 保存视频为 MP4 |

### 关键参数

| 节点 | 字段 | 说明 | 示例值 |
|------|------|------|--------|
| 97 | image | 输入图片文件名（需先上传） | `"input.png"` |
| 93 | text | 正向提示词（英文动作描述） | `"A bird flying in the sky"` |
| 98 | width / height | 视频尺寸 | 640 × 640 |
| 98 | length | 视频帧数（81帧≈5秒@16fps） | 81 |
| 94 | fps | 帧率 | 16 |
| 86 | noise_seed | 随机种子（不同值生成不同视频） | 42 |
| 108 | filename_prefix | 输出文件名前缀 | `"video/my_video"` |

### 输出视频参数

- **分辨率**: 640 × 640
- **帧数**: 81 帧
- **帧率**: 16 fps
- **时长**: 约 5 秒
- **格式**: MP4
- **输出路径**: `subfolder=video`, `type=output`

See `references/upload-and-submit.md` for details.

## Route B: Check Status

### 查询队列

```bash
curl -s -H "Authorization: Bearer $API_KEY" "$GW/api/v1/ai/queue"
```

**响应：**

```json
{
  "queue_running": [[130, "03464627-...", {...}]],
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
  "03464627-...": {
    "status": {"status_str": "success", "completed": false},
    "outputs": {}
  }
}
```

**已完成：**

```json
{
  "03464627-...": {
    "status": {"status_str": "success", "completed": true},
    "outputs": {
      "108": {
        "images": [{"filename": "my_video_00001_.mp4", "subfolder": "video", "type": "output"}],
        "animated": [true]
      }
    }
  }
}
```

> 视频生成通常需要 30 秒至 2 分钟（取决于 GPU 和队列情况）。

See `references/queue-history-download.md` for details.

## Route C: Download

下载前先从任务状态中获取输出文件信息（`filename`, `subfolder`, `type`），然后通过查看接口下载。

```bash
# 下载 MP4 视频（注意 subfolder=video）
curl -s -H "Authorization: Bearer $API_KEY" \
  "$GW/api/v1/ai/image/view/?filename=my_video_00001_.mp4&subfolder=video&type=output" \
  -o output.mp4
```

**关键点：**

- 视频输出的 `subfolder` 为 `video`（不是空字符串）
- 视频输出的 `type` 为 `output`
- 下载的是 MP4 格式，可直接播放

- 建议下载到 `/data/file/`

See `references/queue-history-download.md` for details.

## Route D: Tune Parameters

| 参数 | 节点 | 建议 |
|------|------|------|
| 输入图片 | 97 | 推荐 PNG，清晰度越高越好 |
| 正向提示词 | 93 text | 英文动作描述效果更稳定，如 "A bird spreading its wings and flying away" |
| 负向提示词 | 89 text | 默认可保持，避免修改 |
| 视频尺寸 | 98 width/height | 默认 640×640；支持 832×480 等，需为 16 的倍数 |
| 视频帧数 | 98 length | 默认 81（≈5s@16fps）；41≈2.5s, 161≈10s |
| 帧率 | 94 fps | 默认 16；视频时长 = length / fps |
| 随机种子 | 86 noise_seed | 不同值生成不同视频；相同种子 + 相同参数可复现 |
| 采样步数 | 85/86 steps | LightX2V 加速模式下固定 4 步，不建议修改 |
| 采样偏移 | 103/104 shift | 默认 5.0；增大偏移更锐利，减小更平滑 |

See `references/parameters-prompts.md` for details.

## Route E: Troubleshoot

| 问题 | 排查方法 |
|------|---------|
| 上传图片失败 | 检查文件大小（≤50MB）、格式（推荐 PNG）、Bearer Token 是否有效 |
| 工作流提交报 `value_not_in_list` | 模型文件名不正确，检查 UNet/CLIP/VAE/LoRA 名称是否与服务器一致 |
| 工作流提交报 `return_type_mismatch` | 节点间连接类型不匹配，检查节点输出→输入的链接是否正确 |
| 任务长时间未完成 | 检查 `/api/v1/ai/queue` 是否有排队任务；GPU 可能忙碌 |
| 下载视频返回空 | 检查 `subfolder` 是否为 `video`（不是空字符串） |
| 401 鉴权失败 | 检查 Bearer Token 是否有效：`curl -H "Authorization: Bearer sk-xxx" $GW/api/v1/ai/queue` |
| 429 请求被限流 | AI 接口 10次/分/IP，稍后重试 |

See `references/troubleshooting.md` for details.

## Verification Checklist

- [ ] 输入图片上传成功，返回 `name` 值
- [ ] 工作流提交成功，`node_errors` 为空
- [ ] 任务在 `/api/v1/ai/queue` 中执行完成
- [ ] 任务状态 `completed: true`，outputs 包含 MP4 文件信息
- [ ] 成功下载 MP4 文件（注意 `subfolder=video`）
- [ ] 视频可正常播放且分辨率符合配置

## References

- `references/overview.md` — 能力概览与服务假设
- `references/upload-and-submit.md` — 上传与工作流提交
- `references/queue-history-download.md` — 队列、历史与下载
- `references/parameters-prompts.md` — 参数与提示词建议
- `references/examples.md` — 完整示例
- `references/troubleshooting.md` — 常见问题与排查
