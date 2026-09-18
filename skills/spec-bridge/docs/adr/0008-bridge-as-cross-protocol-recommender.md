# ADR-0008: 桥作 cross-protocol recommender（按栈路由 use_skill）

- 状态：Accepted（2026-09-18）
- 决策人：JcLoveCode（与 AI 结对设计）

## 背景

v1.2 桥只感知一种"内置协议"，`bridge next` 输出 stage + next + 按 stage 查表的 advice——这一 advice 暗含"agent 知道下一步该调哪个 skill"。但当项目层是 openspec / matt（v1.2 §2 栈 A / 栈 B）时，agent 应该调的是 openspec 的 `openspec-propose`、matt 的 `spec-executor` 等外栈 skill，不是桥内置的执行纪律。这导致：

1. **advice 与实际工作流脱节**：一个 Stack A 项目跑 `bridge next`，advice 仍按内置协议的"填 proposal/design/tasks"指引——但产物其实是 openspec 自出的，agent 看 advice 调内置 skill 重复劳动。
2. **wayfinder / grill-with-docs 二档语义无落点**：matt 整栈的规划期 skill（v1.3 设计 D8）按变更规模分两档——小变更（一个 session 装得下）用 `grill-with-docs`、大变更（绿地 / 季度级）用 `wayfinder`（出意图地图后 handoff `to-spec`）。v1.2 桥对此无知。
3. **三栈并存无守卫**：一个仓库可能既有用 openspec 跑的旧 change，又有 matt 跑的旧 change，又有 builtin 跑的新 change。v1.2 桥只识别 builtin 形态，其他两栈的历史产物会被新 builtin 静默吃成"垃圾目录"或被覆盖。

## 决策

1. **`bridge next` 加 `→ protocol:` 段**（v1.3 B1）：
   按 `stage + workflow_kind` 二维查 `PROTOCOL_HINTS` 表，给出 use_skill 推荐列表。
   - planning × openspec → `use_skill openspec-propose`
   - planning × matt → `use_skill grill-with-docs`（小雾）+ `use_skill wayfinder`（大雾）
   - executing × builtin → `use_skill test-driven-development` + `use_skill requesting-code-review`
   - executing × openspec → `use_skill openspec-apply-change` + `use_skill test-driven-development`
   - executing × matt → `use_skill spec-executor` + `use_skill tdd`
   - 终态（contracted_approved / patching / archived / abandoned）→ 不路由
   - 前置阶段 planning@builtin → 不路由（内置协议自带产物生成）

2. **桥仍是 navigator，不是 dispatcher**（承接 ADR-0004）：
   use_skill 字面量是 **stdin 提示**，给 agent 看——不是 spawn，不代理，不阻塞。桥**不拥有调用栈**，agent 看着 use_skill 决定执行哪个 skill。多协议 ≠ 多调度。

3. **能力阶梯升级为 v2 五级**（v1.3 B4）：
   L1 原生 / L2 matt / **L3 状态机中断**（桥接管拍点与外栈接管）/ **L4 agent 自身**（LLM 即技能，CLI 不替代）/ **L5 桥档案员保留**（台账 + 归档 + 回执）。
   L3 和 L4 是新增——明确"CLI 该接管的能力空白"和"LLM 本职不该 CLI 化"两类边界，避免边界模糊导致复杂度回归。

4. **三栈并存守卫**（v1.3 B3a + §1 多栈并存守卫）：
   - `bridge list` 输出 `untracked_artifacts[]` 段，让外栈历史产物显形——避免新 builtin change 覆盖。
   - `bridge adopt <dir>` 只建台账（.bridge.yaml + .bridge.log 第一条大事记），**不动任何产物**（proposal.md / design.md / tasks.md / specs/<cap>/spec.md 都不写）——D4 关键。
   - 拒绝空目录（无接管信号 → exit 2）；拒绝覆盖（已有 .bridge.yaml → exit 2）。

5. **sync 兼容规则**（v1.3 §6.3）：
   台账共享（`.bridge.yaml` 一份）+ 归档目录共享（`changes/archive/` 不分栈）+ 根基线共享（`specs/<cap>/spec.md` 不分栈 + `sync` 引擎对全部栈生效）+ 回执盖同基线。
   跨栈续作合法（`init --parent <archived-id>` 不约束 kind）；跨栈归档路径唯一。

## Considered Options

- **桥代理调用 use_skill**（spawn 子代理执行 skill）：被否——桥再造一个调度层等于造第二个引擎，正是 ADR-0001 拒绝的复杂度回归。桥的输出只有 `stdout 提示 + 台账字段`，不存在对外部工具的调用代码（ADR-0004 后果）。
- **单一固定 use_skill 列表**（不分 stage × kind）：被否——一个 matt 项目跑 executing 段看到 `use_skill test-driven-development` 是 superpowers 的 skill，本机没装就会卡死或拉错 skill。
- **wayfinder 单一推荐**（无小雾/大雾档位澄清）：被否——wayfinder 是季度级大雾 skill，调一次开销大；一个 1-file bug fix 调 wayfinder 是杀鸡用牛刀，grill-with-docs（小雾）才是正确档位。
- **`bridge list` 不加 untracked_artifacts 段**（让用户自己管外栈）：被否——list 是用户的"看见"，不显形意味着外栈历史产物被静默吃成"垃圾目录"或被 builtin change 覆盖，R4 测试义务反推该段必须有。
- **`bridge adopt` 同时改产物**（比如补全 .bridge.yaml 后顺手补 spec.md 的 schema 字段）：被否——D4 关键"adopt 不动产物"——adopt 是接管不是改造，产物所有权在外栈；想改产物开 builtin change 走 v1.2 标准流程。

## Consequences

- **正面**：`bridge next` 现在对三栈都是有用 advice（v1.2 只对 builtin 栈有用）；matt 栈规划期有清晰的"小雾/大雾"档位提示；三栈并存不再静默覆盖；agent 跑一个混合栈项目无需手挑栈。
- **负面**：PROTOCOL_HINTS 路由表是新文件——文档/代码漂移风险（v1.3 B4 T4.4 加 `docs-sync-test.mjs` 自证：双向集合相等 + --workflow-kind 三处一致 + §5/§0 命令计数对齐）。
- **边界守住**：桥仍是 navigator（不 spawn）；wayfinder/grill-with-docs 档位判定由 agent 看变更规模（ADR-0004 不替 L4）；台账 / 归档 / 根基线 三共享是兼容性测试 (`tests/sync.test.mjs` + `tests/delta-apply.test.mjs`) 的覆盖目标。
- **后续**：v1.4 附录考虑把 matt 栈分档提示做成自动检测（变更文件数 / `tasks.md` 批次数）——本轮不引入，留给 L4 agent 判断（ADR-0004 不调度）。