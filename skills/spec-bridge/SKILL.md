---
name: spec-bridge
description: Single-entry workflow router that bridges user-installed OpenSpec (planning artifacts) and Superpowers (execution discipline), with Matt-skills as a full alternative stack and built-in protocols as the always-available fallback. Invoke when a repo contains active change directories (openspec/changes/*/ or changes/*/ with a .bridge.yaml), or when the user asks to start, continue, resume, plan, contract, implement, execute, archive, sync, or distill a change or spec-driven workflow. Do not invoke for unrelated coding tasks or questions that do not touch a change.
---

# Spec Bridge

单入口路由：把"规划（OpenSpec）— 执行（Superpowers）— 归档（自带引擎）"接成一条流水线，
三家缺谁都不瘫痪。所有确定性操作走 CLI（`scripts/bridge.mjs`），你只做判断和交互。

**铁律**

1. **状态只在磁盘**：`.bridge.yaml`（每个 change 一份）。路由每轮重算，不依赖对话记忆。
2. **prompt 管判断，代码管操作**：合并/校验/回执永远调 CLI，绝不让 LLM 现场合并文本。
3. **零配置**：任何仓库开箱即用；不匹配当前消息的输入是**惰性的**——不创建、不修改任何状态。

## 0. 脚本定位

本 skill 目录下的 `scripts/bridge.mjs` 是唯一确定性入口（下文所有命令里的 `<bridge>` 指它的绝对路径，
即本 SKILL.md 所在目录拼 `scripts/bridge.mjs`）。Node ≥ 20。

**查命令**：`node <bridge>` 无参数 = dump 全部 14 条命令清单（最快查用法，不依赖 IDE 显示）。

## 1. 入口例程（每次触发先走这五步，不许跳过）

```
① 定位项目根（git root 或 cwd）→ node <bridge> layout <project-root>
② node <bridge> list <project-root>          # 活跃 change 清单 + untracked_artifacts[] 段
③ 三分流：
   a. 有活跃 change + 消息是继续/实现/归档它 → 读该 change 的 .bridge.yaml，恢复到对应阶段
   b. 消息是开新变更 → §3 起头
   c. 都不是（闲聊/无关任务）→ 不碰任何状态文件，直接正常处理消息
④ 多个活跃 change 且意图不明 → 列出清单让用户选，绝不猜
⑤ 恢复时先报一行：当前 change / stage / next / 能力快照，然后续做
```

**多栈并存守卫**（v1.3 起，list 输出结构变了）：
- `list` 返回 JSON 有两段——`changes[]`（tracked，台账已建）和 `untracked_artifacts[]`（产物在但没台账，如外栈的 openspec/matt 旧 change）。
- 有 `untracked_artifacts` 项时，**先停下来问用户**："要不要 `bridge adopt` 接管？"——别自动开新 change 把外栈历史覆盖掉。
- 三栈（openspec / matt / builtin）可能**同时存在**于一个仓库：list 输出的每条 change 带 `workflow_kind` 字段标识，混着用没问题；归档/同步各自走各自的。

换对话、聊岔了、隔了几天——重复这套例程即可，磁盘状态就是全部真相。
产物与状态矛盾时，**以产物为准**（状态文件丢了就按内容重建）。

## 1.5 每轮状态宣告（v1.7 / 导航员激活）

AI 在**每轮回复的第一行**必须写一行 inventory 宣告——用户可见、AI 可追溯：

```
[inventory] 本轮调了：<skill1>, <skill2>, ...
```

规则：
- **不宣告不算已用**——没写这一行的 skill 视为没调（审计追溯以宣告为准）
- inventory 内容必须传给 probe：`bridge probe . --inventory "<同上一行内容>"`
- probe 路由按 inventory 的栈归属判定（C6：Superpowers > Matt > OpenSpec > 兜底）
- 空轮次（只回答用户问题没调 skill）也要写：`[inventory] 本轮调了：(none)`
- AI 不靠"内心记忆"——每轮开头重写一次（即使上轮写过）
- 多栈并存时按优先级顺序写，例：`[inventory] 本轮调了：superpowers:test-driven-development, openspec:apply-change`

