# ADR-0013: memory 个人层 + 团队层规则（v1.8-3）

- 状态：Accepted（2026-09-21）
- 决策人：JcLoveCode（与 AI grill 锐化）
- 关联 change：changes/v1-8-3-memory-personal-team/

## 背景

v1.7-v1.8-2 把 bridge 升级为"纯桥 + 导航员"（ADR-0011/0012），但仍缺一个关键能力：**记忆规则层**——在哪记决策 why？个人层和团队层边界在哪？什么时候同步？

实战发现三个问题：

1. **个人 memory 碎片化**——有的用 `.codebuddy/memory/`（IDE 层），有的用 `changes/<name>/memory.md`（change 层），有的不写 memory；归档后团队看不到"为什么这样设计"。
2. **团队 memory 空白**——归档后的 `specs/<cap>/why.md` 只记当前 change 的决策，跨 change 的演进脉络丢失（例：v1.2 砍 X，v1.5 恢复 X，v1.8 再砍 X——团队层不知道"砍 3 次"的 why）。
3. **写规则没硬约束**——AI 把 memory 当日志（写"改了 cmd-init.mjs 加 detectIdeMemory"）或流水账（"2026-09-21 13:00 修复 bug"）；没遵循"每行必带 why"原则。

v1.8-3 把这三件事落到"两层记忆规则"——个人层（IDE 优先 + fallback）+ 团队层（archive 触发 sync + hash 校验）+ 写规则硬约束（SKILL.md + AGENTS.md）。

## 决策

### D1. 个人层 IDE 优先（零配置探测）

- **探测信号**：`.codebuddy/memory/` 目录存在 **且** 至少一个 `.md` 文件
- **IDE 在场**：`bridge init` / `bridge adopt` 跳过生成 `changes/<name>/memory.md`；probe 输出 `memory_hint.personal = "ide"` + 路径 + 行数
- **IDE 不在场**：`bridge init` / `bridge adopt` 生成空骨架 `changes/<name>/memory.md`（§0 元信息 + §1 决策段占位 + §2 卡住占位 + §3 父继承占位）
- **边界**：bridge 只填骨架结构和元信息（`generated_by: bridge v1.8.3`），**不写** memory 内容（违反"bridge 不替 AI 写"硬约束）

**拒绝的方案**：始终生成 `changes/<name>/memory.md` + 用户手动迁移到 IDE。问题：双写混乱；零配置原则要求"IDE 在场就自动跳过"。

### D2. 个人层 fallback 骨架格式

生成的 `changes/<name>/memory.md` 含 3 段：

```markdown
## §0 元信息
- generated_by: bridge v1.8.3
- generated_at: 2026-09-21T13:00:00Z
- parent_change: <id>

## §1 决策段（供团队层 sync）
<!-- AI 在此写关键决策，格式：vX.Y.Z: 砍 X 因为 Y -->

## §2 卡住与走偏
<!-- AI 在此写遇到的陷阱、误判、边界发现 -->

## §3 父 change 继承
<!-- 若 --parent 指定，AI 可在此写继承的设计决策 -->
```

**拒绝的方案**：只生成空文件 / 生成 5 段（加"实现细节""测试场景"）。问题：空文件无引导；5 段过细引导 AI 写流水账。

### D3. probe 输出 memory_hint 字段（三态）

`bridge probe` JSON 输出加 `memory_hint` 字段：

```json
{
  "memory_hint": {
    "personal": "ide" | "bridge" | "none",
    "ide_path": ".codebuddy/memory/",
    "ide_daily_count": 3,
    "ide_curated_lines": 42,
    "bridge_path": "changes/x/memory.md",
    "bridge_lines": 0,
    "team_caps": ["bridge", "cli", "nuxi"],
    "team_total_lines": 128
  }
}
```

**边界**：
- `personal = "ide"` 时不填 `bridge_path` / `bridge_lines`
- `personal = "none"` 时 stderr 输出 `[hint] no memory detected, recommend: mkdir .codebuddy/memory/ or bridge memory init <dir>`
- `team_caps` 遍历 `.bridge/team/*/memory.md`，只列存在的 cap

### D4. archive-ready 守门（个人 memory 有内容或 IDE 在场）

`bridge archive-ready` 加守门：

- **通过条件**：`.codebuddy/memory/` 存在 **或** `<change>/memory.md` 存在且 §1 决策段至少 1 行非空内容
- **拒绝条件**：两者都不满足 → exit 1 + stderr `[FAIL] personal memory missing or empty. Either: (1) use IDE memory (.codebuddy/memory/), or (2) write decisions to changes/<name>/memory.md §1`

**拒绝的方案**：允许无 memory 归档。问题：归档后团队层空白，违反"每个 change 必须有 why"原则（来自调研报告 §3.1 设计原则）。

### D5. 团队层 sync（archive 触发 + hash 校验）

