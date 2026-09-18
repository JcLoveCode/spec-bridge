# Why — v1-3-sdd-meta-navigator

> **蒸馏规则**（v1.2 D1/D2）：why.md 唯一权威源 = `changes/v1-3-sdd-meta-navigator/design.md` ## Decisions。本文件由批 Batch N.3 单向蒸馏（design.md → why.md）——design.md 才是 source of truth，why.md 是面向读者的"为什么层"摘要，与 spec.md（"做什么层"）互补。
>
> 修订顺序：先改 design.md ## Decisions → 再同步此文件（不反向）。同栈/跨栈续作重新走 `bridge init --parent <archived-id>` 后，会开新的 `<cap>-2/why.md`，按"父 why → 子 why"递增维护（ADR-0005 follow-up 链）。

## D1 — `bridge init` 按 `--workflow-kind` 分支

**问题**：`bridge init foo` 总是生成 5 模板（proposal/design/tasks/execution-contract + specs/spec.md）。但当项目层装的是 openspec（已装）或 matt（备胎）时，openspec 的 `openspec-propose` / matt 的 `to-spec` 自出 proposal+spec.md——桥再写一遍就是抢槽位。

**选项**：A. 保持现状 / B. 按栈分支（openspec/matt 只建台账，builtin 出模板）/ C. 加 `--templates=false` 开关。

**决定**：**B**。

**理由**：能力阶梯原话"原生 → 次选 → 兜底按槽位补位，不按环境整体降级"——`init` 出模板抢了原生栈"规划产物"槽位的活。模板降级为 builtin 兜底，正符合"台账共享，流程独立"（v1.2 §1 workflow_kind 原话）。

**实现落点**：`scripts/cmd-init.mjs` 的 `if (workflowKind === 'builtin')` 包住 5 模板写入块（约 20 行）。openspec/matt 两条分支只写 `.bridge.yaml` + `.bridge.log` + 空 `specs/<cap>/` + init event。

**测试**：`tests/init-workflow-kind.test.mjs` 3 case（openspec / matt / builtin）全 PASS。

## D2 — `bridge sync` 保持桥引擎唯一发布者

**问题**：当 openspec 栈跑 change 时，openspec 自己的 `sync-specs` 也会写 `specs/<cap>/spec.md`。桥要不要让位？

**选项**：A. 桥引擎唯一 + openspec 自行 sync 过则 verify 报差异不阻塞 / B. openspec 栈下调 openspec sync-specs，桥只记账 / C. 双轨。

**决定**：**A**。

**理由**：桥的回执哈希链（`.bridge.yaml` 里 `spec_publication_receipt` + `sha256`）是 v1.2 唯一审计资产——verify 漂移检测、why 笔记 spec-rev、follow-up 链 ADR-0005 全靠它。openspec `sync-specs` 不写桥的回执格式。B 方案会让桥退化成纯台账——放弃审计。C 双轨会出"两份 spec.md 内容相同但回执不同"，verify 必失败。

**兼容规则**（SKILL.md §6.3 同步）：同栈/跨栈 change 都用 `bridge sync` 写回执；若先 `openspec sync-specs` 跑过，verify 报"差异不阻塞"。

## D3 — `bridge adopt <dir>` + `bridge list` 提示

**问题**：用户已有的"用 openspec+superpower/matt 生成 spec 历史 change 目录"——桥要不要自动接管？自动接管会不会误吃别的目录？

**选项**：A. 新命令 `adopt` + `list` 加 untracked 提示 / B. layout 自动补台账 / C. v1.3 不做。

**决定**：**A**。

**理由**：用户明确"衔接用户已经用 openspec+superpower/matt 生成 spec 的历史文档"。B 违反 L46 惰性原则（不匹配的输入不碰状态文件——random 目录会被吃掉）。C 拖太久。

**实现落点**：
- 新 `scripts/cmd-adopt.mjs`（130 行）：三栈识别（openspec 看 `proposal.md`+`specs/<cap>/spec.md`；matt 看 `.scratch/`+`docs/agents/issue-tracker.md`；其他输出"未识别格式，可手填台账"）
- `bridge.mjs` dispatch 加 `adopt` 入口 + `listChanges()` 加 `untracked_artifacts[]` 段
- 拒绝覆盖（已有 `.bridge.yaml` → exit 2）+ 拒绝空目录（无接管信号 → exit 2）

**测试**：`tests/adopt.test.mjs` 4 case（R3 × 3 + R4 × 1）+ 2 fixture（`tests/fixtures/external-openspec-spec/` + `tests/fixtures/external-matt-proposal/`）。

## D4 — spec-kit / 其他 SDD 工具：只探测不深度路由

**问题**：除了 openspec-cn 和 matt，还有 spec-kit / spec-superflow 等 SDD 工具，要不要接管？

**选项**：A. v1.3 只加探测标记（layout 一行）/ B. 三格式 + spec-kit 也接管 / C. 通用启发式。

**决定**：**A**。

