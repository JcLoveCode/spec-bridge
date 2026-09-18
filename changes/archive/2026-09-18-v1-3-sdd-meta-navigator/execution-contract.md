# Execution Contract: v1-3-sdd-meta-navigator

## Intent Lock

让桥成为 SDD 编程的元层导航员：按栈分支 init、按栈指引 next、接管 openspec/matt 历史产物、保持 sync 唯一发布权——桥不生成文档、不代理调用，只管生命周期、衔接与归档。

## Scope Fence

### In Scope

- B1 `bridge next` 按栈路由（含 TDD 测试 4 case）
- B2 `bridge init` 按 `--workflow-kind` 分支（含测试 3 case）
- B3 `bridge adopt <dir>` 新命令 + `bridge list` 加 untracked artifacts 段（含 fixtures 测试）
- B4 SKILL.md §6 + §1 守卫 + ADR-0008 + CONTEXT.md 能力阶梯 v2 + docs-sync-test

### Out of Scope

- D6 v1.4 智能拆解（强模型 handoff + 子 agent 状态机）—— v1.4 单独设计
- spec-kit / spec-superflow 深度路由—— v1.3 只探测标记
- DAG / 多 ticket 并行（spec-superflow SDD 模式）—— bridge 单 change 单线推进
- 桥调 openspec-cn / spec-superflow CLI（CLI 未实测装）—— v1.3 不依赖
- 改 `vendor/` 共享代码（sync/verify/state）—— Q2 已定 sync 唯一

## Approved Requirements

<!-- 映射自 specs/v1-3-sdd-meta-navigator/spec.md。每条 SHALL/MUST 必须有一条测试义务 + 落进至少一个 Batch。 -->

- [ ] **R1** — init-by-workflow-kind：`bridge init` 按 kind 分支，openspec/matt 只建台账，builtin 出 5 模板（测试义务：`tests/init-workflow-kind.test.mjs` 3 case）
- [ ] **R2** — next-advice-by-protocol：`bridge next` advised 含 `protocol` 路由表，按 stage + workflow_kind 推 use_skill（测试义务：`tests/xrouter-protocol.test.mjs` 4 case）
- [ ] **R3** — adopt-external-artifacts：`bridge adopt <dir>` 接管 openspec/matt 历史产物建台账（测试义务：`tests/adopt.test.mjs` 3 case）
- [ ] **R4** — list-untracked-artifacts：`bridge list` 输出 untracked 段（测试义务：含在 `tests/adopt.test.mjs`）
- [ ] **R5** — sync-compat-with-external-sync：`bridge verify` 报 drift 不阻塞（测试义务：手动 + SKILL.md §6 文档规则）
- [ ] **R6** — layout-detect-external-sdd：`bridge layout` 输出 spec-kit / spec-superflow 探测标记（测试义务：`tests/layout-detect.test.mjs`）

## Constraints

<!-- 唯一权威源：design.md ## Decisions。每条 C 编号对到 D 编号。 -->

- **C1**（→ D1）`bridge init` 必须按 `--workflow-kind` 分支：openspec/matt 只建 `.bridge.yaml` + `.bridge.log` + 空 `specs/<cap>/`；builtin 出 5 模板（不改 13 命令清单）
- **C2**（→ D2）`bridge sync` 必须保持桥引擎唯一发布者；openspec 栈下 openspec 自跑 sync-specs → bridge verify 报 drift 不阻塞（规则写进 SKILL.md §6）
- **C3**（→ D3）`bridge adopt` 只识别 openspec 格式（`proposal.md` + `specs/<cap>/spec.md`）和 matt 格式（`.scratch/` + `CONTEXT.md`/ADR）；其他格式输出"未识别"提示，不建台账
- **C4**（→ D4）`bridge layout` 加 spec-kit / spec-superflow 探测标记（输出 1 行）；深度路由不在 v1.3 范围
- **C5**（→ D5）`bridge next` advised.protocol 仅推荐 `use_skill`，不强制执行；用户忽略不影响 stage 推进
- **C6**（→ D6 v1.4 附录）v1.3 不实现 v1.4 智能拆解；ADR-0008 不重审 ADR-0004 边界
- **C7**（→ D7）全没装时仍走 `bridge init` 开户（台账 = 档案员）；SKILL.md §1 例程加 commit/提交前守卫（agent 层，非 CLI 强制）
- **C8**（→ D8）路由表 wayfinder 档位：matt 栈 + stage=planning + 大雾 → `use_skill wayfinder`；小雾 → `use_skill grill-with-docs`

## Execution Batches

<!-- 来源：tasks.md。每批 — 任务号们 — 完成定义 — 审查时点。 -->

- **Batch 1**（TDD 优先）：`T1.1` + `T1.2` — `cmd-next.mjs` 加 PROTOCOL_HINTS 路由表 + 4 case 测试
- **Batch 2**：`T2.1` + `T2.2` — `cmd-init.mjs` 按 kind 分支 + 3 case 测试
- **Batch 3**：`T3.1` + `T3.2` + `T3.3` + `T3.4` — `cmd-adopt.mjs` 新命令 + `bridge list` 加 untracked 段 + dispatch + fixtures 测试
- **Batch 4**：`T4.1` + `T4.2` + `T4.3` + `T4.4` — SKILL.md / CONTEXT.md / ADR-0008 + docs-sync-test
- **Batch N**：`TN.1` + `TN.2` + `TN.3` + `TN.4` + `TN.5` + `TN.6` — sync/verify/why.md/git mv/state set archived/commit/push

## Escalation Rules

- 任一测试 FAIL → 批内停止，回 planning 重开（参照 v1.2 §3 协议）
- R1-R6 任一无法实现 → 回 planning 重开 follow-up change（不开 follow-up 局部修订，遵守 ADR-0005 归档不可变）
- 路由表测试发现 use_skill 名字变了 → 开 v1.3.1 follow-up 同步路由表 + ADR-0008 修订
- SKILL.md §6 与 `cmd-next.mjs` PROTOCOL_HINTS 不一致（docs-sync-test FAIL） → 批内停止，回 planning 修文档