- **触发时机**：`bridge state set stage archived` 时自动调 `bridge memory sync <changeDir>`
- **算法**：
  1. 读 `<changeDir>/memory.md` §1 决策段（parse `vX.Y.Z:` 行）
  2. 拼接决策段计算 sha256 → `source_hash`
  3. 按 `.bridge.yaml.capabilities` 决定目标 cap（多 cap 写多份；空 cap 落 `orphaned/`）
  4. 对每个 cap：
     - 读 `.bridge/team/<cap>/memory.md` frontmatter `last_synced_hash`
     - hash 一致 → no-op + stderr `[info] <cap> already synced`
     - hash 不一致 → 追加决策段 + 更新 `last_synced_hash` + `synced_at` + `synced_from`
- **失败不回滚**：sync 失败 → stderr `[warn] memory sync failed: <reason>` + appendEvent + **不回滚** stage=archived
- **frontmatter 格式**：

```yaml
---
last_synced_hash: abc123...
synced_at: 2026-09-21T13:00:00Z
synced_from: changes/v1-8-3-memory-personal-team
---
```

**拒绝的方案**：手动调 `bridge memory sync`。问题：人会忘；archive flow 是唯一"个人→团队"同步点（来自调研报告 §十一知识循环 A 流转）。

### D6. orphaned 沉淀（capabilities 空或多 cap 不一致）

- **触发条件**：`.bridge.yaml.capabilities` 为空 **或** 多 cap（如 `cli,nuxi`）但决策段有"只适用某 cap"的分歧
- **落点**：`.bridge/team/orphaned/<change-id>.md`
- **格式**：

```markdown
---
orphaned_at: 2026-09-21T13:00:00Z
orphaned_from: changes/v1-8-3-memory-personal-team
orphaned_reason: "capabilities empty"
---

## §1 决策段
v1.8.3: 砍 X 因为 Y
```

- **reconcile 用途**：人审 orphaned 后调 `bridge memory reconcile --cap <cap> --include-orphaned` 归并到正式 cap

**拒绝的方案**：拒绝 sync（exit 1）。问题：阻止 archive 不合理；orphaned 是合法中间态。

### D7. reconcile 不删原 cap（追加元信息 + 人审）

- **命令**：`bridge memory reconcile [--team] [--cap <cap>] [--include-orphaned]`
- **行为**：
  - `--team` 模式：遍历所有 cap，重新读 source memory + 对比 hash + 追加"reconcile YYYY-MM-DD by <actor>"元信息
  - 单 cap 模式：只处理指定 cap
  - `--include-orphaned`：把 `.bridge/team/orphaned/` 的决策段合并到 cap（人审后标记"reviewed by <name>"）
- **不删原则**：reconcile **不删除**任何决策段（即使 hash 不一致），只追加元信息 + 标记冲突（"conflicted with <other-change>"）

**拒绝的方案**：reconcile 自动删重复 / 自动解冲突。问题：违反"人审"原则；memory 是团队共识，机器不该删人写的决策。

### D8. 写规则硬约束（SKILL.md + AGENTS.md）

**SKILL.md §4.5** 加"写 memory 的硬约束"：

- ✅ 好示例：`v1.8.3: 砍 --builtin flag 因为纯桥模式不需要逃生口`
- ✅ 好示例：`v1.6: init 加 detectLayout 因为项目根有 openspec/ 时不该默认 builtin`
- ❌ 坏示例：`改了 cmd-init.mjs 加 detectIdeMemory`（没 why）
- ❌ 坏示例：`2026-09-21 13:00 修复 bug`（流水账）
- ❌ 坏示例：`新增 memory-detect-ide.test.mjs 3 个测试`（操作日志）

**AGENTS.md 禁止事项 §3** 加：

> **不替 AI 写 memory 内容**：bridge 只填骨架结构和元信息（`generated_by`），不替 AI 总结决策 / 写 why。AI 是决策者，bridge 是档案员。

**拒绝的方案**：只写文档，不加测试验证。问题：AI 仍会写流水账；需要集成测试验证"append 后 event 日志可查"（来自 T2.1 测试义务）。

### D9. 团队层目录结构

```
.bridge/
  team/
    <cap>/
      memory.md        # 该 cap 的决策段累积（frontmatter + 按 change 追加）
    orphaned/
      <change-id>.md   # capabilities 空或多 cap 不一致时的沉淀
```

- **不放在 specs/ 下**：`specs/<cap>/why.md` 是单 change 蒸馏输出；`team/<cap>/memory.md` 是跨 change 演进脉络
- **不放在 changes/archive/ 下**：归档后不可改（ADR-0005），但 team memory 是累积型（每次 archive 追加）

**拒绝的方案**：放在 `specs/<cap>/team-memory.md`。问题：specs/ 是 spec 域，team memory 是 meta 域（记录"为什么这样 spec"，不是 spec 本身）。

### D10. bridge memory 命令族（5 子命令）

