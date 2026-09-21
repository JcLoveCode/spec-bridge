# v1-7-probe-active-navigator

## Purpose

`bridge probe` 命令按当前对话上下文（项目类型 + 能力缺口 + 已用 skill + 拍点）实时推荐该调哪个 SDD skill，引导用户**主动**生成 spec，让归档守卫能力（archive-ready / verify / distill）在有 spec 的前提下合适生效。

## Requirements

### Requirement: probe 命令存在

The system SHALL 提供 `bridge probe <project-root>` 子命令，可选参数 `--stage <stage>`、`--inventory "<skill1>,<skill2>,..."`。

#### Scenario: 基本调用
- **WHEN** 执行 `node <bridge> probe <project-root>` 且 `<project-root>` 是有效 git 根
- **THEN** stdout 输出 D5 格式文本（[probe] 段 + project_type + capabilities + inventory + stage + advised_skill + advised_reason + prompt_to_user）

#### Scenario: 带 inventory 参数
- **WHEN** 执行 `node <bridge> probe <project-root> --inventory "openspec-explorer,superpowers-tdd"`
- **THEN** 路由按 inventory 优先（superpowers-tdd 命中 Superpowers → advised_skill = superpowers-* 子 skill）

#### Scenario: 带 stage 参数
- **WHEN** 执行 `node <bridge> probe <project-root> --stage executing`
- **THEN** 路由按 stage 选 advised_skill 的子集（executing 阶段不推荐 openspec-init，只推荐 openspec-apply-change / superpowers-tdd）

### Requirement: probe 探测 4 维度

The system SHALL 在每次 probe 调用时探测：(a) 项目类型 / (b) 能力缺口 / (c) 已用 skill / (d) 目前拍点。

#### Scenario: 探测项目类型
- **WHEN** 项目根含 `openspec/` 子目录（含 config.yaml 或 archive 子目录）
- **THEN** project_type = "openspec"

#### Scenario: 探测项目类型（fallback）
- **WHEN** 项目根无 `openspec/` 子目录
- **THEN** project_type = "standalone"（builtin 兜底）

#### Scenario: 探测能力缺口
- **WHEN** 项目类型 = "openspec" 但本会话未调任何 superpowers-* skill
- **THEN** fallback_skill = "superpowers-test-driven-development"（提示用户装 Superpowers）

#### Scenario: 探测 inventory
- **WHEN** `--inventory` 传 "openspec-explorer"
- **THEN** inventory = ["openspec-explorer"]；路由按此 skill 所属栈（OpenSpec）优先

#### Scenario: 探测 inventory（缺省）
- **WHEN** `--inventory` 未传
- **THEN** inventory = []；路由退到"按项目类型 + 能力层"（无 inventory 加权）

#### Scenario: 探测目前拍点
- **WHEN** `.bridge.yaml` 含 `stage: contracted`
- **THEN** stage = "contracted"，next_stage = "executing"

### Requirement: probe 路由优先级

The system SHALL 按以下优先级路由 advised_skill：(1) inventory 含 superpowers-* skill → Superpowers 子 skill；(2) 否则 inventory 含 matt-* skill → Matt 子 skill；(3) 否则 inventory 含 openspec-* skill → OpenSpec CLI；(4) 否则按能力层（同 1-2-3 但用 capabilities 字段）；(5) 否则 advised_skill = null。

#### Scenario: 优先级 1 — Superpowers 胜出
- **WHEN** inventory = ["superpowers-tdd", "openspec-explorer"]
- **THEN** advised_skill = "superpowers-test-driven-development"（不选 openspec-*）

#### Scenario: 优先级 2 — Matt 胜出（无 Superpowers）
- **WHEN** inventory = ["matt-to-goal", "openspec-explorer"]
- **THEN** advised_skill = "matt-to-goal"（不选 openspec-*）

#### Scenario: 优先级 3 — OpenSpec 胜出（无 Superpowers/Matt）
- **WHEN** inventory = ["openspec-explorer"]
- **THEN** advised_skill = "openspec-apply-change"（按 OpenSpec 栈下一阶段）

#### Scenario: 优先级 4 — 能力层兜底
- **WHEN** inventory = [] 且 capabilities 字段 = ["openspec", "superpowers"]
- **THEN** advised_skill = "superpowers-test-driven-development"（能力层最高优先级）

#### Scenario: 优先级 5 — 无建议
- **WHEN** inventory = [] 且 capabilities = ["builtin"]
- **THEN** advised_skill = null（不给推荐，让用户裸聊）

### Requirement: probe 输出引导生成 spec

The system SHALL 在 advised_skill 非 null 时，stdout 末尾追加 `prompt_to_user` 一行，含具体的"按你现状，下一步是 XXX 引导生成 proposal.md"措辞。

#### Scenario: 引导 OpenSpec 栈生成 proposal
- **WHEN** advised_skill = "openspec-apply-change"
- **THEN** prompt_to_user = "调 openspec-apply-change /changes/<change-id> 引导生成 proposal.md"

#### Scenario: 引导 Matt 栈生成 spec
- **WHEN** advised_skill = "matt-to-goal"
- **THEN** prompt_to_user = "调 matt-to-goal /changes/<change-id> 引导生成 proposal.md"

#### Scenario: 不引导（无 advised_skill）
- **WHEN** advised_skill = null
- **THEN** 不输出 prompt_to_user（让用户继续裸聊）

### Requirement: probe 合并 next 输出

The system SHALL 在 probe 内部调 `bridge next <project-root>` 并把 next 输出合并到 stdout 末尾 `[next]` 段（避免 AI 调两次）。

#### Scenario: probe + next 合并
- **WHEN** 执行 `bridge probe <root>` 且 root 含 `.bridge.yaml`
- **THEN** stdout 末尾追加 `[next]\nstage: <S>\nnext: <一句话>\nadvised: <CLI 动作>` 段

### Requirement: probe 不写文件

The system SHALL 不创建或修改任何文件（除 stdout）。

#### Scenario: 不污染状态目录
- **WHEN** 执行 probe 后
- **THEN** `.bridge/` / `.bridge.yaml` / `.bridge.log` 不被创建或修改（probe 是只读 + stdout）
