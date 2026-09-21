# Tasks: v1-8-1-bridge-as-navigator

按 [executor-protocol](../../skills/spec-bridge/references/executor-protocol.md) 的"自动启发式"排成批次；每批 ≤2 任务时 inline，否则派发子代理。

## Batch 1 — schema 扩字段 + probe advised_invocation（D5）

- [x] **T1.1** bridge-state 允许 `external_stack` / `adopted_at` 字段 + `cross_refs` 占位
- [x] **T1.2** probe 输出 `advised_invocation: <cmd>` 字段（D5）
- [x] **T1.3** 8 测试覆盖（init/verify + probe advised_invocation）→ 全绿

完成定义：8/8 测试 pass；init/exec 流程不破坏。
审查时点：Batch 1 末已通过（132/132 全绿）。

## Batch 2 — init/adopt/distill 改造（D1-D4）+ detect-stack 新模块（D2）

- [x] **T2.1** cmd-init：默认只建台账 + 自动调 probe + `--builtin` / `--no-auto-probe` 逃生口（C1-C4）
- [x] **T2.2** cmd-init：workflow_kind 推导加第 4 级"项目栈探测"（D2）
- [x] **T2.3** vendor/detect-stack.mjs 新模块：matt > openspec > builtin 优先级（D2）
- [x] **T2.4** cmd-adopt：写 `external_stack` + `adopted_at` 字段（D3）+ 自动探测
- [x] **T2.5** cmd-distill：检测 external_stack → 跳过 + stderr 提示（D4）
- [x] **T2.6** ADR-0011 写完
- [x] **T2.7** SKILL.md §7 v1.8-1 CHANGELOG 段

完成定义：12 测试全绿（init 改造 4 + adopt 增强 2 + 项目栈探测 2 + distill skip 2 + 原 B1 8）；distill 跳过外栈按业务话术 stderr 提示。
审查时点：Batch 2 末已通过（134/134 全绿）。

## Batch N — 归档

- [ ] **TN.1** `node bridge.mjs sync changes/v1-8-1-bridge-as-navigator` → 写回执
  - **已知未决**：v1.8-1 spec.md 是 matt 风格（external frontmatter，无 ADDED/MODIFIED 段），sync openspec 校验拒绝。
  - 3 选项待 ψ3 拍板：A 改 spec 为 openspec 兼容 / B 加 cmd-sync `--external-skip` 选项 / C 跳过 sync 走 matt 自带发布。
  - 倾向 B（与 D4 distill-skip-external 行为对齐 + 协议一致性）。
- [ ] **TN.2** `node bridge.mjs verify changes/v1-8-1-bridge-as-navigator` → PASS（依赖 TN.1）
- [ ] **TN.3** 写 `specs/v1-8-1-bridge-as-navigator/why.md`（蒸馏）
  - 注：external_stack=matt 的 change distill 会跳过（D4）；why.md 由 matt `to-spec` 自带机制生成
- [ ] **TN.4** `git mv changes/v1-8-1-bridge-as-navigator changes/archive/<YYYY-MM-DD>-v1-8-1-bridge-as-navigator/`
- [ ] **TN.5** commit + push v1-8-1-bridge-as-navigator 分支