**理由**：v1.3 识别 openspec-cn + matt 两种"已实测装好"的格式足够。其他 SDD 产物 v1.3 只在 `bridge layout` 输出探测标记（"发现外部 SDD 产物：spec-kit"），深度接管留 v1.4。C 通用启发式违反"空仓库测试"——random 目录会被吃掉。

**实现落点**：`bridge layout` 探测输出里加 `external_sdd_artifacts: [spec-kit]` 段（不阻塞，标记用）。

## D6 — v1.4 智能拆解（明确附录）

**说明**：用户提"智能拆解"——把"大雾 change 自动拆为多个小 change"的桥智能。涉及 ADR-0004"不代理调用"边界重审。**v1.3 不做，v1.4 单独开 change**。

**为什么 v1.3 不做**：智能拆解要 LLM 介入（澄清槽位 + 意图分解），是 L4 agent 自身的本职，桥在 L3/L5——这是能力阶梯 v2 的边界。桥替 LLM 做拆解就是 LLM 越界（L4 边界守 L3 的 catch-all）。

**v1.4 留的事**：开 change `v1-4-smart-decomposition`，重审 ADR-0004，把"明确不代理"的边界松到"代理意图拆解、不代理实现调用"。

## D7 — 全没装时（第 3 级）仍走 init 开户

**问题**：当仓库既没装 openspec 也没装 matt（栈探测全空），agent 自由开发不建 change 目录——bridge 怎么知道该介入了？

**选项**：A. init 仍开户（台账 = 档案员，agent 自由 + 桥只在提交时介入）/ B. 不 init，靠 adopt 补台账 / C. 完全不走 change，只 specs 蒸馏。

**决定**：**A**。

**理由**：用户担忧"提交时能检测到么"——三层检测链兜死：
1. 有 `.bridge.yaml` → `bridge list` 直接看到
2. 有目录无台账 → `bridge list` 的 untracked 提示 → `bridge adopt`
3. 连目录都没写 → SKILL.md §1 例程守卫要求 agent 在 commit/提交/归档前先跑 `bridge list`，既无活跃也无 untracked 但工作区有 diff → agent 先 `init` 补账

B 假设"agent 至少留了目录"，真自由开发可能没有（用户担忧成立）。C 丢 ADR-0005/0006 因果链与模式标签。

**SKILL.md §1 守卫句**："恢复时先报一行：当前 change / stage / next / 能力快照，然后续做"——把"agent 自由开发不建账"补成 SKILL.md 入口例程的硬步。

## D8 — 路由表 wayfinder 档位（matt 栈意图澄清分档）

**问题**：matt 整栈的规划期 skill 按变更规模分两档——小雾（一个 session 装得下）vs 大雾（绿地、季度级）。桥要不要给两档分别给 use_skill？

**选项**：A. 加 wayfinder 档位（matt 栈 + stage=planning + 大雾）/ B. 不加。

**决定**：**A**。

**理由**：澄清槽位分两档：
- **小雾**（一个 session 装得下）→ `use_skill grill-with-docs`
- **大雾**（装不下、绿地、季度级）→ `use_skill wayfinder` → 出意图地图后 handoff `to-spec`

wayfinder 不是被排除在桥外，而是 matt 栈的"大雾档"。桥不替 agent 判定"小雾还是大雾"——这是 L4 agent 自身判断（变更文件数 / tasks.md 批次数 / 季度级信号），桥只**给两档都给提示**，由 agent 选。

**实现落点**：`scripts/cmd-next.mjs` `PROTOCOL_HINTS[planning][matt]` —— `[\`use_skill grill-with-docs\`, \`use_skill wayfinder\`]`，agent 看变更规模二选一。

**测试**：`tests/xrouter-protocol.test.mjs` R3 case 验"matt planning 推荐 grill-with-docs + wayfinder"。

---

## Out-of-scope decisions（明确不做的）

- **D6**（v1.4 智能拆解）：涉及 ADR-0004 重审，留 v1.4（见上）
- **spec-superflow SDD 模式**（多 wave 并行）：bridge 不引入 DAG 数据结构
- **桥调 openspec-cn CLI**（CLI 未实测装）：v1.3 不依赖 CLI，仅识别产物格式建台账

## Risks & Mitigations

| 风险 | 缓解 |
|---|---|
| 路由表过期（use_skill 名字变了） | 加路由表测试 + `docs-sync-test.mjs` 自证 + 季度巡检任务 |
| 修订改路由表时漏改 SKILL.md §6 | B4 T4.4 `docs-sync-test.mjs` 验证 §6 路由表与 `cmd-next.mjs` PROTOCOL_HINTS 一致 |
| 全没装时 agent 忘记 init | SKILL.md §1 例程守卫：commit/提交/归档前先 `bridge list` |
| v1.3 自举（v1.3 自己改 next，但 next 已要用 v1.3 能力指引） | v1.3 实现期 next 输出还按 v1.2 路由（builtin）；v1.3 自身用 `use_skill test-driven-development` + 手填四件套走完 |