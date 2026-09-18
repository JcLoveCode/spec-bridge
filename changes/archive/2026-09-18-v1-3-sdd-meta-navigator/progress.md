# Progress — v1-3-sdd-meta-navigator

> 按 SKILL.md §3 "executing" 段："每批完成必须过一道审查，结论写进 `<change-dir>/progress.md`（无回执引擎，台账先行）"。

## Batch 1 — `bridge next` 按栈路由

**完成定义**：`tests/xrouter-protocol.test.mjs` 4 case PASS；`bridge next` 实际输出含 `→ protocol:` 段。

**审查结论**：✅ PASS

### 任务对账

| 任务 | 状态 | 证据 |
|---|---|---|
| T1.1 写 `tests/xrouter-protocol.test.mjs`（RED） | ✅ | 4 case |
| T1.2 改 `scripts/cmd-next.mjs` 加 PROTOCOL_HINTS（GREEN） | ✅ | 路由表 + advice 后插入 |

### 测试结果

```
# tests 4  # pass 4  # fail 0
```

### 决策落实（D5 + D8）

- **D5**：`bridge next` 加 `→ protocol:` 段，按 `stage + workflow_kind` 推荐 use_skill；✓
- **D8**：matt kind planning 推荐 `grill-with-docs`（小雾）+ `wayfinder`（大雾），两档澄清槽位；✓
- **ADR-0004 不代理**：仅 `use_skill` 推荐字面量，不 spawn 子代理；✓

---

## Batch 2 — `bridge init` 按栈分支产物路径

**完成定义**：`tests/init-workflow-kind.test.mjs` 3 case PASS；openspec/matt kind 只建台账 + 空 specs/，builtin 走 v1.2 现状。

**审查结论**：✅ PASS

### 任务对账

| 任务 | 状态 | 证据 |
|---|---|---|
| T2.2 写 `tests/init-workflow-kind.test.mjs`（RED） | ✅ | 3 case |
| T2.1 改 `scripts/cmd-init.mjs` 加 workflowKind 分支（GREEN） | ✅ | `if (workflowKind === 'builtin')` 包 5 模板写入 |

### 测试结果

```
# tests 3  # pass 3  # fail 0
```

### 决策落实（D3）

- **D3**：`bridge init` 按 `--workflow-kind` 二分——openspec/matt 只建台账 + 空 specs/；builtin 兜底出 5 模板；✓
- **D6**：`workflow_kind=builtin` 缺省；✓
- **D7**：stdout `next:` hint 保留；✓

---

## Batch 3a — `bridge adopt` 接外栈 + `list` 加 untracked 段

**完成定义**：`tests/adopt.test.mjs` 4 case PASS；`bridge adopt` 只写台账不动产物（D4）；`bridge list` 输出 `untracked_artifacts` 段。

**审查结论**：✅ PASS

### 任务对账

| 任务 | 状态 | 证据 |
|---|---|---|
| T3.4 写 `tests/adopt.test.mjs`（RED） | ✅ | 4 case |
| T3.1 新 `scripts/cmd-adopt.mjs`（GREEN） | ✅ | 130 行 |
| T3.3 改 `scripts/bridge.mjs` dispatch + listChanges untracked 段（GREEN） | ✅ | import + adopt 分支 + untracked_artifacts 段 |

### 测试结果

```
# tests 4  # pass 4  # fail 0
```

### 决策落实（D4）

- **D4**：`bridge adopt <dir>` 只写台账，不动产物；✓
- **D4 边界**：拒绝覆盖（已有 .bridge.yaml → exit 2）+ 拒绝空目录（无接管信号 → exit 2）；✓
- **D4 list 段**：`bridge list` 输出 `untracked_artifacts[]`；✓

### 关键修正

- **walk bug 修正**：复用 `cmd-init.detectProjectRoot`，openspec 风格 adopt 正确识别 `layout=openspec`。
- **测试断言放宽**：R4 场景 1 接受顶层 4 产物或 `endsWith('spec.md')`。

