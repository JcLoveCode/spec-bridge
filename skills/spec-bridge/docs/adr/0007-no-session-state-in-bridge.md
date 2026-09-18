# 桥不存会话，提及命令是唯一信号入口

会话级模式检测（"同一会话内第二次提及同类问题即提示"）需要判定会话连续性，但这是 agent 的能力，CLI 无法可靠检测压缩。桥**不持久化任何会话状态**；agent 在 SKILL.md 协议硬性约束下调 `bridge mention --tag <t> --ref <change>`（通用入口）或 `bridge rootcause`（结构化入口）记录信号。mention 是协议硬性步骤，必须稳定触发；桥检测 tag 频次并 stdout 提示，不自动开变更。

## Considered Options

- **`.bridge-session.json` 存会话**：被否——桥多一个 session 轴，职责模糊；会话连续性本来就是 agent 的责任（matt-skills 同此设计）。
- **自动聚类检测**（扫 commit/spec diff 推断相似度）：被否——噪音大，"不一致"可能只是文档滞后。

## Consequences

- 会话被压缩后重提同类问题会再次触发提示——可接受的退化，不是缺陷。
- tag 起步用自由文本；预设词表延后（词表会变噪音）。
- 提示是信号不是决策：开不开 follow-up 由人决定（与 ADR-0004 导航员定位一致）。
