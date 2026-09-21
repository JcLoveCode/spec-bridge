# ADR-0011: bridge 作为导航员（v1.8-1 默认优先外栈）

- 状态：Accepted（2026-09-21）
- 决策人：JcLoveCode（与 AI grill 锐化）
- 关联 change：changes/v1-8-1-bridge-as-navigator/

## 背景

v1.7 (ADR-0010) 把"导航员激活"落到 `bridge probe`：每次用户动作后 AI 拿"按你现状推荐 skill"，引导用户**主动**生成 spec。但 v1.7 只在用户显式调 `bridge probe` 时触发，init 还是 v1.2 默认生成 5 件模板（proposal / design / tasks / spec / execution-contract）。

实战发现三个问题：

1. **init 默认产模板"和导航员建议"打架**——bridge init 落地"当前 change 用什么栈"的方式是"写 5 件模板"，但用户**实际**通常用外栈（matt `to-spec` / openspec-propose）。这两套产物并存在同目录里。
2. **adopt 不写台账 → 后续 sync/distill 漏外栈**——外栈 change 接管后没记 `external_stack` 字段，archive-ready 看不出它是外栈产物，distill 拿外栈格式的 design.md 找不到 bridge 的 `### D<N>` 决策记录会 exit 1。
3. **项目栈探测在 init 上没做**——`init` 直接派生 `workflow_kind` 走的是"显式 > capabilities > builtin"三级 fallback，没看项目根有没有 `.claude-plugin/` 或 `openspec/` 目录。

v1.8-1 把这三件事落到 CLI 行为变化 + 一个新模块。

## 决策

### D1. init 默认只建台账（不写 5 件模板）

- 默认行为：`bridge init <name>` 建 `.bridge.yaml` + `.bridge.log` + 空 `specs/<cap>/` 目录，**不写** proposal/design/tasks/spec/execution-contract
- 完成后**自动调** `bridge probe <change-dir>` 给 AI 看导航推荐
- 逃生口：`--builtin` 强制 v1.7 旧行为（生成 5 件模板）；`--no-auto-probe` 跳过默认自动 probe（CI / 自动化脚本用）

**拒绝的方案**：保留 v1.7 行为 + 仅靠 SKILL.md 提示用户"接下来用 X 外栈"。问题：AI 不主动 probe = 用户不知道有外栈更顺手；实战已经发生 3 次"建完发现要走外栈，白做 5 件模板"。

### D2. init 派生 workflow_kind 加第 4 级"项目栈探测"

推导链变 4 级：
1. 显式 `--workflow-kind`（值域 openspec/matt/builtin）
2. `--capabilities` 首值（须在值域内）
3. **项目栈探测**（新）：`vendor/detect-stack.mjs` 输出 `{ primary, signals }`
4. builtin（兜底）

`detect-stack` 优先级 `matt > openspec > builtin`：
- matt：`.claude-plugin/` 目录在场 **且** `package.json` 含 `"matt-skills"` 字段
- openspec：`openspec/` 目录在场
- 都不在场：builtin

**拒绝的方案**：用 `package.json` 一字段"猜"栈（如看到 `@op/spec` 就 openspec）。问题：单点字符串匹配误报率高；多信号（目录 + 字段）才稳。

### D3. adopt 写台账 + 标 external_stack

- 默认行为：adopt 时写 `external_stack: <name>`（用户 `--stack` 给值时）或自动探测（`proposal.md + design.md` → matt；`openspec/changes/x` 路径 → openspec）
- 同步写 `adopted_at: <ISO datetime>` 字段（用于审计：什么时候接管的）
- 修 v1.4 实战 bug：旧版 adopt 不写台账 → sync/distill 漏处理外栈产物

### D4. distill 跳过 external_stack change

- 检测到 `state.external_stack` → exit 0 + stderr 提示"外栈自带 why generator"，**不写** why.md
- 配合 v1.5 D3 "why.md 必写"约定：external_stack change 跳过这步不违反"无 why 不归档"——外栈自带

### D5. probe 输出 advised_invocation（v1.8-1 增量）

- v1.7 probe 已输出 `advised_skill`；v1.8-1 加 `advised_invocation: <skill invocation line>`
- AI 把这两个字段一起拿去问用户"用 / 不用 / 换别的"
- 不写文件 + 不自动调 skill（呼应 ADR-0010 D）

### D6. schema 字段在 v1.8 才开 `cross_refs`（v1.8 起）

- external_stack / adopted_at / cross_refs 三个字段是 v1.8 才允许出现在 .bridge.yaml 的合法字段
- AGENTS.md 禁止事项 §3 同步更新："不要改 4 个 receipt 字段名 + v1.8 才开 cross_refs"

### D7. 双逃生口设计原则

- v1.8-1 起所有"默认行为变"必须配 `--old-behavior` 类逃生口（`--builtin` / `--no-auto-probe`）
- 自动化脚本（CI / agent 批量 init）可关掉变化；用户手敲 CLI 默认走新行为

## 后果

### 正面

- "导航员优先"从文档落到 CLI 默认行为——用户跑 init 立刻看到 probe 推荐
- 外栈产物接管有台账 → sync/distill/archive-ready 不漏
- 项目栈探测免去用户手敲 `--workflow-kind`

### 负面

- init 行为变化（默认不写模板）→ 老用户首批 init 会"看不到 5 件模板"——靠 `--builtin` 逃生 + SKILL.md CHANGELOG 公告
- 项目栈探测增加 init 启动开销（statSync + readFileSync，约 5-10ms）——可接受
- detect-stack.mjs 是新模块 → 测试 + 维护成本；但隔离在 vendor/，与 CLI 主流程解耦

## 关联

- 实施：changes/v1-8-1-bridge-as-navigator/
- 上游：ADR-0001（prompt 管判断）/ ADR-0004（workflow_kind 三级推导）/ ADR-0008（跨协议推荐器）/ ADR-0010（probe 主动激活）/ ADR-0009（detect-layout 优先级）
- 下游：matt to-spec skill / openspec-propose skill（被 init 默认路由引导到）
- 测试：tests/init-auto-probe.test.mjs（B1-B5）/ tests/adopt.test.mjs（B4）/ tests/distill-skip-external.test.mjs（B6）
- spec 增量：changes/v1-8-1-bridge-as-navigator/specs/v1-8-1-bridge-as-navigator/spec.md
