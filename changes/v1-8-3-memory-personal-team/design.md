# Design: v1-8-3-memory-personal-team

## Purpose

把 bridge 从"无记忆"扩成"两层记忆"——个人层（探测 IDE 自带优先 + fallback 在 change 下建空骨架）+ 团队层（CLI 同步 + hash 校验 + cap 边界 + orphaned 沉淀）。bridge 只填结构和元信息，不替 AI 写 memory 内容；硬约束（不替 AI 总结 / 不写过程日志 / 每行必带 why）写进 SKILL.md + AGENTS.md。

## Architecture

新增 1 个文件 + 改 6 个文件：

```
skills/spec-bridge/scripts/
├── cmd-memory.mjs              # 新：4 命令 + reconcile + show + 校验 hash
├── cmd-init.mjs                # 改：探测 IDE memory + 按需调 memory init
├── cmd-adopt.mjs               # 改：同 init 探测逻辑
├── cmd-probe.mjs               # 改：加 memory_hint 字段
├── cmd-archive-ready.mjs       # 改：加"个人 memory 有内容或 IDE memory 在场"守门
└── cmd-archive.mjs（或 archive flow）
                                 # 改：archive 通过后自动调 memory sync
```

```
skills/spec-bridge/
├── SKILL.md                    # 改 §7 加 v1.8-3 CHANGELOG + §x 写规则硬约束示例
├── docs/adr/
│   └── 0013-memory-personal-team-rules.md   # 新 ADR
└── tests/                      # 新加 31 测试（9 文件）
```

运行时生成目录结构：

```
<project-root>/
├── .codebuddy/memory/          # IDE 自带（bridge 不写，只探测）
└── .bridge/
    └── team/
        ├── <cap>/memory.md     # 团队层 cap 级 memory
        ├── default/memory.md   # 未声明 cap 时落 default
        └── orphaned/memory.md  # cap 归属不明的决策沉淀
```

```
changes/<name>/
├── .bridge.yaml
├── .bridge.log
├── memory.md                   # 个人层 memory（IDE 不在场时生成）
└── specs/<cap>/
```

## Decisions

### D1 — 个人层优先用 IDE 自带 memory

**决定**：探测 `.codebuddy/memory/` 存在则不生成个人 memory.md，只在 probe 输出报告 IDE memory 路径 + 行数。

**理由**：
- README 调研报告 §2.1 明文"桥不重复造轮子，以 codebuddy memory 为准"
- 桥只"声明" IDE memory 存在 + 路径 + 行数，**不读内容**——避免 bridge 替 AI 做总结（违反 D9）

**实现细节**：
- `detectIdeMemory(projectRoot)`：检查 `.codebuddy/memory/` 目录 + 至少一个 `.md` 文件 + 统计 MEMORY.md 行数 + daily 文件数
- `cmd-init.mjs` / `cmd-adopt.mjs` 写 `.bridge.yaml` 前调 `detectIdeMemory`：在场跳过 init；不在场调 `bridge memory init`

### D2 — 个人层 fallback：IDE 不在 → changes/<name>/memory.md 空骨架

**决定**：bridge 自动生成空骨架（§0 元信息 + §1-N 占位），由 AI 按规则填。

**理由**：
- "按需补"语义的最小实现——探测到不在就补一份空模板
- 幂等：已存在 no-op + `[hint]`

**空骨架模板**：
```
# Personal Memory: <name>
> 写者：AI / 人 | 写时：YYYY-MM-DD
> 规则：bridge 不替 AI 总结，只填结构 + 元信息；每行必带 why

## §0 元信息
- change: <name>
- capabilities: <cap>
- parent: <parent-id>（如果有）
- generated_by: bridge v1.8.3

## §1 决策段（vX.Y.Z: 砍 X 因为 Y）

## §2 卡住 / 走偏

## §3 父 archive 继承（如有）
```

### D4 — probe 输出加 `memory_hint` 字段

