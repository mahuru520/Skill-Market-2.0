# 上传与工作流提交

## 上传输入图片

```bash
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/upload" \
  -F "image=@/data/file/你的图片.png" \
  -F "overwrite=true"
```

**响应：**

```json
{"name": "你的图片.png", "subfolder": "", "type": "input"}
```

上传成功后返回包含文件名的 JSON，文件名（`name` 值）在后续工作流的 `LoadImage` 节点中使用。最大文件大小 50MB，推荐 PNG 格式。

## 提交视频工作流

```bash
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/ai/video/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": {
      "84": {"inputs": {"clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan", "device": "default"}, "class_type": "CLIPLoader"},
      "85": {"inputs": {"add_noise": "disable", "noise_seed": 0, "steps": 4, "cfg": 1, "sampler_name": "euler", "scheduler": "simple", "start_at_step": 2, "end_at_step": 4, "return_with_leftover_noise": "disable", "model": ["103", 0], "positive": ["98", 0], "negative": ["98", 1], "latent_image": ["86", 0]}, "class_type": "KSamplerAdvanced"},
      "86": {"inputs": {"add_noise": "enable", "noise_seed": 537400111571805, "steps": 4, "cfg": 1, "sampler_name": "euler", "scheduler": "simple", "start_at_step": 0, "end_at_step": 2, "return_with_leftover_noise": "enable", "model": ["104", 0], "positive": ["98", 0], "negative": ["98", 1], "latent_image": ["98", 2]}, "class_type": "KSamplerAdvanced"},
      "87": {"inputs": {"samples": ["85", 0], "vae": ["90", 0]}, "class_type": "VAEDecode"},
      "89": {"inputs": {"text": "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸变的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走", "clip": ["84", 0]}, "class_type": "CLIPTextEncode"},
      "90": {"inputs": {"vae_name": "wan_2.1_vae.safetensors"}, "class_type": "VAELoader"},
      "93": {"inputs": {"text": "你的正向提示词（英文）", "clip": ["84", 0]}, "class_type": "CLIPTextEncode"},
      "94": {"inputs": {"fps": 16, "images": ["87", 0]}, "class_type": "CreateVideo"},
      "95": {"inputs": {"unet_name": "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "weight_dtype": "default"}, "class_type": "UNETLoader"},
      "96": {"inputs": {"unet_name": "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors", "weight_dtype": "default"}, "class_type": "UNETLoader"},
      "97": {"inputs": {"image": "你的图片.png"}, "class_type": "LoadImage"},
      "98": {"inputs": {"width": 640, "height": 640, "length": 81, "batch_size": 1, "positive": ["93", 0], "negative": ["89", 0], "vae": ["90", 0], "start_image": ["97", 0]}, "class_type": "WanImageToVideo"},
      "101": {"inputs": {"lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors", "strength_model": 1.0000000000000002, "model": ["95", 0]}, "class_type": "LoraLoaderModelOnly"},
      "102": {"inputs": {"lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors", "strength_model": 1.0000000000000002, "model": ["96", 0]}, "class_type": "LoraLoaderModelOnly"},
      "103": {"inputs": {"shift": 5.000000000000001, "model": ["102", 0]}, "class_type": "ModelSamplingSD3"},
      "104": {"inputs": {"shift": 5.000000000000001, "model": ["101", 0]}, "class_type": "ModelSamplingSD3"},
      "108": {"inputs": {"filename_prefix": "video/你的视频名", "format": "auto", "codec": "auto", "video-preview": "", "video": ["94", 0]}, "class_type": "SaveVideo"}
    }
  }'
```

## 节点说明

