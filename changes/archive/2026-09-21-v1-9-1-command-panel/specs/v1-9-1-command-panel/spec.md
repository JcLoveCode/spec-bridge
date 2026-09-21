## Purpose

为 spec-bridge 引入命令面板 + 持久化配置，参考 ponytail 的 `/ponytail [lite|full|ultra|off]` 设计，让用户对不同的强度级别和手动配置的能力栈进行细粒度控制。

## ADDED Requirements

### Requirement: 命令面板 mode 强度级别

bridge SHALL 支持 4 档预设强度级别：`full` / `memory` / `navigator` / `off`，通过 `bridge mode <preset>` 命令切换。

#### Scenario: 查询当前 mode
- WHEN 用户执行 `bridge mode`（无参数）
- THEN 输出当前 mode + config source（project/global/default）

#### Scenario: 设置 mode
- WHEN 用户执行 `bridge mode full|memory|navigator|off`
- THEN 验证值合法性，写入项目级 `.bridge-config.json`

#### Scenario: 非法值报错
- WHEN 用户执行 `bridge mode foobar`
- THEN 抛错 `Invalid mode: foobar`

### Requirement: 能力栈配置 stacks

bridge SHALL 提供 `bridge stacks list|set|add|remove` 命令族手动配置能力栈。

#### Scenario: 设置多个栈
- WHEN 用户执行 `bridge stacks set matt,superpowers`
- THEN 配置写入 `stacks: [{kind:matt, priority:1}, {kind:superpowers, priority:2}]`

#### Scenario: 追加栈
- WHEN 用户执行 `bridge stacks add openspec`
- THEN 在现有 stacks 后追加 priority = max+1

#### Scenario: 删除栈并重新编号
- WHEN 用户执行 `bridge stacks remove matt`
- THEN 删除后剩余 stacks 的 priority 重新连续编号

### Requirement: 两层持久化配置

bridge SHALL 支持项目级 `<repo>/.bridge-config.json` 覆盖全局 `~/.config/spec-bridge/config.json`。

#### Scenario: 项目级覆盖全局
- WHEN 全局配置 `mode: full`，项目级配置 `mode: navigator`
- THEN `bridge mode` 返回 `navigator, source=project`

#### Scenario: 无配置 fallback
- WHEN 项目级 + 全局都没有配置
- THEN 返回默认值 `{mode: 'full', stacks: []}`

### Requirement: 入口例程读取配置

bridge 入口例程 SHALL 每轮读取配置，根据 mode 决定行为。

#### Scenario: mode=off 跳过自动推荐
- WHEN 配置 `mode: off`
- THEN 入口例程跳过所有自动推荐，只响应显式命令

#### Scenario: stacks 为空 fallback builtin
- WHEN 配置 `mode: navigator` + `stacks: []`
- THEN fallback 到 builtin 模板（保持零配置）

### Requirement: bridge.mjs 命令分发（mode + stacks）

bridge.mjs SHALL 注册 `mode` 和 `stacks` 命令到 dispatcher 并更新 usage 帮助。

#### Scenario: bridge mode 派发
- WHEN 用户执行 `bridge mode navigator`
- THEN 调用 `cmd-mode.mjs run({_:['navigator'], projectRoot:process.cwd()})`

#### Scenario: bridge stacks 派发
- WHEN 用户执行 `bridge stacks set matt,superpowers`
- THEN 调用 `cmd-stacks.mjs run({_:['set','matt,superpowers'], projectRoot:process.cwd()})`

## Related

- ADR-0014：command-panel-and-stacks（10 决策点）
- v1.9-2：移除自动探测（v1.9-1 配置优先于探测）
- v1.9-3：context-aware navigator（lastUsedStack 自动记录）