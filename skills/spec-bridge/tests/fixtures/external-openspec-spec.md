## Purpose

Fixture：模拟外部 OpenSpec 仓库已存在的 delta spec（v1.3 D4 接管的典型形态）。
无 .bridge.yaml，无 5 模板，仅 `specs/<cap>/spec.md` 在场。
`bridge adopt` 应该只写台账，不动 spec.md 内容。

## ADDED Requirements

### Requirement: External Spec Adoption

The system SHALL register an existing OpenSpec change directory under spec-bridge control by writing a `.bridge.yaml` + first `.bridge.log` entry without modifying pre-existing artifacts.

#### Scenario: adopt a fresh openspec-style change

- **WHEN** the operator runs `bridge adopt <dir>` against a directory containing only `specs/<cap>/spec.md` and the project root has an `openspec/` directory
- **THEN** `.bridge.yaml` is created with `workflow_kind=openspec` and `layout=openspec`, `.bridge.log` records the adopt event, and existing `spec.md` content is unchanged
