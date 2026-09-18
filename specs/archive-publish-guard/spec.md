# archive-publish-guard

## Purpose

让"归档后想 verify 一下"这条信任链不再依赖 AI 自觉——vendor 在 archive 路径下能正确算 projectRoot；bridge 的"完工签收单"必须真实反映产物落盘；distill 不再是 AI 手动写，而是 CLI 子命令。

## Requirements

### Requirement: vendor resolvePublicationContext 支持 archive 嵌套路径

The system SHALL resolve `changeDir` 的 publication context 时，沿 `dirname` 跳到 `basename === 'changes'` 的祖先目录再算 `projectRoot`，支持任意深度的 `changes/<...>/<id>/` 路径（含 `changes/archive/<date>-<id>/` 与 `changes/archive/<date>-<id>/<sub>/` 套娃）。

#### Scenario: 活跃 change 路径

- **WHEN** `changeDir = <root>/changes/v1-5-vendor-distill-guard`
- **THEN** `projectRoot = <root>` 且 `baselineSpecsDir = <root>/specs`

#### Scenario: archive 路径

- **WHEN** `changeDir = <root>/changes/archive/2026-09-18-v1-4-list-archive-visibility`
- **THEN** `projectRoot = <root>` 且 `baselineSpecsDir = <root>/specs`

#### Scenario: 套娃 archive 路径

- **WHEN** `changeDir = <root>/changes/archive/2026-09-18-x/y/z`（变更目录在 archive 子目录里）
- **THEN** `projectRoot = <root>` 且 `baselineSpecsDir = <root>/specs`

### Requirement: bridge archive 流程校验 why.md 落盘

The system SHALL 在写 `.bridge.log` 的 "Batch N complete" 大事记前，校验 `<changeDir>/specs/<cap>/why.md` 文件存在；若不存在则 `console.error` + `exit 1`，并提示 "run: node bridge.mjs distill <change-dir>"。

#### Scenario: why.md 已落盘

- **WHEN** `bridge archive <change-dir>` 流程跑 Batch N
- **AND** `<changeDir>/specs/<cap>/why.md` 存在
- **THEN** 写 "Batch N complete: ... why.md distilled ..." 大事记，exit 0

#### Scenario: why.md 缺失

- **WHEN** `bridge archive <change-dir>` 流程跑 Batch N
- **AND** `<changeDir>/specs/<cap>/why.md` 不存在
- **THEN** `console.error("STALE: why.md not found at <path> — run: node bridge.mjs distill <change-dir>")` + `exit 1`，不写大事记

### Requirement: bridge distill CLI 子命令

The system SHALL 提供 `bridge distill <change-dir>` 子命令：从 `<changeDir>/design.md` 解析 `## Decisions` 段，按 ADR-0003 单向蒸馏格式生成 `<changeDir>/specs/<cap>/why.md`。

#### Scenario: design.md 有 Decisions 段

- **WHEN** `node bridge.mjs distill changes/v1-5-vendor-distill-guard`
- **AND** `design.md` 含 `## Decisions` 段且 ≥1 条 `### D<num> — <name>` 决策
- **THEN** 写 `specs/<cap>/why.md`，含 `## Conclusion` + `## Source-of-truth` 段，每条决策附 `来源: design.md D<num>` + `spec-rev: <回执hash>`

#### Scenario: design.md 缺 Decisions 段

- **WHEN** `node bridge.mjs distill <change-dir>`
- **AND** `design.md` 无 `## Decisions` 段
- **THEN** `console.error("MISSING: design.md has no ## Decisions — distillation impossible")` + `exit 1`

#### Scenario: why.md 已存在

- **WHEN** `node bridge.mjs distill <change-dir>`
- **AND** `specs/<cap>/why.md` 已存在
- **THEN** 拒绝覆盖：`console.error("EXISTS: why.md already at <path> — refusing to overwrite")` + `exit 1`（除非 `--force`）
