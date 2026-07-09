# 故障排查

## 服务不可访问

1. 确认网关 `https://ai.ospreyai.cn` 可访问
2. 确认 `API_KEY` 有效（`Authorization: Bearer sk-xxx`）

## 队列卡住或任务长时间不完成

1. 使用 `/api/v1/ai/queue` 检查是否还有未完成任务
2. 确认工作流依赖的模型和节点已安装

## 没有输出文件

1. 通过 `/api/v1/ai/tasks/{prompt_id}` 确认任务是否 `completed: true`
2. 检查 `filename_prefix` 是否正确
3. 检查 `subfolder` 是否为空字符串（图片输出 subfolder 为空）

## 鉴权失败（401）

```bash
# 验证 Bearer Token 是否有效
curl -s -H "Authorization: Bearer $API_KEY" "$GW/api/v1/ai/queue"
```

## 限流（429）

- AI 接口限流 10 次/分/IP（突发 5）
- 触发 429 时退避重试（如指数退避：1s、2s、4s…）

## 后端服务不可用（503）

- 网关返回 503 表示内网 ComfyUI 服务未运行或不可达，联系网关运维

## 图片质量不理想

1. 优先使用英文提示词
2. steps 调整到 25–35
3. cfg 保持在 4–7
4. 更换 seed 生成不同变体
