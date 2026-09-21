# Tasks: v1-7-probe-active-navigator

按 [executor-protocol](../../skills/spec-bridge/references/executor-protocol.md) 的"自动启发式"排成批次；每批 ≤2 任务时 inline，否则派发子代理。

## Batch 1 — probe 探测逻辑（4 维度 + 路由）

- [x] **T1.1** 新建 `skills/spec-bridge/scripts/cmd-probe.mjs`，实现 `run(projectRoot, opts)` 函数：
  - detectLayout → project_type
  - 读 `.bridge.yaml` → capabilities, stage, next
  - parse `--inventory "<skill1>,<skill2>"` → 已用 skill 数组
  - routeSkill(project_type, capabilities, inventory, stage) → advised_skill + reason
  - 内调 `bridge next` 合并拍点
  - stdout 输出 D5 格式
- [ ] **T1.2** bridge.mjs dispatch 加 probe 分支 + usage 块更新（约 5 行）

完成定义：`node bridge.mjs probe .` 输出 D5 格式文本；4 种路由优先级各覆盖（手动跑 4 次不同 inventory 验证）
审查时点：批末

## Batch 2 — SKILL.md §1 加"每轮状态宣告"段 + specs/cli/probe/spec.md

- [ ] **T2.1** SKILL.md §1 加"每轮状态宣告"段：规定 AI 每轮消息开头写 `[inventory] 本轮调了：XXX, YYY` 行；不宣告不算已用
- [ ] **T2.2** 新建 `specs/cli/probe/spec.md`：probe 命令的 source-of-truth spec（含 R1-R5 场景 + D5 输出格式）

完成定义：SKILL.md §1 含宣告段；specs/cli/probe/spec.md 落地
审查时点：批末

## Batch 3 — 测试

- [x] **T3.1** 新建 `skills/spec-bridge/tests/probe-active-navigator.test.mjs`，覆盖：
  - R1: Superpowers 项目 + inventory 含 superpowers-tdd → advised_skill = superpowers-tdd
  - R2: Matt 项目 + 无 inventory → advised_skill = matt-to-goal
  - R3: OpenSpec 项目 + inventory 含 openspec-explorer → advised_skill = openspec-apply-change
  - R4: builtin 项目 + 无 inventory + 无 superpowers/matt/openspec → advised_skill = null
  - R5: inventory 软约束（不传 inventory → 路由退到"按项目类型"）

完成定义：`node --test tests/probe-active-navigator.test.mjs` 5 用例全过
审查时点：批末

## Batch N — 归档

- [ ] **TN.1** `node bridge.mjs sync changes/v1-7-probe-active-navigator` → 写回执
- [ ] **TN.2** `node bridge.mjs verify changes/v1-7-probe-active-navigator` → PASS
- [ ] **TN.3** 写 `specs/v1-7-probe-active-navigator/why.md`（蒸馏）
- [ ] **TN.4** `git mv changes/v1-7-probe-active-navigator changes/archive/<YYYY-MM-DD>-v1-7-probe-active-navigator/`
- [ ] **TN.5** commit + push v1-7-probe-active-navigator 分支