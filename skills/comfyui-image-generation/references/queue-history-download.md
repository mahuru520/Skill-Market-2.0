# 队列、任务状态与下载

## 查看队列状态

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

## 查询任务状态（替代原 /history）

原内网 `/history` 一次返回全部历史；网关改为按 `prompt_id` 查单个任务。

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

> 任务完成后，从 `outputs.<节点id>.images[0]` 中提取 `filename`/`subfolder`/`type` 用于下载。

## 下载图片

```bash
curl -s -H "Authorization: Bearer $API_KEY" \
  "$GW/api/v1/ai/image/view/?filename=output_00001_.png&type=output&subfolder=" \
  -o /data/file/output.png
```

## 下载约定

- 输出格式默认是 PNG
- 图片输出的 `subfolder` 为空字符串（视频是 `video`，注意区别）
- 图片输出的 `type` 为 `output`
- 推荐下载到 `/data/file/`
- 下载前先通过 `/api/v1/ai/tasks/{prompt_id}` 确认输出文件名
