# Spec Bridge — 术语表

本文件只放术语，不放实现细节。

## Language

**变更（change）**：
一个有界的工作单元（一个功能或一个 bug），目录 `changes/<需求号>-<slug>/`，是契约、执行、归档的原子。
_避免_：任务（任务是 change 内的批次）、需求（需求是分支粒度）。

**需求号分支**：
承载 N 个变更的 git 分支，命名 `<需求号>`，是合并/推送/PR 的原子。变更与分支是 N:1。
_避免_：把"需求"当作 change 的同义词。

**能力阶梯（capability ladder，v2 五级）**：
探测结果决定每个功能槽位由谁供职，分五级（L1~L5）：
- **L1 原生**：项目层官方插件（openspec / superpowers）
- **L2 matt**：整栈备胎（matt `spec-executor` / `to-spec` / `tdd`）
- **L3 状态机中断**：桥的导航员接管（`bridge next` / `bridge adopt`）
- **L4 agent 自身**：LLM 即技能（写决策摘要、批内化解方案澄清、模式信号判断）——CLI 不替代
- **L5 桥档案员保留**：桥本职（台账读写、归档蒸馏、回执签发）

按槽位补位不按栈整体降级；桥只在 L3/L5 现身，不替代 L1/L2，也不冒充 L4。
（旧版"原生 → matt → 内置"三级语义合并入 v2 五级：原"内置"= L5，本职；新加 L3 状态机中断 + L4 agent 自身作为明确边界。）

**功能槽位（slot）**：
工作流的一个独立能力位：规划产物、契约压缩、执行、调试、审查、归档合并、知识沉淀。
每个槽位独立探测、独立兜底。

**栈（Stack A / B / C）**：
项目层探测出的整栈选择。A = openspec + superpowers（规划半 + 执行半，缺一仍算 A）；
B = matt 整栈（自足）；C = 都没有 → 内置最小闭环（照跑不瘫痪）。

**契约（execution contract）**：
4 份规划产物压缩成的执行握手文件。转译不是复制。有批准门，内容级过期检测。
_避免_：spec（spec 是根基线里的规范条目）。

**发布回执（publication receipt）**：
`sync` 写入 `.bridge.yaml` 的 base64 编码记录（delta hash + 基线前后 hash）。
三处消费：closing guard 放行、why 蒸馏的"已发布"标记、`spec-rev` 陈旧判定。

**根基线（published baseline）**：
`specs/<capability>/spec.md` 的集合。发布产物，不是事实源；事实源是 `changes/`（delta 永不删除）。

**单向蒸馏（unidirectional distillation）**：
知识只从 change/基线流向 why 笔记，永不回流 specs。规则见 ADR-0003。

**why 笔记**：
`specs/<capability>/why.md`。结论 + 溯源链接 + `spec-rev`。不进基线 hash。
_避免_：知识库（kb 是另一个项目的概念，本 skill 不用）。

**惰性（inert）**：
不匹配任何活跃变更的对话输入不创建、不修改任何状态文件——单入口路由的防污染原则。

**空仓库测试（fresh clone test）**：
skill 可用性的验收判据：`git init` 空仓库 + 装上 skill 即可用，零项目改动。

**导航员（navigator）**：
桥的角色之一：告知用户当前所处流程拍点与下一步建议。
_避免_：调度员（桥不代理调用外部工具，见 ADR-0004）。

**档案员（archivist）**：
桥的角色之二：把散落的规格整理成可查阅的落地资产（台账、归档、蒸馏）。

**工作流类型（workflow kind）**：
变更台账 `.bridge.yaml` 顶层字段，标记该变更由哪套流程承载（`openspec | matt | builtin`）。台账共享，流程独立。

**SDD 产物**（v1.3 新术语）：
由 spec-bridge **内置协议生成的产物**（`proposal.md` / `design.md` / `tasks.md` / `execution-contract.md` / `specs/<cap>/spec.md` 模板 + `bridge init` 用内置模板写的实例）。
_避免_："SDD 模板"——模板是字面常量，产物是 fill 后的实际文件；`bridge init --workflow-kind builtin` 才会写这些。

**外部产物**（v1.3 新术语）：
由**外栈工具生成的产物**——openspec 自出的 `proposal.md` / `design.md` / `tasks.md` / `specs/<cap>/spec.md`、matt `to-spec` 自出的意图地图等。桥**不重写、不生成、不覆盖**，只接（`bridge adopt`）或留（`bridge list` 的 `untracked_artifacts[]` 段提示）。
_避免_：混称"栈产物"——栈是项目层概念，外部产物是文件来源概念。