设计动机：probe 的路由输入是 `--inventory` flag；AI 不宣告 → 用户看不到调过啥 → 审计黑洞；
没宣告的 skill 在下一轮 probe 时不会出现在 inventory → 路由退到兜底，导航失活。

详见 `specs/cli/probe/spec.md`（probe 命令的 source-of-truth spec）。

## 2. 能力探测（每个 change 只做一次，结果写入 capabilities）

**项目层**（这个仓库用哪套栈，文件系统证据）：

| 标记 | 栈 |
|---|---|
| `openspec/` 目录存在 | **Stack A**：openspec 出规划产物 |
| `.scratch/` + `docs/agents/issue-tracker.md` 存在 | **Stack B**：matt 整栈（`to-spec`/`to-goal`/`spec-executor`） |
| 都没有 | **Stack C**：自带最小闭环（照跑，不瘫痪） |

**能力层**（这台机器装了什么，看本会话 skill 清单）：superpowers 标志 skill
（test-driven-development / systematic-debugging）、matt 标志 skill（spec-executor / to-goal / tdd）。

规则：栈按项目层定；栈内缺的**槽位**用能力层补（如 Stack A 但 superpowers 未装 → 执行槽位退到
matt `spec-executor` 或内置协议）。只装一半不降级换栈。探测完写一行报告给用户：

```
本次变更：openspec(规划) + matt spec-executor(执行) + 内置(sync+蒸馏)
```

## 3. 生命周期

change 目录名：`<需求号>-<slug>`（一个需求号分支可承载多个 change）。

### planning → 产出 4 产物

`changes/<name>/{proposal.md, specs/<capability>/spec.md, design.md, tasks.md}`
（openspec 在场则由它生成；Stack B 用 `to-spec`；Stack C 给模板手写——形态必须同构）。

> **v1.3 按 `workflow_kind` 分支产物路径**（设计 D3）：
> - `bridge init foo --workflow-kind openspec` → **只建台账**（`.bridge.yaml` + `.bridge.log` + 空 `specs/<cap>/`），不写 5 模板；产物由 openspec 自出。
> - `bridge init foo --workflow-kind matt` → 同上，只建台账；产物由 `to-spec` 自出。
> - `bridge init foo` 或 `--workflow-kind builtin`（默认）→ 5 模板（proposal/design/tasks/execution-contract + specs/spec.md），与 v1.2 R1 行为一致。
> 接外栈已存在的 change 用 `bridge adopt <dir>`（不写产物、不动文件、只建台账 + 大事记；见 §5 / R4）。

- delta spec 格式：`## ADDED/MODIFIED/REMOVED/RENAMED Requirements` + `### Requirement: 名称`
  + `#### Scenario:`（WHEN/THEN）。中英文标题均可，路径必须 `specs/<capability>/spec.md`。
- `design.md` 必须有 `## Decisions` 段——它是后面 why 蒸馏的唯一权威源。
- 开工守卫：当前分支是 `main`/`master` → 停下，要求切/建需求号分支。**不建 worktree**。

一键脚手架（v1.1+，推荐入口）：

```bash
node <bridge> init <name> --capability <cap> --branch <需求号分支> --capabilities <快照> \
  [--workflow-kind <openspec|matt|builtin>]   # 缺省取 capabilities 首值，再缺省 builtin（ADR-0004）
  [--parent <archived-change-id>]             # 开续作 follow-up（ADR-0005）：父必已归档，自动快照其 artifacts_hash
```

或手工初始化状态：

```bash
node <bridge> state init <change-dir> --layout <openspec|standalone> --branch <需求号分支> --capabilities <快照>
```

### contracted → 契约压缩 + 批准门

按 [references/contract-mapping.md](./references/contract-mapping.md) 把 4 产物压缩成
`execution-contract.md`（映射表 + 需求覆盖交叉检查），展示给用户，**显式批准才过门**：

