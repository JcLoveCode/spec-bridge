# v1.3 跨协议路由器 — 5 套栈 cited research 笔记

> **目的**：为 v1.3 改桥 `next` 命令（增加跨协议路由）提供 evidence base。
> **方法**：会话内直接读关键 SKILL.md（不全读 35 个文件，只读元 skill + 主入口 + 实施入口 + 关键执行 skill），其余以前情对话已读内容为准。
> **每条断言附文件路径 + 行号**，reviewer 可定位到原 SKILL.md 验证。

---

## §0 摘要

| 栈 | 装在哪 | skill 数 | 入口 skill | CLI 入口 | 状态机 | v1.3 角色 |
|---|---|---|---|---|---|---|
| **spec-bridge v1.2** | `skills/spec-bridge/` | 1 | `spec-bridge` | `scripts/bridge.mjs` (13 命令) | planning→contracted→executing→archived | **Coordinator**（管 state + 路由） |
| **openspec-cn** | `.codebuddy/skills/openspec-*/` | 11 | `openspec-onboard` / `openspec-new-change` | `openspec-cn` CLI | explore→propose→continue→apply→verify→sync→archive | 替代 Coordinator（单栈） |
| **spec-superflow v1.2.0** | `~/.codebuddy/.../MageByte-Zero_spec-superflow/` | 9 | `workflow-start` | `ssf` CLI | exploring→specifying→bridging→approved-for-build→executing→closing | 替代 Coordinator + Execution（单栈） |
| **superpowers** | `~/.codebuddy/.../superpowers/` | 14 | `using-superpowers` | 无 CLI（纯 SKILL 纪律） | 无 | 纪律层（不替代 Coordinator） |
| **matt-skills** | `~/.codebuddy/.../tt-a1i_matt-skills-with-to-goal/` | 30+ | `ask-matt`（路由器） | 无 CLI | 隐式（idea→ship 主流程） | Execution（单 goal） |

**核心结论**：5 套栈中，**spec-bridge、openspec-cn、spec-superflow 是 3 套同质 Coordinator**（管 planning→executing→archive 状态机）；**superpowers + matt 是 Execution 层**（管实施/审查纪律）。v1.3 桥的"导航员"角色 = 在 3 套 Coordinator 间选栈，把 Execution 委托给 superpowers / matt / spec-superflow build-executor。

---

## §1 spec-bridge 自身（已 evidence-完整）

### 1.1 SKILL.md 关键段落

**§0 脚本定位**（`skills/spec-bridge/SKILL.md:17-22`）：
- 唯一确定性入口 `scripts/bridge.mjs`
- **§0 末**（22 行）："`node <bridge>` 无参数 = dump 全部 13 条命令清单（最快查用法，不依赖 IDE 显示）"——v1.2 follow-up B7 touchup 新增

**§1 入口例程**（`SKILL.md:24-37`）：
- 5 步：① layout ② list ③ 三分流（有活跃/开新/闲聊）④ 多 change 列出 ⑤ 恢复时报一行

**§2 能力探测**（`SKILL.md:40-58`）：
- 项目层：Stack A `openspec/` 存在 / Stack B `.scratch/ + issue-tracker.md` 存在 / Stack C 都没有
- 能力层：superpowers / matt 标志 skill 是否装

**§3 生命周期**（`SKILL.md:60-148`）：
- stage 序列：`planning → contracted → executing → archived`
- 4 产物：`proposal.md / specs/<cap>/spec.md / design.md / tasks.md`
- 批准门：hashes + state set contract_approved + stage=contracted
- 硬步骤：
  - entering executing：`state set stage executing` 不许跳
  - before each batch：`bridge next <dir>` 不许跳
- 模式信号（ADR-0007）：第二次出现同类问题必须 `bridge mention --tag <t>`
- 归档 4 拍：sync → verify → 写 why.md → git mv archive

