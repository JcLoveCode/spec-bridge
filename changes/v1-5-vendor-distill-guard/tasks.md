# Tasks: v1-5-vendor-distill-guard

按 [executor-protocol](../../skills/spec-bridge/references/executor-protocol.md) 的"自动启发式"排成批次；每批 ≤2 任务时 inline，否则派发子代理。

## Batch 1 — vendor resolvePublicationContext while 循环

- [ ] **T1.1** 改 `scripts/vendor/spec-publication.mjs:271-280` `resolvePublicationContext`：单 if-else → while 循环跳到 `basename === 'changes'`
- [ ] **T1.2** 写 `tests/vendor-resolve-publication-context.test.mjs`：3 case — active 路径 / archive 路径 / 套娃 archive 路径

完成定义：`node bridge.mjs verify changes/archive/2026-09-18-v1-4-list-archive-visibility` 不再因 projectRoot 错而 FAIL
审查时点：T1.2 跑通后

## Batch 2 — cmd-distill.mjs 新子命令

- [ ] **T2.1** 写 `scripts/cmd-distill.mjs`：从 `<change-dir>/design.md ## Decisions` 蒸馏 → 写 `<change-dir>/specs/<cap>/why.md`（格式仿 v1.3 `specs/v1-3-research-xrouter/why.md`）
- [ ] **T2.2** 改 `scripts/bridge.mjs` dispatch 加 `distill` 入口 + help 加 `distill <change-dir>` 行
- [ ] **T2.3** 写 `tests/cmd-distill.test.mjs`：2 case — 正常 design.md 蒸馏 / 缺 design.md 时 exit 1

完成定义：`node bridge.mjs distill changes/v1-5-vendor-distill-guard` 成功生成 `specs/archive-publish-guard/why.md`
审查时点：T2.3 跑通后

## Batch 3 — bridge archive 校验 why.md 存在性

- [ ] **T3.1** 改 `scripts/bridge.mjs` Batch N 模板（archive 流程）：写 "Batch N complete" 前 `fs.existsSync(join(changeDir, 'specs', cap, 'why.md'))` 校验，缺则 `console.error` + `exit 1`
- [ ] **T3.2** 写 `tests/archive-distill-guard.test.mjs`：2 case — 有 why.md 放行 / 缺 why.md exit 1
- [ ] **T3.3** 跑 `node tests/docs-sync-test.mjs` 验证 SKILL.md §3 蒸馏段 + §5 命令表已加 distill

完成定义：v1.5 自身 archive 流程会强制 require why.md；测试套 PASS
审查时点：T3.3 跑通后

## Batch 4 — 文档同步

- [ ] **T4.1** 改 `SKILL.md` §3 蒸馏段："AI 手动写 why.md" → "走 `bridge distill <change-dir>`"
- [ ] **T4.2** 改 `SKILL.md` §5 命令表加 `distill <change-dir>` 行
- [ ] **T4.3** 改 `CONTEXT.md` 补 distill 子命令段
- [ ] **T4.4** 跑 `node tests/docs-sync-test.mjs` → 验证所有文档与代码一致

完成定义：文档与代码同步；测试自证
审查时点：T4.4 跑通后

## Batch N — 归档

- [ ] **TN.1** `node bridge.mjs sync changes/v1-5-vendor-distill-guard` → 写回执
- [ ] **TN.2** `node bridge.mjs verify changes/v1-5-vendor-distill-guard` → PASS（含 vendor 修复 + distill 校验）
- [ ] **TN.3** `node bridge.mjs distill changes/v1-5-vendor-distill-guard` → 生成 `specs/archive-publish-guard/why.md`（D2 自动化，v1.4 是手动写漏了）
- [ ] **TN.4** `git mv changes/v1-5-vendor-distill-guard changes/archive/2026-09-18-v1-5-vendor-distill-guard/`
- [ ] **TN.5** `state set stage archived` + commit + push
