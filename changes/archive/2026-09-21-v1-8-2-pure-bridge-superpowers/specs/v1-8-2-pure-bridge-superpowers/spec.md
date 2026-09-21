## Purpose

bridge 进入"纯桥模式"——`bridge init` 不再生成任何 spec 模板（proposal/design/tasks/spec/execution-contract），只建台账 + 路由；外栈产物由外栈（matt `to-spec` / openspec-propose / superpowers `brainstorming`）自管生成。同时把 superpowers 加入项目栈探测优先级，让 superpowers 栈用户被正确推到 superpowers 的具体 skill。

## ADDED Requirements

### Requirement: bridge init 不再写 spec 模板

The system SHALL NOT write `proposal.md` / `design.md` / `tasks.md` / `execution-contract.md` / `specs/<cap>/spec.md` when `bridge init <name>` is invoked, regardless of flags passed.

#### Scenario: 默认 init 不写模板

- **WHEN** 用户执行 `bridge init foo-bar`（无任何 flag）
- **THEN** change 目录 `changes/foo-bar/` 下只有 `.bridge.yaml` + `.bridge.log` + 空 `specs/foo-bar/` 目录
- **AND** 不写 `proposal.md` / `design.md` / `tasks.md` / `execution-contract.md` / `specs/<cap>/spec.md`
- **AND** 自动调 `bridge probe changes/foo-bar` 给 AI 看导航推荐（除非 `--no-auto-probe`）

#### Scenario: --builtin flag 变 no-op（向后兼容提示）

- **WHEN** 用户执行 `bridge init foo-bar --builtin`（v1.8-1 旧 flag）
- **THEN** flag 被忽略，与默认行为一致——**不写**任何模板
- **AND** stderr 输出 `[hint] --builtin flag removed in v1.8-2 (pure bridge mode), no-op` 提示
- **AND** exit 0

#### Scenario: init usage 字符串不含 --builtin

- **WHEN** 用户执行 `bridge init`（无 name 参数触发 usage 输出）
- **THEN** usage 输出**不**含 `--builtin` flag
- **AND** `--workflow-kind` 值域含 `superpowers`（v1.8-2 扩值）

### Requirement: superpowers 加入项目栈探测优先级

The system SHALL detect `superpowers` stack as project stack when both signals are present:
1. `.claude-plugin/` directory exists at project root
2. `package.json` contains `"superpowers"` field (dependencies / devDependencies / keywords / name / description any one)

#### Scenario: 双信号在 → primary = superpowers

- **WHEN** 项目根有 `.claude-plugin/` 目录
- **AND** `package.json` 含 `"superpowers"` 字段（如 keywords 或 dependencies）
- **THEN** `detectStack(projectRoot).primary === 'superpowers'`
- **AND** `detectStack(projectRoot).signals.claudePlugin === true`
- **AND** `detectStack(projectRoot).signals.packageJsonSuperpowers === true`

#### Scenario: 缺 .claude-plugin/ → 不派 superpowers

- **WHEN** 项目根**无** `.claude-plugin/` 目录
- **AND** `package.json` 含 `"superpowers"` 字段
- **THEN** `detectStack(projectRoot).primary !== 'superpowers'`
- **AND** 兜底到 openspec 或 builtin

#### Scenario: 缺 superpowers 字段 → 不派 superpowers

- **WHEN** 项目根**无** `.claude-plugin/` 目录相关 superpowers 字段（如 `.claude-plugin/` 在场但 `package.json` 没 `"superpowers"`，而是有 `"matt-skills"`）
- **THEN** `detectStack(projectRoot).primary === 'matt'`（matt 仍优先 openspec）
- **AND** 不会因为 superpowers 字段缺失导致误派

#### Scenario: 优先级 superpowers > matt > openspec > builtin

- **WHEN** 项目根同时有 `.claude-plugin/` + `"superpowers"` 字段 + `"matt-skills"` 字段 + `openspec/` 目录
- **THEN** `detectStack(projectRoot).primary === 'superpowers'`（superpowers 优先于 matt 和 openspec）
- **AND** matt 项目同理：双信号在时优先于 openspec

### Requirement: WORKFLOW_KINDS 值域扩为 4 个

The system SHALL accept `superpowers` as a valid value for `workflow_kind` field in `.bridge.yaml`, alongside `openspec` / `matt` / `builtin`.

#### Scenario: --workflow-kind superpowers 合法

- **WHEN** 用户执行 `bridge init foo --workflow-kind superpowers`
- **THEN** exit 0
- **AND** `.bridge.yaml` 中 `workflow_kind: superpowers`

#### Scenario: 非法值仍报错

- **WHEN** 用户执行 `bridge init foo --workflow-kind invalid`
- **THEN** exit 2
- **AND** stderr 输出 `invalid --workflow-kind 'invalid' — must be one of: superpowers, openspec, matt, builtin`

### Requirement: probe fallback 文案引导 brainstorming

The system SHALL output a `bridge doesn't write templates, use brainstorming or edit freely` message when no external stack skill is in inventory, instead of `AI 自由发挥` (v1.8-1 ambiguous phrase).

#### Scenario: 无 inventory → advised_skill (none) + 新文案

- **WHEN** 用户执行 `bridge probe . --inventory ""`
- **THEN** advised_skill = `(none)`
- **AND** advised_reason = `inventory 未含任何已知栈 skill — bridge 不写模板，请 AI 用 brainstorming 或直接编辑自由发挥`
- **AND** advised_invocation = `bridge 不写模板 — AI 用 brainstorming 或直接编辑自由发挥`

### Requirement: 删除 5 件模板常量与 fillTemplate 函数

The system SHALL remove `PROPOSAL_TEMPLATE` / `DESIGN_TEMPLATE` / `TASKS_TEMPLATE` / `SPEC_TEMPLATE` / `CONTRACT_TEMPLATE` constants and `fillTemplate` function from `cmd-init.mjs`, as they are no longer used after D1.

#### Scenario: cmd-init.mjs 不含 5 件模板常量

- **WHEN** 读 `cmd-init.mjs` 全文
- **THEN** grep `PROPOSAL_TEMPLATE|DESIGN_TEMPLATE|TASKS_TEMPLATE|SPEC_TEMPLATE|CONTRACT_TEMPLATE` 返回 0 行
- **AND** grep `fillTemplate` 返回 0 行
- **AND** grep `\bbuiltin\b` 仅剩 `detachProjectRoot` 等无关函数引用