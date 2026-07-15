# 画像更新算法：辩证投票 + 时间衰减

> 读取时机：执行画像更新时（每次 heartbeat 或关键交互后）。
> 需要理解更新逻辑时读取，不每次对话都加载。

---

## 核心原则

1. **不覆盖，只融合**：新信号与旧画像合并，而非替换
2. **矛盾是特征**：检测到矛盾时显式写入矛盾表，不强行折中
3. **时间衰减**：旧证据权重随时间指数衰减，防止画像僵化
4. **证据驱动**：每次更新都附上推断依据，便于解释

---

## 更新触发时机

| 时机 | 更新内容 |
|------|---------|
| 每次心跳（~30min） | 检查是否有新信号，更新维度 |
| 每次长对话结束 | 整体回顾，更新风格/情绪/矛盾 |
| 关键事件 | 重大技术决策 → 更新技能子维度；情绪异常 → 更新情绪基调 |
| 每周 | MEMORY.md 提炼 → 整体画像复核 |

---

## 加权更新公式

```
newValue = α * signal + (1 - α) * oldValue
```

`α` = 信号权重，范围 `0.0 ~ 1.0`

**权重参考**：

| 信号类型 | α（权重） |
|---------|---------|
| 显式表达（"我是新手"） | 0.8 |
| 行为信号（等待时间长） | 0.4 |
| 短查询（<10字） | 0.5 → pace +0.1 |
| 代码片段存在 | 0.5 → skill 子维度更新 |
| 矛盾信号 | 0.7 → 写入矛盾表 |

---

## 时间衰减

```
effectiveWeight = α * decayFactor
decayFactor = e^(-λ * daysSinceLastUpdate)
```

`λ`（衰减系数）：默认 `0.05`（30天后权重降至约22%，90天≈1%）

**示例**：30天前的信号，衰减后实际权重 ≈ 0.8 × 0.22 ≈ 0.18

---

## 辩证矛盾检测

**触发条件**：新信号与已有画像的差异 > 阈值 `θ = 0.4`

**检测流程**：

```
if abs(newSignal - oldValue) > θ:
    if 矛盾表已有此对:
        更新矛盾强度 += 0.1（上限 1.0）
    else:
        写入矛盾表 [(偏好A, 偏好B, 强度)]
        强度 = abs(newSignal - oldValue)
```

**更新后的注入策略变化**：
- 矛盾强度 ≥ 0.6 → 响应必须兼顾矛盾两端
- 矛盾强度 < 0.6 → 可以偏向新信号的方向

---

## 证据追加

每次更新追加证据到 `evidence[]`：

```json
{
  "evidence": [
    {
      "signal": "短查询：'当前模型'",
      "inferred": "pace.fast",
      "date": "2026-05-09",
      "turn": "explicit-query"
    }
  ]
}
```

证据保留最近 **20 条**，超过时删除最早的。

---

## 快速更新脚本（伪代码）

```python
def update_dimension(dimension, new_signal, signal_type, confidence=0.5, decay_days=0):
    alpha = SIGNAL_WEIGHTS[signal_type]
    decay = math.exp(-0.05 * decay_days)
    effective_alpha = alpha * decay

    old_value = profile[dimension]
    new_value = effective_alpha * new_signal + (1 - effective_alpha) * old_value

    # 矛盾检测
    conflict = abs(new_signal - old_value)
    if conflict > 0.4:
        log_contradiction(dimension, old_value, new_signal, conflict)

    profile[dimension] = new_value
    profile[f"{dimension}_confidence"] = min(1.0, confidence + 0.1)
    profile["lastUpdated"] = today()
    append_evidence(dimension, new_signal, signal_type)
```

---

## 更新后动作

1. **写入 HONCHO.md**：`profile` 部分更新
2. **如果矛盾表变化**：重新计算受影响维度的注入策略
3. **如果 skill 子维度变化**：影响下次回复的技术深度预期
4. **写入 memory/YYYY-MM-DD.md**：记录本次更新内容和依据