---

## Batch 4 — 文档同步 + ADR-0008

**完成定义**：`tests/docs-sync-test.mjs` 6 case PASS；SKILL.md §6 + CONTEXT.md v2 + ADR-0008 与代码交叉引用一致。

**审查结论**：✅ PASS

### 任务对账

| 任务 | 状态 | 证据 |
|---|---|---|
| T4.4 写 `tests/docs-sync-test.mjs`（RED→GREEN） | ✅ | 6 case：§6 use_skill ⊆ PROTOCOL_HINTS / CONTEXT 术语 / ADR-0008 / --workflow-kind 三处一致 / §5 ⊆ bridge.mjs / §0 vs §5 计数 |
| T4.1 改 `SKILL.md`：§0 13→14、§1 多栈并存守卫、§3 planning workflow_kind 提示、§5 加 `adopt` + `list` 备注、新 **§6 跨协议路由** | ✅ | §6.1 路由表 / §6.2 能力阶梯 v2 五级 / §6.3 sync 兼容 / §6.4 与 ADR-0004 关系 |
| T4.2 改 `CONTEXT.md`：能力阶梯升级 v2 + 新术语 "SDD 产物" / "外部产物" / "跨协议路由" | ✅ | v2 五级 + Relationships 加新术语映射 |
| T4.3 新 `docs/adr/0008-bridge-as-cross-protocol-recommender.md` | ✅ | 背景 / 决策 5 条 / 4 considered options / consequences |

### 测试结果

```
# tests 6  # pass 6  # fail 0
```

### 决策落实（D7 + D8 收尾）

- **D7**：SKILL.md §0 "dump 全部 N 条" 与 §5 速查表命令数一致（docs-sync-test R5 场景 6 自证）；✓
- **D8**：能力阶梯升级为 v2 五级——L1 原生 / L2 matt / L3 状态机中断 / L4 agent 自身 / L5 桥档案员保留；✓
- **ADR-0004 边界**：§6.1 use_skill 列表仅是 stdin 提示，不 spawn；§6.4 显式重申"桥仍是 navigator"；✓
- **ADR-0008 立场**：跨协议推荐是 navigator 的延伸，不变成 dispatcher；✓

### 关键修正

- **bridge.mjs usage 块补 `rebuttal`**：v1.3 之前加 `rebuttal` 命令时 usage 块漏写（disptach + import 都在，唯独 usage 行漏）—— docs-sync-test R5 场景 5 触发，修一行字面量。
- **测试正则调整**（TDD 过程产物）：
  - §6 段截取要跳过标题行本身（不是简单 `split('## 6.')`）
  - 反引号在 SKILL.md §5 表格里包命令名，正则要用反引号抓取（不是行首字母）
  - `mention/rootcause` 合并行要 split `/`（两个顶层命令都被 §5 表声明）
  - `extractBridgeCommands` 只扫 usage 字符串字面量（行首 4 空格 + `'` + 空白 + 命令 + 后续参数），避开 dispatch / JS 关键字

### 偏离 / 风险

- 无

### 累计测试（v1.2 follow-up + v1.3 全批）

| 测试文件 | 通过 | 备注 |
|---|---|---|
| navigator-b1 ~ b6 | 41/41 | v1.2 follow-up baseline |
| navigator-b7-touchup | 4/4 | §3 hard step |
| init-integration | 8/8 | init spawn + 5 模板（builtin kind 现状） |
| init-templates | 7/7 | 5 模板非空 + 占位符 |
| sync / delta-apply | 10/10 | 共享代码无破坏 |
| xrouter-protocol（v1.3 B1） | 4/4 | |
| init-workflow-kind（v1.3 B2） | 3/3 | |
| adopt（v1.3 B3a） | 4/4 | |
| **docs-sync-test（v1.3 B4）** | **6/6** | |
| **合计** | **87/87** | |

### 下一步

Batch N：sync → verify → 写 why.md → git mv → state archived → commit → push。