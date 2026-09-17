# ADR-0001: 单入口路由（放弃多入口守卫与 8 态状态机）

- 状态：Accepted（2026-09-17）
- 决策人：JcLoveCode（与 AI 结对设计）

## 背景

spec-bridge 要桥接三个彼此独立的系统：用户自装的 OpenSpec（规划）、Superpowers（执行纪律）、
Matt-skills（整栈备胎）。三家的 skill 各有各的触发方式，没有总调度就会各跑各的。
上游 spec-superflow 用的是"单入口 workflow-start + 8 态状态机 + CLI guard"。

## 决策

1. **单入口路由**：只有一个人口 skill（本 SKILL.md），读目录/状态 → 判阶段 → 分发。
   判断逻辑写在一处，不散在每个子 skill 里。
2. **状态机砍到 3 态**：`planning → contracted → archived`（外加终态 `abandoned`）。
   不复刻 8 态——change 目录存在性 + 产物本身就是状态。
3. **状态只在磁盘**（`changes/<name>/.bridge.yaml`），路由每轮重算；
   不匹配当前消息的输入是**惰性的**（不碰状态文件），换对话/聊岔不丢不污染。
4. **触发 = skill description 自动路由 + 显式点名**。AGENTS.md 指针是可选的项目级加强，
   不是前置条件（空仓库测试）；将来可选 `init` 命令，口子已留（项目级 `.spec-bridge.yaml`）。

## 拒绝的备选

- **多入口守卫**（每个子 skill 自查前置条件）：规则散布、互相矛盾、新会话要复活每个入口。
  spec-superflow 自己也只是把它当二道防线，主路由仍是集中的。
- **8 态状态机**：`debugging`/`bridging`/`approved-for-build` 等细分态对单 change 流程是过度工程。

## 后果

- 正面：改路由只改一个文件；跨会话恢复确定性；乱输入不污染。
- 负面：入口 skill 是单点，它坏了整个桥接瘫痪——用 tests/ 里对入口 CLI 的回归用例对冲。
