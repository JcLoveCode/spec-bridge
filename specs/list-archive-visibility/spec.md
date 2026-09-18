# list-archive-visibility

## Purpose

`bridge list <root>` 输出加 `archived_count` 字段，agent 起新 change 时知道"archive 有 N 条历史可接续"，不破坏 v1.2 D5 "skip archive 避免喧宾夺主"；同时 `detectLayout` 改用 archive 历史化石作为 layout 真信号——避免把 OpenSpec CLI 本地安装产物（磁盘有、gitignored）误判为 openspec 布局。

## Requirements

### Requirement: list-output-includes-archived-count

The system SHALL make `bridge list <root>` return an `archived_count` field in the JSON output. The field MUST be a non-negative integer equal to the number of subdirectories under `changesDir/archive/`. The field SHALL be present even when `archived_count` is `0` (e.g., before any change has been archived).

The system SHALL NOT enumerate the archived changes in the `bridge list` output (e.g., no `archived: [...]` array). Detail MUST remain reachable only via `bridge pattern --tag <t>` / `bridge mention <dir> --tag <t>` / `bridge next changes/archive/<id>` per v1.2 D5.

#### Scenario: spec-bridge repo reports 5 archived changes

- **WHEN** `bridge list .` is executed in the spec-bridge repo (after v1.1~v1.3 are archived)
- **THEN** output JSON includes `"archived_count": 5` and `changes: []` + `untracked_artifacts: []`

#### Scenario: fresh repo reports 0

- **WHEN** `bridge list .` is executed in a fresh repo with no archived changes
- **THEN** output JSON includes `"archived_count": 0` and the field is still present

### Requirement: detectlayout-prefers-archive-history

The system SHALL make `detectLayout(projectRoot)` decide `layout` based on where bridge history actually exists, not merely on the presence of `openspec/` directory. The priority order MUST be:

1. `changes/archive/*/.bridge.yaml` exists → `standalone` (changesDir = `changes/`)
2. `openspec/changes/archive/*/.bridge.yaml` exists → `openspec` (changesDir = `openspec/changes/`)
3. `openspec/config.yaml` exists (OpenSpec CLI installed) → `openspec`
4. default → `standalone`

The function MUST be defined identically in `bridge.mjs` (primary) and `cmd-init.mjs` (mirror) so that `bridge list` and `bridge init` agree on layout.

#### Scenario: spec-bridge repo with OpenSpec CLI installed returns standalone

- **WHEN** `bridge list .` is executed in the spec-bridge repo (which has `openspec/` from local CLI install AND `changes/archive/` with bridge history)
- **THEN** output JSON shows `layout: 'standalone'` (NOT `opensourcepec`) — because bridge archive history exists at the standalone path

#### Scenario: real OpenSpec project with bridge archive under openspec/

- **WHEN** `bridge list .` is executed in a real OpenSpec project where bridge history lives at `openspec/changes/archive/`
- **THEN** output JSON shows `layout: 'openspec'` (rule 2 hits first)

#### Scenario: OpenSpec CLI installed but no bridge history

- **WHEN** a repo has `openspec/config.yaml` but no bridge archive under either path
- **THEN** layout = `openspec` (rule 3)

#### Scenario: fresh repo, no OpenSpec, no archive

- **WHEN** a fresh repo has no `openspec/` and no archive
- **THEN** layout = `standalone` (rule 4 default)