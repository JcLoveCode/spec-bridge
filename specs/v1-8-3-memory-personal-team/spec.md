# v1-8-3-memory-personal-team

## Purpose

让 bridge 拥有"两层记忆"——个人层（探测 IDE 自带 memory 优先 + fallback 在 change 下建空骨架）+ 团队层（archive 触发 CLI 同步 + hash 校验 + cap 边界 + orphaned 沉淀）。bridge 只填结构和元信息，不替 AI 写 memory 内容。

## Requirements

### Requirement: bridge 个人层优先用 IDE 自带 memory

The system SHALL detect `.codebuddy/memory/` at project root. When present, the system SHALL NOT generate `changes/<name>/memory.md`; instead, the probe output SHALL include `memory_hint.personal = "ide"` with path + line counts.

#### Scenario: IDE memory 在场 → bridge 不生成个人 memory.md

- **WHEN** 项目根 `.codebuddy/memory/` 目录存在且含至少一个 `.md` 文件
- **AND** 用户执行 `bridge init <name>`
- **THEN** change 目录**不**生成 `memory.md`
- **AND** probe 输出 `memory_hint.personal = "ide"` + `ide_path` + `ide_daily_count` + `ide_curated_lines`
- **AND** `bridge event` 日志写 "ide memory detected, skip personal init"

#### Scenario: IDE memory 不在场 → bridge 生成空骨架

- **WHEN** 项目根 `.codebuddy/memory/` 目录不存在
- **AND** 用户执行 `bridge init <name>`
- **THEN** change 目录生成 `memory.md` 含 §0 元信息 + §1 决策段占位 + §2 卡住占位 + §3 父继承占位
- **AND** probe 输出 `memory_hint.personal = "bridge"` + `bridge_path` + `bridge_lines: 0`
- **AND** bridge 自动写 `generated_by: bridge v1.8.3` 元信息

#### Scenario: IDE memory 探测误判（目录空）

- **WHEN** `.codebuddy/memory/` 目录存在但无 `.md` 文件
- **THEN** bridge 视为不在场，走 fallback 生成个人 memory.md
- **AND** stderr 输出 `[hint] .codebuddy/memory/ is empty, personal memory fallback enabled`

### Requirement: bridge memory 命令族（4 子命令）

The system SHALL provide `bridge memory` command family with subcommands: `init`, `append`, `sync`, `show`, plus `reconcile`.

#### Scenario: bridge memory init 已存在 no-op

- **WHEN** 用户执行 `bridge memory init <dir>`
- **AND** `<dir>/memory.md` 已存在
- **THEN** 系统**不**重写 memory.md（保护已有内容）
- **AND** stderr 输出 `[hint] memory.md already exists, no-op`

#### Scenario: bridge memory append 写到 §1

- **WHEN** 用户执行 `bridge memory append <dir> --text "v1.8.3: 砍 X 因为 Y"`
- **AND** 未指定 `--section`
- **THEN** 文本追加到 `<dir>/memory.md` §1 决策段末段
- **AND** `bridge event` 日志写 "memory appended: v1.8.3: 砍 X 因为 Y"

#### Scenario: bridge memory append 写到 §2

- **WHEN** 用户执行 `bridge memory append <dir> --text "..." --section §2`
- **THEN** 文本追加到 `<dir>/memory.md` §2 卡住走偏末段

#### Scenario: bridge memory show 纯读不改文件

- **WHEN** 用户执行 `bridge memory show`
- **THEN** stdout 输出 `<change>/memory.md` 内容
- **AND** 文件 mtime 不变
- **AND** exit 0

#### Scenario: bridge memory show <cap> 读团队层

- **WHEN** 用户执行 `bridge memory show <cap>`
- **THEN** stdout 输出 `.bridge/team/<cap>/memory.md` 内容

### Requirement: probe 输出 memory_hint 字段

The system SHALL include `memory_hint` field in probe JSON output, with three states.

#### Scenario: 三态输出

- **WHEN** 项目根 `.codebuddy/memory/` 在场
- **THEN** `memory_hint.personal = "ide"` + IDE 路径 + 行数
- **WHEN** 项目根 IDE 不在场，change 目录 memory.md 在场
- **THEN** `memory_hint.personal = "bridge"` + bridge 路径 + 行数
- **WHEN** 两者都不在场
- **THEN** `memory_hint.personal = "none"` + stderr 引导"建目录 / 写 memory"

#### Scenario: memory_hint 含团队层 cap 列表

- **WHEN** probe 输出 memory_hint
- **THEN** `team_caps: [...]`（遍历 `.bridge/team/*/memory.md` 得到的 cap 列表）
- **AND** `team_total_lines: <int>`（所有 cap memory 总行数）

### Requirement: archive-ready 守门