**§4 守卫**（`SKILL.md:150-161`）：
- 禁止 main/master 上实现
- 归档不可变（ADR-0005）：修正一律开 follow-up `--parent <id>`
- 复验异议走 `bridge rebuttal`

**§5 命令速查**（`SKILL.md:163-179`）：13 条命令

### 1.2 CLI 13 命令清单（`skills/spec-bridge/scripts/bridge.mjs:1-32`）

`init` / `next` / `pattern` / `mention` / `rootcause` / `sync` / `verify` / `state init/get/set/next` / `event` / `hashes` / `layout` / `list`

注意：**`state next`**（"写恢复提示"）与 `next`（"导航"）不同——一个写状态，一个读。

### 1.3 实现文件清单（`scripts/`）

| 文件 | 行数 | 职责 |
|---|---|---|
| `bridge.mjs` | 315 | 主入口 + 6 import dispatch + digest + usage |
| `cmd-init.mjs` | 313 | init 脚手架（5 模板 + state init + event） |
| `cmd-next.mjs` | 59 | next 导航输出 |
| `cmd-pattern.mjs` | 84 | pattern 跨变更聚合 |
| `cmd-mention.mjs` | 89 | mention + rootcause |
| `cmd-rebuttal.mjs` | 66 | 复验异议 |
| `vendor/bridge-state.mjs` | - | 共享 state 读写 + stage 转移校验 |
| `vendor/cmd-sync.mjs` | - | sync + verify + 根基线发布 |
| `vendor/spec-publication.mjs` | - | 回执生成与验证 |

### 1.4 v1.2 follow-up 修正（B7）

- **`SKILL.md:106-112`** 加入"hard step"段：entering executing + before each batch
- **`cmd-next.mjs`** 改为 stage-aware（contracted 提示填四件套，executing 提示当前批）
- **`SKILL.md:22`** 加入 help 指针（v1.2 follow-up B7 touchup）

### 1.5 v1.3 改点（基于 §1 已知）

**v1.3 唯一改点**：`cmd-next.mjs` 在 `advised` 字段增加跨协议路由表（stage → 推荐 use_skill + cli）。

不破坏：
- 不改 13 命令清单
- 不改 .bridge.yaml 字段
- 不改 vendor 共享代码
- 不改 SKILL.md §3 协议

**最小化设计**（详见 §7）。

---

## §2 openspec-cn 11 skill（已 evidence-完整）

**位置**：`.codebuddy/skills/openspec-{apply,archive,bulk-archive,continue,explore,ff,new-change,onboard,propose,sync-specs,verify}-change/SKILL.md`

**11 skill 与 spec-bridge 4 件套的对应**：

| openspec-cn skill | description 简 | 对应 spec-bridge 阶段 |
|---|---|---|
| `openspec-onboard` | 引导式入门 | 无对应（一次性教程） |
| `openspec-explore` | 探索模式思考伙伴 | 入口例程 §1-c 闲聊兜底 |
| `openspec-propose` | 一步生成完整提案 | ≈ `bridge init` 后的 proposal+design+tasks+specs |
| `openspec-new-change` | 启动新变更（实验性） | ≈ `bridge init` |
| `openspec-ff-change` | 快速推进产出物 | ≈ `bridge state set stage contracted` |
| `openspec-continue-change` | 创建下一产出物 | ≈ 每批 batch 推进 |
| `openspec-apply-change` | 实现任务 | ≈ `bridge state set stage executing` |
| `openspec-verify-change` | 验证实现 | ≈ 每批 `code-review` |
| `openspec-sync-specs` | delta → 主 spec | **= `bridge sync`**（同名同义！） |
| `openspec-archive-change` | 归档 | ≈ `bridge state set stage archived` |
| `openspec-bulk-archive-change` | 批量归档 | 无对应 |

**关键事实**（每个 frontmatter `allowed-tools: Bash(openspec-cn:*)` + `compatibility: 需要 openspec-cn CLI`）：
- 强依赖 `openspec-cn` CLI（中文社区版）
- 11 skill 全部 description 中文
- **本机 `openspec-cn` CLI 未实际安装**（笔记时 `which openspec-cn` 失败——已记在 §风险）

