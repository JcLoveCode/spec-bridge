## Purpose

桥是 SDD 编程的元层导航员——按项目实际装的栈（openspec/superpowers/matt）路由每拍该用的 skill/CLI，模板降级为 builtin 兜底，桥只管生命周期 + 衔接 + 归档。

## ADDED Requirements

### Requirement: init-by-workflow-kind

The system SHALL make `bridge init --workflow-kind` branch its output. When `--workflow-kind openspec` or `--workflow-kind matt` is passed, the system SHALL scaffold only the ledger (`.bridge.yaml` + `.bridge.log` + empty `specs/<cap>/`) and SHALL NOT generate `proposal.md`, `design.md`, `tasks.md`, or `execution-contract.md`. When `--workflow-kind builtin` is passed (or omitted), the system SHALL preserve the existing behavior of generating all five templates.

#### Scenario: openspec kind skips templates

- **WHEN** `bridge init foo --workflow-kind openspec`
- **THEN** `changes/foo/.bridge.yaml` exists, `proposal.md`/`design.md`/`tasks.md`/`execution-contract.md` do NOT exist, `.bridge.log` records the init event

#### Scenario: matt kind skips templates

- **WHEN** `bridge init foo --workflow-kind matt`
- **THEN** same outcome as openspec kind

#### Scenario: builtin kind retains all templates

- **WHEN** `bridge init foo --workflow-kind builtin` (or no flag)
- **THEN** `changes/foo/` contains all five templates + state + log (current behavior)

### Requirement: next-advice-by-protocol

The system SHALL make `bridge next` include a `protocol` advice list. The list SHALL be derived from `PROTOCOL_HINTS[stage]` (and when multi-stack aware: filtered by `workflow_kind`). The list SHALL only contain `use_skill` recommendations; it SHALL NOT auto-execute them.

#### Scenario: executing stage with openspec kind

- **WHEN** `bridge next <dir>` and `stage` = `executing` and `workflow_kind` = `openspec`
- **THEN** output includes `→ use_skill openspec-apply-change` and `→ use_skill test-driven-development`

#### Scenario: planning stage

- **WHEN** `bridge next <dir>` and `stage` = `planning`
- **THEN** output's `protocol` list is empty (router does not pollute pre-plan stages)

#### Scenario: archived stage

- **WHEN** `bridge next <dir>` and `stage` = `archived`
- **THEN** output's `protocol` list is empty (terminal state)

#### Scenario: matt kind at planning offers wayfinder for foggy efforts

- **WHEN** `bridge next <dir>` and `stage` = `planning` and `workflow_kind` = `matt`
- **THEN** output includes `→ use_skill grill-with-docs` (small fog) and `→ use_skill wayfinder` (huge fog — see SKILL.md §6 for trigger)

### Requirement: adopt-external-artifacts

The system SHALL provide `bridge adopt <dir>` to take over pre-existing SDD artifacts and create a ledger. The command SHALL recognize openspec format (`proposal.md` + `specs/<cap>/spec.md`) and matt format (`.scratch/` + `CONTEXT.md` or ADR files). The command SHALL infer the initial stage from content: presence of `execution-contract.md` implies `contracted`, presence of only the four artifacts implies `planning`. For unrecognized formats, the command SHALL output a "format not recognized, may manually fill ledger" notice and SHALL NOT create a ledger.

#### Scenario: adopt openspec-style directory

- **WHEN** `bridge adopt /path/to/openspec-change` and the directory contains `proposal.md` and `specs/<cap>/spec.md`
- **THEN** a ledger is created with `parent_artifacts_hash` recorded, stage inferred from content, and `.bridge.log` gains an `adopt:` event

#### Scenario: adopt matt-style directory

- **WHEN** `bridge adopt /path/to/matt-work` and the directory contains `.scratch/` and a `CONTEXT.md`
- **THEN** a ledger is created as above

#### Scenario: adopt unrecognized directory

- **WHEN** `bridge adopt /path/to/random`
- **THEN** a notice is printed; no ledger is created; no state file is touched

### Requirement: list-untracked-artifacts

The system SHALL make `bridge list <root>` output an `untracked artifacts:` segment. The segment SHALL list directories under the change root (excluding `archive/`) that look like openspec or matt SDD artifacts but lack `.bridge.yaml`. The segment SHALL suggest `bridge adopt <dir>` commands.

#### Scenario: list finds openspec-style untracked change

- **WHEN** `bridge list .` runs and a sibling directory contains `proposal.md` but no `.bridge.yaml`
- **THEN** the output includes `untracked artifacts:` followed by the directory name and a suggested `bridge adopt` command

### Requirement: sync-compat-with-external-sync

The system SHALL keep `bridge sync` as the sole publisher of the published baseline. When the system detects that another publisher (e.g. openspec `sync-specs`) has modified `specs/<cap>/spec.md` since the last receipt, `bridge verify` SHALL report the drift but SHALL NOT block archive. SKILL.md SHALL document this rule.

#### Scenario: verify after external sync

- **WHEN** `bridge verify <dir>` runs and the baseline `specs/<cap>/spec.md` has been modified by an external publisher
- **THEN** the command reports drift with a non-zero status; archive still permitted (gate is informational, not blocking for openspec stacks)

### Requirement: layout-detect-external-sdd

The system SHALL make `bridge layout <root>` output one detection line per recognized external SDD product family (besides openspec-cn and matt). For spec-kit and spec-superflow, the output SHALL be a one-line "detected external SDD product family: <name>" notice. Deep routing for these families is out of v1.3 scope.

#### Scenario: layout detects spec-kit

- **WHEN** `bridge layout .` runs and a sibling directory contains `specs/<NNN>-*/spec.md` (spec-kit pattern)
- **THEN** the output includes `detected external SDD product family: spec-kit (deep routing: v1.4+)`