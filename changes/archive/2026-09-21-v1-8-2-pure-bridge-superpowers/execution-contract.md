# Execution Contract: v1-8-2-pure-bridge-superpowers

## Intent Lock

把 bridge 砍成"纯导航员"——init 不写 spec 模板 + superpowers 进入项目栈优先级；bridge 只建台账 + 路由，外栈产物由外栈自管。

## Scope Fence

### In Scope

- 删 `cmd-init.mjs` 的 `--builtin` flag + 5 件模板常量 + `fillTemplate` 函数 + 模板写入代码块
- 扩 `WORKFLOW_KINDS` 值域为 4 个
- `vendor/detect-stack.mjs` 加 superpowers 双信号探测 + 改优先级
- `cmd-probe.mjs` 改 fallback reason 文案
- 测试更新 / 新增（4 套）
- SKILL.md §7 + AGENTS.md 同步
- 新加 ADR-0012
- archive 流程（sync / verify / distill / archive-ready / git mv / stage=archived / commit + push）

### Out of Scope

- 不改 probe 路由优先级（C6 写死）
- 不改 distill/sync/archive-ready 行为（external_stack 接管逻辑不变）
- 不加 `--matt` / `--openspec` / `--superpowers` 显式栈 flag
- 不改 SKILL.md §2 / §6 多栈并存守卫
- 不在 v1.8-2 改 superpowers advised_invocation 映射细节

## Approved Requirements

- [ ] **R1** — bridge init 不再写 spec 模板：默认 + `--builtin` flag no-op + usage 字符串同步（测试义务：init-no-builtin.test.mjs 3 测试）
- [ ] **R2** — superpowers 加入项目栈探测优先级：双信号 + 优先级排序 + 信号缺失兜底（测试义务：detect-stack-superpowers.test.mjs 4 测试）
- [ ] **R3** — WORKFLOW_KINDS 值域扩为 4 个：合法值 + 非法值报错（测试义务：init-workflow-kind.test.mjs 扩值域用例）
- [ ] **R4** — probe fallback 文案引导 brainstorming：无 inventory 时 advised_reason 新文案 + advised_invocation fallback 对齐（测试义务：probe-fallback-bridge-pure.test.mjs 2 测试）
- [ ] **R5** — 删除 5 件模板常量与 fillTemplate 函数：grep 验证无残留（测试义务：grep + import 引用检查）

## Constraints

- **C1**（来自 ADR-0011 D7）：所有"默认行为变"必须配逃生口 flag。本 change 是例外——砍掉 `--builtin` 没有逃生口（叙事"纯桥"硬约束）。
- **C2**（来自 ADR-0001）：bridge 不现场合并文本，所有合并走 CLI。
- **C3**（来自 ADR-0010 D4）：probe 不自动调 skill，只输出 advised_skill/invocation 给 AI 看。
- **C4**（来自 ADR-0011 D2）：detect-stack 探测信号以多信号为稳，superpowers 双信号与 matt 对称。
- **C5**（来自 ADR-0005）：归档 stage=archived 后不可改；本 change 走完整 archive 流程。
- **C6**（来自 AGENTS.md 禁止事项 §3）：改 schema 字段名要先开 ADR。本 change 改 `workflow_kind` 值域（**不是字段名**）——值域扩是允许的（v1.8-2 ADR-0012 决策）。

## Execution Batches

- **Batch 1**（砍 builtin 模板生成）— T1.1 cmd-init.mjs 删 builtin + T1.2 WORKFLOW_KINDS 扩值域 — 完成定义：grep 验证 + init 测试通过
- **Batch 2**（superpowers 加入 detect-stack）— T2.1 detect-stack.mjs 加 superpowers 信号 + T2.2 文件头标同步 — 完成定义：detect-stack 4 测试通过
- **Batch 3**（probe fallback 文案调整）— T3.1 cmd-probe.mjs advised_reason 改 + T3.2 advised_invocation fallback 改 — 完成定义：probe fallback 测试通过
- **Batch 4**（测试覆盖）— T4.1 删旧 builtin 测试 + T4.2 新加 init-no-builtin + T4.3 新加 detect-stack-superpowers + T4.4 改 init-workflow-kind + T4.5 新加 probe-fallback-bridge-pure — 完成定义：`npm test` 全绿，9+ 测试
- **Batch 5**（文档 + ADR）— T5.1 新加 ADR-0012 + T5.2 SKILL.md §7 CHANGELOG + T5.3 AGENTS.md 禁止事项 — 完成定义：grep 验证 + 文档查找
- **Batch N**（归档）— TN.1 sync + TN.2 verify + TN.3 distill + TN.4 archive-ready + TN.5 git mv + TN.6 stage=archived + TN.7 commit + push

## Escalation Rules

执行过程中遇到以下情况必须停下回 planning 重开：

- 砍 `--builtin` 后 CI/脚本回归（v1.8-1 老 flag 用法报错）→ 评估是否加 `--builtin-deprecated` 兼容 flag
- superpowers 双信号误判（`@scope/superpowers-util` 之类 npm 包误触发）→ 收紧字段匹配（如只匹配 `keywords`）
- probe fallback 新文案用户反馈看不懂 → 评估是否加具体 skill 名（如 `superpowers:brainstorming`）
- archive sync 校验失败（spec.md 结构问题）→ 与 v1.8-1 一样走 `sync --external-skip` 或改 spec.md