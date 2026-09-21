# v1.9-3 任务清单

## T1：lastUsedStack 自动记录

**输出**：修改 `cmd-init.mjs` + `cmd-adopt.mjs`

**变更**：
```javascript
// cmd-init.mjs
writeBridgeConfig(projectRoot, { lastUsedStack: workflowKind });

// cmd-adopt.mjs
writeBridgeConfig(projectRoot, { lastUsedStack: externalStack });
```

**验收**：
- init 后 config 含 lastUsedStack = workflow_kind
- adopt 后 config 含 lastUsedStack = external_stack

## T2：推荐逻辑升级

**输出**：在 `config-utils.mjs` 加 `getRecommendedStack(config)` 函数

```javascript
export function getRecommendedStack(config) {
  // 优先级：lastUsedStack > stacks[0] > builtin
  if (config.lastUsedStack && VALID_STACKS.includes(config.lastUsedStack)) {
    return config.lastUsedStack;
  }
  if (config.stacks.length > 0) {
    return config.stacks[0].kind;
  }
  return 'builtin';
}
```

**验收**：
- 有 lastUsedStack → 返回它
- 无 lastUsedStack 但有 stacks → 返回 stacks[0].kind
- 都无 → builtin

## T3：probe 输出加 last_used 字段

**输出**：修改 `cmd-probe.mjs`

**变更**：
```
last_used: matt
```

**验收**：
- probe 输出含 `last_used: <kind>`

## T4：stack_hint 升级

**输出**：修改 `cmd-probe.mjs`

**变更**：stack_hint 从 `stacks[0]?.kind` 改为 `getRecommendedStack(config)`

**验收**：
- 有 lastUsedStack → stack_hint = lastUsedStack
- 无 lastUsedStack → stack_hint = stacks[0].kind

## T5：cmd-stacks reset-used 子命令

**输出**：修改 `cmd-stacks.mjs`

**新增**：
```bash
bridge stacks reset-used
# 重置 lastUsedStack = null
```

**验收**：
- 命令可执行
- 重置后 lastUsedStack = null

## T6：测试实现

**输出**：`tests/last-used-stack.test.mjs`（5 测试）

1. init 后 lastUsedStack 被记录
2. adopt 后 lastUsedStack 被记录
3. probe stack_hint 来自 lastUsedStack
4. probe last_used 字段输出
5. stacks reset-used 重置

**验收**：
- 5 个测试全绿

## T7：ADR-0016 撰写

**输出**：`skills/spec-bridge/docs/adr/0016-context-aware-navigator.md`

## T8：CHANGELOG 更新

**输出**：在 `SKILL.md §7` 加 v1.9-3 条目

## 依赖关系

```
T1 → T2（推荐逻辑）→ T3/T4（probe）
T5（独立）
T6 ← T1-T5
T7 → T8
```

## 预计工作量

- 修改：~50 行
- 新增测试：~100 行
- 文档：~50 行
- **总计**：~200 行变更