# Execution Contract: v1-2-navigator-architect

## Intent Lock

v1.1 验证了兜底闭环但桥的三块本职空白（无导航输出 / 无修正路径 / 无模式检测）；本变更把 grill 会话的 ADR-0004~0007 决策落成代码，交付导航员与档案员的最小可用形态。改动面：bridge-state 模板 +4 字段、4 个新命令文件、cmd-init 两参数、SKILL.md 协议硬性步骤。

## Scope Fence

### In Scope
- workflow_kind / parent / parent_artifacts_hash / tags 四字段及推导与校验
- next / pattern / mention / rootcause / rebuttal 五命令
- patching 旁路态 + 归档写保护（sync exit 4 / state set 白名单 / hashes 提示）
- SKILL.md §3 硬性步骤 + §5 速查表补全

### Out of Scope
- 会话状态持久化（ADR-0007 拒绝）
- 预设 tag 词表
- 外部工具代理调用（ADR-0004 拒绝）
- openspec 布局的 workflow_kind 特殊处理
- `bridge followup --from` 命令本体（只出提示文案）

## Approved Requirements

- [ ] **R1** — workflow_kind 顶层字段：显式 > capabilities 首值 > builtin 三级推导（测试义务：三级推导各一断言，Batch 1）
- [ ] **R2** — `bridge next` 只读导航：stage 查表输出建议；archived 提示开 follow-up（测试义务：5 stage 输出 + 不存在 exit 1，Batch 3）
- [ ] **R3** — `init --parent` 快照：父必 archived，快照 parent_artifacts_hash（测试义务：合法 / 不存在 / 未归档三路径，Batch 2）
- [ ] **R4** — patching 旁路：无 parent 拒绝（exit 2），有合法 parent 放行（测试义务：双向断言，Batch 1）
- [ ] **R5** — tags + `bridge pattern --tag`：全库扫描含 archive，无匹配空列表 exit 0（测试义务：跨活跃+归档聚合断言，Batch 4）
- [ ] **R6** — mention / rootcause 信号：事件入 .bridge.log + 历史计数输出；N≥2 附建议行（测试义务：首次无提示 / 二次有提示 / root-cause 前缀，Batch 5）
- [ ] **R7** — `bridge rebuttal` 轻量落盘：rebuttals/<date>-<slug>.md，零状态变更（测试义务：文件创建 + yaml 不变，Batch 6）
- [ ] **R8** — 归档写保护：sync exit 4；state set 仅放行 stage；hashes --check archived 漂移提示 follow-up（测试义务：三路径各一断言，Batch 6）

## Constraints

- **C1**（D1）：workflow_kind 是顶层单值，不嵌套；capabilities 语义保留为能力快照
- **C2**（D2）：next 命令纯读侧，不写任何状态；写 next 字段是 state next 的职责
- **C3**（D3）：follow-up 不发明新目录结构，metadata 快照让版本链可重放
- **C4**（D4）：patching 是 stage 值不是新状态机拓扑；校验集中在 state set 入口
- **C5**（D5）：归档不可变只守 CLI 边界（exit 4 + 白名单 + 提示）；文件级编辑归 git
- **C6**（D6）：tags 自由文本；pattern 是读侧聚合，零写风险
- **C7**（D7）：mention 只查台账历史（.bridge.log），"会话内第二次"由 SKILL.md 协议保证，桥不存会话
- **C8**（D8）：rebuttal 不触发状态变更；是否升级 follow-up 由人决定
- **C9**（ADR-0001）：bridge.mjs 350 行硬上限；每命令只留 ≤5 行路由 stub，逻辑在 cmd-*.mjs
- **C10**：新字段对旧 .bridge.yaml 向后兼容（readState 缺省 null）

## Execution Batches

- Batch 1（3 任务）— 状态模板 +4 字段 + patching 校验 + workflow_kind 推导｜完成定义：state set/get 新字段可用｜审查：批末
- Batch 2（2 任务）— init --parent 快照｜完成定义：follow-up 一键生成｜审查：批末
- Batch 3（3 任务）— cmd-next.mjs + 接线 + 测试｜完成定义：bridge next 出拍点+建议｜审查：批末
- Batch 4（2 任务）— cmd-pattern.mjs + 测试｜完成定义：tag 聚合可查｜审查：批末
- Batch 5（2 任务）— cmd-mention.mjs 双入口 + 测试｜完成定义：信号入台账可重放｜审查：批末
- Batch 6（3 任务）— rebuttal + verify 文案 + 归档写保护 + 测试｜完成定义：双轨闭环｜审查：批末
- Batch 7（2 任务）— SKILL.md 硬性步骤 + 速查表 + CONTEXT 核对｜完成定义：协议与 CLI 一致｜审查：批末
- Batch 8（5 任务）— sync → verify → why 蒸馏 → git mv 归档 → commit/push/bump 0.3.0｜完成定义：四拍收口

## Escalation Rules

- bridge.mjs 超过 350 行上限 → 停，重拆路由再继续
- 新字段导致旧台账（v1.1 归档件）读取失败 → 停，先修兼容
- SKILL.md 协议文本与 CLI 实测行为不一致 → 停，先对齐
- 测试接缝偏离 run() 层（出现需要 mock 内部模块的测试）→ 停，重审设计