- **init**：`bridge memory init <dir> [--parent <id>]` — 生成空骨架（已存在 no-op）
- **append**：`bridge memory append <dir> --text "<text>" [--section §1|§2|§3]` — 追加一行 + appendEvent
- **sync**：`bridge memory sync <dir>` — 个人层→团队层同步（hash 校验）
- **show**：`bridge memory show [<change>|<cap>]` — 纯读（cat），不改文件
- **reconcile**：`bridge memory reconcile [--team] [--cap <cap>] [--include-orphaned]` — 人审合并

**边界**：命令族**不**包含 `edit` / `delete` / `merge`（这些都是人的决策行为，不该 CLI 化）。

## 影响面

### 触及文件（10 files）

- A `skills/spec-bridge/scripts/cmd-memory.mjs`（新）
- M `skills/spec-bridge/scripts/cmd-init.mjs`（探测 IDE memory）
- M `skills/spec-bridge/scripts/cmd-adopt.mjs`（同 init）
- M `skills/spec-bridge/scripts/cmd-probe.mjs`（memory_hint 字段）
- M `skills/spec-bridge/scripts/cmd-archive-ready.mjs`（守门）
- M `skills/spec-bridge/scripts/bridge.mjs`（state set hook + memory 命令注册）
- M `skills/spec-bridge/SKILL.md`（§4.5 + §7 CHANGELOG）
- M `skills/spec-bridge/AGENTS.md`（禁止事项 §3）
- M `skills/spec-bridge/README.md`（§1.1 a' 补两层规则段落）
- A `skills/spec-bridge/docs/adr/0013-memory-personal-team-rules.md`（本 ADR）

### 测试覆盖（+31 tests）

- A `tests/memory-detect-ide.test.mjs`（3）
- A `tests/memory-init-empty.test.mjs`（3）
- A `tests/memory-append.test.mjs`（4）
- A `tests/memory-sync-hash.test.mjs`（5）
- A `tests/memory-orphaned.test.mjs`（3）
- A `tests/memory-reconcile.test.mjs`（3）
- A `tests/probe-memory-hint.test.mjs`（4）
- A `tests/archive-ready-memory-gate.test.mjs`（3）
- A `tests/memory-show-readonly.test.mjs`（3）

测试数：143 → 174

### 兼容性

- **v1.7-v1.8-2 归档件兼容**：旧 change 无 memory.md，archive-ready 守门"IDE 在场通过"（假设 IDE memory 在 1/28）
- **外栈兼容**：matt / openspec / superpowers 栈产物走 D1 同探测逻辑（IDE 优先）
- **builtin 逃生口保留**：v1.8-2 已砍 `--builtin` flag（ADR-0012），v1.8-3 不加逃生口（memory 命令族本身是逃生口）

## 与其他 ADR 的关系

- **ADR-0001**（prompt 管判断）：团队层 sync 算 hash 必须 CLI 做，不让 LLM 现场合并 ✓
- **ADR-0004**（导航员不调度）：probe 输出 memory_hint 是给 AI 看的提示，不调 skill ✓
- **ADR-0005**（归档不可改）：归档后 `changes/archive/` 不动，团队层写 `.bridge/team/` ✓
- **ADR-0007**（无会话状态）：memory_hint 每轮重算，不依赖对话记忆 ✓
- **ADR-0010**（probe 导航员）：memory_hint 是 probe 输出的一部分 ✓
- **ADR-0011**（导航员默认外栈）：D1 探测 IDE memory 是"外栈探测"的延伸（IDE = 最外层栈）✓
- **ADR-0012**（纯桥模式）：bridge 不替 AI 写 memory，只填骨架 ✓

## 风险与限制

1. **IDE memory 探测误判**：`.codebuddy/memory/` 存在但用户期待有 bridge memory → 加 stderr `[hint]` + 文档说明"显式调 bridge memory init --force"（未实装，留后续）
2. **团队层 cap 累积过快**：同一 cap 被多 change 反复 sync → 评估"按月份汇总"或"决策段去重"（未做，留 v1.9）
3. **orphaned 膨胀**：capabilities 始终空的项目 → 所有决策落 orphaned/ → 评估"自动归并到 default cap"（未做，留 reconcile 人审）
4. **memory 格式校验松**：append 不强制 `vX.Y.Z:` 格式 → 可能出现非标格式 → 评估"sync 时正则校验"（未做，宽容优先）

## 遗留问题

- **UPDATE 关键字**（调研报告 §3.5）：个人层 append 时标 `UPDATE` 前缀 → sync 时触发"更新已有决策段"而非追加。**未实装**（留 v1.9-memory-update）。
- **rebuttals/ 复验异议**（调研报告 §4.5）：归档后发现决策错误 → 写 `.bridge/team/<cap>/rebuttals/<hash>.md` 标记"superseded"。**未实装**（留 v1.9-memory-audit）。
- **知识循环 B 流转**（调研报告 §十一）：团队→个人（probe 读 top 3 cap 摘要给 AI 看）。**未实装**（probe 当前只统计行数，不读内容）。
