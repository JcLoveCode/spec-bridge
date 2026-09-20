# v1-6-init-detectlayout-fix

## Purpose

让 `detectLayout` 在 archive 化石与 openspec/config.yaml 都不在场、但 `openspec/` 目录在场时仍返回 `layout: openspec`——补 spec/cli/spec.md R1 场景 1.5 的"仅 openspec/ 目录在场"边界情况。同时保留 v1.4 ADR-0009 防误判成果（archive 化石优先级 1 保护 spec-bridge 仓库根不被 OpenSpec CLI 本地安装目录误判）。

## Requirements

### Requirement: detectLayout 加 openspec/ 目录弱信号兜底

The system SHALL detect `layout: openspec` when `<projectRoot>/openspec/` 目录在场且 archive 化石（v1.4 第一性原则）与 `openspec/config.yaml`（OpenSpec CLI 标志）都不在场；返回 `changesDir = <projectRoot>/openspec/changes`。

#### Scenario: 仅 openspec/ 目录在场（无 archive 化石 + 无 config.yaml）

- **WHEN** `<projectRoot>/openspec/` 目录存在
- **AND** `<projectRoot>/changes/archive/` 无 `.bridge.yaml` 化石
- **AND** `<projectRoot>/openspec/config.yaml` 不存在
- **THEN** `detectLayout` 返回 `{ layout: 'openspec', changesDir: '<projectRoot>/openspec/changes', baselineDir: '<projectRoot>/openspec/specs' }`

#### Scenario: archive 化石在场压制 openspec/ 弱信号（v1.4 防误判）

- **WHEN** `<projectRoot>/changes/archive/<id>/.bridge.yaml` 存在（bridge history 化石）
- **AND** `<projectRoot>/openspec/` 目录同时存在（OpenSpec CLI 本地安装）
- **THEN** `detectLayout` 返回 `layout: standalone`（化石优先级 1 压制弱信号）

#### Scenario: spec-bridge 仓库根 list 端到端回归保护

- **WHEN** 在 spec-bridge 仓库根（`.gitignore` 忽略 `openspec/` 但磁盘存在 + `changes/archive/<5 id>` 在场）
- **THEN** `bridge list <spec-bridge-root>` 输出 `layout: standalone, archived_count: 5`（端到端断言 v1.4 修复成果未被 v1.6 弱信号破坏）
