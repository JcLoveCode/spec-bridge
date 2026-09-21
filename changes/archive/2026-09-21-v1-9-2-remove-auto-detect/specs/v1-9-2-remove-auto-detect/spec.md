## Purpose

将 v1.8-1/2 引入的自动探测（`vendor/detect-stack.mjs`）从主路径移除，降级为 v1.9-1 stacks 配置为空时的 fallback。v1.9-3 计划完全删除探测模块。

## ADDED Requirements

### Requirement: bridge init workflow_kind 派生

`bridge init` SHALL 优先使用 v1.9-1 stacks 配置作为 workflow_kind 派生，无配置时才走探测 fallback。

#### Scenario: stacks 配置优先
- WHEN 项目根有 superpowers 信号 + 用户配置 `stacks set openspec`
- THEN workflow_kind 推为 openspec（来自配置），不是 superpowers（探测）

#### Scenario: 探测 fallback 仍生效
- WHEN 无 stacks 配置 + 项目根有 matt 信号（.claude-plugin + matt-skills）
- THEN workflow_kind 推为 matt（来自探测 fallback）

### Requirement: bridge adopt external_stack 派生

`bridge adopt` SHALL 按 `--stack flag > stacks 配置 > 信号探测 fallback` 三段优先级派生 external_stack。

#### Scenario: --stack 显式覆盖
- WHEN 用户执行 `bridge adopt --stack openspec`（与 stacks 配置冲突）
- THEN external_stack 为 openspec（显式优先）

#### Scenario: stacks 配置优先于信号
- WHEN 用户配 `stacks set matt` 且无 --stack flag
- THEN external_stack 为 matt（来自配置）

#### Scenario: 信号探测 fallback
- WHEN 无 --stack flag + 无 stacks 配置
- THEN external_stack 走 `detectStackFromSignals()` 启发式

### Requirement: bridge probe stack_hint 输出

`bridge probe` SHALL 输出 `stack_hint` 字段（来自配置或探测 fallback）。

#### Scenario: stack_hint 来自配置
- WHEN 用户配置 `stacks set matt,superpowers`
- THEN probe 输出 `stack_hint: matt`

#### Scenario: stack_hint 来自探测
- WHEN 无 stacks 配置 + 项目根有 matt 信号
- THEN probe 输出 `stack_hint: matt`

### Requirement: 配置完全覆盖探测

当用户配置 stacks 时，磁盘特征信号（superpowers/matt/openspec/）SHALL 被完全忽略。

#### Scenario: 配置胜过 superpowers 信号
- WHEN 项目根有 superpowers 信号（.claude-plugin + package.json:superpowers）+ 配置 stacks set openspec
- THEN init 推 openspec（来自配置）

## Related

- ADR-0015：remove-auto-detect（7 决策点）
- ADR-0014：命令面板（v1.9-2 是其应用层）
- v1.9-3：context-aware navigator（进一步减少对探测的依赖）