```bash
node <bridge> hashes <change-dir>                       # 取当前摘要
node <bridge> state set <change-dir> artifacts_hash <值>
node <bridge> state set <change-dir> contract_hash <值>
node <bridge> state set <change-dir> contract_approved "<批准摘要>"
node <bridge> state set <change-dir> stage contracted
node <bridge> state next <change-dir> "已批准契约，待执行"
```

未批准不执行，无例外。

### executing → 按 [references/executor-protocol.md](./references/executor-protocol.md) 执行

> **hard step — entering executing**（不许跳过）
> 批准门过 → 立刻 `state set <dir> stage executing`，否则 `bridge next` 永远停在 contracted，无法感知批进度。
> 自证：`bridge next <dir>` 输出 `stage: executing`。

> **hard step — before each batch**（不许跳过）
> 每批开工前先 `bridge next <dir>` —— 看 stage / next / advised / Batch N（执行中追加）四行确认当前拍点；不一致时停下核对。
> 批末：`state next <dir> "<下批一句话>"`（next 字段以 `Batch N:` 起头会自动触发末尾追加 `→ Batch N`），再调一次 `bridge next` 留痕。

- 执行器选择（按能力快照）：superpowers TDD/SDD 纪律层（契约作输入锚点）→
  matt `spec-executor` + `tdd`/`code-review` → 内置协议 + 派发子代理（implementer-prompt 模板）。
- 执行方式**自动启发式**（≤2 任务 inline；有并行波次才派发），开工时向用户报告一行**但不阻塞**。
- TDD 铁律 + 每批完成必须过一道审查，结论写进 `<change-dir>/progress.md`（无回执引擎，台账先行）。
- 每批/每次中断收尾：`node <bridge> state next <change-dir> "<下一步一句话>"`。

**契约过期检测**（每次续做执行前跑）：

```bash
node <bridge> hashes <change-dir> --check   # 漂移 → 停，回到 contracted 重生成契约
```

**模式信号（ADR-0007 硬性步骤，不许跳过）**：执行中识别到"同类问题**第二次**出现且已找到根因"
→ 必须调 `node <bridge> mention <change-dir> --tag <t> [--note <一句话>]`（结构化根因用 `rootcause`）记录信号。
桥输出全库历史计数，N≥2 会建议开 follow-up。桥不存会话状态——"会话内第二次"的判定由本协议保证，
压缩后重提触发重复提示是可接受的退化（ADR-0007）。

**导航**（任一拍可跑，纯读）：`node <bridge> next <change-dir>` 输出 stage + next + 按拍建议。

### archived → 四拍，一个用户可见的归档步骤

```
① 发布    node <bridge> sync <change-dir>        # delta → 根基线，写 sha256 回执（vendored 引擎）
② 校验    node <bridge> verify <change-dir>      # 回执重算通过才继续
③ 蒸馏    写 specs/<capability>/why.md           # 单向蒸馏，见下
④ 归档    git mv 到 changes/archive/<YYYY-MM-DD>-<name>/，state set stage archived
```

**为什么蒸馏（why 蒸馏）的硬规则**（详见 ADR-0003）：

- 只蒸馏**有发布回执**的 change（回执 = 已发布标记）
- 唯一权威源：该 change `design.md ## Decisions`；还原不出来的写"why 未知"，**禁止编造**
- 产物：`specs/<capability>/why.md`，每条 = 结论 + 溯源链接 + `spec-rev: <回执hash>`
- **只写 why.md，永不写 spec.md**（回执 hash 只盖 spec.md，基线保持确定性）
- 定时通道（如果有自动化）：按 commit 界扫 `specs/` + `changes/archive/` 增量补漏，只做兜底

## 4. 守卫（Guardrails）

