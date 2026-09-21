# v1-9-3-context-aware-navigator

## Purpose

让 bridge 记住"上次用的能力栈"，避免用户每次手动配置。CLI 自动记录 + 推荐优先级升级，让连续开发时不用每次重设栈。

## Requirements

### Requirement: CLI 自动记录 lastUsedStack

`bridge init` 和 `bridge adopt` SHALL 在成功后自动写入 `lastUsedStack` 字段。

#### Scenario: init 自动记录
- WHEN 用户执行 `bridge init test-change`（workflow_kind 推为 matt）
- THEN `.bridge-config.json` 含 `lastUsedStack: "matt"`

#### Scenario: adopt 自动记录
- WHEN 用户执行 `bridge adopt changes/x --stack openspec`
- THEN `.bridge-config.json` 含 `lastUsedStack: "openspec"`

### Requirement: getRecommendedStack 推荐逻辑

config-utils SHALL 提供 `getRecommendedStack(config)` 函数，按 `lastUsedStack > stacks[0] > builtin` 优先级返回推荐栈。

#### Scenario: lastUsedStack 优先
- WHEN `config.lastUsedStack = "matt"` + `config.stacks[0].kind = "openspec"`
- THEN `getRecommendedStack(config)` 返回 `"matt"`

#### Scenario: 无 lastUsedStack 回退
- WHEN `config.lastUsedStack = null` + `config.stacks[0].kind = "matt"`
- THEN `getRecommendedStack(config)` 返回 `"matt"`

#### Scenario: 全空 fallback builtin
- WHEN `config.lastUsedStack = null` + `config.stacks = []`
- THEN `getRecommendedStack(config)` 返回 `"builtin"`

### Requirement: probe 输出 last_used

`bridge probe` SHALL 输出 `last_used: <kind>` 字段，让 AI 看到"上次你用的是 matt"。

#### Scenario: last_used 字段输出
- WHEN `config.lastUsedStack = "matt"`
- THEN probe 输出 `last_used: matt`

#### Scenario: 未设置时输出 unset
- WHEN `config.lastUsedStack = null`
- THEN probe 输出 `last_used: (unset)`

### Requirement: stacks reset-used 子命令

`bridge stacks` SHALL 支持 `reset-used` 子命令，清空 lastUsedStack。

#### Scenario: 重置 lastUsedStack
- WHEN 用户执行 `bridge stacks reset-used`
- THEN `lastUsedStack` 字段被设为 `null`，输出 `Last-used stack reset.`

### Requirement: probe stack_hint 推荐来源

`bridge probe` 的 `stack_hint` 字段 SHALL 来自 `getRecommendedStack(config)`，按 `lastUsedStack > stacks[0] > builtin` 优先级。

#### Scenario: stack_hint 优先 lastUsedStack
- WHEN `lastUsedStack = "matt"` + `stacks[0] = "openspec"`
- THEN `stack_hint` 为 `"matt"`（不是 `"openspec"`）
