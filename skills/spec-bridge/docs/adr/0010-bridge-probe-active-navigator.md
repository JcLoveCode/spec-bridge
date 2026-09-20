# ADR-0010: bridge probe 主动激活（v1.7 落"导航员激活"）

- 状态：Accepted（2026-09-20）
- 决策人：JcLoveCode（与 AI grill 锐化）
- 关联 change：changes/v1-7-probe-active-navigator/

## 背景

ADR-0001 把"skill description 自动路由 + 显式点名"定为单入口路由的触发机制。v1.3 在 SKILL.md §2 加了三栈探测（OpenSpec / Matt / builtin）+ §6 PROTOCOL_HINTS 推荐表，构成了"按栈推荐"的雏形。

但 v1.1-v1.6 一直没落地两件事：
1. **AI 不会主动喊"你下一步该走哪个 skill"**——只在 `bridge next` 被显式调用时输出，且只报当前拍点
2. **探测用户当前对话上下文**——SKILL.md §2 探测"项目装了什么"，但**不探测"用户在本次对话已经调了哪些 skill"**，无法按用户实际走法实时路由

v1.5 在 proposal.md:49 / design.md:116 / execution-contract.md:34 三处显式拒绝新增 `bridge probe`，推到未来。

v1.7 把这两件事落到一个 CLI 命令 + SKILL.md 加"每轮状态宣告"段。

## 决策

### D1. `bridge probe` 是 CLI 命令

- 入口：`node <bridge> probe <project-root> [--stage <stage>] [--inventory "<skill1>,<skill2>,..."]`
- 默认 stdout 输出，**不写文件**
- AI 在每次用户消息后、每次阶段进阶时调一次
- 探测 + 推荐逻辑全部在 CLI 内（确定性，不靠 LLM 现场合并）

### D2. probe 探测 4 维度

| 维度 | 来源 | 用途 |
|---|---|---|
| (a) 项目类型 | `bridge layout` 已做（detectLayout） | 路由到对应栈的 skill 集 |
| (b) 能力缺口 | SKILL.md §2 已有的能力层探测 + 本次会话 inventory | 提示用户装缺的能力 |
| (c) 已用 skill（inventory） | AI 每轮在消息开头宣告 "本轮调了 X, Y skill" → probe 接收为 `--inventory` | 按用户已用栈推荐同栈下一步 |
| (d) 目前拍点 | `bridge next` 已能做 | 给"现在该走 X skill 因为拍点是 Y"的具体理由 |

### D3. 路由优先级：Superpowers > Matt > OpenSpec > 都不给

按"能力层补槽位"原则（SKILL.md §2），优先级为：
1. **项目已装 Superpowers** → 推荐 Superpowers 子 skill（test-driven-development / systematic-debugging）
2. **否则 项目装 Matt** → 推荐 Matt 子 skill（spec-executor / to-goal / grill-with-docs）
3. **否则 项目装 OpenSpec** → 推荐 OpenSpec CLI（openspec-apply-change / openspec-sync / openspec-archive）
4. **否则** → 不给 skill 推荐，让用户继续裸聊（不要硬塞 skill）

### D4. SKILL.md §1 加"每轮状态宣告"段

- AI 在每轮消息开头宣告一行：`[inventory] 本轮调了：openspec-explorer, superpowers-tdd`
- 不宣告就不算"已用"——probe 按"无 inventory"路由
- 这是软约束，靠 prompt 合规性；不写文件、不污染状态

### D5. probe 输出格式（stdout）

```
[probe]
project_type: openspec              # 探测项目层
capabilities: [superpowers, matt]    # 项目装的能力（能力层）
inventory: [openspec-explorer]       # 用户本轮已用 skill
stage: contracted                    # 当前拍点（来自 bridge next / .bridge.yaml）
next_stage: executing
advised_skill: openspec-apply-change  # 推荐 skill（按 D3 优先级）
advised_reason: 你项目用 OpenSpec + 已调 explorer，下一步走 apply-change 把 explorer 产出写成 proposal.md
fallback_skill: superpowers-test-driven-development  # 备选（提示用户装锁能力）
prompt_to_user: 调 openspec-apply-change /changes/v1-7-probe-active-navigator 引导生成 proposal.md
```

