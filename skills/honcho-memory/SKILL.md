---
name: honcho-memory
description: Honcho 用户辩证画像管理。当用户提到"记忆管理"、"用户画像"、"了解我"、"更新画像"、"HONCHO"、"Honcho"、"用户建模"时触发。也用于每次对话结束时或心跳时自动更新 HONCHO.md。实现类似 Hermes Agent 的六大维度用户建模：技术水平、交互节奏、沟通风格、目标取向、情绪基调、矛盾偏好。
---

# Honcho 用户画像管理

基于 Honcho 辩证用户建模原理，在 OpenClaw 记忆中实现 Hermes 风格的六大维度画像系统。

## 核心文件

| 文件 | 作用 |
|------|------|
| `HONCHO.md` | 当前用户画像（六大维度数值 + 注入策略） |
| `USER.md` | 用户背景信息（项目、工具、环境） |
| `references/honcho-dimensions.md` | 六大维度详解 + 推断信号 + 存储格式 |
| `references/dialectic-update.md` | 画像更新算法（加权融合 + 时间衰减 + 矛盾检测） |

## 六大维度（快速参考）

```
1. skill       → 0.0新手~1.0专家，用 subDimensions 记录子领域
2. pace        → 0.0缓慢~1.0极速，用 taskPacing 记录任务节奏差异
3. style       → formal/concise/humor/technicalTerms 组合权重
4. goal        → 0.0探索型~1.0完成型，记录会话 trajectory
5. emotion     → valence(正面/负面) + arousal(激活度) + dominantReaction
6. contradictions → 矛盾对列表，响应时必须兼顾两端
```

**矛盾偏好注入策略（最关键）**：

| 矛盾对存在时 | 响应方式 |
|-------------|---------|
| `(要示例, 讨厌长)` | **折叠式**：关键片段 + "展开完整代码" |
| `(快速出结果, 理解原理)` | **分层式**：先用 + "要深挖哪部分？" |
| `(自动, 手动控制)` | **可配置式**：默认自动 + "可手动覆盖" |

## 工作流

### 1. 触发时机判断

- 用户明确要求更新/查看画像 → 直接执行
- 每次心跳 → 检查是否有新信号，按需更新
- 长对话结束 → 整体回顾更新风格/情绪/矛盾维度
- 新项目/任务出现 → 更新技术子维度

### 2. 画像更新步骤

读取 `references/dialectic-update.md` 了解算法细节后：

```
① 从当前对话中提取信号（见下"信号提取"）
② 判断是否触发矛盾检测（与 HONCHO.md 当前值对比）
③ 加权融合新值 → 更新 HONCHO.md 对应维度
④ 如有矛盾变化 → 更新注入策略注释
⑤ 追加证据到 evidence[]（保留最近20条）
⑥ 写入 memory/YYYY-MM-DD.md 记录本次更新
```

### 3. 信号提取规则

**对话内信号**（每次回复后检查）：

| 信号 | 推断维度 |
|------|---------|
| 查询 ≤ 10字，无寒暄 | pace.fast +0.1，style.concise 确认 |
| 主动问原理/为什么 | goal.explore +0.05，skill 有信心 |
| 直接说"先结论" | style.concise +0.1 |
| 问"还有什么？" | goal.explore +0.1 |
| 问"怎么实现" | goal.complete +0.1 |
| 情绪词（"烦了"/"卡"）| emotion.valence -0.1，stressSignals 追加 |
| 代码/配置修改成功 | skill 子维度 +0.05 |
| 技术术语使用密集 | style.technicalTerms 确认 |

### 4. 画像应用到响应

**每次回复前**（隐式，不需要显式说明）：

```
读取 HONCHO.md 当前值（仅关键维度）：
  style.concise → 控制回复长度
  style.formal  → 决定措辞风格
  pace          → 决定给出探索引导的时机
  contradictions → 检查相关矛盾对 → 应用对应注入策略
  emotion.stressSignals → 避免过于冗长的回复
```

**具体注入**：

```javascript
// 示例：根据画像调整回复策略
const profile = read HONCHO.md current values

if (profile.contradictions.includes('fast-result-vs-understand')) {
  reply = giveSolution() + "\n要深挖哪部分？"
}

if (profile.style.concise > 0.7) {
  reply = makeCompact(reply)  // 删除冗余解释
}

if (profile.emotion.stressSignals.length > 2) {
  reply = shorten(reply)  // 情绪压力大时减少篇幅
}
```

## 隐私原则

- **本地存储**：所有画像数据存在 `workspace/HONCHO.md`，不上传
- **可删除**：用户要求时，清空 HONCHO.md 对应维度即可
- **透明**：证据数组让用户可以查看每条推断的依据
- **用户控制**：用户可随时要求修改任何维度值

## 常见触发语句

> "了解下我的习惯" / "更新下我的画像" / "我的风格是什么"
> "根据我的画像调整" / "我一般是什么节奏"
> "怎么根据 Honcho 记忆管理" / "实现用户画像"
