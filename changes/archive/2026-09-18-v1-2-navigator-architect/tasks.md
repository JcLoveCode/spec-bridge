# Tasks: v1-2-navigator-architect

按 [executor-protocol](../../skills/spec-bridge/references/executor-protocol.md) 的"自动启发式"排成批次；每批 ≤2 任务时 inline，否则派发子代理。测试接缝：命令 `run()` 层（与 init-templates / init-integration 同构）。

## Batch 1 — 状态模板扩展 + workflow_kind

- [ ] **T1.1** `vendor/bridge-state.mjs`：状态模板加 `workflow_kind` / `parent` / `parent_artifacts_hash` / `tags` 四字段（默认 null）；`state set stage patching` 强校验 parent 存在且父已归档，否则 exit 2
- [ ] **T1.2** `cmd-init.mjs`：`--workflow-kind` 落字段；缺省取 `--capabilities` 首值；再缺省 `builtin`
- [ ] **T1.3** 测试：workflow_kind 推导链（显式 > capabilities 首值 > builtin）× 3 断言

完成定义：state set/get 对新字段读写正常；patching 校验路径 exit 2 可测
审查时点：批末

## Batch 2 — parent 引用（init --parent）

- [ ] **T2.1** `cmd-init.mjs`：`--parent <change-id>` 校验父存在 + stage=archived → 快照父 artifacts_hash；不满足 exit 2
- [ ] **T2.2** 测试：合法父（快照正确）/ 父不存在 / 父未归档（exit 2）× 3 断言

完成定义：follow-up 脚手架一键生成，metadata 带父 hash 快照
审查时点：批末

## Batch 3 — bridge next 导航命令

- [ ] **T3.1** `cmd-next.mjs`：读 stage + next 字段 → 按 stage 查表输出建议动作（5 个 stage 含 patching）；archived 时提示开 follow-up
- [ ] **T3.2** bridge.mjs 路由接线（≤5 行 stub）；usage 更新
- [ ] **T3.3** 测试：5 个 stage 的输出断言 + change 不存在 exit 1

完成定义：任一活跃 change 敲 bridge next 得到一行拍点 + 一行建议
审查时点：批末

## Batch 4 — tags + bridge pattern 聚合

- [ ] **T4.1** `cmd-pattern.mjs`：`--tag <t>` 扫描 changes/ 含 archive/，输出 name/stage/tags/该 tag 的 mention 计数（查 .bridge.log）
- [ ] **T4.2** 测试：多 change 多 tag 匹配 / 无匹配空列表 exit 0

完成定义：跨变更（含归档）按 tag 聚合可查
审查时点：批末

## Batch 5 — mention + rootcause 信号命令

- [ ] **T5.1** `cmd-mention.mjs`：`run`（mention）+ `runRootcause` 两入口；追加事件 + 检索历史同 tag 次数；N≥2 附提示行
- [ ] **T5.2** 测试：首次 mention（无提示）/ 第二次（有提示）/ rootcause 事件前缀断言

完成定义：信号入台账，历史频次可重放，提示是 stdout 信号
审查时点：批末

## Batch 6 — rebuttal + verify 提示 + 归档写保护

- [ ] **T6.1** `cmd-rebuttal.mjs`：写 `rebuttals/<date>-<slug>.md`；`verify` 失败路径补 follow-up 提示文案
- [ ] **T6.2** `sync` 遇 archive/ 路径 exit 4；`state set` 对 archived 仅放行 stage；`hashes --check` archived 漂移提示"开 follow-up"
- [ ] **T6.3** 测试：rebuttal 落盘 / verify 文案 / archive 写保护 × 3 断言

完成定义：双轨闭环——自动检测提示 + 人工异议落点 + 原版写保护
审查时点：批末

## Batch 7 — SKILL.md 协议硬性步骤 + 文档同步

- [ ] **T7.1** SKILL.md §3 executing 节补硬性步骤："识别到同类问题第二次出现且已找到根因 → 必须调 bridge mention / bridge rootcause"（ADR-0007）
- [ ] **T7.2** SKILL.md §5 命令速查表补 next / pattern / mention / rootcause / rebuttal 五行；CONTEXT.md 术语补 workflow_kind 缺项核对

完成定义：协议文本与 CLI 能力一致，无漂移
审查时点：批末

## Batch 8 — 归档（四拍收尾）

- [ ] **T8.1** `node <bridge> sync changes/v1-2-navigator-architect` → 写回执
- [ ] **T8.2** `node <bridge> verify changes/v1-2-navigator-architect` → PASS
- [ ] **T8.3** 写 `specs/cli/why.md` 增量（蒸馏 D1–D8，带 spec-rev）
- [ ] **T8.4** `git mv changes/v1-2-navigator-architect changes/archive/2026-09-18-v1-2-navigator-architect/` + state set stage archived
- [ ] **T8.5** commit + push v1.2 分支，package.json bump 0.3.0
