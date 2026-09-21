# Design: v1-7-probe-active-navigator

## Purpose

把"导航员激活"（ADR-0001 设计原则 + ADR-0008 跨协议推荐器）落到一个可调用的 CLI：
- AI 在每次用户消息后 / 每次阶段进阶时调一次 `bridge probe`
- probe 输出"按你现状推荐 skill + 引导生成 spec"
- 用户**主动**按 probe 推荐调对应 skill（OpenSpec CLI / Matt skill / Superpowers skill）→ 生成 spec → 走完归档流水线

probe 是导航员 + 推荐器 + 引导器的整合，**不替代** AI 决策（保留 ADR-0001 "prompt 管判断，代码管操作"原则）。

## Architecture

```
[user message] → AI in IDE
       ↓
   AI 调 `bridge probe <root> [--inventory "<skills>"]`
       ↓
   cmd-probe.mjs:
   ├─ detectLayout() → project_type
   ├─ readState() → capabilities, stage, next
   ├─ parse inventory[] → 已用 skill
   ├─ routeSkill(project_type, capabilities, inventory, stage):
   │  ├─ 优先 Superpowers（能力层最高）
   │  ├─ 否则 Matt
   │  ├─ 否则 OpenSpec
   │  └─ 都不在 → null（不给推荐）
   ├─ internalCall `bridge next <root>` → 当前拍点 + next 建议
   └─ 合并输出 stdout
       ↓
   AI 读 stdout → 按 prompt_to_user 调对应 skill
       ↓
   用户生成 spec → 走完 archived 流水线
```

数据流：
- 输入：`--inventory` (软约束，由 AI 每轮宣告) + `--stage` (可选覆盖) + `<root>` (项目根)
- 输出：stdout JSON-like 文本（D5 格式）
- 状态读：`.bridge.yaml` (only)、不写

## Decisions

### D1 — probe 是 CLI 命令，不是 SKILL.md 段

**选项**：
- A. CLI 命令（cmd-probe.mjs）
- B. SKILL.md 思考模式（纯文档）
- C. Hybrid

**决定**：A（CLI 命令）

**理由**：用户选 A。B 已被 grill 拒绝（AI 不会主动执行探测逻辑；prompt 合规性差）。

### D2 — probe 不写文件，stdout 实时输出

**选项**：
- A. stdout 实时
- B. 写 `.bridge/probe.json`
- C. 写 `.bridge/recommended-skills.md`

**决定**：A（stdout）

**理由**：用户选 A。B/C 都被 grill 拒绝（污染状态目录；与 §0 "状态只在磁盘 .bridge.yaml" 原则冲突）。

### D3 — probe 探测 4 维度：项目类型 + 能力缺口 + inventory + 拍点

**选项**：
- A. 4 维度全做
- B. 只做项目类型 + 拍点
- C. 只做 inventory + 拍点

**决定**：A（4 维度全做）

**理由**：用户选 A（多选）。B 缺 inventory → 路由错（用户用 OpenSpec explorer 完后 probe 仍推荐 Matt skill）。C 缺项目类型 → 路由缺基础上下文。

### D4 — 路由优先级 Superpowers > Matt > OpenSpec > 都不给

**选项**：
- A. 4 级优先级
- B. 3 级（去 OpenSpec）
- C. 随机选

**决定**：A（4 级）

**理由**：用户原话 "又有 superpower 的能力就执行 superpower 能力建议,没有就继续用 matt skills 都没有就不给建议 skills"——4 级优先级。

### D5 — 输出格式标准化（stdout）

**选项**：
- A. JSON
- B. KEY: value 文本
- C. 自由格式

**决定**：B（KEY: value 文本）

**理由**：人眼可读 + 解析方便（每行 [key] [value]）+ AI 易解析。JSON 多余的语法噪音。自由格式不稳定。

### D6 — SKILL.md §1 加"每轮状态宣告"段

**选项**：
- A. SKILL.md 软约束（每轮 AI 自报）
- B. CLI 强约束（每次 probe 强制要 inventory）
- C. 不加状态宣告

**决定**：A（软约束）

**理由**：用户选 A。B 强制 inventory 会让 AI 不调 probe（嫌烦）。C 缺 inventory 维度。

### D7 — probe 内部调 `bridge next`，合并输出

**选项**：
- A. 合并（probe 调 next，输出合并版）
- B. 分开（probe 只输出能力，next 单独调）
- C. 重写 next 逻辑到 probe 内

**决定**：A（合并）

**理由**：避免 AI 调两次。next 语义不变（单独用还在）。C 是重写没必要。

### D8 — probe 推荐 + 引导，不自动调 skill

**选项**：
- A. 只推荐 + 引导
- B. 自动调 OpenSpec CLI
- C. 自动调 Matt skill

**决定**：A

**理由**：保留 ADR-0001 "prompt 管判断，代码管操作"原则。B/C 让 probe 替代 AI 决策，违反设计初衷。

## Out-of-scope decisions

- **不做 receipt 算法版本化**（v1.6 backlog）——独立 spec，单独 change
- **不做 `bridge probe --watch`（持续轮询）** —— 用户期望"每步都给"，但 IDE 主动轮询不在 scope，靠 SKILL.md §1 软约束
- **不做 probe 缓存** —— 每次独立算（写文件会被 grill 拒）

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| R-low：AI 漏宣告 inventory | probe 退到"无 inventory" → 推荐回退到只按项目类型路由 | SKILL.md §1 软约束 + prompt 合规 |
| R-low：probe 输出与 PROTOCOL_HINTS 重复 | 用户困惑 | D7 合并 next，输出加 `[probe + next]` 段标识 |
| R-low：bridge.mjs 行数 +80~100 突破 C9 上限 | 后续迭代负重 | cmd-probe.mjs 独立文件 + bridge.mjs 仅 5 行 dispatch + usage |
| R-low：probe 推荐错栈（OpenSpec 用户被推 Matt） | 用户走错流程 | inventory 维度必填 + D4 优先级严格按 inventory 内 skill 所属栈 |
| R-low：CLI 命令总行数（v1.5 后从 13 → 15） | 命令矩阵变大 | docs/adr 不增；specs/cli 加 probe spec 段 |