## Purpose

v1.2 为 bridge CLI 交付导航员与档案员能力：流程线声明、用户可见导航、续作引用、修补旁路、模式聚合、根因信号、复验异议与归档写保护。

## ADDED Requirements

### Requirement: 变更台账声明工作流类型

The system SHALL persist a top-level `workflow_kind` field in `.bridge.yaml` with values `openspec | matt | builtin`, settable via `init --workflow-kind`, defaulting to the first value of `--capabilities`, then to `builtin`.

#### Scenario: 显式指定优先

- **WHEN** `bridge init <name> --workflow-kind matt --capabilities builtin`
- **THEN** `.bridge.yaml` 的 `workflow_kind` 为 `matt`

#### Scenario: 缺省从 capabilities 首值推导

- **WHEN** `bridge init <name> --capabilities matt,tdd`（未指定 workflow-kind）
- **THEN** `workflow_kind` 为 `matt`

#### Scenario: 双缺省回落 builtin

- **WHEN** `bridge init <name>`（两个参数都未给）
- **THEN** `workflow_kind` 为 `builtin`

### Requirement: 导航命令输出当前拍点与建议

The system SHALL provide `bridge next <change-dir>` that prints the change's stage, its `next` resume hint, and a stage-derived recommended action, without writing any state.

#### Scenario: 各拍点输出对应建议

- **WHEN** change 处于 planning / contracted / executing / patching 任一拍
- **THEN** 输出含 stage 行、next 字段行、以及按 stage 查表的建议动作行

#### Scenario: archived 提示开续作

- **WHEN** change 处于 archived
- **THEN** 建议行动作为"开 follow-up（引用本变更 hash）"，不输出执行类建议

#### Scenario: change 不存在

- **WHEN** 指定的 change 目录无 `.bridge.yaml`
- **THEN** stderr 报错并以非零退出码退出

### Requirement: 续作变更携带父引用快照

The system SHALL support `bridge init <name> --parent <change-id>` that requires the parent to exist with `stage: archived`, and snapshots the parent's `artifacts_hash` into the new change's `parent_artifacts_hash`.

#### Scenario: 合法父生成快照

- **WHEN** `--parent` 指向一个已归档变更
- **THEN** 新 change 的 `parent` 与 `parent_artifacts_hash` 字段写入父名与父产物摘要

#### Scenario: 父未归档被拒

- **WHEN** `--parent` 指向的变更 stage 不是 archived
- **THEN** 以 exit code 2 拒绝，不创建任何目录

### Requirement: 修补态作为生命周期旁路

The system SHALL accept `stage: patching` only when the change carries a `parent` whose referenced change is archived; otherwise the transition is rejected with exit code 2.

#### Scenario: 无 parent 转 patching 被拒

- **WHEN** 对无 `parent` 字段的 change 执行 `state set stage patching`
- **THEN** 拒绝并 exit 2，stage 保持原值

#### Scenario: 有合法 parent 转 patching 成功

- **WHEN** change 带 archived 父引用
- **THEN** stage 变更为 `patching`，事件记录追加

### Requirement: 模式标签跨变更聚合

The system SHALL persist free-text comma-separated `tags` in `.bridge.yaml` and provide `bridge pattern --tag <t>` that scans `changes/` including `archive/` and lists changes carrying the tag with their stage and mention count.

#### Scenario: 聚合匹配含归档

- **WHEN** 两个 change（一活跃一归档）的 tags 都含 `authz-bypass`
- **THEN** `bridge pattern --tag authz-bypass` 输出两条记录

#### Scenario: 无匹配不是错误

- **WHEN** 没有任何 change 带该 tag
- **THEN** 输出空列表并以 0 退出

### Requirement: 提及与根因信号入台账

The system SHALL provide `bridge mention <change> --tag <t> [--note <text>]` and `bridge rootcause <change> --tag <t>` that append events to `.bridge.log` and print the tag's historical mention count; when count ≥ 2 the output includes a follow-up suggestion line.

#### Scenario: 首次提及无提示

- **WHEN** 某 tag 台账历史 0 次，执行 mention
- **THEN** 事件追加，输出历史 1 次，无建议行

#### Scenario: 第二次出现触发建议

- **WHEN** 某 tag 台账历史已达 1 次，再次 mention
- **THEN** 输出含"consider pattern / follow-up"建议行

#### Scenario: rootcause 语义标记

- **WHEN** 执行 rootcause
- **THEN** 事件以 root-cause 前缀记录，其余行为与 mention 一致

### Requirement: 复验异议有轻量落点

The system SHALL provide `bridge rebuttal <change> <text>` that writes a timestamped markdown note under the change's `rebuttals/` directory without mutating any state field.

#### Scenario: 异议落盘

- **WHEN** 对已归档变更执行 rebuttal
- **THEN** `rebuttals/<date>-<slug>.md` 创建且 `.bridge.yaml` 无字段变更

### Requirement: 归档目录写保护

The system SHALL refuse mutating operations against changes under `changes/archive/`: `sync` exits with code 4, `state set` only permits the `stage` field, and `hashes --check` drift on archived changes suggests opening a follow-up instead of editing.

#### Scenario: sync 拒绝归档路径

- **WHEN** `bridge sync` 的目标位于 `changes/archive/` 下
- **THEN** 以 exit code 4 拒绝

#### Scenario: 归档漂移提示续作

- **WHEN** 已归档 change 的产物 hash 与台账不一致
- **THEN** `hashes --check` 输出建议开 follow-up 而非修改原版