| 节点 ID | class_type | 功能 | 说明 |
|---------|-----------|------|------|
| 84 | CLIPLoader | 加载文本编码器 | 加载 Wan 模型的 CLIP `umt5_xxl_fp8_e4m3fn_scaled.safetensors`，type 固定为 `wan` |
| 85 | KSamplerAdvanced | 后半段采样（去噪） | 从第 2 步到第 4 步，`add_noise: disable`，`return_with_leftover_noise: disable` |
| 86 | KSamplerAdvanced | 前半段采样（加噪） | 从第 0 步到第 2 步，`add_noise: enable`，`return_with_leftover_noise: enable` |
| 87 | VAEDecode | VAE 解码 | 将 latent 解码为像素帧，依赖 VAE (90) |
| 89 | CLIPTextEncode | 负向提示词编码 | 默认负向提示词，防止静态、模糊等不良效果 |
| 90 | VAELoader | 加载 VAE | 加载 `wan_2.1_vae.safetensors` |
| 93 | CLIPTextEncode | 正向提示词编码 | 描述想要的运动和动作，英文效果更好 |
| 94 | CreateVideo | 创建视频 | 设置帧率 (fps)，将图像帧组合为视频 |
| 95 | UNETLoader | 加载高噪声 UNet | 加载 `wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors` |
| 96 | UNETLoader | 加载低噪声 UNet | 加载 `wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors` |
| 97 | LoadImage | 加载输入图片 | 加载已上传的图片，`image` 字段填上传后的文件名 |
| 98 | WanImageToVideo | 图像转视频核心 | 核心节点，设定宽高/帧数，接收正向/负向条件与 VAE |
| 101 | LoraLoaderModelOnly | 加载高噪声 LoRA | 加载 `wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise`，加速 4 步推理 |
| 102 | LoraLoaderModelOnly | 加载低噪声 LoRA | 加载 `wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise`，加速 4 步推理 |
| 103 | ModelSamplingSD3 | 采样偏移调整 | 为低噪声模型调整 shift |
| 104 | ModelSamplingSD3 | 采样偏移调整 | 为高噪声模型调整 shift |
| 108 | SaveVideo | 保存视频 | 设置输出文件名前缀和格式，保存到 video 子目录 |

## 节点连接关系

```
LoadImage (97) ──→ WanImageToVideo (98) ──→ KSampler 加噪 (86) ──→ KSampler 去噪 (85) ──→ VAEDecode (87) ──→ CreateVideo (94) ──→ SaveVideo (108)

CLIPLoader (84) ──→ CLIPTextEncode 正向 (93) ──→ WanImageToVideo (98)
                 └→ CLIPTextEncode 负向 (89) ──→ WanImageToVideo (98)

UNETLoader 高噪声 (95) ──→ LoraLoader (101) ──→ ModelSamplingSD3 (104) ──→ KSampler 去噪 (85)
UNETLoader 低噪声 (96) ──→ LoraLoader (102) ──→ ModelSamplingSD3 (103) ──→ KSampler 加噪 (86)

VAELoader (90) ──→ WanImageToVideo (98), VAEDecode (87)
```

## 双通道采样说明

Wan2.2 图生视频使用双通道采样策略：

1. **前半段（节点 86）**：加噪阶段，`add_noise: enable`，从第 0 步到第 2 步，使用低噪声 UNet+LoRA
2. **后半段（节点 85）**：去噪阶段，`add_noise: disable`，从第 2 步到第 4 步，使用高噪声 UNet+LoRA

这种分离策略使 4 步快速推理即可生成高质量视频。

## 常改字段

| 节点 | 字段 | 作用 | 示例值 |
|------|------|------|--------|
| 97 | `image` | 输入图片文件名 | `"input.png"` |
| 93 | `text` | 正向提示词（英文动作描述） | `"A bird flying in the sky"` |
| 98 | `width` / `height` | 视频尺寸 | 640 |
| 98 | `length` | 视频帧数 | 81 |
| 94 | `fps` | 帧率 | 16 |
| 108 | `filename_prefix` | 输出文件名前缀 | `"video/my_video"` |

## 工作流依赖模型

| 模型文件 | 用途 |
|---------|------|
| `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | CLIP 文本编码器（Wan） |
| `wan_2.1_vae.safetensors` | VAE 解码器 |
| `wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors` | 高噪声 UNet |
| `wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors` | 低噪声 UNet |
| `wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors` | 高噪声 LoRA（4步加速） |
| `wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors` | 低噪声 LoRA（4步加速） |
