# Tasks: v1-4-list-archive-visibility

按 [executor-protocol](../../skills/spec-bridge/references/executor-protocol.md) 的"自动启发式"排成批次；每批 ≤2 任务时 inline，否则派发子代理。

## Batch 1 — 修复 detectLayout 化石优先

- [x] **T1.1** `scripts/bridge.mjs` `detectLayout()` 改用 archive 化石优先（4 case if-else + 抽 `hasAnyBridgeYaml` 辅助函数）
- [x] **T1.2** `scripts/cmd-init.mjs` mirror `detectLayout()` 同步修 + 补 `readdirSync` import

完成定义：`bridge layout .` 在 spec-bridge 仓库返回 `{ layout: 'standalone', changesDir: '.../changes' }` 而非 `openspec`
审查时点：T1.2 完成后跑 `cd skills/spec-bridge && node tests/init-workflow-kind.test.mjs` 不挂

## Batch 2 — list 加 archived_count + 测试

- [x] **T2.1** `scripts/bridge.mjs` `listChanges()` 加 `archived_count` 字段（只数子目录，不展示详情）
- [x] **T2.2** `tests/docs-sync-test.mjs` 加 R6（bridge list 输出必有 `archived_count` 数字字段）
- [x] **T2.3** 跑 `node tests/docs-sync-test.mjs` → 6+1 = 7 case 全 PASS

完成定义：`bridge list .` 在 spec-bridge 仓库输出 `archived_count: 5`，测试套 PASS
审查时点：T2.3 后

## Batch 3 — 文档同步

- [ ] **T3.1** `SKILL.md` §5 `list` 行加 "返回 `archived_count`" 提示
- [ ] **T3.2** `CONTEXT.md` 补 "layout 探测规则" 段（archive 化石优先）
- [ ] **T3.3** 跑 `node tests/docs-sync-test.mjs` → 验证 R1~R6 + R7 layout 修复同步

完成定义：文档与代码一致；测试自证
审查时点：T3.3 后

## Batch 4 — ADR-0009 + 蒸馏补全

- [ ] **T4.1** 写 `skills/spec-bridge/docs/adr/0009-detectlayout-archive-fossil-priority.md`（D1 + D2 + D3 决策落地）
- [ ] **T4.2** `skills/spec-bridge/CONTEXT.md` 加 ADR-0009 引用 + v1.4 在 changelog 标 `+= detectLayout 修复 + list archived_count`
- [ ] **T4.3** 跑 `node tests/docs-sync-test.mjs` → 验证 ADR-0009 路径与文档一致

完成定义：ADR + CONTEXT 双源记入
审查时点：T4.3 后

## Batch N — 归档

- [ ] **TN.1** `node bridge.mjs sync changes/v1-4-list-archive-visibility` → 写回执
- [ ] **TN.2** `node bridge.mjs verify changes/v1-4-list-archive-visibility` → PASS
- [ ] **TN.3** 写 `specs/list-archive-visibility/why.md`（蒸馏 D1~D3）
- [ ] **TN.4** `git mv changes/v1-4-list-archive-visibility changes/archive/2026-09-18-v1-4-list-archive-visibility/`
- [ ] **TN.5** `state set stage archived` + commit + push