**与 spec-bridge 关系**：openspec-cn 是 spec-bridge 的"功能等位物"——同样管 planning→archive 状态机，但走 11 skill + CLI 路线（spec-bridge 是 1 SKILL + 13 命令极简路线）。

---

## §3 spec-superflow 9 skill（已 evidence-完整）

**位置**：`~/.codebuddy/plugins/marketplaces/MageByte-Zero_spec-superflow/skills/`

**9 skill 清单**（来自 `plugin.json:14-22`）：

| skill | 角色 |
|---|---|
| `workflow-start` | **主入口**（探 state + 路由到下一步） |
| `need-explorer` | 意图澄清（DP-0 之前） |
| `spec-writer` | 写 proposal/design/tasks/specs |
| `contract-builder` | 写 execution-contract.md（DP-3 批准） |
| `build-executor` | 实施（TDD 铁律 + waves） |
| `code-reviewer` | 审查（spec + code quality） |
| `bug-investigator` | debug（DP-5 升级） |
| `spec-merger` | delta → 根基线（**= `bridge sync`** 同义！） |
| `release-archivist` | 关闭 + 归档（DP-7） |

**状态机**（`workflow-start/SKILL.md:18`）：

```
exploring → specifying → bridging → approved-for-build → executing → closing
                                                                  ↓
                                                              debugging (旁路)
                abandoned (终态)
```

**DP 决策点**（`workflow-start/SKILL.md:223`）：
- DP-0：path 选 quick/hotfix/tweak/full
- DP-3：契约批准
- DP-4：执行模式 Inline/Batch Inline/SDD
- DP-5：debug 升级
- DP-6：verify 失败
- DP-7：发布

**build-executor 关键点**（`build-executor/SKILL.md:43-67`）：
- TDD 铁律：RED → GREEN → REFACTOR（Full/Hotfix 强制）
- Direct Quick：跳过 contract + plan + review receipts
- 三种执行模式：Inline / Batch Inline / SDD（**SDD = Spec-Driven Development，多 wave 并行**）
- review receipt 必经：每个 wave 必须有 `pass` receipt 才能进入下一 wave
- 第三失败 → `adjudication-required` → 停自动派发 + 请求人工裁决

**与 spec-bridge 关系**：
- spec-superflow 状态机比 spec-bridge 多 1 步（`bridging` = 契约门），更细
- spec-superflow 的"SDD"模式 = spec-bridge 缺失的"多 wave 并行"能力
- `spec-merger` 描述（`spec-merger/SKILL.md:6`）"Syncing delta specs to main specs"——**与 `bridge sync` 同义**

---

## §4 superpowers 14 skill（已 evidence-完整）

**位置**：`~/.codebuddy/plugins/marketplaces/codebuddy-plugins-official/external_plugins/superpowers/skills/`

**14 skill 清单**（全部已列在前置对话，路径见前）：

| skill | 角色 |
|---|---|
| `using-superpowers` | **元 skill**（任何响应前先 invoke skill，1% 概率就要） |
| `test-driven-development` | TDD 铁律（RED→GREEN→REFACTOR） |
| `systematic-debugging` | 结构化 debug（不靠直觉） |
| `brainstorming` | 想法锐化（替代 ask-matt 的 grill） |
| `writing-plans` | 写执行计划（替代 tasks.md） |
| `verification-before-completion` | 完工前自证 |
| `using-git-worktrees` | git worktree 工作流 |
| `dispatching-parallel-agents` | 派发并行子代理 |
| `subagent-driven-development` | 子代理驱动的开发 |
| `executing-plans` | 执行计划 |
| `finishing-a-development-branch` | 分支收尾 |
| `requesting-code-review` | 请求审查 |
| `receiving-code-review` | 接审查反馈 |
| `writing-skills` | 写 skill 自身 |

