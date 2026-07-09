# ComfyUI 视频生成概览

## 服务地址

- 网关地址：`https://ai.ospreyai.cn`（变量 `$GW`）
- 鉴权：`Authorization: Bearer $API_KEY`（网关 new-api 的 `sk-xxx`）

## 核心流程

1. 上传输入图片到 `POST /api/v1/upload`，返回 `name` 值
2. 通过 `POST /api/v1/ai/video/generate` 提交视频工作流，返回 `prompt_id`
3. 通过 `GET /api/v1/ai/tasks/{prompt_id}` 轮询任务状态，直到 `completed: true`
4. 从任务返回的 `outputs` 中获取输出文件信息（`filename`/`subfolder`/`type`）
5. 通过 `GET /api/v1/ai/image/view/?filename=...&subfolder=video&type=output` 下载 mp4

## 环境约定

- 用户目录：`/data/file/`
- 输出视频通常位于网关侧的 `video` 子目录（`subfolder=video`）
- 首次使用前应确保视频生成技能已加载
- 所有请求必须带 `Authorization: Bearer $API_KEY` 头

## 限流

- AI 接口限流 10 次/分/IP（突发 5），触发 429 时需退避重试

## 工作流依赖

当前手册示例依赖以下典型节点：

- `CLIPLoader`
- `VAELoader`
- `UNETLoader`
- `LoadImage`
- `WanImageToVideo`
- `CreateVideo`
- `SaveVideo`
- `KSamplerAdvanced`
- `LoraLoaderModelOnly`
- `ModelSamplingSD3`

## 默认输出参数

- 分辨率：`640x640`
- 帧数：`81`
- 帧率：`16 fps`
- 时长：约 5 秒
- 格式：MP4
