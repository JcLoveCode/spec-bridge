# Tasks: v1-6-init-detectlayout-fix

按 [executor-protocol](../../skills/spec-bridge/references/executor-protocol.md) 的"自动启发式"排成批次；scope 极小（1 文件改动 ×2 + test 增强 + 文档同步），单 batch 足够。

## Batch 1 — detectLayout 加 openspec/ 弱信号 + 回归测试

- [ ] **T1.1** 增强 `skills/spec-bridge/tests/init-integration.test.mjs` R1.5.1：保留原 case，加 2 个回归 case
  - case A: `changes/archive/<id>/.bridge.yaml` 化石在场 + `openspec/` 目录在场 → standalone（v1.4 ADR-0009 防误判保护）
  - case B: spec-bridge 仓库根（`spec-bridge/` 真仓库）`bridge list` → `layout: standalone`（端到端回归）
  - **先跑 RED**：3 个 case 应全 FAIL（R1.5.1 原 fail + A 应 fallback 到 standalone 但实现走 openspec 弱信号 → FAIL；B 期望 standalone 但当前 v1.4 实现跑 list 不在此测试，需加新断言）
- [ ] **T1.2** 改 `skills/spec-bridge/scripts/bridge.mjs:103-121` `detectLayout`：加第 4 条 `if (existsSync(join(root, 'openspec')))` → `layout: openspec`
- [ ] **T1.3** 改 `skills/spec-bridge/scripts/cmd-init.mjs:206-219` mirror `detectLayout`：同步加同条
- [ ] **T1.4** 跑 GREEN：`init-integration.test.mjs` 3 个 case 全 PASS + 全套 `skills/spec-bridge/tests/*.test.mjs` 无回归（R7 mirror 一致性 + R6 archived_count + R3 等）
- [ ] **T1.5** 文档同步：
  - `skills/spec-bridge/docs/adr/0009-detectlayout-archive-fossil-priority.md` 补 v1.6 附录段
  - `skills/spec-bridge/CONTEXT.md § Layout 探测规则` 补第 4 条

完成定义：
- `node --test skills/spec-bridge/tests/init-integration.test.mjs` 全部 PASS（原 7 PASS + 新 2 PASS = 10 case）
- `node --test skills/spec-bridge/tests/*.test.mjs` 全套无新增 fail（96/96 仍 PASS）
- 实测 `node bridge.mjs init demo-fix` 在 spec-bridge 仓库根 → `layout: standalone`

审查时点：批末

## Batch N — 归档

- [ ] **TN.1** `node bridge.mjs sync changes/v1-6-init-detectlayout-fix` → 写回执
- [ ] **TN.2** `node bridge.mjs verify changes/v1-6-init-detectlayout-fix` → PASS
- [ ] **TN.3** `node bridge.mjs distill changes/v1-6-init-detectlayout-fix` → 写 `specs/v1-6-init-detectlayout-fix/why.md`
- [ ] **TN.4** `node bridge.mjs archive-ready changes/v1-6-init-detectlayout-fix` → D3 守门员 PASS
- [ ] **TN.5** `git mv changes/v1-6-init-detectlayout-fix changes/archive/<YYYY-MM-DD>-v1-6-init-detectlayout-fix/`
- [ ] **TN.6** `node bridge.mjs state set <archive-path> stage archived`
- [ ] **TN.7** `node bridge.mjs event <archive-path> "Batch N complete: ..."`
- [ ] **TN.8** commit + push v1.6-init-detectlayout-fix 分支 + merge to main