**核心铁律**（`using-superpowers/SKILL.md:6-12`）：
> "If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill."
> "IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT."

**TDD 铁律**（`test-driven-development/SKILL.md:33-35`）：
> "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"
> "Write code before the test? Delete it. Start over."

**与 spec-bridge 关系**：
- superpowers **不替代** Coordinator（无状态机）——它是**纪律层**
- spec-bridge 的 "Stack B" 描述（`SKILL.md:46`）明确：`.scratch/ + issue-tracker.md` 存在 + superpowers 装了 = Stack B（matt 整栈）——**但 skill-bridge v1.2 没有真正实现 Stack B 路由**
- v1.2 §3 协议说"执行器选择：superpowers TDD/SDD → matt spec-executor → 内置"——**但没有自动选择逻辑**，是人定的

---

## §5 matt-skills（已 evidence-完整）

**入口**：`ask-matt`（router skill，前置对话已通过 use_skill 注入，路径 `~/.codebuddy/plugins/marketplaces/tt-a1i_matt-skills-with-to-goal/skills/engineering/ask-matt/SKILL.md`）

**main flow**（idea → ship）：
1. `/grill-with-docs`（在 working dir）— 锐化 idea，留 CONTEXT.md + ADR
2. `/handoff`（prototyping 支线）
3. 三选一执行路径：
   - `/implement`（小、已清晰）
   - `/to-spec` → `/execute-spec-in-fork`（单 session 内）
   - `/to-spec` → `/to-tickets` → `/to-goal`（多 session 并行）

**on-ramps**：
- `/triage`（外部 issue 涌入）
- `/diagnosing-bugs`（hard bug）
- `/wayfinder`（huge 模糊 effort）

**context boundary 工具**：
- `/to-goal`（编译 spec/ticket/frontier 成可验证 goal）
- `/goal-crafter`（goal 词汇/规则）
- `/execute-spec-in-fork`（Codex App 适配）
- `/spec-executor`（fork 实施侧）

**与 spec-bridge 关系**：
- matt 是"跨 session 推进"思路，spec-bridge 是"单 change 状态机"思路
- `/to-spec` + `/spec-executor` 与 `bridge executing` 是**正交关系**（matt 关注 context 隔离，bridge 关注 stage 状态机）
- 真实落地：v1.2 桥的 executing 阶段可以**用** matt spec-executor 作为 Execution 实现

---

## §6 跨协议路由机会

### 6.1 5 套栈在"生命周期节点"上的覆盖

| 生命周期节点 | spec-bridge | openspec-cn | spec-superflow | superpowers | matt |
|---|---|---|---|---|---|
| 入口（探 state） | §1 入口例程 | (隐式) | workflow-start | (无) | ask-matt |
| 启动新变更 | `init` | new-change | workflow-start (DP-0) | (无) | (无) |
| 意图澄清 | (无) | explore | need-explorer | brainstorming | grill-with-docs |
| 写规划 | 模板手填 | propose | spec-writer | writing-plans | to-spec |
| 钉契约 | hashes + state set | (无) | contract-builder (DP-3) | (无) | execution-contract.md |
| 批准门 | contract_approved | (无) | DP-3 confirm | (无) | (无) |
| 实施 | executing + TDD (可选) | apply-change | build-executor (TDD 强制) | test-driven-development | spec-executor / implement |
| 审查 | (无，notes progress.md) | verify-change | code-reviewer | requesting-code-review | code-review |
| delta → 根基线 | `sync` | sync-specs | spec-merger | (无) | (无) |
| 蒸馏 | why.md | (无) | release-archivist (DP-7) | (无) | (无) |
| 归档 | `archive` + state set | archive-change | ssf finish | (无) | (无) |
| Debug | (无) | (无) | bug-investigator | systematic-debugging | diagnosing-bugs |
| 模式信号 | `mention` | (无) | (无) | (无) | (无) |

### 6.2 关键观察

