# Specification — v1.2 follow-up B7

> delta 格式（ADR-0005）：所有块继承自父 `2026-09-18-v1-2-navigator-architect`，本变更仅 ADDED 至现有 `bridge-next` capability。

## ADDED Requirements

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

## MODIFIED Requirements

无（所有改动为 ADDED，不破坏现有行为）。

## REMOVED Requirements

无。