### D6. 引导用户生成 spec

probe 推荐完 advised_skill 后，给 prompt_to_user 一行："调 XXX 引导生成 proposal.md"——让用户**主动**开新 change 或补当前 change 的 spec 骨架。

probe 不直接调 OpenSpec CLI / Matt skill / Superpowers skill（保持"prompt 管判断，代码管操作"原则）——只推荐 + 引导。

### D7. "有了 spec，桥的归档守卫能力才能继续合适生效"

probe 推荐 + 引导 → 用户生成 spec（proposal.md / design.md）→ `bridge state set contract_approved approved` → `bridge sync` 发布基线 → `bridge verify` 复核 → `bridge distill` 蒸馏 why.md → `bridge archive-ready` 守门 → `git mv` 归档。

probe 是这条流水线的"前置发现器"——没它，用户可能跳过 spec 直接写代码，archive-ready 会拒绝。

### D8. 与现有 `bridge next` 的关系

- `bridge next`：报当前拍点 + 下一步建议（按 stage 推荐该走哪）
- `bridge probe`：报项目能力 + 推荐 skill（按用户已用 inventory 推荐该调哪个 skill）

两者互补：probe 给"按能力该走哪个栈"，next 给"按阶段该走哪一步"。

合并方案：probe 内部调 next（避免 AI 调两次），输出合并版"项目能力 + 当前拍点 + 推荐 skill + 下一步动作"。

## 拒绝的备选

### A. 只改 SKILL.md 不加 CLI

- **拒绝理由**：AI 不会主动执行探测逻辑；prompt 合规性差；改完 SKILL.md 用户仍要靠 IDE 触发
- **保留**：SKILL.md 仍加"每轮状态宣告"段（D4），但配合 CLI probe

### B. CLI 写文件（如 .bridge/probe.json）

- **拒绝理由**：用户选 B（stdout 实时）；写文件会污染状态目录；与 §0 "状态只在磁盘 .bridge.yaml" 原则冲突（probe 输出是临时建议不是状态）
- **保留**：probe 不写任何文件

### C. 不探测已用 skill

- **拒绝理由**：缺这维度 → probe 推荐只按项目类型 → 用户用 OpenSpec explorer 完后 probe 仍推荐 Matt skill → 路由错
- **保留**：D2(c) inventory 维度必做

### D. probe 自动调 OpenSpec CLI / Matt skill

- **拒绝理由**：违反"prompt 管判断，代码管操作"（ADR-0001 原则）；让 probe 替代 AI 决策
- **保留**：probe 只推荐 + 引导（D6），实际调用由 AI 在下一轮消息里做

## 后果

### 正面

- "导航员激活"从设计原则（ADR-0001）落到可执行 CLI
- 每次用户动作后 AI 都能拿到"按你现状推荐 skill"——引导用户**主动**生成 spec
- 与 §1 入口例程（5 步）+ §2 能力探测 + §6 PROTOCOL_HINTS 兼容：probe 是它们的整合器，不替代

### 负面

- "每轮状态宣告"靠 prompt 合规性——AI 可能漏宣告 → probe 路由退到"无 inventory"
- probe 不写文件 → 多次调用结果不连续（每次独立计算）——这是设计意图，不算 bug
- 新增 CLI 命令 → bridge.mjs 行数 +80~100，需谨慎控制（C9 ≤ 350）

## 关联

- 实施：changes/v1-7-probe-active-navigator/
- 上游：ADR-0001（单入口路由触发机制）/ ADR-0008（桥作为跨协议推荐器）/ v1.3 §6 PROTOCOL_HINTS
- 测试：tests/probe-active-navigator.test.mjs（新增）
- spec 增量：specs/cli/probe/spec.md