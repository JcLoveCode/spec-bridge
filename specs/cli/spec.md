# cli

## Purpose

`bridge init` 是 spec-bridge 单入口路由的"开 change"子命令。它把开一个新 change 从 5 步手动折叠成 1 步 CLI 调用，并把变更的规划产物模板（proposal / design / tasks / spec / execution-contract）与 `.bridge.yaml` 状态机入口一次性落盘。

## Requirements

### Requirement: bridge init 命令一键脚手架

`bridge.mjs` SHALL 提供 `init <name>` 子命令，自动探测项目根、探测 layout、创建 change 目录、写入四个规划产品模板 + execution-contract 模板 + `.bridge.yaml` + `.bridge.log`。

#### Scenario: 成功脚手架一个新 change

- **WHEN** 用户在 spec-bridge 兼容的仓库（含 `changes/` 或 `openspec/`）下执行 `node bridge.mjs init v1_1-bridge-init`
- **THEN** 系统创建 `changes/v1_1-bridge-init/` 目录，内含 `proposal.md`、`design.md`、`tasks.md`、`specs/cli/spec.md`、`execution-contract.md` 五个非空模板文件
- **AND** `.bridge.yaml` 含 `stage: planning`、`layout: <检测值>`、`branch: <传入或 null>`、`capabilities: <传入或 null>`
- **AND** `.bridge.log` 含首条 ISO 时间戳大事记
- **AND** stdout 输出 `<changeDir>` 绝对路径 + 一行 next hint

#### Scenario: 已存在同名 change 时拒绝覆盖

- **WHEN** 用户执行 `node bridge.mjs init v1_1-bridge-init` 且 `changes/v1_1-bridge-init/` 已存在
- **THEN** 系统退出码 `3`
- **AND** stderr 输出 `change 'v1_1-bridge-init' already exists at <absolute path>`
- **AND** 不修改任何已存在文件

#### Scenario: name 不符合 kebab-case 时拒绝

- **WHEN** 用户执行 `node bridge.mjs init Foo Bar` 或 `node bridge.mjs init --foo`
- **THEN** 系统退出码 `2` 并打印 usage

#### Scenario: 探测 standalone layout

- **WHEN** 项目根无 `openspec/` 子目录
- **THEN** `.bridge.yaml` 的 `layout: standalone`，changes 目录位于 `<projectRoot>/changes/<name>/`，基线目录 `<projectRoot>/specs/<cap>/spec.md`

#### Scenario: 探测 openspec layout

- **WHEN** 项目根含 `openspec/` 子目录
- **THEN** `.bridge.yaml` 的 `layout: openspec`，changes 目录位于 `<projectRoot>/openspec/changes/<name>/`

### Requirement: init 不写 receipts、不调 sync/verify、不写 hashes

`bridge init` SHALL NOT 调用 `bridge sync` 或 `bridge verify`，亦 SHALL NOT 写入 `artifacts_hash` / `contract_hash` / `published` / `spec_publication_receipt` 字段。hash 与回执属于 contracted → executing → archived 阶段。

#### Scenario: init 之后 .bridge.yaml 不含回执字段

- **WHEN** 成功执行 init 后
- **THEN** `.bridge.yaml` 中 `artifacts_hash`、`contract_hash`、`published`、`spec_publication_receipt` 字段均为 `null`
- **AND** `stage` 字段为 `planning`

### Requirement: 项目根探测失败时使用 cwd 兜底并打印提示

`bridge init` SHALL 在项目根探测失败（无 git toplevel、无含 `changes/` 的祖先目录）时回退到 cwd，并在 stderr 打印一行 fallback 提示；change 目录 SHALL 仍正常创建——standalone 布局自举，首个 change 落盘即确立布局。

#### Scenario: 非 git 仓库且无 changes/ 祖先目录

- **WHEN** 用户在 `/tmp/foo`（无 git、无 changes/ 祖先）执行 `node bridge.mjs init demo`
- **THEN** 系统使用 `/tmp/foo` 作为项目根继续执行
- **AND** stderr 打印 fallback 提示
- **AND** `demo` change 目录与 5 个模板文件成功创建，exit code 0
- **AND** `.bridge.yaml` 的 `layout: standalone`（首个 change 落盘即自举确立 standalone 布局）

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

### Requirement: stage-aware 导航提示

`bridge next <change-dir>` SHALL 在不同 stage 下输出针对性 advised 提示，覆盖以下状态：

- `stage=contracted` 且 `contract_approved` 非空 → advised 改为 "approve run / proceed to executing — `state set stage executing`"
- `stage=contracted` 且 `contract_approved` 为空 → advised 保持原"批准门"提示
- `stage=executing` 且 `next` 字段匹配 `Batch N` 格式 → 输出末尾追加 "→ Batch N: <next 字段值>"
- `stage=executing` 且 `next` 字段非 batch 格式 → 输出保持现"按 next 字段"格式
- `stage=patching` → advised 加 "patching bypass — verify parent still archived (ADR-0005)"
- `stage=archived` → advised 加 "archived — open follow-up if correction needed; do NOT edit original (ADR-0005)"
- `stage=planning` / 其他 → advised 保持现有"去写 contract"提示

#### Scenario: contracted 后 approved 提示进 executing

- **WHEN** change 处于 `stage=contracted` 且 `contract_approved` 已填
- **THEN** `bridge next` 输出包含 "proceed to executing" 且包含 "state set stage executing"

#### Scenario: executing 时显示当前 Batch

- **WHEN** change 处于 `stage=executing` 且 `next` 字段形如 "Batch N: ..."
- **THEN** `bridge next` 输出末尾追加 "→ Batch N: <原 next 内容>"

#### Scenario: 归档态守门

- **WHEN** change 处于 `stage=archived`
- **THEN** `bridge next` 输出包含 "ADR-0005" 且包含 "follow-up"

### Requirement: SKILL.md §3 硬性步骤栏

SKILL.md §3 SHALL 在"进入 executing"段顶部包含硬性步骤栏，含至少 2 条 `> hard step` 引用块：

1. `> hard step — entering executing: ...` 引用 `state set stage executing` 命令
2. `> hard step — before each batch: ...` 引用 `bridge next` 命令

每条 SHALL 给出"为什么是硬性"的一句话理由（例："否则 next 命令永远停在 contracted，无法感知批进度"）。

#### Scenario: SKILL.md §3 硬性步骤栏存在

- **WHEN** 读 `skills/spec-bridge/SKILL.md` §3
- **THEN** 文件包含字符串 "hard step" 至少 2 次
- **AND** 包含命令字面量 "state set stage executing"
- **AND** 包含命令字面量 "bridge next"
