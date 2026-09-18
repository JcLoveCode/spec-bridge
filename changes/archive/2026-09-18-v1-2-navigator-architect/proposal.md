# Change: v1-2-navigator-architect

## Why

v1.1 验证了 Stack C 兜底闭环，但桥的三块本职能力仍是空白：

1. **无导航输出**——`.bridge.yaml` 有 `next` 字段但没有用户可见命令；ADR-0004 钉死"导航员"定位，却只有感知（探测）没有输出。
2. **无修正路径**——"做歪了 / bug 修复 / 回炉"只能走全流程重开；ADR-0005 的不可变历史 + follow-up 链未实现。
3. **无模式检测**——连环错、一错再错没有任何信号机制；ADR-0006/0007 的 tags / mention 协议未落地。

本次变更把 grill 会话（R1–R5 轮）的 4 个 ADR 决策落成代码，交付导航员与档案员的最小可用形态。

## What Changes

- 新增：`workflow_kind` 顶层字段（流程线声明，ADR-0004）
- 新增：`bridge next` 导航命令（ADR-0004 的用户可见输出）
- 新增：`parent` / `parent_artifacts_hash` 续作引用字段 + `init --parent`（ADR-0005）
- 新增：`patching` 生命周期旁路态 + 转换校验（ADR-0005）
- 新增：`tags` 模式标签字段 + `bridge pattern` 聚合命令（ADR-0006）
- 新增：`bridge mention` / `bridge rootcause` 信号命令（ADR-0007）
- 新增：`bridge rebuttal` 复验异议命令 + `verify` 偏差提示文案（R3-Q2 双轨）
- 修订：SKILL.md §3 补 mention 硬性触发步骤（ADR-0007）
- 修订：CLI 对 `changes/archive/` 路径的写保护（ADR-0005）

## Scope

### In Scope

- 上述 9 项功能及其测试（单一接缝：命令 `run()` 层）
- `bridge-state.mjs` 状态模板扩展 4 个新字段
- 新命令实现文件（与 `cmd-init.mjs` / `cmd-sync.mjs` 对称）
- SKILL.md 协议文档更新

### Out of Scope

- 会话状态持久化（ADR-0007 明确拒绝：桥不存会话）
- 预设 tag 词表（自由文本起步，词表 v2 再议）
- 外部工具栈的代理调用（ADR-0004 拒绝调度员角色）
- `openspec` 布局下的 workflow_kind 特殊处理（standalone 先行，openspec 布局行为不变）
- follow-up 的自动化建议（`bridge followup --from` 仅作为提示文案，不实现命令）
