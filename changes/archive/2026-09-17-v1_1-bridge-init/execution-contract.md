# Execution Contract: v1_1-bridge-init

## Intent Lock

`bridge.mjs` 当前缺 `init` 子命令——开 change 须 5 步手动（mkdir + 4 模板 + state init + log）。本变更新增 `bridge init <name>`，一步脚手架 4 份规划产品 + execution-contract 模板 + `.bridge.yaml` + `.bridge.log`，并通过 2 测试守住 4 个使用场景。

## Scope Fence

### In Scope

- 单文件 `skills/spec-bridge/scripts/cmd-init.mjs`（与 cmd-sync.mjs 风格对齐；导出 `run(args, {stdout, stderr})`）
- `skills/spec-bridge/scripts/bridge.mjs` 增加 `init` 命令路由 + usage 更新（单文件 ≤ 350 行硬上限）
- 2 个测试：`init-templates.test.mjs`（模板渲染单元） + `init-integration.test.mjs`（端到端 tmpdir 隔离）
- 5 个模板常量内嵌为 ES module exports：PROPOSAL_TEMPLATE / DESIGN_TEMPLATE / TASKS_TEMPLATE / SPEC_TEMPLATE / CONTRACT_TEMPLATE
- `bridge.mjs` 使用说明（usage）更新
- 既有的 state init / layout / list / sync / verify / hashes / event 行为零改动
- vendor/ 目录零改动

### Out of Scope

- 修改 vendor/ 接缝
- `--from-archive`（从归档恢复 change）—— 留作后续 v1.2
- `--stack <A|B|C>` 显式指定栈
- `--interactive` 引导填模板
- 跨平台 shebang 检测
- init 阶段写入 artifacts_hash / contract_hash / 回执
- 修改 package.json 版本号（本变更收尾时作为独立 commit）

## Approved Requirements

> 映射自 `specs/cli/spec.md`。每条 SHALL/MUST 必须有一条测试义务 + 落进至少一个 Batch。

- [ ] **R1 — bridge init 命令一键脚手架**：探测项目根 + layout + 创建 change 目录 + 写 4 模板 + execution-contract + `.bridge.yaml` + `.bridge.log`（测试义务：`init-integration.test.mjs` 断言 5 文件齐 + `.bridge.yaml` 字段 + `.bridge.log` 首行）
  - 场景 1.1 成功脚手架
  - 场景 1.2 重名拒绝（exit 3）
  - 场景 1.3 name 校验（exit 2）
  - 场景 1.4 探测 standalone layout
  - 场景 1.5 探测 openspec layout
- [ ] **R2 — init 不写 receipts / hashes / sync/verify**：hash 与回执属 contracted→archived 阶段（测试义务：`init-integration.test.mjs` 断言 `.bridge.yaml` 四字段均为 `null`、stage=planning）
- [ ] **R3 — 项目根探测失败回退 cwd + stderr 提示**（测试义务：`init-integration.test.mjs` 二次 case，cwd=/tmp/no-git-no-changes）

需求覆盖交叉检查：
- proposal §What Changes 中的"新增 init 子命令" → R1 ✓
- proposal §What Changes 中的"不调 sync/verify" → R2 ✓
- design.md D6（探测 fallback） → R3 ✓
- proposal Out-of-Scope 中"v1.2 / from-archive / interactive / shebang / 版本号" → 不映射，进 Escalation Rules 留痕

## Constraints

> 唯一权威源：`design.md ## Decisions`。本节为下游执行器直接消费。

- **C1**（来自 D1）：单文件 `scripts/cmd-init.mjs`，与 cmd-sync.mjs 对齐；bridge.mjs 仅负责路由，单文件 ≤ 350 行硬上限。
- **C2**（来自 D2）：模板作为 ES module export 的 string constants，不放外部文件。
- **C3**（来自 D3）：`existsSync(changeDir)` → exit 3，不覆盖。
- **C4**（来自 D4）：capability 默认值 = 目录名小写；`--capability` 覆盖。
- **C5**（来自 D5）：`init` 不调 sync/verify、不写 hashes / 回执。
- **C6**（来自 D6）：项目根探测 `git toplevel` 优先 → 向上 walk changes/ → fallback cwd + stderr 提示。
- **C7**（来自 D7）：stdout 输出 `<changeDir>\n<next hint>` 两行；stderr 仅在探测失败时写。

## Execution Batches

> 来源：`tasks.md` 5 批次。按 executor-protocol §"自动启发式" ≤2 任务 inline；本变更全部 inline。

- **Batch 1 — cmd-init.mjs 核心**（T1.1 + T1.2）：完成定义 = 单元测试渲染 5 模板非空 + 端到端测试通过。审查时点 = 批末（write+read 5 模板 + run() 主流程代码）。
- **Batch 2 — bridge.mjs 路由 + 使用说明**（T2.1 + T2.2 + T2.3）：完成定义 = bridge.mjs ≤ 350 行、既有命令行为不变。审查时点 = 跑既有 tests（`delta-apply.test.mjs` + `sync.test.mjs`）零回归。
- **Batch 3 — 测试**（T3.1 + T3.2）：完成定义 = `npm test` 4/4 通过。审查时点 = 既有用例 + 新用例全过。
- **Batch 4 — 验证门**（T4.1 + T4.2 + T4.3）：完成定义 = hash drift 0 + list 输出预期 + 之后方可进入 archived。审查时点 = 全部 gate 输出匹配预期。
- **Batch 5 — 归档**（T5.1 ~ T5.6）：sync → verify → why 蒸馏 → git mv → commit → push v1.1。审查时点 = changes/archive/ 下有 2026-09-17-v1_1-bridge-init/ + specs/cli/why.md 非空 + changes/ 下无 active v1_1-bridge-init/。

跨批次依赖：
- B1 → B2（cmd-init.mjs 导出 `run()` 才能被 bridge.mjs import）
- B2 → B3（路由接通才能跑端到端测试）
- B3 → B4（tests 全过是 hash check 的前置——hash 是产物 hash，测试保证产物稳定）
- B4 → B5（hash gate 通过才能 sync）

## Escalation Rules

- **E1 — Out-of-Scope 反向触发**：若执行过程中发现需要改 vendor/、加 `--from-archive`、加 `--interactive`、改 package.json 版本号中的任意一项，立即停下，回 planning 重开新 change。
- **E2 — bridge.mjs 超过 350 行**：单文件硬上限被破 → 停下，考虑抽出"命令路由"到独立 `cmd-router.mjs`（那是另一 ADR 的事），本变更范围内不解决。
- **E3 — 模板常量被破坏**：若 unit test 渲染出空字符串 / 缺必含节段，停下查模板字符串而非测试——模板是 spec 的下界。
- **E4 — sync 失败**：若 `bridge sync` 因 spec.md 格式不合 OpenSpec delta 语法退出码非 0，停下查 `spec-publication.mjs` 的 validator 输出，而非改 sync 行为——vendor 是冻结的。