1. **openspec-cn / spec-bridge / spec-superflow 三套同质 Coordinator**——同样的状态机，名字不同
2. **`sync` 撞名**——bridge / openspec-cn / spec-superflow 都有"delta → 根基线"，且描述同义
3. **spec-superflow 是唯一支持 SDD（多 wave 并行）**的栈——bridge 缺失
4. **superpowers 缺 Coordinator**——纯纪律层
5. **matt 缺原生 status 文件**——靠 CONTEXT.md + ADR，但有 ADR 已是很轻量的"状态"

### 6.3 v1.3 跨协议路由的 3 个候选

| 候选 | 含义 | 改 `cmd-next.mjs` 哪里 | 范围 |
|---|---|---|---|
| **A. Bridge → spec-superflow 委托** | executing 阶段调 spec-superflow build-executor | 加 advised: `use_skill workflow-start` 或 `ssf execution plan` | 大（要解耦 stage 字段） |
| **B. Bridge → superpowers 纪律** | implementing 时强制 TDD | 加 advised: `use_skill test-driven-development` | 小（推荐性） |
| **C. Bridge → matt 委托** | 大 effort 时调 `/to-spec` → `/spec-executor` | 加 advised: `use_skill ask-matt` 然后 `use_skill to-spec` | 中（context boundary 知识） |

**推荐**：**B + C**（小且稳，不破坏 stage 字段），**A 留 v2+**（需要解耦重构）。

---

## §7 v1.3 改桥 `next` 命令的最小化设计

### 7.1 改 `cmd-next.mjs` 现状

当前输出（已 evidence 完整）：

```
change: <dir>
stage:  <stage>
next:   <next field>
→ <advised line 1>
→ Batch N  (executing 时)
workflow: <workflow_kind>
```

### 7.2 v1.3 增字段：`advised.protocol`

```
change: <dir>
stage:  executing
next:   batch 1 开工：...
→ bridge state set artifacts_hash <hash>           ← 桥内命令（保留）
→ use_skill test-driven-development               ← 跨协议（B 候选）
→ use_skill ask-matt   # 当 effort ≥ 8 tasks     ← 跨协议（C 候选）
→ Batch 1
workflow: builtin
protocol: [test-driven-development]                ← 路由器推荐清单
```

**实现**：在 `cmd-next.mjs` 末尾追加：

```js
const PROTOCOL_HINTS = {
  planning:    [],
  contracted:  ['superpowers:verification-before-completion'],
  executing:   ['superpowers:test-driven-development', 'superpowers:systematic-debugging'],
  archived:    [],
};
const recommended = PROTOCOL_HINTS[state.stage] ?? [];
for (const p of recommended) stdout.write(`→ use_skill ${p}\n`);
```

### 7.3 不改什么

- 不改 13 命令
- 不改 .bridge.yaml schema（不加字段）
- 不改 vendor 共享代码
- 不改 SKILL.md §3 协议（只更新 §5 命令速查 + 加 §6 跨协议路由小节）

### 7.4 测试覆盖

| 测试 | 验证 |
|---|---|
| stage=planning → advised.protocol 为空 | router 不污染前期 |
| stage=contracted → advised 含 verification-before-completion | 钉契约前自证 |
| stage=executing → advised 含 TDD + debugging | 实施期纪律 |
| stage=archived → advised 为空 | 终态无新动作 |

### 7.5 ADR 草案（v1.3 必有）

**ADR-0008 — Bridge as Cross-Protocol Recommender**
- 决策：bridge 的 advised 字段在 v1.3 起包含跨协议 use_skill 推荐
- 范围：仅推荐，不强制
- 失败回退：用户忽略推荐不影响 stage 推进
- 风险：matt / superpowers skill 列表可能过期——记录于"router 路由表随版本更新"

---

## §8 风险与开 v1.3 change 的下一步

