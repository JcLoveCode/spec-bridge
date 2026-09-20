# Execution Contract: v1-7-probe-active-navigator

## Intent Lock

把"导航员激活"（ADR-0001 设计原则 + ADR-0008 跨协议推荐器）落到
`bridge probe` CLI：每次用户消息/阶段进阶后，probe 输出"按你现状推荐
skill + 引导生成 spec"——推荐 Superpowers / Matt / OpenSpec / 不给。
**不替代** AI 决策（保留"prompt 管判断，代码管操作"原则）。

## Scope Fence

### In Scope

- D1-D8（design.md ## Decisions）：CLI 命令 / stdout 输出 / 4 维度探测 / 4 级路由 / 标准化输出 / SKILL.md §1 软约束 / probe 合并 next / 推荐+引导
- R1-R6（specs/v1-7-probe-active-navigator/spec.md）：命令存在 / 4 维度 / 4 级路由 / 引导生成 spec / 合并 next / 不写文件
- 4 批执行（tasks.md）：T1.1 写 cmd-probe.mjs / T1.2 bridge.mjs dispatch / T2.1 SKILL.md §1 / T2.2 specs/cli/probe/spec.md / T3.1 测试 / TN.1-TN.5 归档

### Out of Scope

- probe 不写文件（D2 + 用户拍板）
- probe 不自动调 OpenSpec CLI / Matt skill / Superpowers skill（D8）
- 不引入新依赖（仅 node:crypto + node:fs，D1 默认）
- 不改 `bridge next` 语义（probe 合并输出，next 单独还在）
- 不做 receipt 算法版本化（v1.6 backlog，独立 spec）
- 不做项目图谱（spec-mgr）（v1.8+ 独立 change，SKILL.md §7 留架）
- 不做跨项目依赖聚合（v1.8+ 独立 change，不开 cross_refs 字段）
- 不做 `bridge probe --watch`（design out-of-scope 第 2 条）
- 不做 probe 缓存（design out-of-scope 第 3 条）

## Approved Requirements

每条 SHALL/MUST 配一条测试义务 + 落进至少一个 Batch。

- [ ] **R1** — `bridge probe <root>` 命令存在 + 参数支持（测试义务：T3.1 R1 case）
- [ ] **R2** — probe 探测 4 维度：项目类型 / 能力缺口 / inventory / 拍点（测试义务：T3.1 R1-R4）
- [ ] **R3** — probe 路由优先级 4 级：Superpowers > Matt > OpenSpec > 不给（测试义务：T3.1 R1-R5）
- [ ] **R4** — probe 输出 prompt_to_user 引导生成 spec（测试义务：T3.1 R1）
- [ ] **R5** — probe 合并 next 输出（测试义务：T3.1 R1 stdout 末尾 [next] 段）
- [ ] **R6** — probe 不写文件（测试义务：T3.1 R1 验证 `.bridge/` 不被创建）

## Constraints

唯一权威源：design.md ## Decisions。每条 C 编号对到 D 编号。

- [ ] **C1 = D1** — probe 是 CLI 命令（cmd-probe.mjs 独立 + bridge.mjs dispatch 5 行），不是 SKILL.md 段
- [ ] **C2 = D2** — probe stdout 实时输出（D5 KEY:value 文本），不写 `.bridge/probe.json` / `recommended-skills.md`
- [ ] **C3 = D3** — 探测 4 维度全做：项目类型 + 能力缺口 + inventory + 拍点（不全则路由错）
- [ ] **C4 = D4** — 路由优先级严格 4 级：Superpowers > Matt > OpenSpec > 不给（按 inventory 内 skill 所属栈）
- [ ] **C5 = D5** — 输出格式标准化：KEY: value 文本（人眼可读 + 解析方便 + AI 易解析），不 JSON / 不自由格式
- [ ] **C6 = D6** — SKILL.md §1 加"每轮状态宣告"段（软约束），不强制 inventory（强制会让 AI 不调 probe）
- [ ] **C7 = D7** — probe 内部调 `bridge next` 合并输出（避免 AI 调两次），next 语义不变
- [ ] **C8 = D8** — probe 只推荐 + 引导，不自动调 OpenSpec CLI / Matt skill / Superpowers skill（保留 ADR-0001 原则）

