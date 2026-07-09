# 故障排查

## 服务不可访问

1. 确认网关 `https://ai.ospreyai.cn` 可访问
2. 确认 `API_KEY` 有效（`Authorization: Bearer sk-xxx`）

## 图片未先上传

视频生成前必须先上传输入图片（`POST /api/v1/upload`），否则 `LoadImage` 无法找到文件。

## 队列长时间未完成

1. 先用 `/api/v1/ai/queue` 查看任务是否仍在执行
2. 30 秒至 2 分钟通常属于正常范围
3. 超时后检查模型或节点是否缺失

## 没有输出文件

1. 通过 `/api/v1/ai/tasks/{prompt_id}` 确认任务是否 `completed: true`
2. 检查 `filename_prefix` 是否匹配
3. 检查 `subfolder=video&type=output` 是否正确

## 鉴权失败（401）

```bash
# 验证 Bearer Token 是否有效
curl -s -H "Authorization: Bearer $API_KEY" "$GW/api/v1/ai/queue"
```

## 限流（429）

- AI 接口限流 10 次/分/IP（突发 5）
- 触发 429 时退避重试（如指数退避：1s、2s、4s…）

## 中文文件名下载问题

中文文件名建议使用 Python 方式下载，以处理 URL 编码（见 `queue-history-download.md`）。

## 质量不理想

1. 输入图尽量清晰
2. 正向提示词优先使用英文动作描述
3. 保持默认负向提示词
