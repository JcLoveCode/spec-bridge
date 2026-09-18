# Design: v1-2-navigator-architect

## Purpose

把 ADR-0004 至 ADR-0007 的定位决策落成最小可用代码：导航员（next 命令）、档案员（pattern / 归档守卫）、修正路径（follow-up / patching）、信号机制（mention / rootcause / rebuttal）。

## Architecture

```
bridge.mjs（路由，350 行硬上限）
  ├─ cmd-next.mjs        新：导航输出（读状态 → 推导建议）
  ├─ cmd-pattern.mjs     新：全库 tag 聚合（读侧，无写）
  ├─ cmd-mention.mjs     新：mention + rootcause 两个入口（信号记录 + 历史频次）
  ├─ cmd-rebuttal.mjs    新：复验异议落盘（rebuttals/<date>-<slug>.md）
  ├─ cmd-init.mjs        改：--workflow-kind / --parent 联动
  └─ vendor/bridge-state.mjs  改：状态模板 +4 字段 + patching 校验
```

## Decisions

### D1 — workflow_kind 是顶层单值字段，从 capabilities 推导缺省

**选项**：a) 复用 capabilities 字段不加新字段；b) 新增顶层单值 workflow_kind；c) 子键 bridge.workflow
**决定**：b。init 支持 `--workflow-kind <openspec|matt|builtin>`；缺省取 `--capabilities` 首值；再缺省 builtin。capabilities 保留为能力快照（更细粒度），workflow_kind 是流程线声明（grep 友好）。
**理由**：R2 grill 决策——顶层好 grep；capabilities 是"哪些槽位谁供职"，workflow_kind 是"这条变更走哪条流程线"，语义不同（ADR-0004）。

### D2 — bridge next 只读 + 推导，不引入新状态

**选项**：a) next 命令内嵌建议逻辑并写回 .bridge.yaml；b) 纯读侧命令：输出 stage + next 字段 + 按 stage 查表的固定建议
**决定**：b。无参数必填 change-dir；按 stage 输出建议动作（planning→填四件套；contracted→hashes --check 后执行；executing→继续批次；patching→引用父契约；archived→无下一步，提示开 follow-up）。
**理由**：导航员最小落点；写状态是 state next 的职责，next 命令只消费（ADR-0004）。

### D3 — follow-up 是普通 change + parent 快照字段

**选项**：a) 独立 follow-up 目录结构；b) 普通 change + `parent` + `parent_artifacts_hash` 两个 metadata 字段；c) 弱引用（只存 parent 名）
**决定**：b。init 支持 `--parent <change-id>`：校验父目录存在且 stage=archived → 从父 .bridge.yaml 读取 artifacts_hash 快照写入；父不存在或未归档 → exit 2。
**理由**：CLI 结构零新增；hash 快照让版本链可重放（ADR-0005）。

### D4 — patching 是 stage 值，转换时强校验 parent

**选项**：a) 独立状态机旁路（新拓扑）；b) stage 增加一个值 `patching`，`state set stage patching` 时校验 parent 字段存在且父已归档
**决定**：b。状态机拓扑不变（仍是线性 + 一个旁路值），校验集中在 state set 入口。
**理由**：ADR-0001 拒绝状态机膨胀；patching 的全部特殊语义 = parent 必填，一条校验足够（ADR-0005）。

### D5 — 归档不可变守在 CLI 层，文件级交给 git

**选项**：a) 文件系统只读挂载/hook 拦截编辑；b) CLI 命令族对 archive/ 路径拒绝写操作（sync / state set 白名单外字段 / init 已存在）
**决定**：b。`sync` 遇 archive/ 路径 → exit 4（新退出码：写保护）；`state set` 对 archived change 仅允许 stage 字段（patching 出口）；`hashes --check` 对 archived 漂移 → 提示"开 follow-up，勿改原版"。
**理由**：CLI 是桥能守住的边界；手工编辑文件归 git 管辖，桥不越权（ADR-0005）。

### D6 — tags 自由文本，pattern 全库扫描

**选项**：a) 预设词表；b) 自由文本逗号分隔
**决定**：b。`state set tags "authz-bypass,off-by-one"`；`bridge pattern --tag <t>` 扫描 changes/ 含 archive/，输出匹配变更清单（name / stage / tags / 事件中该 tag 的 mention 次数）。
**理由**：R4/Q2 补充决策——词表会变噪音；聚合是读侧操作零风险（ADR-0006）。

### D7 — mention 只查台账历史，"第二次"判定归协议

**选项**：a) 桥维护会话内计数；b) mention 记录事件 + 检索 .bridge.log 历史同 tag 次数并输出；c) 完全不记录
**决定**：b。`bridge mention <change> --tag <t> [--note <一句话>]`：追加事件到 .bridge.log，输出"该 tag 台账历史 N 次"；N ≥ 2 时附提示行（consider pattern / follow-up）。`bridge rootcause` 同结构，事件前缀 root-cause。会话内"第二次"由 SKILL.md 协议硬性步骤保证（R8）。
**理由**：ADR-0007——桥不存会话；历史频次是台账事实，可重放；提示是信号不是决策。

### D8 — rebuttal 是轻量命令，不强制 spec 形态

**选项**：a) rebuttal 走完整 follow-up change；b) 轻量命令写 `rebuttals/<date>-<slug>.md` 自由文本
**决定**：b。`bridge rebuttal <change> <一句话> [--tag <t>]`：在 archived change 下建 rebuttals/ 目录写一条带时间戳的 markdown；不触发任何状态变更。
**理由**：R3-Q2 双轨——复验异议先记录后决策；是否升级 follow-up 由人定（ADR-0004 提示不决策）。

## Out-of-scope decisions（明确不做的）

- 不做 `bridge followup --from` 命令本体（v1.2 只出提示文案；命令等真实需求出现再议）
- 不做 mention 的会话去重（压缩后重提会重复提示——ADR-0007 记录的可接受退化）
- 不动 openspec 布局探测逻辑（workflow_kind 与布局正交）

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| bridge.mjs 路由膨胀超 350 行 | 违反 ADR-0001 上限 | 每命令只留 ~5 行分发 stub，逻辑全在 cmd-*.mjs；当前 261 行 + 5×5 ≈ 286 行，余量足 |
| state set 新字段破坏旧 .bridge.yaml 兼容 | 已归档 change 读取失败 | readState 对缺省字段返回 null（现有行为），新字段只加不改 |
| pattern 全库扫描在大仓库变慢 | list 类命令超时 | changes/ 目录规模天然有界（变更数 = 需求数），不做索引 |
