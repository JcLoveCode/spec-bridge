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

## 1. 入口例程（每次触发先走这五步，不许跳过）

```
① 定位项目根（git root 或 cwd）→ node <bridge> layout <project-root>
② node <bridge> list <project-root>          # 活跃 change 清单（自动跳过 archive/）
③ 三分流：
   a. 有活跃 change + 消息是继续/实现/归档它 → 读该 change 的 .bridge.yaml，恢复到对应阶段
   b. 消息是开新变更 → §3 起头
   c. 都不是（闲聊/无关任务）→ 不碰任何状态文件，直接正常处理消息
④ 多个活跃 change 且意图不明 → 列出清单让用户选，绝不猜
⑤ 恢复时先报一行：当前 change / stage / next / 能力快照，然后续做
```

换对话、聊岔了、隔了几天——重复这套例程即可，磁盘状态就是全部真相。
产物与状态矛盾时，**以产物为准**（状态文件丢了就按内容重建）。

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
| `list <root>` | 活跃 change 清单 |
| `init <name> [flags]` | 一键脚手架（`--workflow-kind` / `--parent` 见 §3） |
| `next <dir>` | 导航：stage + next + 按拍建议动作（纯读） |
| `state init/get/set/next <dir>` | 状态读写（含 workflow_kind/parent/tags） |
| `hashes <dir> [--check]` | 产物摘要 / 契约过期检测（归档漂移提示续作） |
| `sync <dir>` | delta → 根基线 + 发布回执（archive/ 路径 exit 4） |
| `verify <dir>` | 回执重算（closing guard；失败提示双轨） |
| `pattern --tag <t> [root]` | 跨变更 tag 聚合，含归档（ADR-0006） |
| `mention/rootcause <dir> --tag <t>` | 模式信号 + 全库历史计数（ADR-0007） |
| `rebuttal <dir> <一句话>` | 复验异议落盘（rebuttals/，零状态变更） |
| `event <dir> <text>` | 追加大事记到 `.bridge.log` |