- 禁止在 `main`/`master` 上实现
- 未过批准门不执行；`hashes --check` 漂移不执行
- `verify` 失败不许进 archived；归档前必须 `sync` 成功
- 归档不可变（ADR-0005）：`changes/archive/` 下的产物不编辑，修正一律开续作 `init <name> --parent <id>`；
  `patching` 旁路（`archived → patching → re-archived`）要求 parent 必填——CLI 已强制（sync exit 4 / state set 白名单）
- 复验异议走 `bridge rebuttal`（rebuttals/ 落盘，零状态变更），是否升级续作由人决定（提示不决策）
- 不删除 delta spec（`changes/` 是活动事实源 + 留痕，根基线只是发布产物）
- 跨 change 冲突（同一 requirement 被多个活跃 change 修改）→ 引擎会拦，交人工定顺序
- 不匹配的对话输入不碰状态文件（惰性原则）
- 不 push、不开 PR、不动 issue tracker，除非用户显式要求

## 5. 命令速查

| 命令 | 用途 |
|---|---|
| `layout <root>` | 探测 openspec/standalone 布局 |
| `list <root>` | 活跃 change 清单（含 `untracked_artifacts[]` 段——v1.3，`archived_count` 字段报告 archive 历史条数——v1.4） |
| `init <name> [flags]` | 一键脚手架（`--workflow-kind` 分支产物 / `--parent` 见 §3） |
| `adopt <dir>` | 接外栈已存在 change——只建台账，不动产物（v1.3 B3a） |
| `next <dir>` | 导航：stage + next + 按栈 `→ protocol:` 路由（v1.3） |
| `state init/get/set/next <dir>` | 状态读写（含 workflow_kind/parent/tags） |
| `hashes <dir> [--check]` | 产物摘要 / 契约过期检测（归档漂移提示续作） |
| `sync <dir>` | delta → 根基线 + 发布回执（archive/ 路径 exit 4） |
| `verify <dir>` | 回执重算（closing guard；失败提示双轨） |
| `pattern --tag <t> [root]` | 跨变更 tag 聚合，含归档（ADR-0006） |
| `mention/rootcause <dir> --tag <t>` | 模式信号 + 全库历史计数（ADR-0007） |
| `rebuttal <dir> <一句话>` | 复验异议落盘（rebuttals/，零状态变更） |
| `event <dir> <text>` | 追加大事记到 `.bridge.log` |

> v1.3 起 14 条（原 13 + 新增 `adopt`）。详见 §6 跨协议路由 + ADR-0008。

## 6. 跨协议路由（v1.3，cross-protocol router）

> **角色重申**（承接 ADR-0004）：桥**只推荐** use_skill，**不代理调用**——下文出现的 `use_skill X` 都是给 agent 看的字面量提示，不是 spawn。

### 6.1 路由表（stage × workflow_kind）

`bridge next` 输出末尾的 `→ protocol:` 段按 `stage + workflow_kind` 二维查表给出 use_skill 推荐：

| stage \ kind | builtin（兜底） | openspec | matt |
|---|---|---|---|
| **planning** | （不推荐，由内置协议自带产物生成） | `use_skill openspec-propose`（出 proposal.md） | `use_skill grill-with-docs`（小雾）<br>`use_skill wayfinder`（大雾 / 季度级 — 出意图地图后 handoff to-spec） |
| **contracted / contracted_approved** | （不推荐 — 等批准门） | — | — |
| **executing** | `use_skill test-driven-development`<br>`use_skill requesting-code-review` | `use_skill openspec-apply-change`<br>`use_skill test-driven-development` | `use_skill spec-executor`<br>`use_skill tdd` |
| **patching / archived / abandoned** | — | — | — |

> **不路由的位置**：前置阶段（planning@builtin@openspec）由各自产物生成器接管，桥不必指；终态（archived/patching/abandoned）路由只读，不写执行槽位。

### 6.2 能力阶梯 v2（五级）

`§2` 原三级（原生 → matt → 内置）升级为五级，按**槽位**补位不按栈整体降级：

