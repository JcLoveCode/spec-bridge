# Change: v1-3-sdd-meta-navigator

## Why

桥 v1.2 在"SDD 编程的元层导航"上留三个洞：

1. **`bridge init` 无条件生成自家 5 模板**——openspec/matt 栈下抢了对应栈 skill 的活（违反 `CONTEXT.md` L15-17 能力阶梯："原生（openspec/superpowers）→ 次选（matt）→ 兜底（内置），按槽位补位，不按环境整体降级"）
2. **`bridge next` 只指引桥内命令**——不指引到 `openspec-propose` / `grill-with-docs` / `test-driven-development` 等栈工具（用户每次都得自己想起或问 `ask-matt`）
3. **不接管历史 SDD 产物**——企业用户的 openspec / matt 历史 spec 文档，桥认不出，无法建台账接管

企业用户做 SDD 编程时，**已经在用** openspec + superpowers（plan 矩阵）或 matt 或 spec-superflow 这几套之一——桥作为"单入口协议"（v1.1 起的定位）必须识别这些栈并路由，而不是要求用户从零开始用桥自家模板。

> v1.3 的研究产出 `.scratch/v1-3-cross-stack-research.md`（401 行，cited to file:line）证实：5 套栈中 spec-bridge / openspec-cn / spec-superflow 是 3 套同质 Coordinator，superpowers / matt 是 Execution 层；桥的"导航员"角色 = 在 3 套 Coordinator 间选栈，把 Execution 委托给 superpowers / matt / spec-superflow build-executor。

## What Changes

- **新增**：`bridge init --workflow-kind` 按栈分支（`openspec`/`matt` → 只建台账 `.bridge.yaml`+`.bridge.log`+空 `specs/<cap>/`，不生成四件套；`builtin` → 现状 5 模板）
- **新增**：`bridge next` 在 advised 字段追加 `protocol` 跨协议路由表（`stage + workflow_kind` → 推荐 `use_skill X`）
- **新增**：`bridge adopt <dir>` 接管 openspec/matt 历史产物（建台账 + stage 按内容推断）
- **新增**：`bridge list` 输出加 `untracked artifacts:` 段（列出无台账的历史产物 + 建议 adopt 命令）
- **新增**：`bridge layout` 加 spec-kit / spec-superflow 等外部 SDD 工具的探测标记
- **新增**：SKILL.md §1 例程加"多栈并存且未指定 workflow_kind → agent 先问用户"守卫
- **新增**：SKILL.md §6 跨协议路由小节（路由表 + 能力阶梯 v2 摘要）
- **新增**：ADR-0008（Bridge as Cross-Protocol Recommender）
- **修改**：CONTEXT.md "能力阶梯"术语从三层升级为五级（含第 3 级"状态机中断"+ 第 4 级"全无栈 agent 自身"+ 第 5 级"全无栈中栈例外"）
- **修订**：`SKILL.md §2 "Stack C = builtin 最小闭环"` → `Stack C = agent 自由 + 桥档案员`

不改：
- 13 命令清单（init/next/list/layout/state/hashes/sync/verify/event/pattern/mention/rootcause/rebuttal/help）
- `.bridge.yaml` schema
- `vendor/` 共享代码
- SKILL.md §3 协议（只更新 §5/§6）

## Scope

### In Scope

- **B1**：`cmd-next.mjs` 加 `PROTOCOL_HINTS` 路由表（stage + workflow_kind → use_skill）+ 加 4 个测试 case（planning/contracted/executing/archived）
- **B2**：`cmd-init.mjs` 按 `--workflow-kind` 分支（`openspec`/`matt` 只建台账；`builtin` 出 5 模板）+ 3 case 测试
- **B3**：新命令 `cmd-adopt.mjs`（格式识别 openspec/matt，stage 推断）+ `cmd-list.mjs` 加 `untracked artifacts:` 段 + fixtures 测试
- **B4**：`SKILL.md §6` 跨协议路由小节 + `§1` 例程守卫 + `CONTEXT.md` 能力阶梯 v2 术语更新 + `ADR-0008.md` 新写 + `docs-sync-test.mjs` 防文档漂移

### Out of Scope

- **D6 — v1.4 智能拆解**（smart decomposition）：强模型 grill → handoff 执行指南（matt /handoff 优先，桥内置兜底）→ 用户三选一（新窗口低模型 / 调会话模型级别 / 桥 spawn 子 agent 走状态机）。涉及重审 ADR-0004"不代理调用"边界，v1.4 单独设计。
- **spec-kit / spec-superflow 深度路由**：v1.3 只加探测标记（`bridge layout` 多输出一行），深度接管留 v1.4
- **DAG / 多 ticket 并行**（spec-superflow SDD 模式）：bridge 单 change 单线推进不变
- **桥调 openspec-cn / spec-superflow CLI**：本机 openspec-cn CLI 未实测装，v1.3 不依赖
- **改 `vendor/`**（sync/verify/state 共享代码）：保持 v1.2 实现，Q2 已定 sync 桥引擎唯一

### Evidence Base

- `.scratch/v1-3-cross-stack-research.md`（5 套栈 cited 笔记，401 行）
- `changes/archive/2026-09-18-v1-3-research-xrouter/`（research change 全件，bridge 议程已审计通过）
- grill-with-docs 4 轮 interview（Q1-Q12 + motion v3 12 决策全部落定）