# ComfyUI 工作流提交

## 提交接口

```bash
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/ai/image/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": {
      "62": {"inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "lumina2", "device": "default"}, "class_type": "CLIPLoader"},
      "63": {"inputs": {"vae_name": "ae.safetensors"}, "class_type": "VAELoader"},
      "66": {"inputs": {"unet_name": "z_image_bf16.safetensors", "weight_dtype": "default"}, "class_type": "UNETLoader"},
      "67": {"inputs": {"text": "你的描述", "clip": ["62", 0]}, "class_type": "CLIPTextEncode"},
      "68": {"inputs": {"width": 1024, "height": 1024, "batch_size": 1}, "class_type": "EmptySD3LatentImage"},
      "69": {"inputs": {"seed": 123456789, "steps": 30, "cfg": 4.5, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1, "model": ["70", 0], "positive": ["67", 0], "negative": ["71", 0], "latent_image": ["68", 0]}, "class_type": "KSampler"},
      "70": {"inputs": {"shift": 3, "model": ["66", 0]}, "class_type": "ModelSamplingAuraFlow"},
      "71": {"inputs": {"text": "blurry, low quality, distorted, deformed, ugly", "clip": ["62", 0]}, "class_type": "CLIPTextEncode"},
      "65": {"inputs": {"samples": ["69", 0], "vae": ["63", 0]}, "class_type": "VAEDecode"},
      "9": {"inputs": {"filename_prefix": "output", "images": ["65", 0]}, "class_type": "SaveImage"}
    }
  }'
```

## 节点说明

| 节点 ID | class_type | 功能 | 说明 |
|---------|-----------|------|------|
| 62 | CLIPLoader | 加载文本编码器 | 加载 Lumina2 的 CLIP 模型 `qwen_3_4b.safetensors`，type 固定为 `lumina2` |
| 63 | VAELoader | 加载 VAE 解码器 | 加载 `ae.safetensors`，用于将 latent 解码为像素图 |
| 66 | UNETLoader | 加载 UNet 主模型 | 加载 `z_image_bf16.safetensors`，图片生成核心去噪模型 |
| 67 | CLIPTextEncode | 正向提示词编码 | 将正向提示词文本编码为条件向量，传递给 KSampler 的 positive |
| 68 | EmptySD3LatentImage | 生成空 latent | 设定输出图片宽高 (width/height) 和批次大小 (batch_size) |
| 69 | KSampler | 采样去噪 | 核心节点，控制 seed/steps/cfg/sampler/scheduler 等生成参数 |
| 70 | ModelSamplingAuraFlow | 采样偏移调整 | 为 Lumina2 模型调整 shift 参数，影响采样分布 |
| 71 | CLIPTextEncode | 负向提示词编码 | 将负向提示词编码为条件向量，传递给 KSampler 的 negative |
| 65 | VAEDecode | VAE 解码 | 将 KSampler 输出的 latent 解码为像素图像 |
| 9 | SaveImage | 保存图片 | 设置输出文件名前缀 (filename_prefix)，保存到 ComfyUI 输出目录 |

## 节点连接关系

```
CLIPLoader (62) ──→ CLIPTextEncode 正向 (67) ──→ KSampler (69)
                 └→ CLIPTextEncode 负向 (71) ──→ KSampler (69)

UNETLoader (66) ──→ ModelSamplingAuraFlow (70) ──→ KSampler (69)

EmptySD3LatentImage (68) ──→ KSampler (69)

KSampler (69) ──→ VAEDecode (65) ──→ SaveImage (9)
VAELoader (63)  ──→ VAEDecode (65)
```

## 常改字段

| 节点 | 字段 | 作用 | 示例值 |
|------|------|------|--------|
| 67 | `text` | 正向提示词（英文） | `"A cute puppy"` |
| 71 | `text` | 负向提示词 | `"blurry, ugly"` |
| 68 | `width` / `height` | 图片尺寸 | 1024 |
| 69 | `seed` | 随机种子（不同值生成不同图片） | 123456789 |
| 69 | `steps` | 采样步数（越高越精细） | 25-35 |
| 69 | `cfg` | CFG 强度（推荐 4-7） | 4.5 |
| 9 | `filename_prefix` | 输出文件名前缀 | `"output"` |

## 工作流依赖模型

| 模型文件 | 用途 |
|---------|------|
| `qwen_3_4b.safetensors` | CLIP 文本编码器（Lumina2） |
| `ae.safetensors` | VAE 解码器 |
| `z_image_bf16.safetensors` | UNet 去噪主模型 |
