# cli/probe

## Purpose

`bridge probe` 是 spec-bridge 导航员激活（v1.7 / ADR-0010）的"探测 + 推荐"子命令：探测 4 维度（project_type / capabilities / stage / inventory）、按 4 级优先级（Superpowers > Matt > OpenSpec > 兜底）路由、合并 `bridge next` 的拍点提示、stdout 输出 D5 格式——给 AI 看 `advised_skill`，**不**替 AI 写文件、不替 AI 调 skill。

设计源：ADR-0010（D1-D8）。命令实现：`skills/spec-bridge/scripts/cmd-probe.mjs`。

## Requirements

### Requirement: probe 接 `<change-dir>` 参数，输出 D5 格式 7 行 KEY:value 文本

`bridge probe <change-dir>` SHALL 接受一个 change-dir 位置参数，stdout 输出 7 行 KEY:value 文本（顺序固定）：`project_type`、`capabilities`、`stage`、`inventory`、`advised_skill`、`advised_reason`、`next_hint`。

#### Scenario: 标准 change-dir 调用输出完整 D5 格式

- **WHEN** 用户在已 init 的 change 下执行 `node bridge.mjs probe changes/demo`
- **THEN** 退出码 `0`
- **AND** stdout 包含且仅包含 7 行 KEY:value：`project_type:` / `capabilities:` / `stage:` / `inventory:` / `advised_skill:` / `advised_reason:` / `next_hint:`
- **AND** `advised_reason` 包含"按 D4 优先级 N"字样（N ∈ {1,2,3,4}）

### Requirement: probe 支持 `--inventory` flag，解析为已用 skill 数组

`bridge probe <change-dir> [--inventory <s1,s2,...>]` SHALL 支持 `--inventory` flag，逗号分隔的 skill 名解析为字符串数组（trim + 过滤空串）。

#### Scenario: --inventory 解析为数组

- **WHEN** 用户执行 `node bridge.mjs probe changes/demo --inventory "openspec-explore, superpowers-tdd"`
- **THEN** 内部 inventory 数组为 `['openspec-explore', 'superpowers-tdd']`（trim 后两个元素）
- **AND** `inventory:` 行的值为 `openspec-explore,superpowers-tdd`

#### Scenario: --inventory 缺省时为空数组

- **WHEN** 用户执行 `node bridge.mjs probe changes/demo`（不传 --inventory）
- **THEN** inventory 数组为 `[]`
- **AND** `inventory:` 行的值为空字符串

### Requirement: probe 按 4 级固定优先级路由（Superpowers > Matt > OpenSpec > 兜底）

probe SHALL 按 inventory 中第一个出现的栈归属路由 advised_skill，优先级写死：**Superpowers (P1) > Matt (P2) > OpenSpec (P3) > 兜底 (P4)**。判定以 skill 名小写后是否含 `superpowers` / `matt` / `openspec` 子串为准（顺序检查 inventory）。

#### Scenario: R2 场景 1 — inventory 含 Superpowers skill 路由到 P1

- **WHEN** inventory 包含 `superpowers:test-driven-development`（任意位置）
- **THEN** `advised_skill: superpowers:test-driven-development`
- **AND** `advised_reason` 包含"按 D4 优先级 1"

#### Scenario: R2 场景 2 — inventory 只含 Matt 路由到 P2

- **WHEN** inventory 包含 `matt:spec-executor` 且不含 Superpowers skill
- **THEN** `advised_skill: matt:spec-executor`
- **AND** `advised_reason` 包含"按 D4 优先级 2"

#### Scenario: R2 场景 3 — inventory 只含 OpenSpec 路由到 P3

- **WHEN** inventory 包含 `openspec:apply-change` 且不含 Superpowers/Matt skill
- **THEN** `advised_skill: openspec:apply-change`
- **AND** `advised_reason` 包含"按 D4 优先级 3"

#### Scenario: R2 场景 4 — 空 inventory 路由到 P4 兜底

- **WHEN** inventory 为空数组或不传
- **THEN** `advised_skill: (none)`
- **AND** `advised_reason` 包含"按 D4 优先级 4 兜底（AI 自由发挥）"

### Requirement: probe 合并 `bridge next` 的 next_hint（C5 不重复造车）

probe SHALL 内部调用 `bridge next <change-dir>` 并提取 `→ ` 开头的 advice 行，合并到 stdout 的 `next_hint:` 字段。AI 不得也不需要再单独调 `bridge next`。

#### Scenario: next_hint 行来自 bridge next 的 → advice

- **WHEN** probe 被调用且 change-dir 已 init
- **THEN** `next_hint:` 行的值是 `bridge next` 输出中以 `→ ` 开头的行去掉前缀的字符串
- **AND** 若 `bridge next` 不返回 advice 行，`next_hint: (unknown)`

### Requirement: probe 不写任何状态文件（C2 只输出不写入）

probe SHALL NOT 修改 `.bridge.yaml`、`.bridge.yaml` 内任何字段、`.bridge.log`、4 件产物（proposal/design/tasks/spec）、`specs/`、`execution-contract.md` 任何文件。

