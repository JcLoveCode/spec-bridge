# Execution Contract: v1-4-list-archive-visibility

## Intent Lock

v1.3 归档后 agent 不知 archive 历史可接续——`bridge list` 输出不显历史条数；根因是 `detectLayout` 把仓库根 `openspec/`（OpenSpec CLI 本地安装产物）错判为 openspec 布局，让 list 走 `openspec/changes/` 看不见 `changes/archive/` 历史。修复：
1. `bridge list` 输出加 `archived_count` 字段（只数不展示）
2. `detectLayout` 改 archive 化石优先

## Scope Fence

### In Scope
1. `scripts/bridge.mjs` `listChanges()` 返回 `archived_count`
2. `scripts/bridge.mjs` `detectLayout()` 化石优先
3. `scripts/cmd-init.mjs` mirror `detectLayout()` 同步修
4. `tests/docs-sync-test.mjs` 加 R6 (list archived_count 字段)
5. `SKILL.md` §5 list 行说明
6. `CONTEXT.md` 补 layout 探测规则

### Out of Scope
- **不加 `--include-archive` flag**（v1.2 D5 "skip archive 避免喧宾夺主"——详情走 `pattern` / `mention`）
- **不重构 archive 物理结构**（archive/ 仍然是 git mv 落点，不分层 / 分栈）
- **不修 v1.3 parent 字段**：v1.3 .bridge.yaml 里 `parent: 2026-09-18-v1-3-research-xrouter` 是 follow-up 引用，不动
- **`.gitignore` 改 openspec/ + .codebuddy/**：v1.4 不管（已在 commit `fed763a` 作为仓库层 chore 落地）
- **OpenSpec 栈 layout 修复走 v1.4 follow-up**：本 change 只修 spec-bridge 自身仓库 layout 错判

## Approved Requirements

<!-- 映射自 specs/list-archive-visibility/spec.md。每条 SHALL/MUST 必须有一条测试义务 + 落进至少一个 Batch。 -->
- [ ] **R1 — list 输出 archived_count**：当 `bridge list <root>` 被调用，返回 JSON 必须包含数字字段 `archived_count`（测试义务：bridge list . 输出 grep "archived_count" 必为数字类型）
- [ ] **R2 — detectLayout 化石优先**：当 `changes/archive/*/.bridge.yaml` 存在时返回 layout=standalone，即使 `openspec/` 目录存在（测试义务：bridge list . 返回 layout='standalone'，changesDir 含 'changes' 不含 'openspec/changes'）
- [ ] **R3 — cmd-init mirror 一致**：`cmd-init.mjs` 的 mirror `detectLayout` 与 `bridge.mjs` 主版探测结果一致（测试义务：init 与 list 用同一目录探测结果）

## Constraints

<!-- 唯一权威源：design.md ## Decisions。每条 C 编号对到 D 编号。 -->
- [x] **C1** — detectLayout 化石优先（D1）：优先级 1) bridge archive 化石 2) openspec archive 化石 3) openspec/config.yaml 4) 缺省 standalone
- [x] **C2** — list 只数不展示（D2）：archived_count 是数字字段，不是数组——详情走 `pattern` / `mention`
- [x] **C3** — 不动 v1.3 parent 字段 + archive 物理结构（D3）：parent 是 ADR 链接字段，物理位置正交

## Execution Batches

<!-- 来源：tasks.md。每批 — 任务号们 — 完成定义 — 审查时点。 -->

### Batch 1 — detectLayout 修复（已完成）
- T1.1 + T1.2：bridge.mjs + cmd-init.mjs detectLayout 化石优先

### Batch 2 — archived_count 字段（已完成）
- T2.1 + T2.2 + T2.3：listChanges() 加字段 + R6 测试

### Batch 3 — 文档同步（待办）
- T3.1 + T3.2 + T3.3：SKILL.md / CONTEXT.md 同步 + 测试验证

### Batch 4 — ADR-0009 + 蒸馏补全（待办）
- T4.1 + T4.2 + T4.3：ADR 文档 + CONTEXT 引用

### Batch N — 归档（待办）
- TN.1~TN.5：sync → verify → why.md → git mv → archived → push

## Escalation Rules

执行过程中遇到哪些情况必须停下回 planning 重开：
- R1/R2/R3 测试有任一 FAIL → 停下回 Batch 1 重做
- detectLayout 4 case 顺序改动 → 停下回 Batch 1 重审 D1
- archive 物理结构需求（如"按栈分层"）出现 → 停下回 D3 重审（违反 §6.3 sync 兼容规则）
- v1.3 parent 字段被任何代码动到 → 停下回 D3 重审（违反 ADR-0005）
- `bridge list --include-archive` flag 需求出现 → 停下回 D2 重审（破坏 v1.2 D5）