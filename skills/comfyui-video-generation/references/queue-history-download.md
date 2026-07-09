# 队列、任务状态与下载

## 查看队列状态

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

视频生成通常需要 30 秒至 2 分钟。

## 查询任务状态（替代原 /history）

原内网 `/history` 一次返回全部历史；网关改为按 `prompt_id` 查单个任务。

```bash
curl -s -H "Authorization: Bearer $API_KEY" "$GW/api/v1/ai/tasks/{prompt_id}"
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

> 任务完成后，从 `outputs.<节点id>.images[0]` 中提取 `filename`/`subfolder`/`type` 用于下载。

## 下载视频

### 直接下载（英文文件名）

```bash
curl -s -H "Authorization: Bearer $API_KEY" \
  "$GW/api/v1/ai/image/view/?filename=video/output.mp4&subfolder=video&type=output" \
  -o /data/file/output.mp4
```

### 中文文件名下载

中文文件名需要使用 Python 方式处理 URL 编码：

```bash
export API_KEY="sk-your-api-key"
export GW="https://ai.ospreyai.cn"
python3 << 'EOF'
import os, urllib.request, urllib.parse

gw = os.environ["GW"]
key = os.environ["API_KEY"]
headers = {"Authorization": f"Bearer {key}"}

params = urllib.parse.urlencode({
    "filename": "你的视频名_00001_.mp4",
    "subfolder": "video",
    "type": "output"
})

url = f"{gw}/api/v1/ai/image/view/?{params}"
req = urllib.request.Request(url, headers=headers)
data = urllib.request.urlopen(req).read()

with open("/data/file/你的视频.mp4", "wb") as f:
    f.write(data)
print(f"下载完成，大小: {len(data)} bytes")
EOF
```

## 下载约定

- 输出格式默认是 MP4
- 视频位于 `video` 子目录，需带 `subfolder=video&type=output` 参数
- 推荐下载到 `/data/file/`
- 下载前先通过 `/api/v1/ai/tasks/{prompt_id}` 确认实际输出文件名