| 级 | 含义 | 示例 |
|---|---|---|
| **L1 原生** | 项目层的官方插件 | openspec 的规划产物、superpowers 的 TDD/审查 |
| **L2 matt** | 整栈备胎 | matt `spec-executor` / `to-spec` / `tdd` |
| **L3 状态机中断** | 桥的导航员角色接管 | `bridge next` 报拍点、`bridge adopt` 接管外栈 |
| **L4 agent 自身** | LLM 即技能，CLI 不替代 | 写决策摘要、批内化解方案澄清、模式信号判断 |
| **L5 桥档案员保留** | 桥本职（无法替代） | 台账读写、归档蒸馏、回执签发 |

> **关键不变量**：每槽位独立探测、独立兜底（"只装一半不降级换栈"，§2）；桥不替代 L1/L2，只在 L3/L5 现身；L4 是 LLM 的本职，不是 CLI 的事。

### 6.3 sync 兼容规则

跨栈归档必须满足：

1. **台账共享**：`changes/<name>/.bridge.yaml` 一份；`workflow_kind` 字段标识走哪条流程线，不分目录。
2. **归档目录共享**：所有栈的 `git mv` 都进 `changes/archive/<YYYY-MM-DD>-<name>/`，不分栈归档。
3. **根基线共享**：`specs/<capability>/spec.md` 不分栈 — `sync` 引擎（vendored）做 delta apply，对全部栈都生效；同栈/跨栈续作均可（`init --parent <archived-id>`）。
4. **回执盖同基线**：`sync` 写入的 sha256 回执对应 `spec.md`，不分栈覆盖；`why.md` 单向蒸馏同此。

> 例：matt 栈开 `foo` change → openspec 栈续作 `foo-2 --parent foo` → 内置栈归档 → 三栈共享台账、归档目录、根基线。

### 6.4 与 ADR-0004 的关系

桥**仍是导航员 + 档案员**（ADR-0004），不调度。§6.1 的 `use_skill X` 是 **stdin 提示**——给 agent 看的"下一步该调哪个 skill"——不 spawn、不代理、不阻塞。同命令同一拍同一输出，agent 看着决定执行哪个 use_skill，桥不干预。

新增的设计点是：

- **跨栈感知**：`bridge next` 现在读 `workflow_kind`，出对应栈的 use_skill 列表；不再是单一内置协议叙事（ADR-0001 的"单入口路由"含义扩展为"按栈路由"，仍然单入口）。
- **三栈并存守卫**：`bridge list` 的 `untracked_artifacts[]` 段让外栈历史产物显形，避免被新 builtin change 覆盖（D4 / B3a）。
- **能力阶梯 L3/L4 区分**：把"状态机中断"和"agent 自身"从原"次选/兜底"拆出来——前者是 CLI 接管能力空白，后者是 LLM 本职不该 CLI 化。

详见 ADR-0008（设计源）+ §1 多栈并存守卫 + CONTEXT.md 能力阶梯 v2 术语。

## 7. 未来路线（v1.7+ 留口子）

bridge 当前只做"提炼 + 归档"。未来要加的"项目图谱层"——把 spec 提炼后的产物可视化为项目结构图、跨模块依赖图、改动影响图，给团队用。这个能力目前叫 **spec-mgr**，**不**在当前 spec-bridge 仓库里。

v1.7 不动 schema（保留 4 个 receipt 字段：`artifacts_hash / contract_hash / published / spec_publication_receipt`）。后续 v1.8+ 起独立 change 时，再开 `cross_refs` 字段供图谱层消费。

CodeBuddy 自身的 `memory`（`.codebuddy/memory/`）也是同理——日常 buffer 由 IDE 自己填；大改动后生成"项目用图谱"是未来能力，不在 v1.7 范围。

### v1.8-1 CHANGELOG（ADR-0011，bridge-as-navigator）

**默认行为变 + 双逃生口**：所有"默认行为变"都配 `--old-behavior` 类 flag。

- **D1 init 默认只建台账**（不写 5 件模板）+ 默认自动调 `bridge probe`：
  - `--builtin` → 强制生成 5 件模板（v1.7 行为）
  - `--no-auto-probe` → 跳过默认自动 probe（CI 用）
  - 重复 init 同名 change → exit 3