**三态**：
- `personal=ide(.codebuddy/memory/, daily=12, curated=4 memory.md)`
- `personal=bridge(changes/<name>/memory.md, empty)`
- `personal=none`（两者都不在，引导建目录）

**输出 JSON 字段**：
```
memory_hint: {
  personal: "ide" | "bridge" | "none",
  ide_path?: "/abs/.codebuddy/memory/",
  ide_daily_count?: 12,
  ide_curated_lines?: 4,
  bridge_path?: "/abs/changes/<name>/memory.md",
  bridge_lines?: 0,
  team_caps: ["default"],
  team_total_lines: 0
}
```

### D5 — archive-ready 守门

**决定**：任一条件满足即可；都不满足则 FAIL + 可读提示。

**逻辑**：
```
const ideMemoryOk = fs.existsSync('.codebuddy/memory/');
const personalMemoryOk = memory.md exists + 决策段行 > 0;
if (!ideMemoryOk && !personalMemoryOk) {
  fail("personal memory required (either IDE .codebuddy/memory/ exists or changes/<name>/memory.md has content)");
}
```

**失败 stderr**：
```
[error] archive-ready: personal memory is empty or missing
[hint]  either:
       1) 项目根有 .codebuddy/memory/（IDE 自带，bridge 不重复）
       2) changes/<name>/memory.md 有内容（用 `bridge memory append` 追加）
```

### D6 — archive 触发团队层同步（CLI 算 hash 校验）

**决定**：archive flow 自动调 `bridge memory sync <dir>`，sync CLI 算 hash 校验。

**sync CLI 行为**：
1. 读 `<dir>/memory.md`，抽"§1 决策段"（parse `vX.Y.Z:` 行）
2. 算 source hash（决策段拼接 sha256）
3. 对应 cap（按 `--capabilities` 或 default）：
   - 已存在 `.bridge/team/<cap>/memory.md` → 检查 last_synced_hash
   - hash 一致 → no-op
   - hash 不一致 → 追加决策段（带 source change 名 + 日期）
4. 写回 `.bridge/team/<cap>/memory.md` + 更新 last_synced_hash

**失败处理**：sync 失败 → stderr `[warn] memory sync failed; team cap <cap> not updated`；archive 不回滚

### D7 — cap 边界声明

**决定**：复用 `--capabilities` flag；未声明时按 `defaultCapability(name)` 落 `default/`。

**默认规则**：`v1-8-3-memory-personal-team` → `v1-8-3-memory`

### D8 — orphaned 沉淀

**决定**：cap 归属不明时落 `orphaned/`，不强制归并。

**orphaned/memory.md 格式**：
```
# Orphaned Decisions
> cap 归属不明，待 reconcile

## YYYY-MM-DD — <source-change>
- vX.Y.Z <decision>
```

### D9 — 写规则硬约束

**SKILL.md §x**：
```
## 写 memory 的硬约束
- bridge 不替 AI 总结——memory 内容由 AI / 人按规则填
- 不写过程日志——chat 风格的过程记录属于对话层
- 每行必带 why——推荐格式 vX.Y.Z: 砍 X 因为 Y

### 示例
好：v1.8.3: 砍 --builtin flag 因为纯桥叙事硬约束
坏：我把 builtin flag 砍了
坏：先试了 A，B 不行，最后用 D 解决了（这是对话层）
```

**AGENTS.md 禁事加**：不要直接 tell 助手写 memory 内容——bridge 只填结构

### D10 — 测试 31 cases（9 文件）

