# 完整示例

## 生成飞天小猪视频

```bash
export GW="https://ai.ospreyai.cn"
export API_KEY="sk-your-api-key"

# 1. 上传输入图片
curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/upload" \
  -F "image=@/data/file/飞天小猪.png" \
  -F "overwrite=true"

# 2. 提交图生视频工作流
RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/ai/video/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": {
      "93": {"inputs": {"text": "The flying pig with superhero cape flaps its wings happily, flying upward through the clouds, gentle movement, joyful atmosphere, wings flapping, clouds drifting, smooth animation", "clip": ["84", 0]}, "class_type": "CLIPTextEncode"},
      "97": {"inputs": {"image": "飞天小猪.png"}, "class_type": "LoadImage"},
      "98": {"inputs": {"width": 640, "height": 640, "length": 81, "batch_size": 1, "positive": ["93", 0], "negative": ["89", 0], "vae": ["90", 0], "start_image": ["97", 0]}, "class_type": "WanImageToVideo"},
      "94": {"inputs": {"fps": 16, "images": ["87", 0]}, "class_type": "CreateVideo"},
      "108": {"inputs": {"filename_prefix": "video/飞天小猪", "format": "auto", "codec": "auto", "video-preview": "", "video": ["94", 0]}, "class_type": "SaveVideo"}
    }
  }')

echo "$RESPONSE"
# 从响应中提取 prompt_id
PROMPT_ID=$(echo "$RESPONSE" | python -c "import sys,json; print(json.load(sys.stdin)['prompt_id'])")

# 3. 轮询任务状态
while true; do
  STATUS=$(curl -s -H "Authorization: Bearer $API_KEY" "$GW/api/v1/ai/tasks/$PROMPT_ID")
  COMPLETED=$(echo "$STATUS" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('$PROMPT_ID',{}).get('status',{}).get('completed',False))")
  [ "$COMPLETED" = "True" ] && break
  sleep 5
done

# 4. 下载视频（中文文件名用 Python 处理 URL 编码）
python3 << EOF
import os, urllib.request, urllib.parse
gw = os.environ["GW"]; key = os.environ["API_KEY"]
params = urllib.parse.urlencode({"filename": "飞天小猪_00001_.mp4", "subfolder": "video", "type": "output"})
req = urllib.request.Request(f"{gw}/api/v1/ai/image/view/?{params}", headers={"Authorization": f"Bearer {key}"})
data = urllib.request.urlopen(req).read()
with open("/data/file/飞天小猪.mp4", "wb") as f:
    f.write(data)
print(f"下载完成，大小: {len(data)} bytes")
EOF
```
