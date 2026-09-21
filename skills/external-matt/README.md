# External Matt Skills（vendor 目录）

> **状态**：vendor 自 [tt-a1i/matt-skills-with-to-goal](https://github.com/tt-a1i/matt-skills-with-to-goal)
> **许可证**：MIT（详见 `LICENSE`）
> **当前版本**：`1.2.3-to-goal.2`（commit `3cca18b`）

## 这是什么

本目录是 spec-bridge 的**外栈能力搬运区**——把 matt-skills 仓库的核心工程能力 skill 完整复制过来，让 spec-bridge 用户**断网/无插件也能用**：

- `bridge probe` 推荐时输出 `advised_skill_path` 字段（指向本目录的 SKILL.md）
- AI 可二选一：调 `use_skill to-spec`（如插件装了）/ 直接读 `skills/external-matt/engineering/to-spec/SKILL.md`

## 与"纯桥不干活"哲学的关系

搬运 ≠ 实装。bridge 不写 to-goal 编译逻辑，不改 SKILL.md 内容，只给 AI/用户指路。详细论证见 ADR-0017。

## 已 vendor 的能力

| Skill | 一句话用途 | 路径 |
|---|---|---|
| `to-spec` | 当前对话 → agent-ready spec | `engineering/to-spec/SKILL.md` |
| `to-tickets` | spec → 带 blocker 的 ticket | `engineering/to-tickets/SKILL.md` |
| `to-goal` | 已批准来源 → 5 段交接单 | `engineering/to-goal/SKILL.md` |
| `goal-crafter` | 模糊愿望 → 5 问澄清 + goal | `engineering/goal-crafter/SKILL.md` |
| `spec-executor` | 隔离线程执行 spec | `engineering/spec-executor/SKILL.md` |
| `execute-spec-in-fork` | Codex App 编排适配器 | `engineering/execute-spec-in-fork/SKILL.md` |

## 使用方式

### 方式 A：调 use_skill（插件路径）
```bash
# 如已装 matt-skills 插件
use_skill to-spec
use_skill to-goal
```

### 方式 B：读 vendor 文件（断网路径）
```bash
# AI 直接读 SKILL.md（无需插件）
cat skills/external-matt/engineering/to-spec/SKILL.md
```

## 同步上游

详见 `VENDOR.md`（手动同步策略）。

## 许可证

本目录所有 vendor 内容版权归 Matt Pocock 所有，按 MIT 许可证授权。完整许可证文本见 `LICENSE`。