| 文件 | 测试数 | 覆盖 |
|---|---|---|
| `memory-detect-ide.test.mjs` | 3 | IDE 在 / 不在 / 损坏 |
| `memory-init-empty.test.mjs` | 3 | 首次 init / 幂等 / 父继承 |
| `memory-append.test.mjs` | 4 | 空骨架 / 已内容 / format / 多行 |
| `memory-sync-hash.test.mjs` | 5 | 首次 / 一致 no-op / 不一致追加 / 累计 / 失败不 archive |
| `memory-orphaned.test.mjs` | 3 | 空 cap / 多 cap 不一致 / 人审 |
| `memory-reconcile.test.mjs` | 3 | `--team` / `--include-orphaned` / 不删原 cap |
| `probe-memory-hint.test.mjs` | 4 | 三态 / IDE 路径 / bridge 行数 / team caps |
| `archive-ready-memory-gate.test.mjs` | 3 | IDE 通过 / 个人通过 / 都缺失败 |
| `memory-show-readonly.test.mjs` | 3 | 个人 show / 团队 show / 纯读 |

合计 31 测试（v1.8-2 是 9 测试）。`npm test` 143 → 174+ 全绿。

### D11 — 文档同步

- 新加 ADR-0013（`docs/adr/0013-memory-personal-team-rules.md`）：D1-D10 决策入 ADR
- 改 `SKILL.md §7`：v1.8-3 CHANGELOG 段 + §x 写规则硬约束示例
- 改 `AGENTS.md`：业务目的 a' 改写为"两层规则完整版" + 禁事加"不替 AI 写 memory 内容"
- 改 `README.md §1.1 a'`：补两层规则段落

## Out-of-scope decisions

- **不**改 `.codebuddy/memory/` 任何行为（IDE 自管域）
- **不**改 distill / why.md 输出位置（memory 在 changes/<name>/memory.md，why.md 在 specs/<cap>/why.md）
- **不**加 `--memory / --no-memory` flag
- **不**做 memory 自动总结（违反 D9 硬约束）
- **不**做跨项目 memory 合并
- **不**做 memory 加密 / 权限控制
- **不**改 SKILL.md §6 多栈并存守卫
- **不**改 probe 路由优先级
- **不**加 `bridge memory show --format json`
- **不**改 archive flow 的 sync / verify / distill（除 D5/D6 加的守门和触发外）

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| IDE memory 探测误判（目录存在但内容损坏） | 跳过生成但用户期待内容 | `detectIdeMemory` 检查目录 + 至少一个 .md；空目录 stderr 提示 |
| 个人 memory.md 写"过程日志" | 团队层同步污染 | SKILL.md §x 给"好/坏"示例；archive-ready 弱校验格式 |
| 团队层 cap 边界变更时数据丢失 | 决策段归并错位 | reconcile 时不删任何决策段，只标 reconcile 元信息；原 cap 保留为 archive |
| archive 触发 sync 但 sync 失败 | 团队层没同步但 archive 完成 | sync 失败 stderr 报；archive 不回滚；用户手动重试 |
| `--parent` 续作时父 archive memory.md 无决策段 | 子 change 记忆断层 | stderr 提示；AI 决定 fallback 手动补 |
| orphaned 累积过多 | 文件越来越大 | `--include-orphaned` 给人审归并 |
| 探测 IDE memory 路径写死 | 其他 IDE（如 Cursor）找不到 | v1.8-3 保持写死；调研报告留作未来扩展点 |
| 测试污染真实 `.codebuddy/memory/` | 误改 IDE 数据 | 测试在 tmpdir 跑，不读 IDE memory 内容 |
| 4 个 memory.md 命令与 event 系统重复 | 双账本 | memory 命令族复用 `cmd-event.mjs` 的 `appendEvent` |

---

## 知识循环 3 流转（调研报告 §四核心）

```
个人层 ─→ 个人 memory.md（AI / 人 append 决策段）
   ↓ archive 触发 sync（CLI 算 hash 校验）
团队层 ─→ .bridge/team/<cap>/memory.md（自动汇总，hash 一致不重写）
   ↓ cap 边界变更触发 reconcile（人审，归并不删原 cap）
团队总纲 ─→ 全组看到"过去的事"
```

**关键守门**：
- 个人 → 团队：archive-ready 守门 → archive 触发 sync（CLI 算 hash）
- 团队内：reconcile 时不删任何决策段
- LLM 不在场时：memory.md / team/memory.md **只读不写**（避免现场合并污染）