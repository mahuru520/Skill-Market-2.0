# 完整示例

## 生成小狗图片

```bash
export GW="https://ai.ospreyai.cn"
export API_KEY="sk-your-api-key"

# 1. 提交文生图工作流
RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" -X POST "$GW/api/v1/ai/image/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": {
      "62": {"inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "lumina2", "device": "default"}, "class_type": "CLIPLoader"},
      "63": {"inputs": {"vae_name": "ae.safetensors"}, "class_type": "VAELoader"},
      "66": {"inputs": {"unet_name": "z_image_bf16.safetensors", "weight_dtype": "default"}, "class_type": "UNETLoader"},
      "67": {"inputs": {"text": "A cute fluffy golden retriever puppy, big shiny eyes, sitting on grass, sunny day, photorealistic", "clip": ["62", 0]}, "class_type": "CLIPTextEncode"},
      "68": {"inputs": {"width": 1024, "height": 1024, "batch_size": 1}, "class_type": "EmptySD3LatentImage"},
      "69": {"inputs": {"seed": 12345, "steps": 30, "cfg": 4.5, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1, "model": ["70", 0], "positive": ["67", 0], "negative": ["71", 0], "latent_image": ["68", 0]}, "class_type": "KSampler"},
      "70": {"inputs": {"shift": 3, "model": ["66", 0]}, "class_type": "ModelSamplingAuraFlow"},
      "71": {"inputs": {"text": "blurry, low quality, distorted", "clip": ["62", 0]}, "class_type": "CLIPTextEncode"},
      "65": {"inputs": {"samples": ["69", 0], "vae": ["63", 0]}, "class_type": "VAEDecode"},
      "9": {"inputs": {"filename_prefix": "puppy", "images": ["65", 0]}, "class_type": "SaveImage"}
    }
  }')

echo "$RESPONSE"
# 从响应中提取 prompt_id
PROMPT_ID=$(echo "$RESPONSE" | python -c "import sys,json; print(json.load(sys.stdin)['prompt_id'])")
echo "prompt_id=$PROMPT_ID"

# 2. 轮询任务状态
while true; do
  STATUS=$(curl -s -H "Authorization: Bearer $API_KEY" "$GW/api/v1/ai/tasks/$PROMPT_ID")
  COMPLETED=$(echo "$STATUS" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('$PROMPT_ID',{}).get('status',{}).get('completed',False))")
  [ "$COMPLETED" = "True" ] && break
  sleep 5
done

# 3. 下载图片（subfolder 为空字符串）
curl -s -H "Authorization: Bearer $API_KEY" \
  "$GW/api/v1/ai/image/view/?filename=puppy_00001_.png&type=output&subfolder=" \
  -o /data/file/小狗.png
```
