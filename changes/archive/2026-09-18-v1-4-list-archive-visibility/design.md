# Design: v1-4-list-archive-visibility

## Purpose

让 bridge list 看见 archive 历史——既给 agent 一个数字（`archived_count`）感知"有 N 条历史"，又修根因 `detectLayout` 错判让 list 走错目录。两件事合一起解决"v1.3 归档后 agent 失忆"的症状 + 病根。

## Architecture

```
                     ┌──────────────────────────────────┐
                     │ bridge list <root>                │
                     └────────────────┬─────────────────┘
                                      │
                                      ▼
                     ┌──────────────────────────────────┐
                     │ detectLayout(root)                │
                     │ 优先级：                          │
                     │  1. changes/archive/*/.bridge.yaml│ ← 历史化石（最准）
                     │  2. openspec/changes/archive/*/   │
                     │  3. openspec/config.yaml (CLI 标志)│
                     │  4. 缺省 standalone               │
                     └────────────────┬─────────────────┘
                                      │ returns { layout, changesDir, baselineDir }
                                      ▼
                     ┌──────────────────────────────────┐
                     │ listChanges()                     │
                     │ 扫 changesDir/ 子目录：           │
                                     │  - 有 .bridge.yaml → 读 stage  推入 changes[]
                                     │  - 无 .bridge.yaml 但有产物 → 推入 untracked_artifacts[]
                                     │ 扫 changesDir/archive/ 子目录：
                                     │  - 只数子目录数 → archived_count
                                     └────────────────┬─────────────────┘
                                      │
                                      ▼
                     {
                       layout: 'standalone',
                       changesDir: '...',
                       changes: [],
                       untracked_artifacts: [],
                       archived_count: 5
                     }
```

**关键设计点**：
- `detectLayout` 化石优先——以"bridge 历史落点"为真信号，不靠"目录是否存在"
- `listChanges` 物理位置不耦合 layout 探测——只按 `changesDir` 扫，layout 错时 archived_count 自然错
- list 输出**只数 archive** 不展示详情——保持 v1.2 D5 "skip archive 避免喧宾夺主"

## Decisions

### D1 — `detectLayout` 改用 archive 化石优先探测

**选项**：
- A. 维持现状（`openspec/` 在场 → openspec，否则 standalone）
- B. 看 archive 目录在哪（化石优先）：`changes/archive/*/.bridge.yaml` 在 → standalone；`openspec/changes/archive/*/.bridge.yaml` 在 → openspec；都没有 → 看 `openspec/config.yaml`
- C. 排除 `openspec/` 目录（黑名单模式）

**决定**：**B**

**理由**：A 选项被 OpenSpec CLI 本地安装产物（磁盘有、gitignored）误触发；C 黑名单在 spec-bridge 仓库可行但不通用（别的仓库 OpenSpec 是真布局怎么办）。B 用"历史归档落点"判断 layout——最准的信号是"bridge 历史在哪"，不是"目录有没有"。修两处：`bridge.mjs detectLayout` + `cmd-init.mjs mirror detectLayout`。

**实现**：抽公共函数 `hasAnyBridgeYaml(dir)`（20 行 × 2 文件）；4 个 case 的 switch 改成 if-else 链。

### D2 — `listChanges` 输出加 `archived_count` 字段（只数不展示）

**选项**：
- A. 加 `archived_count: <N>` 字段——agent 知道有历史但不知详情
- B. 加 `archived: [...]` 数组（缩略：name/stage/parent）——agent 可自助拉父
- C. 加 `--include-archive` flag

**决定**：**A**

**理由**：
- A 解决"agent 不知道有历史"症状，最小改动（3 行）
- B 破坏 v1.2 D5 "skip archive 避免喧宾夺主"——agent 起 v1.4 时 list 输出塞一堆 archive 详情
- C 不解决核心问题：默认行为仍是看不到；要 flag 才看——agent 不会主动加 flag
- 详情仍走 `bridge pattern --tag <t>` / `bridge mention <dir> --tag <t>` / `bridge next changes/archive/<id>`——v1.2 设计

**实现**：`bridge.mjs listChanges()` 加 8 行 `archived_count = ...` 计数逻辑。

### D3 — 不动 v1.3 parent 字段 + 不重写 archive 物理结构

**选项**：
- A. 清掉 v1.3 .bridge.yaml `parent: v1-3-research-xrouter` 字段（用户曾问）
- B. 把 archive/ 拆分为 changes/archive/builtin/ + changes/archive/openspec/ + changes/archive/matt/
- C. 维持现状

**决定**：**C**

**理由**：
- A 清掉 = v1.4 不知 v1.3 有父可接（ADR-0005 跟 parent 字段强耦合）——失忆
- B 拆 archive 物理结构破坏 §6.3 sync 兼容规则第三条"归档目录共享"——三栈共享 archive 才让跨栈续作可行
- C parent 字段是逻辑引用，archive 子目录是物理位置，两者正交——不动

## Out-of-scope decisions（明确不做的）

- **D-A**: 不加 `--include-archive` flag——理由见 D2
- **D-B**: 不重写 archive/ 物理结构——理由见 D3
- **D-C**: 不修 v1.3 `.bridge.yaml` parent 字段——理由见 D3
- **D-D**: 不补 v1.3 缺失的 `progress.md` / `tasks.md` 同步——v1.3 已归档（ADR-0005 写保护），要补走 follow-up
- **D-E**: 不动 .gitignore——`openspec/` + `.codebuddy/` 已在 commit `fed763a` 落地

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| archive 真在 openspec/ 下（真有 OpenSpec 栈仓库用 bridge） | detectLayout 看 openspec/changes/archive 有 `.bridge.yaml` → openspec | B 优先级第二档正好覆盖此场景；测试加"两个 archive 都在时优先 standalone" |
| 仓库没有 archive 历史（首次使用） | detectLayout 退回 `openspec/config.yaml` 判断 | 第三档兜底；不影响 layout=standalone 默认 |
| `archived_count` 数字误导（agent 以为可接续但不记得名字） | agent 知道有 N 条但不知接哪条 | 文档 + SKILL.md §5 提示：详情走 `pattern` / `mention` |
| `cmd-init.mjs` 与 `bridge.mjs` mirror 不一致 | init 用旧版 detectLayout，list 用新版 | 强制两文件同步改（已修） |
| 4 套 layout 探测 case 增加维护负担 | 测试要覆盖 4 case | 加 R6 测试 + docs-sync-test R7 校验 mirror 一致 |