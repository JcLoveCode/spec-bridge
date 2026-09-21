# v1.9-3 上下文感知导航（context-aware-navigator）

## 问题

v1.9-1/2 已实现：
- mode 强度级别（full/memory/navigator/off）
- stacks 手动配置
- 探测降为 fallback

但仍缺一个关键能力：**记住上次用的能力栈**。

**用户原话**：
> 只需要根据对话场景和上下文还有上一次用的能力，指引用户用哪个能力

**当前问题**：
- 用户上次用了 matt to-spec
- 隔天再开新 change → bridge 推荐 stacks[0]（可能是 openspec），不是 matt
- 用户每次都得手动 `bridge stacks set matt` 才能让 bridge 记住"我常用 matt"

## 提议方案

### 1. lastUsedStack 字段

**v1.9-1 预留字段**：`config.lastUsedStack`（CLI 自动维护）

```json
{
  "mode": "full",
  "stacks": [
    {"kind": "matt", "priority": 1},
    {"kind": "superpowers", "priority": 2}
  ],
  "lastUsedStack": "matt",
  "updatedAt": "ISO-8601"
}
```

### 2. 自动记录机制

**触发点**：每次 `bridge init` / `bridge adopt` 时自动写入 `lastUsedStack`

```javascript
// cmd-init.mjs (v1.9-3)
const workflowKind = deriveWorkflowKind(...);  // 推导出 workflow_kind
writeBridgeConfig(projectRoot, {
  lastUsedStack: workflowKind  // 自动记录
});
```

### 3. 推荐逻辑升级

**v1.9-3 推荐优先级**：
1. `--workflow-kind` flag（最高）
2. `lastUsedStack`（与 stacks[0] 比，优先 lastUsedStack）
3. `stacks[0]`（用户配置的优先栈）
4. builtin 兜底

**逻辑**：
```javascript
const config = readBridgeConfig(projectRoot);
const candidates = [config.lastUsedStack, config.stacks[0]?.kind, 'builtin']
  .filter(Boolean);
const recommended = candidates.find(c => c !== 'builtin') || 'builtin';
```

### 4. probe 输出加 last_used 字段

```
last_used: matt
```

让 AI 一眼看到"上次你用的是 matt"。

## 预期效果

### Before (v1.9-2)
```bash
# 用户上次用 matt to-spec，今天开新 change
bridge init test-change
# 推荐：openspec（stacks[0]）— 不是 matt！
```

### After (v1.9-3)
```bash
# 上次用了 matt，今天开新 change
bridge init test-change
# 自动写 lastUsedStack=matt
# 推荐：matt（lastUsedStack 优先）
```

## 拍板项

1. ✅ 自动记录 lastUsedStack（CLI 写）是否接受？
2. ⚠️ 推荐优先级 lastUsedStack > stacks[0] vs stacks[0] > lastUsedStack？
3. ⚠️ 用户重置 lastUsedStack 的命令？`bridge stacks reset-used`？