**跨协议路由（cross-protocol router，v1.3 新术语）**：
`bridge next` 在 advice 段后追加 `→ protocol:` 段，按 `stage + workflow_kind` 二维查表给出 use_skill 推荐。仅推荐不代理调用（ADR-0004 不调度 + ADR-0008 延伸）。

**续作（follow-up）**：
引用已归档变更的新变更，metadata 携带 `parent` + `parent_artifacts_hash`。
_避免_：修订（归档内容不可修改，修正一律开续作，见 ADR-0005）。

**修补态（patching）**：
生命周期旁路态：`archived → patching → re-archived`。其 parent 必填且必须已归档。

**因果链（causal chain）**：
连环错的建模维度：由续作的父引用串联而成（纵向）。

**模式标签（pattern tag）**：
一错再错的建模维度：`.bridge.yaml` 的 `tags:` 自由文本字段，跨变更聚类（横向）。与因果链正交，见 ADR-0006。

**提及（mention）**：
agent 调用 `bridge mention --tag <t> --ref <change>` 记录"同类问题再次出现"的信号；桥只记账不判语义。协议硬性步骤，见 ADR-0007。

**根因分析（root-cause）**：
结构化的提及入口：标记"正在做根因修复"。混合触发——单点 bug 不记，模式重复 / 设计缺陷 / 连环因果必记。

**复验异议（rebuttal）**：
人工测试复验发现偏差时的自由文本记录，存于归档变更的 `rebuttals/` 目录；不自动开变更。

**Layout 探测规则**（v1.4 修正，v1.6 补第 4 条弱信号）：
`detectLayout(projectRoot)` 优先级——bridge 历史归档目录在哪 = layout 真信号：
1. **`changes/archive/*/.bridge.yaml` 存在** → `standalone`（changesDir = `changes/`）
2. **`openspec/changes/archive/*/.bridge.yaml` 存在** → `openspec`（changesDir = `openspec/changes/`）
3. **`openspec/config.yaml` 存在**（OpenSpec CLI 标志）→ `openspec`
4. **`openspec/` 目录在场**（v1.6 弱信号兜底）→ `openspec` —— 满足 `spec/cli/spec.md R1 场景 1.5`；archive 化石优先级 1 保护 spec-bridge 仓库根不被 OpenSpec CLI 本地安装目录误判
5. 缺省 → `standalone`

_避免_：只看 `openspec/` 目录存在（v1.4 之前的探测，会把 OpenSpec CLI 本地安装产物误判为 openspec 布局）。详见 ADR-0009（含 v1.6 附录）。

**`archived_count` 字段**（v1.4 新字段）：
`bridge list <root>` 返回 JSON 多一段数字字段 `archived_count`，报告 archive 子目录下的归档 change 条数。只数不展示——详情走 `bridge pattern --tag <t>` / `bridge mention <dir> --tag <t>` / `bridge next changes/archive/<id>`。让 agent 知道"有 N 条历史可接续"，但不喧宾夺主。

**会话（session）**：
桥不拥有的概念——对话上下文连续性归 agent，桥只提供提及命令。
_避免_：桥持久化会话状态。

## Relationships

- 一个**需求号分支**承载 N 个**变更**
- 一个**变更**产出一份**契约**，消费一份**根基线**增量，留下一份**发布回执**
- **why 笔记**从属于**根基线**的 capability，晚于**发布回执**产生
- **功能槽位**属于**能力阶梯（v2）**的一层（L1~L5）；**栈**是项目层的整体选择
- 一个**续作**引用一个已归档**变更**的 `artifacts_hash`；因果链由续作父引用串联
- **模式标签**跨**变更**聚类，与**因果链**正交；**提及**是模式标签的信号源
- **复验异议**从属于已归档**变更**；是否升级为**续作**由人决定
- **SDD 产物** vs **外部产物**：桥的内置 vs 外栈工具栈同一文件路径生成物；台账可同时管两边（`bridge adopt` 接管外部），但产物所有权不变
- **Layout 探测规则**（v1.4 + v1.6 补第 4 条弱信号）：bridge 历史归档目录在哪 = 真信号——优先级 1) `changes/archive/*/.bridge.yaml` 2) `openspec/changes/archive/*/.bridge.yaml` 3) `openspec/config.yaml` 4) `openspec/` 目录在场 (v1.6) 5) 缺省 standalone。详见 ADR-0009
- **`archived_count` 字段**（v1.4）：`bridge list` JSON 的数字字段，只数 archive 子目录不展示详情——让 agent 感知"有 N 条历史"但遵守 v1.2 D5 skip archive 设计