- **D2 init workflow_kind 推导加第 4 级"项目栈探测"**：`vendor/detect-stack.mjs` 看项目根是否有 `.claude-plugin/ + package.json:matt-skills`（→ matt）、`openspec/`（→ openspec）、都没有（→ builtin）
- **D3 adopt 写 `external_stack` + `adopted_at`**：外栈产物接管有台账 + 审计时间戳
- **D4 distill 跳过 external_stack change**：exit 0 + stderr 提示用外栈自带 why generator
- **D5 probe 输出 `advised_invocation`**：配合 v1.7 `advised_skill` 给 AI 完整推荐包

**v1.8 schema 扩展**（AGENTS.md 禁止事项 §3 同步）：`external_stack` / `adopted_at` 字段在 v1.8-1 起允许；`cross_refs` 在 v1.8-1 仍不开（留给后续 change）。

**为什么是"导航员优先"**：init 默认建空台账 + 自动 probe → 用户立刻看到推荐 → 主动用外栈生成 spec，不再"先写 5 件模板 → 发现要走外栈 → 白做"。

### v1.8-2 CHANGELOG（ADR-0012，pure-bridge-mode）

**核心叙事**：bridge 进入"纯桥模式"——`bridge init` 不再生成任何 spec 模板（proposal/design/tasks/spec/execution-contract），只建台账 + 路由。superpowers 加入项目栈优先级，让 superpowers 栈用户被正确路由到 superpowers 的具体 skill。

- **D1 砍 `--builtin` flag**（硬约束，无逃生口）：
  - 5 件模板常量（`PROPOSAL_TEMPLATE` / `DESIGN_TEMPLATE` / `TASKS_TEMPLATE` / `SPEC_TEMPLATE` / `CONTRACT_TEMPLATE`）从 `cmd-init.mjs` 物理删除
  - `fillTemplate` 函数一并删除
  - `--builtin` flag 变 no-op：stderr 给 `[hint] --builtin flag removed in v1.8-2 (pure bridge mode), no-op` 后忽略
  - `cmd-init.mjs` 净减约 138 行；`init-templates.test.mjs` 因失去测试对象删除
- **D2 superpowers 加入 detect-stack 优先级**：项目根有 `.claude-plugin/` + `package.json` 含 `"superpowers"` 字段（双信号，与 matt 对称）→ primary = `superpowers`；优先级排序 `superpowers > matt > openspec > builtin`
- **D3 WORKFLOW_KINDS 值域扩为 4 个**：`new Set(['superpowers', 'openspec', 'matt', 'builtin'])`；`--workflow-kind` 非法值报错文案同步
- **D4 probe fallback 文案引导 brainstorming**：无 inventory 时 advised_reason 改为 "bridge 不写模板，请 AI 用 brainstorming 或直接编辑自由发挥"；advised_invocation fallback 文案同步
- **D5 测试**：143/143 全绿（v1.8-2 新加 10 + 旧测试改 5；删 init-templates 4）

**为什么是"纯桥"**：

- bridge 是导航员，不是 spec 生成器——默认不写任何 spec 内容
- spec 内容由用户用外栈 skill 生成（openspec-propose / matt to-spec / superpowers brainstorming）
- builtin 兜底仅指 workflow_kind 推导的兜底，**不是**模板生成兜底
- v1.8-1 留的 `--builtin` 逃生口本质与"导航员优先"叙事矛盾——纯桥模式彻底砍掉

**v1.8-2 schema 变化**：仅 `workflow_kind` 值域扩为 4 个（**不是字段名变更**，值域扩允许）；字段本身仍叫 `workflow_kind`，旧值兼容。

**回归保护**：`init-auto-probe.test.mjs B3 T1` + `init-workflow-kind.test.mjs R3 场景 3` 都改测 "`--builtin` flag no-op + stderr hint"——未来有人加回 `--builtin` 行为会立刻 fail。
