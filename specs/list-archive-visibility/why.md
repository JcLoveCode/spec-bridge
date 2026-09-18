# Why — list-archive-visibility

> **蒸馏规则**（v1.2 D1/D2）：why.md 唯一权威源 = `changes/v1-4-list-archive-visibility/design.md` ## Decisions。本文件由批 Batch N 单向蒸馏（design.md → why.md）——design.md 才是 source of truth，why.md 是面向读者的"为什么层"摘要，与 spec.md（"做什么层"）互补。

## D1 — `detectLayout` 改用 archive 化石优先探测

**问题**：原探测只看 `openspec/` 目录存在——会把 OpenSpec CLI 本地安装产物（磁盘有、gitignored）误判为 openspec 布局，让 list 走 `openspec/changes/` 看不见 `changes/archive/` 历史。

**选项**：
- A. 维持现状
- C. 黑名单模式（detectLayout 排除已知误判目录）
- **B. 化石优先**：archive 历史目录在哪 = layout 真信号

**决定**：**B**

**理由**：A 根因不除；C 黑名单不通用（其他仓库 OpenSpec 是真布局怎么办）。B 用"bridge 历史落点"判断 layout——最准的信号是"历史在哪"，不是"目录有没有"。4 case 优先级：
1. `changes/archive/*/.bridge.yaml` 在 → standalone
2. `openspec/changes/archive/*/.bridge.yaml` 在 → openspec
3. `openspec/config.yaml` 在 → openspec（OpenSpec CLI 标志）
4. 缺省 standalone

**实现**：`bridge.mjs detectLayout()` + `cmd-init.mjs mirror detectLayout()` 同步修；抽公共辅助函数 `hasAnyBridgeYaml(dir)` 计数子目录 `.bridge.yaml`。

**测试**：R7 验证主版与 mirror 一致 + `changes/archive` / `openspec/changes/archive` / `config.yaml` 三档探测路径都在源码。

## D2 — `listChanges` 加 `archived_count` 字段（只数不展示）

**问题**：v1.3 归档后 agent 不知 archive 有 N 条历史可接续——follow-up 链断了人都不知觉。

**选项**：
- A. 加 `archived_count: <N>` 数字字段
- B. 加 `archived: [...]` 数组（name/stage/parent 缩略）
- C. 加 `--include-archive` flag

**决定**：**A**

**理由**：
- A 解决症状，最小改动（8 行）
- B 破坏 v1.2 D5 "skip archive 避免喧宾夺主"
- C 默认行为仍看不到；agent 不会主动加 flag

**详情仍走** `bridge pattern --tag <t>` / `bridge mention <dir> --tag <t>` / `bridge next changes/archive/<id>`——v1.2 设计。

**测试**：R6 验证 `bridge list .` 输出 JSON 含数字字段 `archived_count` 且 spec-bridge 仓库正确报 5。

## D3 — 不动 v1.3 parent 字段 + archive 物理结构

**问题**：用户曾问"清掉 parent 字段，归档的 [parent] 到哪里去了？"——担心清掉字段会让 archive 子目录消失。

**选项**：
- A. 清掉 v1.3 .bridge.yaml `parent` 字段
- B. 重写 archive 物理结构（按栈分层）
- **C. 维持现状**

**决定**：**C**

**理由**：
- A 清掉 = v1.4 不知 v1.3 有父可接（ADR-0005 跟 parent 字段强耦合）——失忆。archive 子目录仍在（git mv 不会反向动 archive，bridge 任何命令都不删 archive 内容），但 follow-up 链断了
- B 重写 archive 物理结构破坏 §6.3 sync 兼容规则第三条"归档目录共享"——三栈共享 archive 才让跨栈续作可行
- C parent 字段是逻辑引用，archive 子目录是物理位置，两者正交

**清晰区分**：

| 维度 | 谁管 | 在哪里 | 作用 |
|---|---|---|---|
| 物理位置 | git mv + 文件系统 | `changes/archive/<YYYY-MM-DD>-<id>/` | 归档实体存放 |
| 逻辑引用 | v1.3 .bridge.yaml | `parent: <id>` 字段 | v1.4 接续校验 |

清掉 parent 字段失忆（失语义），但 archive 物理目录永远在。

## Out-of-scope decisions（明确不做的）

- **D-A**: 不加 `--include-archive` flag——理由见 D2
- **D-B**: 不重写 archive 物理结构——理由见 D3
- **D-C**: 不修 v1.3 parent 字段——理由见 D3
- **D-D**: `.gitignore` 改 openspec/ + .codebuddy/ 已在 v1.4 之前 commit `fed763a` 落地，v1.4 不再动

## Risks & Mitigations

| 风险 | 缓解 |
|---|---|
| archive 真在 openspec/ 下（OpenSpec 栈仓库用 bridge） | detectLayout 第二档优先看 openspec/changes/archive 化石；测试覆盖 |
| 仓库首次使用没 archive 历史 | detectLayout 退到 openspec/config.yaml 第三档 / 缺省 standalone |
| archived_count 数字误导（agent 不知接哪条） | 文档 + R6 测试显式 assert 数字而非数组 |
| bridge.mjs 与 cmd-init.mjs mirror 不一致 | 抽公共辅助函数强制同步 + R7 加锁 |
| 4 case 探测顺序改动 | R7 测试 + docs-sync-test 自证 |