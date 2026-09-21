# ADR-0016: 上下文感知导航（v1.9-3）

- 状态：Accepted（2026-09-21）
- 决策人：JcLoveCode
- 关联 change：changes/v1-9-3-context-aware-navigator/

## 背景

v1.9-1/2 已实现 mode + stacks 手动配置，但缺一个关键能力：**记住上次用的栈**。

**用户原话**：
> 只需要根据对话场景和上下文还有上一次用的能力，指引用户用哪个能力

**当前问题**：
- 用户上次用了 matt to-spec
- 隔天开新 change → bridge 推荐 stacks[0]（可能是 openspec），不是 matt
- 用户每次都得 `bridge stacks set matt` 让 bridge 记住

**v1.9-1 已预留**：`config.lastUsedStack` 字段（CLI 自动维护）

## 决策

### D1. CLI 自动记录 lastUsedStack

**触发点**：`bridge init` / `bridge adopt` 成功后自动写入

```javascript
// cmd-init.mjs (v1.9-3)
writeBridgeConfig(projectRoot, { lastUsedStack: workflowKind });

// cmd-adopt.mjs (v1.9-3)
writeBridgeConfig(projectRoot, { lastUsedStack: externalStack });
```

**拒绝的方案**：让 AI 自己记录 lastUsedStack
**理由**：违反"bridge 是档案员，AI 是决策者"原则；CLI 写比 AI 写更可靠

### D2. 推荐优先级：lastUsedStack > stacks[0] > builtin

```javascript
export function getRecommendedStack(config) {
  if (config.lastUsedStack && VALID_STACKS.includes(config.lastUsedStack)) {
    return config.lastUsedStack;   // 1. 上次用的（最优先）
  }
  if (config.stacks.length > 0) {
    return config.stacks[0].kind;   // 2. 用户配置的优先栈
  }
  return 'builtin';                  // 3. 兜底
}
```

**拒绝的方案**：stacks[0] > lastUsedStack
**理由**：用户上次用了 = 表达"我习惯用这个"——比"我配了优先级"更实际

### D3. probe 输出 last_used 字段

```
stack_hint: matt
last_used: matt
```

让 AI 一眼看到"上次你用的是 matt"——直接当推荐依据。

### D4. bridge stacks reset-used 子命令

```bash
bridge stacks reset-used
# 清空 lastUsedStack → 下次推荐回到 stacks[0]
```

**场景**：用户换了项目栈（如从 matt 换到 openspec），重置历史记录。

### D5. lastUsedStack 存储：项目级 config（不写全局）

```json
{
  "stacks": [...],
  "lastUsedStack": "matt"
}
```

**理由**：不同 repo 可能用不同栈，项目级隔离更合理。

**拒绝的方案**：写全局 ~/.config
**理由**：用户视角"我刚用 matt"是指**当前项目**，不是全局

### D6. 不主动清空 lastUsedStack

**不实现"超时清空"**——lastUsedStack 一直有效，除非用户手动 reset-used。

**理由**：用户的"上次使用"是一个稳定信号；不应自动遗忘

## 影响面

### 修改文件（5 个）

- M `skills/spec-bridge/scripts/cmd-init.mjs`（自动记录）
- M `skills/spec-bridge/scripts/cmd-adopt.mjs`（自动记录）
- M `skills/spec-bridge/scripts/cmd-probe.mjs`（输出 last_used）
- M `skills/spec-bridge/scripts/config-utils.mjs`（+getRecommendedStack +resetLastUsedStack）
- M `skills/spec-bridge/scripts/cmd-stacks.mjs`（+reset-used 子命令）

### 新增测试（5 个）

- A `tests/last-used-stack.test.mjs`：
  - init 自动记录
  - adopt 自动记录
  - probe stack_hint 优先用 lastUsedStack
  - probe 无 lastUsedStack 时回退
  - reset-used 重置

### 测试覆盖

192 → 197（全绿）

## 与其他 ADR 的关系

- **ADR-0014**（命令面板）：lastUsedStack 是 stacks 配置的"动态维度"层
- **ADR-0015**（移除自动探测）：context-aware 进一步减少对探测的依赖（用户上次决定优先）
- **ADR-0007**（无会话状态）：lastUsedStack 写磁盘，不依赖对话记忆

## 风险与限制

1. **lastUsedStack 误判**：用户在 A 项目用 matt，去 B 项目也用 matt → 推荐正确
2. **重置成本**：用户换栈后必须手动 reset-used（否则沿用旧栈）
   - **缓解**：文档提示 + IDE hint（v1.9-4 再优化）
3. **没"最不常用栈"概念**：用户长期不用某栈不会自动遗忘
   - **理由**：用户的"上次"是信号，"长期不用"不在 v1.9-3 范围

## 遗留问题

- **v1.9-4+**（可选）：
  - `lastUsedStack` 自动 expire（如 30 天未用重置）
  - `bridge stacks history` 命令显示历史栈使用记录
  - probe 加 `recommended: <kind>` 字段（基于 lastUsedStack + stacks + inventory 三方）
- **lastUsedStack 粒度**：当前只记 kind，未来可能记 "{used_skill}: {kind}"（更精准推荐）

## 与 ponytail 的对比

ponytail 没有"上次使用"概念——它通过配置文件主动设置。v1.9-3 与 ponytail 不同：
- ponytail：用户主动配置（`PONYTAIL_DEFAULT_MODE`）
- spec-bridge v1.9-3：CLI 自动记录（省去用户操作）

**互补关系**：用户主动配 + CLI 自动记录 → 双重保险