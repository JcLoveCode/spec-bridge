# Change: v1-8-3-memory-personal-team

## Why

v1.7+ 桥骨架已实装（个人层台账 + 自动归并 + 验证），v1.8-1/1.8-2 把 bridge
改成"纯桥模式 + 主动化导航员"，但 **AGENTS.md §业务目的 a' 标签**还挂着一条明
文承诺：

> CodeBuddy memory 等价骨架（探测 + 按需补）—— v1.8 起独立 change 实装

实战暴露三个具体痛点：

1. **记忆断层**——新窗口开起来，AI 只看得到 chat 历史，看不到"上次我讲过啥
   / 决定过啥 / 卡在哪"。每次都要重做"上下文重建"工作
2. **团队层空白**——v1.7 个人层只服务"我自己"，全组看不到"这条业务以前有人
   踩过坑、做过决定、立过规矩"
3. **团队层记忆规则未明文化**——a' 标签存在但没实装，每次新窗口 AI 都得现场
   编，造成"现场合并污染"（bridge 替 AI 总结 = 越位）

v1.8-3 调研报告（`MEMORY-RULES-RESEARCH.md` 751 行）已对：

- 现成 memory 读什么 / 不读什么（IDE 自带优先 + bridge 不重复）
- 个人 → 团队汇总机制（CLI 同步 + hash 校验）
- cap 边界处理（声明机制 + orphaned 沉淀目录）
- reconcile 怎么调（cap 边界变更触发 + 长期 review）

做完详细调研，等用户拍板实装。

## What Changes

- **D1 个人层探测优先用 IDE 自带 memory**：bridge probe 探测 `.codebuddy/memory/`
  是否存在，存在则**不**在 changes 下生成个人 memory.md，只在 probe 输出里
  `memory_hint` 字段报告 IDE memory 路径 + 行数统计
- **D2 个人层 fallback**：IDE memory 不存在时，bridge init / adopt 自动建
  `changes/<name>/memory.md` 空骨架（§0 元信息 + §1-N 占位），由 AI 按规则填
- **D3 新增 4 条命令**：`bridge memory init/append/sync/show` + `bridge memory
  reconcile --team`，命令族归 `cmd-memory.mjs`
- **D4 probe 输出加 `memory_hint` 字段**：报告"个人层在哪 / 几行 / 团队
  cap=N.M 有 K 行决策"，让 AI 知道"上次讲过啥"
- **D5 archive-ready 守门**：归档前必须"个人 memory 有内容"或 IDE memory 在场，
  避免"啥都没记就归档"
- **D6 archive 触发团队层同步**：archive 通过后自动调 `bridge memory sync`，
  从个人 memory.md 抽取决策段复制到 `.bridge/team/<cap>/memory.md`
- **D7 cap 边界声明**：复用 `--capabilities` flag；未声明时按 `defaultCapability(name)`
  落 `.bridge/team/default/memory.md`
- **D8 orphaned 沉淀**：cap 归属不明的决策先挂 `.bridge/team/orphaned/`，不
  强入任何 cap
- **D9 写规则硬约束**（写进 SKILL.md §x + AGENTS.md 禁事）：
  - bridge 不替 AI 总结，只填结构和元信息
  - 不写过程日志（chat 风格的过程记录属于对话层）
  - 每行必带 why（"vX.Y.Z: 砍 X 因为 Y" 格式）
- **D10 测试**：10+ cases 覆盖（探测 / 补 / append / sync / reconcile / hash /
  probe memory_hint / archive-ready 守门 / orphaned 沉淀 / IDE memory 在场）
- **D11 文档同步**：`SKILL.md §7` 加 v1.8-3 CHANGELOG 段 + `AGENTS.md` 业务目的
  a' 改写为"两层规则完整版" + 禁事加"不替 AI 写 memory 内容" + `README.md §1.1`
  同步 + 新 ADR `0013-memory-personal-team-rules.md`

## Scope

### In Scope

- 新增 `cmd-memory.mjs`（4 命令 + reconcile + show + 校验 hash）
- `cmd-init.mjs`：探测 IDE memory + 按需调 `bridge memory init`
- `cmd-adopt.mjs`：同 init 探测逻辑
- `cmd-probe.mjs`：加 `memory_hint` 字段输出
- `cmd-archive-ready.mjs`：加"个人 memory 有内容或 IDE memory 在场"守门
- `cmd-archive.mjs`（或 archive flow）：自动调 `bridge memory sync`
- 新建 `.bridge/team/<cap>/memory.md` 目录结构 + `.bridge/team/orphaned/` 沉淀
- 新 spec：`specs/cli/memory/spec.md` + `specs/team/memory/spec.md`
- 新 ADR：`0013-memory-personal-team-rules.md`（个人 / 团队两层规则写入宪法）
- `AGENTS.md`：禁事 + 业务目的 a' 同步
- `SKILL.md §7`：v1.8-3 CHANGELOG 段 + 写规则硬约束示例
- `README.md §1.1 a'`：改写为"两层规则完整版"
- 测试：10+ cases
- archive: sync + verify + distill + archive-ready + git mv + stage=archived
  + commit + push

### Out of Scope

- **不**改 `.codebuddy/memory/` 本身的任何行为（IDE 自管域，bridge 只读不写）
- **不**改 distill / why.md 输出位置（memory 在 changes/<name>/memory.md，
  why.md 在 specs/<cap>/why.md——两套产物互补不合并）
- **不**加 `--memory / --no-memory` flag（探测到位，按需补就够了）
- **不**改 SKILL.md §6 多栈并存守卫（v1.6 设计已稳）
- **不**做 memory 加密 / 权限控制（团队层默认项目内可见，符合"团队总纲"语义）
- **不**做 memory 自动总结（违反"bridge 不替 AI 写 memory"硬约束）
- **不**做跨项目 memory 合并（v1.8-3 只服务单项目内个人 / 团队）