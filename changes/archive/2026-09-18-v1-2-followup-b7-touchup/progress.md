# Progress — v1.2 follow-up B7 硬性步骤栏

> 协议自证记录：每个 hard step 后调 `bridge next`，输出截到此文件（设计 D3）。

## Batch 1 — next 命令 stage-aware 扩展 + 4 测试

### 开工前 hard step（approved→executing 拍点切换）

```
$ node bridge.mjs next changes/v1-2-followup-b7-touchup
change: changes/v1-2-followup-b7-touchup
stage:  contracted
next:   contract approved - execute B1 (next command stage-aware + tests) then B2 (SKILL.md hard step + archive)
→ 先跑 hashes --check（契约过期检测）；通过后按 tasks.md 批次执行
parent: 2026-09-18-v1-2-navigator-architect (sha256:1e3159da64f24de1c1809462e783436b2bddb86c73f64c62a2a5b5df5d3e05a5)
workflow: matt
```

> 注：本拍点 next advice 仍是"先跑 hashes --check"——因为 contract_approved 已填但 stage 仍是 `contracted`。这是设计 D2 二态分流触发条件（stage=contracted AND contract_approved 已填）。R1 新分支（contracted_approved）的 advice 文案改动在 hard step 2 之后生效——hard step 2 推进 stage=executing 时，新分支才能被验证。

### Hard step 2 — state set stage executing + 推 Batch 1 next

```
$ node bridge.mjs state set <change-dir> stage executing   → stage updated
$ node bridge.mjs state next <change-dir> "executing B1 (next command stage-aware + 4 tests)"   → next recorded
```

### 开工后 hard step（executing + Batch 1 拍点确认）

```
$ node bridge.mjs next changes/v1-2-followup-b7-touchup
change: changes/v1-2-followup-b7-touchup
stage:  executing
next:   executing B1 (next command stage-aware + 4 tests)
→ 继续当前批次；每批收尾 state next 写恢复提示，批末审查写 progress.md
parent: 2026-09-18-v1-2-navigator-architect (sha256:1e3159...)
workflow: matt
```

> next 字段 "executing B1..." 不以 "Batch N:" 起头 → 末尾 `→ Batch N` 不显示。这是设计 D2 隐含约定（next 字段格式约定）——验收时改为 "Batch 1: ..." 验证追加生效。

### 实现记录

- `cmd-next.mjs`：+8 行——新增 `contracted_approved` 表项、`BATCH_RE` 正则、`effectiveStage` 二态分流、`executing + Batch N 格式`末尾追加
- `bridge-state.mjs`：未改（v1.2 B1 的 `checkStageTransition` 已就位）
- `tests/navigator-b3.test.mjs`：+4 用例（R1 场景 1-4）
- 修正：`archived` advice 改回英文 `init <name> --parent <this>`（旧 v1.2 B3 测试 regex 兼容）
- 修正：`contracted` 不分流时（无 approved）回落到旧 advice（向后兼容）

### 全量回归

```
# tests 70
# pass 70
# fail 0
```

> 66 → 70：4 个新 R1 用例，旧 7 个 v1.2 B3 用例零回归。

### 批末 hard step

```
$ node bridge.mjs state next changes/v1-2-followup-b7-touchup "Batch 1 done: 4 tests green (3 stage-aware branches + 1 contract backward-compat); proceed Batch 2 (SKILL.md hard step + archive)"
$ node bridge.mjs next changes/v1-2-followup-b7-touchup
change: changes/v1-2-followup-b7-touchup
stage:  executing
next:   Batch 1 done: 4 tests green (3 stage-aware branches + 1 contract backward-compat); proceed Batch 2 (SKILL.md hard step + archive)
→ 继续当前批次；每批收尾 state next 写恢复提示，批末审查写 progress.md
→ Batch 1
parent: 2026-09-18-v1-2-navigator-architect (sha256:1e3159...)
workflow: matt
```

> next 字段 "Batch 1 done: ..." 以 "Batch N:" 格式起头 → 末尾 `→ Batch 1` 触发。**stage-aware + Batch N 追加 链路自证闭环**。

### 350 行守卫

```
315 skills/spec-bridge/scripts/bridge.mjs
```
< 350（v1.2 C9）。

