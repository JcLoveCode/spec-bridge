# Design: v1-3-sdd-meta-navigator

## Purpose

把桥从"单层状态机"升级为"SDD 编程的元层导航员"——按项目实际装的栈（openspec/superpowers/matt）路由每拍该用的 skill/CLI，模板降级为 builtin 兜底，桥只管生命周期 + 衔接 + 归档，不生成文档、不代理调用。

## Architecture

```
                ┌────────────────┐
                │  user / agent  │
                └────────┬───────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │  bridge（v1.3 元层导航）       │
          │  ─ state + 台账 + 归档        │
          │  ─ advised.protocol 路由表   │
          └──────┬──────────┬────────────┘
                 │          │
        ┌────────┘          └────────────┐
        ▼                                ▼
   ┌─────────────┐                ┌──────────────┐
   │ layout       │                │ next advised  │
   │ (栈探测)     │                │ (按栈路由)    │
   └──────┬───────┘                └──────┬───────┘
          │                                │
   ┌──────┴────┬─────────┬────┐    ┌───────┴────────┐
   ▼           ▼         ▼    ▼    ▼                ▼
openspec-cn  matt   super- spec- super-         bridge
  11sk       30+sk  powers  super  powers TDD    sync/verify
                  14sk  flow                      archive
                  9sk
```

**三层职责**（不动 v1.2 既有边界）：
1. **Coordinator**（桥）：state + 台账 + 归档 + 发布回执哈希链
2. **Router**（v1.3 新增）：`bridge next` 按栈指引 + `bridge init` 按栈分支
3. **Execution**（栈工具）：superpowers 纪律 / matt 跨 session / spec-superflow build-executor / openspec-cn apply

## Decisions

### D1 — `bridge init` 按 `--workflow-kind` 分支

**选项**：A. 保持现状（总是生成 5 模板）/ B. 按栈分支（openspec/matt 只建台账，builtin 出模板）/ C. 加 `--templates=false` 开关

**决定**：**B**

**理由**：能力阶梯（L15-17）原话"原生（openspec/superpowers）→ 次选（matt）→ 兜底（内置）按槽位补位，不按环境整体降级"——`init` 出模板抢了原生栈"规划产物"槽位的活。模板降级为 builtin 兜底，正符合"台账共享，流程独立"（L59 workflow_kind 的原话）。改 `cmd-init.mjs` 约 20 行。

### D2 — `bridge sync` 保持桥引擎唯一发布者

**选项**：A. 桥引擎唯一（保回执/why 蒸馏/漂移检测）+ openspec 自行 sync 过则 verify 报差异不阻塞 / B. openspec 栈下调 openspec sync-specs，桥只记账 / C. 双轨

**决定**：**A**

**理由**：桥的回执哈希链是 v1.2 唯一审计资产（verify 漂移检测 + why 笔记 spec-rev + follow-up 链 ADR-0005），openspec sync-specs 不写桥的回执格式。B 方案会让桥退化成纯台账——放弃审计。兼容规则写进 SKILL.md §6。

### D3 — `bridge adopt <dir>` + `bridge list` 提示

**选项**：A. 新命令 adopt + list 提示 / B. 不做，layout 自动补台账 / C. v1.3 不做

**决定**：**A**

**理由**：用户明确"衔接用户已经用 openspec+superpower/matt 生成 spec 的历史文档"。自动补台账（B）违反 L46 "惰性"原则（不匹配的输入不碰状态文件）。C 拖太久。B 详细：识别 `openspec` = `proposal.md`+`specs/<cap>/spec.md`；`matt` = `.scratch/` + `CONTEXT.md`/ADR；其他只输出"未识别格式，可手填台账"。

### D4 — spec-kit / 其他 SDD 类工具：只探测不深度路由

**选项**：A. v1.3 只加探测标记（layout 一行）/ B. 三格式 + spec-kit 也接管 / C. 通用启发式

**决定**：**A**

**理由**：v1.3 识别 openspec-cn + matt 两种"已实测装好"的格式足够。其他 SDD 产物（spec-kit / spec-superflow）v1.3 只在 `bridge layout` 输出探测标记（"发现外部 SDD 产物：spec-kit"），深度接管留 v1.4。C 通用启发式违反 L48-49 "空仓库测试"（random 目录会被吃掉）。

