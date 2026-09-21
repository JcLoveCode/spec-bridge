# Change: v1-8-2-pure-bridge-superpowers

## Why

v1.8-1 (ADR-0011) 把 bridge 改成"默认只建台账 + 自动 probe 路由"，但仍留两个口子：
- **`--builtin` 逃生口**：bridge init 仍可生成 5 件内置模板（proposal/design/tasks/spec/execution-contract）
- **detect-stack 没把 superpowers 当一等公民**：项目根有 superpowers 信号时，init 仍按 matt > openspec > builtin 推导，可能把 superpowers 栈项目误判成 openspec/matt

实战发现两个痛点：
1. **`--builtin` 与"导航员优先"叙事冲突**——bridge 既然声称是导航员，就不该同时兜底写模板。实战中用户跑 `bridge init` 后被自动 probe 推到外栈（matt `to-spec` / openspec-propose），但同时 `--builtin` 还能生 builtin 5 件模板——两套产物并存，外栈产物接管时 builtin 模板还留在 change 目录里污染 archive
2. **superpowers 栈用户被误推 openspec**——项目根有 `.claude-plugin/` + `package.json:superpowers` 字段（双信号），按 v1.8-1 detect-stack 应派 openspec（因为 matt 信号缺 matt-skills 字段，openspec 信号只查 openspec/ 目录），但 superpowers 用户其实想被推 superpowers 的 tdd/brainstorming——这是更基础的开发能力

v1.8-2 砍掉 builtin 兜底 + 把 superpowers 加进优先级，bridge 进入"纯桥模式"。

## What Changes

- **D1 砍 `--builtin` flag**：bridge init 永远不写 proposal/design/tasks/spec/execution-contract；只建 `.bridge.yaml` + `.bridge.log` + 空 `specs/<cap>/` 目录 + 自动 probe
- **D2 superpowers 加入 detect-stack**：项目根有 `.claude-plugin/` + `package.json` 含 `"superpowers"` 字段（双信号）→ primary = `superpowers`；优先级调整为 `superpowers > matt > openspec > builtin`
- **D3 WORKFLOW_KINDS 值域扩为** `{superpowers, openspec, matt, builtin}`：cmd-init.mjs / cmd-adopt.mjs / bridge.mjs 全栈同步
- **D4 probe fallback 行为**：无外栈时 advised_skill 返 `(none)` + reason 文案改为"AI 用 brainstorming 或直接编辑自由发挥"
- **D5 测试更新**：删 `--builtin` 旧测试 + 新加 superpowers 探测测试（双信号在/缺一/全缺）+ init 无 builtin 行为验证
- **D6 文档同步**：`SKILL.md §7` 加 v1.8-2 CHANGELOG 段 + `AGENTS.md` 禁止事项 §3 增补 schema 扩字段

## Scope

### In Scope

- `cmd-init.mjs`：删 `--builtin` flag + 5 件模板常量 + `fillTemplate` 函数（约 165 行）
- `vendor/detect-stack.mjs`：加 `hasSuperpowersSignals` 函数 + 改优先级 + 加 superpowers 输出字段（约 25 行新增/改）
- `cmd-init.mjs`：扩 `WORKFLOW_KINDS` 值域（1 行）
- `cmd-probe.mjs`：改 fallback reason 文案（1 行）
- 测试：删 init 相关 builtin 测试 + 新加 superpowers 探测测试 + fallback 引导测试
- `SKILL.md §7`：加 v1.8-2 CHANGELOG 段
- `AGENTS.md`：禁止事项 §3 增补 v1.8 schema 扩字段说明
- archive: sync + verify + distill + archive-ready + git mv + stage=archived + commit + push

### Out of Scope

- **不**改 probe 路由优先级（C6 写死 Superpowers > Matt > OpenSpec > builtin，本 change 不动）
- **不**改 distill/sync/archive-ready 行为（外栈产物自管机制不变）
- **不**加 `--matt` / `--openspec` / `--superpowers` 显式栈 flag（用户已经能 `--workflow-kind`，多 flag 重复）
- **不**改 SKILL.md §2 / §6 多栈并存守卫（v1.6 设计已稳）
- **不**改探身信号细节（如 superpowers 是否用 package.json `keywords` 之外的位置探测）—— 双信号就够，不堆砌