#### Scenario: probe 调用前后 .bridge.yaml 与 .bridge.log 不变

- **WHEN** 在 change 下执行 probe 前后
- **THEN** `.bridge.yaml` 文件 mtime 与 SHA-256 hash 不变
- **AND** `.bridge.log` 文件大小不变

### Requirement: probe 不自动调 skill（C3 只给 advised_skill 让 AI 看）

probe SHALL NOT spawn 子进程调用 OpenSpec / Matt / Superpowers skill；只输出 `advised_skill` 文本，AI 据此问用户拍板或自己决定。

#### Scenario: probe 进程内无 openspec/matt/superpowers 子进程

- **WHEN** probe 被调用
- **THEN** probe 不 spawn 任何 `openspec-*` / `matt-*` / `superpowers-*` 子进程
- **AND** AI 收到的只有 stdout/stderr 文本

### Requirement: probe 隐式 change-dir fallback（v1.7 hotfix C9）

当用户传 `bridge probe .` 或其他 rawDir === cwd 的路径且目标目录无 `.bridge.yaml` 时，probe SHALL 在 `cwd/changes/<name>/` 下找唯一含 `.bridge.yaml` 的 change 目录作为隐式 change-dir；多匹配时报告 ambiguous 让用户明示；用户显式给非 cwd 路径不启用 fallback（避免掩盖错）。

#### Scenario: R4 场景 1 — 仓库根 + 单个 change 自动 fallback 成功

- **WHEN** cwd 是仓库根、cwd 无 `.bridge.yaml`、`cwd/changes/` 下有且仅有 1 个含 `.bridge.yaml` 的子目录
- **AND** 用户执行 `node bridge.mjs probe .`
- **THEN** 退出码 `0`
- **AND** stderr 包含一行 `[hint] no .bridge.yaml under <rawDir>; resolved implicit change-dir → <resolved>`
- **AND** stdout 按 resolved change-dir 正常输出 D5 7 行

#### Scenario: R4 场景 2 — 仓库根 + 多个 change 报 ambiguous

- **WHEN** cwd 是仓库根、`cwd/changes/` 下有 ≥2 个含 `.bridge.yaml` 的子目录
- **AND** 用户执行 `node bridge.mjs probe .`
- **THEN** 退出码 `2`
- **AND** stderr 包含 `ambiguous: found N change dirs with .bridge.yaml:`（N ≥ 2）
- **AND** stderr 列出每个候选 change-dir 绝对路径
- **AND** stderr 包含 `specify one explicitly: bridge probe <change-dir>`

#### Scenario: R4 场景 3 — 仓库根 + 无 change 报原错误

- **WHEN** cwd 是仓库根、cwd 无 `.bridge.yaml`、`cwd/changes/` 不存在或下无任何 `.bridge.yaml`
- **AND** 用户执行 `node bridge.mjs probe .`
- **THEN** 退出码 `1`
- **AND** stderr 为 `no .bridge.yaml under <rawDir> — is it a bridge change directory?`
- **AND** 不说 "ambiguous" 也不说 "resolved implicit change-dir"

#### Scenario: R4 场景 4 — 用户显式给非 cwd 路径不 fallback

- **WHEN** 用户执行 `node bridge.mjs probe /some/other/path`（且 rawDir !== cwd、无 `.bridge.yaml`）
- **THEN** 退出码 `1`
- **AND** stderr 不包含 `resolved implicit change-dir` 字样
- **AND** probe 不静默 fallback 到 cwd 下的 change-dir（避免掩盖用户输入错误）

### Requirement: probe 用法错误退出码 2 + 打印 usage（R3）

`bridge probe` 不带任何位置参数 SHALL 退出码 `2` 并在 stderr 打印一行 usage 提示。

#### Scenario: 不传 change-dir 参数

- **WHEN** 用户执行 `node bridge.mjs probe`
- **THEN** 退出码 `2`
- **AND** stderr 包含 `Usage: bridge probe <change-dir> [--inventory <s1,s2,...>]`

### Requirement: probe 输出的 advised_skill 与 SKILL.md §1.5 inventory 宣告保持一致（C4）

probe 的 `--inventory` flag 内容 SHALL 与 AI 在每轮回复第一行写的 `[inventory] 本轮调了：...` 内容一致；probe 不替 AI 猜（不读对话历史、不自动从调用栈反推）。

#### Scenario: probe inventory 与 AI 宣告一致

- **WHEN** AI 轮次开头写 `[inventory] 本轮调了：openspec-explore, superpowers-tdd`
- **AND** AI 调 `bridge probe . --inventory "openspec-explore, superpowers-tdd"`
- **THEN** probe 路由按同一 inventory 判定，结果可被 AI 据此回答用户

#### Scenario: probe 不读取 AI 对话历史

- **WHEN** probe 被调用
- **THEN** probe 不读取 AI 会话历史、不反推 inventory
- **AND** 若 AI 没传 `--inventory`，probe 按空 inventory 处理（路由到 P4 兜底），不"贴心"猜测
