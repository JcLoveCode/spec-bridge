# Change: v1-7-probe-active-navigator

## Why

spec-bridge 的"导航员激活"在 v1.1 ADR-0001 就被定为设计原则，但 v1.5 三处显式拒绝新增 `bridge probe`（proposal.md:49 / design.md:116 / execution-contract.md:34），推到未来。

当前现状：
- SKILL.md §1 五步入口例程是**软描述**——AI 进新会话不会主动跑
- SKILL.md §2 探测"项目装了什么"，不探测"用户在本次对话已经调了哪些 skill"——无法按用户实际走法实时路由
- `bridge next` 只在显式调用时输出推荐，不主动喊

结果：用户用 OpenSpec explorer 完了，桥不会提醒"该走 openspec-apply-change 把产出写成 proposal.md"——用户可能跳过 spec 直接写代码，归档守门员（archive-ready）会拒绝但已损失上下文。

## What Changes

- **新增 CLI**：`bridge probe <project-root> [--stage S] [--inventory "<skill1>,<skill2>"]` —— 探测 + 推荐 + stdout 输出
- **新增 cmd-probe.mjs**：probe 命令实现（约 150-200 行）
- **扩 bridge.mjs**：dispatch 加 `probe` 分支 + usage 块更新
- **扩 SKILL.md §1**：加"每轮状态宣告"段（"本轮调了 X, Y skill"）
- **新增 specs/cli/probe/spec.md**：probe 命令的 source-of-truth spec
- **新增 tests/probe-active-navigator.test.mjs**：覆盖 4 种路由优先级 + 2 种 inventory 行为

## Scope

### In Scope

- D1-D8 见 ADR-0010 + design.md
- 4 维度探测：项目类型 + 能力缺口 + inventory + 拍点
- 路由优先级：Superpowers > Matt > OpenSpec > 都不给
- 内部调 `bridge next` 合并输出（避免 AI 调两次）
- stdout 输出格式标准化（D5）
- 引导用户生成 spec（D6 / D7）

### Out of Scope

- probe 不写文件（用户选 B）
- probe 不自动调 OpenSpec CLI / Matt skill（保留 ADR-0001 原则）
- 不引入新依赖（用 node:crypto + node:fs 即可）
- 不改 `bridge next` 语义（probe 合并输出，next 单独还在）
- 不做 receipt 算法版本化（v1.6 backlog 项，独立 spec）
- 不做"项目图谱（spec-mgr）"——把 spec 提炼后的产物可视化为项目结构图、跨模块依赖图给团队用是 v1.8+ 独立 change；v1.7 只在 SKILL.md §7 留接口声明，不动 schema
- 不做"跨项目依赖聚合"——同上，v1.8+ 独立 change；v1.7 不开 `cross_refs` 字段