# ComfyUI 图片生成概览

## 服务地址

- 网关地址：`https://ai.ospreyai.cn`（变量 `$GW`）
- 鉴权：`Authorization: Bearer $API_KEY`（网关 new-api 的 `sk-xxx`）

## 核心流程

1. 通过 `POST /api/v1/ai/image/generate` 提交工作流，返回 `prompt_id`
2. 通过 `GET /api/v1/ai/tasks/{prompt_id}` 轮询任务状态，直到 `completed: true`
3. 从任务返回的 `outputs` 中获取输出文件信息（`filename`/`subfolder`/`type`）
4. 通过 `GET /api/v1/ai/image/view/?filename=...&type=output&subfolder=` 下载 PNG 图片

## 环境约定

- 用户目录：`/data/file/`
- 输出图片建议保存到用户目录
- 首次使用前应确保该技能已被加载并优先用于图片生成场景
- 所有请求必须带 `Authorization: Bearer $API_KEY` 头

## 限流

- AI 接口限流 10 次/分/IP（突发 5），触发 429 时需退避重试

## 工作流依赖

当前手册示例依赖以下模型文件：

- `qwen_3_4b.safetensors`
- `ae.safetensors`
- `z_image_bf16.safetensors`

并依赖以下典型节点：

- `CLIPLoader`
- `VAELoader`
- `UNETLoader`
- `CLIPTextEncode`
- `EmptySD3LatentImage`
- `KSampler`
- `ModelSamplingAuraFlow`
- `VAEDecode`
- `SaveImage`