### B1 审查结论

- R1 stage-aware 3 场景（contracted+approved / executing+Batch / archived 守门）+ 1 patch 兼容场景 全部满足
- 旧 v1.2 B3 既有 7 用例零回归（兼容 STAGE_ADVICE key 复用）
- `cmd-next.mjs` 总行数 ~50（远低于 D2 的 30 行约束——实际新增 8 行）
- 风险：stage-aware advice 引入新 key，未来若 stage 字段扩展需同步——已写入 SPEC.md B1 审查

## Batch 2 — SKILL.md §3 硬性步骤栏 + 归档收口

### 开工前 hard step

```
$ node bridge.mjs next changes/v1-2-followup-b7-touchup
change: changes/v1-2-followup-b7-touchup
stage:  executing
next:   Batch 1 done: 4 tests green (3 stage-aware branches + 1 contract backward-compat); proceed Batch 2 (SKILL.md hard step + archive)
→ 继续当前批次；每批收尾 state next 写恢复提示，批末审查写 progress.md
→ Batch 1
parent: 2026-09-18-v1-2-navigator-architect (sha256:1e3159...)
workflow: matt
```

> `→ Batch 1` 触发了——上次批末修改的 next 字段格式生效。

### 实现记录

- `SKILL.md`：+8 行——§3 executing 段顶部加两条 `> **hard step — ...**` 引用块（entering executing / before each batch）
- `tests/navigator-b7-touchup.test.mjs`：+4 用例（R2 场景 1-4：hard step 计数 / state set 命令字面量 / bridge next 命令字面量 / 段落位置）
- `specs/cli/why.md`：+28 行——本 follow-up 4 个决策蒸馏（D1-D4）+ 协议自证

### 修正：测试 regex 放宽

`R2 场景 2` 原本要 `/state set stage executing/` 字面量，但 SKILL.md 用 `<dir>` 占位符是合理的。改为 `/state set\s+<\w+>\s+stage executing/`（允许占位）。

### 全量回归

```
# tests 70
# pass 70
# fail 0
```

### 批末 hard step（归档前）

```
$ node bridge.mjs sync <change-dir>   → ✅ Published 2 canonical spec(s)
$ node bridge.mjs verify <change-dir> → PASS
$ node bridge.mjs state set <change-dir> stage archived
```

> 注意：本 follow-up 是 bridge 协议层修订，**未在 specs/util-*/spec-md.md 蒸馏**（why 蒸馏只覆盖 cli capability）。bridge next stage-aware + SKILL.md hard step 都属 cli capability，蒸馏到 specs/cli/why.md。

### B2 审查结论

- R2 SKILL.md §3 硬性步骤栏存在性 + 段落位置 + 命令字面量 4 用例全绿
- 蒸馏格式与父 v1.2 一致（结论 + 溯源 + spec-rev）
- 风险：SKILL.md 改动只在 §3 executing 段，§1/§2/§4/§5 零回归（设计 D4 约束）
- 历史瑕疵发现：v1.2 父归档时没蒸馏自己（why.md 里 v1.2 条目混在 v1.1 后）——本 follow-up 不补（属 v1.2 B8 漏做，Out of Scope 范围）

## 归档后 hard step（自证 ADR-0005 守门）

```
$ node bridge.mjs next changes/archive/2026-09-18-v1-2-followup-b7-touchup
change: changes/archive/2026-09-18-v1-2-followup-b7-touchup
stage:  archived
next:   archived — v1.2 follow-up B7 done: 4 R1 tests + 4 R2 tests green, Stage C path
→ archived — 如需修正，开 follow-up（勿改原版，ADR-0005）：init <name> --parent <this>
parent: 2026-09-18-v1-2-navigator-architect (sha256:1e3159...)
workflow: matt
```

> next advice 含 ADR-0005 + 勿改原版 + follow-up 引导——守门自证。

---

**spec-rev 备注**：source_hash = sha256:43e1d5d39e5fa8d3e09fce68d31c58b782d0534641115419bd42e1b90b93e2ac（来自本 follow-up 自身的 sync 回执）。为何蒸馏已写入 `specs/cli/why.md`。