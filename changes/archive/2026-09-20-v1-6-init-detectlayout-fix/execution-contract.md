# Execution Contract: v1-6-init-detectlayout-fix

## Intent Lock

v1.4 commit `3398bab` 改 `detectLayout` 优先级为 archive 化石 > openspec/config.yaml > standalone 后，`spec/cli/spec.md R1 场景 1.5`（"项目根含 `openspec/` 子目录 → openspec layout"）对应的 test case `tests/init-integration.test.mjs:53` 持续 FAIL——实现违反 spec。

补 detectLayout 第 4 条 `openspec/ 目录在场` 弱信号兜底，使实现与 spec 一致。同时保留 v1.4 ADR-0009 防误判成果（archive 化石优先级 1 保护 spec-bridge 仓库根）。

## Scope Fence

### In Scope

（来自 proposal §Scope > ### In Scope）

1. 改 `bridge.mjs:103-121` `detectLayout` 加 openspec/ 目录弱信号
2. 改 `cmd-init.mjs:206-219` mirror `detectLayout` 同步加弱信号
3. 增强 `tests/init-integration.test.mjs` R1.5.1 加 2 个回归 case
4. ADR-0009 补 v1.6 附录段
5. CONTEXT.md § Layout 探测规则 补第 4 条

### Out of Scope

（来自 proposal §Scope > ### Out of Scope）

- 不重写 `cmd-adopt.mjs detectLayout`（adopt 用更简单实现，与 archive 化石无关）
- 不补 v1.4 verify FAIL 遗留（receipt rebase 是独立 spec）
- 不立 receipt lifecycle 规范（独立 spec）
- 不引入新依赖 / 不改 hash 算法 / 不改 vendored 子模块

## Approved Requirements

（映射自 `specs/v1-6-init-detectlayout-fix/spec.md`）

- [ ] **R1** — detectLayout 加 openspec/ 弱信号兜底：`detectLayout(projectRoot)` 在 archive 化石 + config.yaml 都不在场、但 `openspec/` 目录在场时返回 `layout: openspec`（测试义务：`init-integration.test.mjs` R1.5.1 + 新增 case A "有 archive 化石 + 有 openspec/ 目录 → standalone" 全 PASS）
- [ ] **R2** — mirror 一致性：`bridge.mjs` 与 `cmd-init.mjs` 的 detectLayout 优先级链 + hasAnyBridgeYaml 辅助同步（测试义务：`docs-sync-test.mjs` R7 PASS 不退化）
- [ ] **R3** — spec-bridge 仓库根 list 端到端回归：`bridge list <spec-bridge-root>` 输出 `layout: standalone, archived_count: 5`（测试义务：init-integration 新增 case B + docs-sync-test R6 PASS）

## Constraints

（唯一权威源：`design.md ## Decisions`。每条 C 编号对到 D 编号。）

- **C1** → D1：detectLayout 优先级链加 openspec/ 弱信号（第 4 条，archive 化石 > config.yaml > openspec/ 目录在场 > standalone）
- **C2** → D2：bridge.mjs + cmd-init.mjs inline mirror 同步（不抽共享模块，避免跨文件 import 扩 scope）
- **C3** → D3：新增 2 个回归 case 写在 init-integration.test.mjs（不写新 test 文件，避免 R7 mirror 一致性测试扩 scope）

## Execution Batches

（来源：`tasks.md`）

- **Batch 1** — detectLayout 弱信号 + 回归测试（T1.1, T1.2, T1.3, T1.4, T1.5）：完成定义 = `node --test init-integration.test.mjs` 全 PASS（10 case）+ 全套 `tests/*.test.mjs` 无新增 fail + 文档同步完成
- **Batch N** — 归档（TN.1~TN.8）：完成定义 = stage archived + push 完成 + merge to main

## Escalation Rules

执行过程中遇到以下情况必须停下回 planning 重开：

- 改 detectLayout 后 v1.4 archive verify 不再 FAIL 反向证明 receipt 也错（说明 vendor / receipt 结构性问题不止 v1.6 scope）
- 新增回归 case A (有 archive 化石 + openspec/ 目录 → standalone) FAIL（说明 v1.4 化石优先级保护被弱信号破坏）
- 全套 test 跑出 > 1 个 fail（说明 v1.6 改动破坏了其它未知契约）
- spec-bridge 仓库根 `bridge list` 输出 `layout: openspec`（说明 v1.4 ADR-0009 防误判成果被 v1.6 弱信号破坏）