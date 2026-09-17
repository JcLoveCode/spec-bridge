# Tasks: bridge init 命令

执行批次按 [references/executor-protocol.md](../../skills/spec-bridge/references/executor-protocol.md) 的"自动启发式"原则排成 3 个批次；每批 ≤2 任务时 inline，否则派发子代理（本增量体量小，全部 inline）。

## Batch 1 — cmd-init.mjs 核心

- [ ] **T1.1** 新文件 `skills/spec-bridge/scripts/cmd-init.mjs`，导出 `run(args, { stdout, stderr } = {})`
  - 模板常量：PROPOSAL_TEMPLATE / DESIGN_TEMPLATE / TASKS_TEMPLATE / SPEC_TEMPLATE / CONTRACT_TEMPLATE（5 个 string constants）
  - `detectProjectRoot(cwd)`：git toplevel → 向上 walk changes/ → fallback cwd
  - `validateName(name)`：kebab-case 校验（`/^[a-z0-9]+(-[a-z0-9]+)*$/`），否则 exit 2
  - `run()` 主流程：5 步（见 design.md D1/D5/D6/D7）
- [ ] **T1.2** 导出函数：`existsSync(changeDir) → fail with exit 3`

完成定义：unit test 渲染 5 个模板非空 + 包含必含占位符；端到端 init 测试通过。

## Batch 2 — bridge.mjs 路由 + 使用说明

- [ ] **T2.1** `skills/spec-bridge/scripts/bridge.mjs` 顶部 import `run as runInit from './vendor/cmd-init.mjs'`（注：与 cmd-sync.mjs 同目录，所以路径对应为 `./cmd-init.mjs`，不是 `./vendor/cmd-init.mjs`——见下面"路径约定"）
- [ ] **T2.2** `bridge.mjs` 增加 `if (command === 'init')` 分支
- [ ] **T2.3** `usage()` 文本新增 `init <name>` 一行

**路径约定**：澄清——`cmd-init.mjs` 放在 `scripts/`（与 `bridge.mjs` 同级），不是 `./vendor/`。`vendor/` 只放 spec-superflow 引擎 + bridge-state.mjs 接缝。`cmd-sync.mjs` 当前虽然在 `vendor/`，但那是 vendor 替换的产物；新增的 cmd-init 是 spec-bridge 自有，不放 vendor。

完成定义：`bridge.mjs` ≤ 350 行；既有命令行为不变。

## Batch 3 — 测试

- [ ] **T3.1** `skills/spec-bridge/tests/init-templates.test.mjs`（单元）
  - 5 个模板都是非空字符串
  - 每个模板含必含占位符 / 节段标记（`## Why` for proposal、`## Decisions` for design、`## ADDED Requirements` for spec、`## Intent Lock` for contract）
- [ ] **T3.2** `skills/spec-bridge/tests/init-integration.test.mjs`（集成）
  - `tmpdir` + `git init` 隔离
  - spawn `node bridge.mjs init demo` → 退出码 0
  - 断言：5 模板文件存在且非空 + `.bridge.yaml` 字段正确 + `.bridge.log` 第一行
  - 重跑 → 退出码 3 + 不修改任何文件

完成定义：`npm test` 全过（既有 2 + 新增 2 = 4）。

## Batch 4 — 验证门（执行前最后一道）

- [ ] **T4.1** `npm test` 全过
- [ ] **T4.2** `node bridge.mjs hashes changes/v1_1-bridge-init --check` → `CURRENT: no drift detected`
- [ ] **T4.3** `node bridge.mjs list .` → 看到 `v1_1-bridge-init`，`has_state=true, stage=contracted`

完成定义：所有 gate 输出匹配预期；之后方可进入 archived。

## Batch 5 — 归档（EXECUTION 末尾）

- [ ] **T5.1** `node bridge.mjs sync changes/v1_1-bridge-init` → 写 spec_publication_receipt
- [ ] **T5.2** `node bridge.mjs verify changes/v1_1-bridge-init` → PASS
- [ ] **T5.3** 写 `specs/cli/why.md`（蒸馏，唯一权威源 = `design.md ## Decisions`）
- [ ] **T5.4** `git mv changes/v1_1-bridge-init changes/archive/2026-09-17-v1_1-bridge-init/`
- [ ] **T5.5** `git add -A && git commit -m "feat(bridge): add init subcommand + dogfood change v1.1"`
- [ ] **T5.6** `git push -u origin v1.1`（仅本分支，不动 main）

完成定义：`changes/archive/` 下有 `2026-09-17-v1_1-bridge-init/`；`specs/cli/why.md` 存在且非空；`changes/` 下无 active `v1_1-bridge-init/`。