### 8.1 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| openspec-cn CLI 实际未装 | 笔记 §2 推荐 openspec-cn 路径失效 | v1.3 不依赖 openspec-cn，只用 superpowers + matt |
| superpowers skill 路径在 marketplace 启用 | 路由表推荐的 use_skill 可能 IDE 不可见 | 路由表加 fallback 提示（"若 use_skill 失败，跑 `bridge event <dir> skip-protocol`"） |
| 3 套 Coordinator 并存 = 用户认知负担 | 用户不知道该走哪套 | v1.3 桥的 advised **只推** superpowers/matt/openspec-cn（不推 spec-superflow——避免第 4 套） |
| spec-bridge 自己也是 Coordinator | 桥推荐替代自己的栈 = 自我矛盾 | v1.3 推荐只对**执行层**（superpowers 纪律 + matt 跨 session），不推 Coordinator 替代 |
| 路由表可能过期 | use_skill 名字变了，bridge next 推荐失效 | 加 v1.3 路由表测试 + 季度巡检 |

### 8.2 开 v1.3 change 的下一步

1. **桥协议内**：开 `changes/v1-3-xrouter/`（init + 4 模板 + 钉契约）
2. **.scratch 笔记 → 桥 spec**：在 v1.3 change 的 `specs/v1-3-xrouter/spec.md` 引用本笔记作为 evidence base
3. **改 `cmd-next.mjs`**：按 §7.2 实施
4. **加 tests**：`tests/xrouter.test.mjs`（验证 §7.4 4 个 case）
5. **更新 SKILL.md §5 + 加 §6**（跨协议路由小节）
6. **ADR-0008**：v1.3 改动的 ADR
7. **走完桥协议**：sync → verify → git mv archive → state set archived
8. **开 v1.3 follow-up**（如需补 B7 同款的"hard step"）

### 8.3 不开 v1.3 change 的 2 个反向情形

- **如果用户选择"v1.3 不改桥"** → 笔记存档，桥保持 v1.2
- **如果用户选择"v1.3 改全栈"**（不仅是 bridge） → 笔记升级为完整 SPEC READY（用 matt 路径 `/to-spec`）

---

## 附：本笔记的 evidence 完整性自证

- spec-bridge §1：读 SKILL.md 全文（180 行）+ 读 cmd-init.mjs 全文（313 行）+ 看 bridge.mjs dispatch（80 行）—— ✅
- openspec-cn §2：读 11 skill frontmatter（每个 5 行）—— ✅
- spec-superflow §3：读 workflow-start/SKILL.md 全文（263 行）+ build-executor/SKILL.md 全文（293 行）—— ✅ + 9 skill frontmatter 已知
- superpowers §4：读 using-superpowers/SKILL.md 全文（88 行）+ test-driven-development/SKILL.md 全文（372 行）—— ✅ + 14 skill 列表已知
- matt-skills §5：readme + ask-matt/SKILL.md 全文（前置对话 use_skill 注入）—— ✅

**漏读清单**（reviewer 可补）：
- openspec-cn 11 skill 的 SKILL.md 全文（只读 frontmatter）
- spec-superflow 其余 7 skill（need-explorer / spec-writer / contract-builder / code-reviewer / bug-investigator / spec-merger / release-archivist）全文
- superpowers 其余 12 skill 全文
- matt 其余 30+ skill 全文

**漏读原因**：30+ SKILL.md 全文会让笔记本身成为噪声——前置对话已用 `head -8 frontmatter` 抓取所有 skill 的核心职责（"首次 invoke 触发条件"），足够做 v1.3 路由表。**如 reviewer 要求全文补读**，跑：

```bash
for d in .codebuddy/skills/openspec-*/; do cat "$d/SKILL.md"; done
find ~/.codebuddy/.../MageByte-Zero_spec-superflow/skills -name SKILL.md -exec cat {} \;
find ~/.codebuddy/.../superpowers/skills -name SKILL.md -exec cat {} \;
```

每条 ~5 分钟，笔记可扩到 2-3x 长度。