## Execution Batches

来源 tasks.md。

### Batch 1 — probe 探测逻辑（4 维度 + 路由）

- T1.1 新建 `skills/spec-bridge/scripts/cmd-probe.mjs`，实现 `run(projectRoot, opts)` 函数：detectLayout → project_type；读 `.bridge.yaml` → capabilities, stage, next；parse `--inventory "<skill1>,<skill2>"` → 已用 skill 数组；routeSkill(project_type, capabilities, inventory, stage) → advised_skill + reason；内调 `bridge next` 合并拍点；stdout 输出 D5 格式
- T1.2 bridge.mjs dispatch 加 probe 分支 + usage 块更新（约 5 行）

完成定义：`node bridge.mjs probe .` 输出 D5 格式文本；4 种路由优先级各覆盖（手动跑 4 次不同 inventory 验证）
审查时点：批末

### Batch 2 — SKILL.md §1 + specs/cli/probe/spec.md

- T2.1 SKILL.md §1 加"每轮状态宣告"段：规定 AI 每轮消息开头写 `[inventory] 本轮调了：XXX, YYY` 行；不宣告不算已用
- T2.2 新建 `specs/cli/probe/spec.md`：probe 命令的 source-of-truth spec（含 R1-R6 场景 + D5 输出格式）

完成定义：SKILL.md §1 含宣告段；specs/cli/probe/spec.md 落地
审查时点：批末

### Batch 3 — 测试

- T3.1 新建 `skills/spec-bridge/tests/probe-active-navigator.test.mjs`，覆盖：
  - R1: Superpowers 项目 + inventory 含 superpowers-tdd → advised_skill = superpowers-tdd
  - R2: Matt 项目 + 无 inventory → advised_skill = matt-to-goal
  - R3: OpenSpec 项目 + inventory 含 openspec-explorer → advised_skill = openspec-apply-change
  - R4: builtin 项目 + 无 inventory + 无 superpowers/matt/openspec → advised_skill = null
  - R5: inventory 软约束（不传 inventory → 路由退到"按项目类型"）

完成定义：`node --test tests/probe-active-navigator.test.mjs` 5 用例全过
审查时点：批末

### Batch N — 归档

- TN.1 `node bridge.mjs sync changes/v1-7-probe-active-navigator` → 写回执
- TN.2 `node bridge.mjs verify changes/v1-7-probe-active-navigator` → PASS
- TN.3 写 `specs/v1-7-probe-active-navigator/why.md`（蒸馏）
- TN.4 `git mv changes/v1-7-probe-active-navigator changes/archive/<YYYY-MM-DD>-v1-7-probe-active-navigator/`
- TN.5 commit + push v1-7-probe-active-navigator 分支

## Escalation Rules

执行过程中遇到以下任一情况必须停下回 planning 重开：

1. **D1-D8 任一决策需重审**——若 executing 时发现 design D1-D8 与现实冲突（如 detectLayout 不足以区分项目类型、inventory 解析出错、4 级优先级在边界 case 给出反直觉推荐），回 planning 重审 D
2. **R1-R6 任一 case 不可测试**——若 spec.md scenario 不能用 node --test 写测试，回 planning 改 spec 或批
3. **SKILL.md §1 软约束不足**——若 AI 仍漏宣告 inventory（D6 软约束无效），回 planning 加硬约束
4. **bridge.mjs dispatch 改造超 5 行**——C1 约束"5 行"是为了不破坏 C9 单文件行数上限，超出需回 planning
5. **测试 5 用例不过**——T3.1 任一 case 失败需修复后重跑，不绕过
6. **执行批顺序需调整**——若 4 批实际不能串行（如 Batch 2 与 Batch 1 互相依赖），回 planning 调顺序