The system SHALL fail `archive-ready` when both IDE memory and personal memory are missing/empty.

#### Scenario: 守门通过（IDE 在场）

- **WHEN** 项目根 `.codebuddy/memory/` 存在
- **THEN** archive-ready PASS（不检查个人 memory.md）

#### Scenario: 守门通过（个人 memory 有内容）

- **WHEN** 项目根 `.codebuddy/memory/` 不存在
- **AND** `<change>/memory.md` 存在且 §1 决策段至少 1 行非空内容
- **THEN** archive-ready PASS

#### Scenario: 守门失败（都缺）

- **WHEN** 项目根 `.codebuddy/memory/` 不存在
- **AND** `<change>/memory.md` 不存在或 §1 决策段为空
- **THEN** archive-ready FAIL
- **AND** stderr 给可读提示：`either: 1) IDE .codebuddy/memory/ 存在 2) changes/<name>/memory.md 有内容`

### Requirement: state set stage archived 触发团队层同步

The system SHALL auto-invoke `bridge memory sync <changeDir>` after `bridge state set <changeDir> stage archived` succeeds. (修订自 R6 v1.8-3 草稿：因 `bridge archive` 子命令不存在，archive 流程是手工 3 步——archive-ready + git mv + state set——故 trigger 改为 state set stage archived 这一步。)

#### Scenario: stage 转换到 archived → sync 触发

- **WHEN** `bridge state set <changeDir> stage archived` 成功（即 state.stage 从非 archived 转换到 archived）
- **THEN** 系统自动调 `bridge memory sync <changeDir>`
- **AND** sync 成功 → `.bridge/team/<cap>/memory.md` 追加该 change 的 §1 决策段（带 source change 名 + 日期）+ appendEvent `memory sync completed`
- **AND** sync 失败 → stderr `[warn] memory sync failed; team cap not updated` + appendEvent `memory sync FAILED: <第一行 stderr>`（state 不回滚）
- **AND** 用户可手动重试：`bridge memory sync <changeDir>`

#### Scenario: sync CLI 算 hash 校验一致性

- **WHEN** `bridge memory sync <changeDir>` 调
- **AND** 决策段 hash 与 `.bridge/team/<cap>/memory.md` 的 last_synced_hash 一致
- **THEN** sync no-op（不重写）
- **WHEN** hash 不一致
- **THEN** sync 追加决策段 + 更新 last_synced_hash

### Requirement: 团队层 cap 边界 + orphaned 沉淀

The system SHALL organize team memory by capability (`capabilities`), with `orphaned/` fallback for unclear cap.

#### Scenario: 多 cap 同步

- **WHEN** `.bridge.yaml` 含 `capabilities: [default, v1-8-3]`
- **AND** `bridge memory sync <changeDir>` 调
- **THEN** 决策段追加到 `.bridge/team/default/memory.md` + `.bridge/team/v1-8-3/memory.md` 两个文件

#### Scenario: cap 归属不明 → orphaned

- **WHEN** `capabilities` 为空数组或多 cap 不一致
- **THEN** 决策段落 `.bridge/team/orphaned/memory.md`，不强入任何 cap

#### Scenario: reconcile 不删原 cap

- **WHEN** 用户执行 `bridge memory reconcile --cap <cap>`
- **THEN** 系统不删除原 `.bridge/team/<cap>/memory.md` 内容
- **AND** 只追加"reconcile YYYY-MM-DD by <actor>"元信息

#### Scenario: --include-orphaned 归并

- **WHEN** 用户执行 `bridge memory reconcile --include-orphaned`
- **THEN** orphaned 决策列出供人审，由人决定归并到哪个 cap（不自动归并）

### Requirement: 写规则硬约束（SKILL.md + AGENTS.md）

The system SHALL enforce memory writing rules: bridge 不替 AI 总结 + 不写过程日志 + 每行必带 why.

#### Scenario: SKILL.md §x 给出好/坏示例

- **WHEN** 用户查阅 SKILL.md
- **THEN** §x 含"好"示例 `v1.8.3: 砍 --builtin flag 因为纯桥叙事硬约束`
- **AND** 含"坏"示例 `我把 builtin flag 砍了` + `先试了 A，B 不行，最后用 D 解决了（这是对话层）`

#### Scenario: AGENTS.md 禁事同步

- **WHEN** 用户查阅 AGENTS.md 禁止事项
- **THEN** 包含"不要直接 tell 助手写 memory 内容——bridge 只填结构"

#### Scenario: append 不强制 format

- **WHEN** 用户执行 `bridge memory append <dir> --text "<any text>"`
- **THEN** 系统**不**强制 `vX.Y.Z:` 前缀（避免过度约束）
- **AND** stderr 弱提示"推荐 vX.Y.Z: 砍 X 因为 Y 格式"
