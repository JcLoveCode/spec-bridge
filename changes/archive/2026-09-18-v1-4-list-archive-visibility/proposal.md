# Change: v1-4-list-archive-visibility

## Why

v1.3 归档后 (`changes/archive/2026-09-18-v1-3-sdd-meta-navigator/`)，
`bridge list` 输出 `changes: []` + `untracked_artifacts: []`——
agent 起 v1.4 时**完全不知道** archive 下还有 v1.1 / v1.2 / v1.2-b7 /
v1.3-research / v1.3-sdd 共 5 条历史可接续，follow-up 链断了人都不知觉。

更深的 bug：`detectLayout` 把仓库根的 `openspec/` 目录（OpenSpec CLI 本地安装产物，被 .gitignore 忽略但磁盘还在）错判为 `layout: openspec`，让 list 走 `openspec/changes/`——根本看不见 `changes/archive/` 历史。layout 错判连带 `archived_count` 错报为 0。

## What Changes

- **`bridge list` 输出加 `archived_count`** 字段：只数不展示，让 agent 知道"有 N 条历史"
- **`detectLayout` 探测信号升级**：archive 历史化石 > `openspec/config.yaml` > 缺省 standalone（修复错判）
- **测试覆盖**：list archived_count 字段在 `bridge list` 输出中存在；detectLayout 在 spec-bridge 仓库（layout=standalone）正确返回 standalone 而不是 openspec
- **文档同步**：`SKILL.md` §5 `list` 行加 "返回 `archived_count`" 提示；`CONTEXT.md` 加"archive 化石优先" layout 探测规则

## Scope

### In Scope

1. `scripts/bridge.mjs` `listChanges()` 返回 `archived_count`
2. `scripts/bridge.mjs` `detectLayout()` 化石优先
3. `scripts/cmd-init.mjs` mirror `detectLayout()` 同步修
4. `tests/docs-sync-test.mjs` 加 R6 (list 输出 archived_count 字段存在)
5. `SKILL.md` §5 补 list 行说明
6. `CONTEXT.md` 补 layout 探测规则

### Out of Scope

- **不加 `bridge list --include-archive` flag**（v1.2 D5 "skip archive 避免喧宾夺主"——详情走 `pattern` / `mention`）
- **不重构 archive 物理结构**（archive/ 仍然是 git mv 落点，不分层 / 分栈）
- **不修 v1.3 parent 字段**：v1.3 .bridge.yaml 里 `parent: 2026-09-18-v1-3-research-xrouter` 是 follow-up 引用，不动
- **`.gitignore` 改 openspec/ + .codebuddy/**：v1.4 不管（已在 commit `fed763a` 作为仓库层 chore 落地）
- **OpenSpec 栈 layout 修复走 v1.4 follow-up**：本 change 只修 spec-bridge 自身仓库 layout 错判