### D5 — `bridge next` 加 `protocol` 字段（按栈路由）

**选项**：A. 加 `protocol` 字段 + 路由表 / B. 只输出推荐文字 / C. 不做

**决定**：**A**

**理由**：用户的"桥没有指引到 openspec/matt 的内置文档生成"洞察。路由表（`PROTOCOL_HINTS`）按 `stage + workflow_kind` 推荐 `use_skill X`。仅推荐不强制（用户忽略不影响 stage 推进——L46 惰性原则延伸）。

### D6 — v1.4 智能拆解（明确附录）

**说明**：见 `proposal.md` Out of Scope。重审 ADR-0004"不代理调用"边界——v1.3 不做，v1.4 单独开 change。

### D7 — 全没装时（第 3 级）仍走 init 开户

**选项**：A. init 仍开户（台账=档案员，agent 自由 + 桥只在提交时介入）/ B. 不 init，靠 adopt 补台账 / C. 完全不走 change，只 specs 蒸馏

**决定**：**A**

**理由**：用户的"提交时后能检测到么?"担忧——三层检测链兜死：
1. 有 `.bridge.yaml` → `bridge list` 直接看到
2. 有目录无台账 → `bridge list` 的 untracked 提示 → `bridge adopt`
3. 连目录都没有 → SKILL.md §1 例程守卫要求 agent 在 commit/提交/归档前先跑 `bridge list`，既无活跃也无 untracked 但工作区有 diff → agent 先 `init` 补账

B 假设"agent 至少留了目录"，真自由开发可能没有（用户担忧成立）。C 丢 ADR-0005/0006 因果链与模式标签。

### D8 — 路由表 wayfinder 档位（matt 栈意图澄清分档）

**选项**：A. 加 wayfinder 档位（matt 栈 + stage=planning + 大雾）/ B. 不加

**决定**：**A**

**理由**：用户问"用 wayfinder 会怎样"帮路由表想清：澄清槽位分两档——小雾（一个 session 装得下）→ `grill-with-docs`；大雾（装不下、绿地、季度级）→ `wayfinder` → 地图清后 handoff `to-spec`。wayfinder 不是被排除在桥外，而是 matt 栈的"大雾档"。

## Out-of-scope decisions（明确不做的）

- **D6**（v1.4 智能拆解）：涉及 ADR-0004 重审，留 v1.4
- **spec-superflow SDD 模式**（多 wave 并行）：bridge 不引入 DAG 数据结构
- **桥调 openspec-cn CLI**（CLI 未实测装）：v1.3 不依赖

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| openspec-cn CLI 未实测装 | D3 识别 openspec 产物仅看目录特征，无 CLI 调用 | 不依赖 CLI，仅识别产物格式建台账 |
| superpowers skill 路径在 marketplace 启用 | 路由表推荐 `use_skill X` 可能 IDE 不可见 | 路由表加 fallback 提示：`bridge event <dir> skip-protocol` |
| 5 套 Coordinator 并存（openspec-cn / spec-superflow / bridge）= 用户认知负担 | 不知该走哪套 | 桥推荐**只推** superpowers/matt（执行层），不推 Coordinator 替代 |
| 桥推荐替代自己 = 自我矛盾 | 用户怀疑桥的价值 | 推荐只对**执行层**（superpowers 纪律 + matt 跨 session），Coordinator 替代留给用户决策 |
| 路由表过期 | use_skill 名字变了，推荐失效 | 加路由表测试 + 季度巡检任务 + docs-sync-test（B4 T4.4） |
| 全没装时（第 3 级）agent 忘记 init | 提交时桥看不到 | SKILL.md §1 例程守卫：commit/提交/归档 → 先 `bridge list` |
| 修订改路由表时漏改 SKILL.md §6 | 文档漂移 | B4 T4.4 `docs-sync-test.mjs` 验证 §6 路由表与 `cmd-next.mjs` `PROTOCOL_HINTS` 一致 |
| v1.3 自举风险 | v1.3 自己改 next，但 next 已经要用 v1.3 的能力指引 | v1.3 实现期 next 输出还按 v1.2 路由（builtin）；v1.3 自身用 `use_skill test-driven-development` + 手填四件套走完 |