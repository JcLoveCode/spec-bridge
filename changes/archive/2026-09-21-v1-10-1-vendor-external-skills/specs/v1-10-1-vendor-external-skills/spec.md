---
external: true
synthesized_by: to-spec (matt-skills)
status: ready-for-agent
capability: vendor-external-matt
---

# v1.10-1 Vendor External Matt Skills

> **性质**：外部 spec（matt to-spec 模板综合），bridge distill 跳过
> **来源**：当前对话上下文 + spec-bridge 仓库现状综合
> **目标**：把 6 个核心工程能力 skill 从 tt-a1i/matt-skills-with-to-goal vendor 到 spec-bridge 仓库

## Problem Statement

spec-bridge 当前在 README §1.2 导航员路由表中推荐用户去调 4 个外栈 skill（openspec / matt / superpowers / builtin），但 §1.3 承诺的 to-goal 集成**实际未交付**：用户找不到 `to-goal` 和 `goal-crafter` 的入口，必须自己装 matt-skills 插件才能用，断网/无插件场景下导航员推荐的路径直接失效。同时 README §1.3 误导用户以为"v1.7+ 已实装"，但仓库内既没有 to-goal 目录也没有相关 CLI 命令。

## Solution

把 6 个核心工程能力 skill 从上游 `tt-a1i/matt-skills-with-to-goal` vendor 到 `spec-bridge` 仓库的 `skills/external-matt/engineering/` 下：

| 搬运的能力 | 解决的读者痛点 |
|---|---|
| `to-spec` | 当前对话 → agent-ready spec（spec-bridge 一直推荐但用户找不到路径） |
| `to-tickets` | spec → 带 blocker 的 ticket（同上） |
| `to-goal` | 已批准来源 → 5 段交接单（补 §1.3 缺失） |
| `goal-crafter` | 模糊愿望 → 5 问澄清 + 可执行 goal（补 §1.3 缺失） |
| `spec-executor` | 隔离线程执行 spec（与 bridge execute 期对接） |
| `execute-spec-in-fork` | Codex App 编排适配器（与 bridge archive 流程对接） |

vendor 后，bridge probe 在推荐时输出 `advised_skill_path` 字段，AI 可二选一：调 `use_skill to-spec`（如插件装了）/ 直接读 `skills/external-matt/engineering/to-spec/SKILL.md`（vendor 内置，断网可用）。

## User Stories

1. 作为一个 spec-bridge 用户，我想在 bridge probe 推荐 `to-spec` 时同时拿到本地路径，这样断网/没装插件也能找到入口
2. 作为一个 spec-bridge 用户，我想在 README §1.3 看到"to-goal 已 vendor 到 `skills/external-matt/engineering/to-goal/SKILL.md`"，这样我知道去哪里学 5 段交接单格式
3. 作为一个 spec-bridge 贡献者，我想看 `VENDOR.md` 知道这 6 个 skill 的上游来源、许可证和同步策略，这样我能安全升级上游版本
4. 作为一个 AI agent，我想从 `bridge probe` 输出的 `advised_skill_path` 直接读 SKILL.md，不用依赖 use_skill 插件加载
5. 作为一个 spec-bridge 用户，我想在 SKILL.md §6 路由表里看到"推荐 `skills/external-matt/engineering/to-spec/SKILL.md`"，这样我能精准定位
6. 作为一个 spec-bridge 维护者，我想搬运过程零代码（纯 SKILL.md 复制），这样升级上游只需 git pull + 重同步
7. 作为一个 spec-bridge 用户，我想 probe 输出格式向前兼容（use_skill 路径仍可用），这样老用户的使用方式不变
8. 作为一个 spec-bridge 用户，我想 §1.3 改"已交付（v1.10）"而不是删掉，这样 §1.3 的设计思路（5 段交接单 + session recommendation）作为长期方向保留
9. 作为一个 spec-bridge 测试者，我想 probe 测试加 `advised_skill_path` 断言，这样 vendor 路径丢失立刻 fail
10. 作为一个 spec-bridge 用户，我想搬运目录独立命名 `external-matt/`（不混进 `skills/spec-bridge/`），这样升级 spec-bridge 不影响 vendor 内容

## Implementation Decisions

### D1：vendor 目录结构（独立命名 + 平铺）

新建 `skills/external-matt/`（不混进 `skills/spec-bridge/`），保留 matt 原仓库目录结构：

```
skills/external-matt/
├── README.md         ← 说明这是 vendor 目录
├── VENDOR.md         ← 上游来源 + 同步策略 + 许可证
├── LICENSE           ← 上游 MIT 许可证副本
└── engineering/
    ├── to-spec/SKILL.md
    ├── to-tickets/SKILL.md
    ├── to-goal/SKILL.md
    ├── goal-crafter/SKILL.md
    ├── spec-executor/SKILL.md
    └── execute-spec-in-fork/SKILL.md
```

**理由**：
- 独立命名 `external-matt/` 而非混进 `skills/spec-bridge/`：spec-bridge 升级不影响 vendor（vendor 走自己的同步策略）
- 平铺 `engineering/` 子目录：与上游一致，未来可加 `productivity/` 等

### D2：vendor 同步策略（手动 + 版本钉死）

- **手动同步**（非自动）：每次上游升级由维护者手动执行 `git fetch upstream + cp -r` + 写新 commit
- **版本钉死**：VENDOR.md 记录上游 commit hash + 版本号（`1.2.3-to-goal.2`），便于追踪
- **变更检测**：维护者下次升级时运行 `diff -rq upstream engineering/`，确保本地是上游真子集
- **不同步许可证以外的依赖**（如上游）的文档、CI 配置等

**理由**：vendor 模式要求"零修改 + 可重放"，手动同步保证审计链清晰；自动同步易引入意外修改。

### D3：probe 输出新字段 `advised_skill_path`（不影响旧字段）

`bridge probe` 输出在现有 `advised_invocation` 字段后新增一行：

```
advised_skill_path: skills/external-matt/engineering/to-spec/SKILL.md
```

**规则**：
- 当 advised_skill 为 `(none)`（bridge 无探测结果）时 → 不输出该字段
- 当 advised_skill 为外栈（如 `matt`）且 vendor 内置时 → 输出路径
- 当 advised_skill 为外栈但 vendor 未内置时 → 不输出该字段（仅保留 use_skill 路径）
- 当 advised_skill 为 `builtin` → 不输出该字段（bridge 不推荐 builtin）

**理由**：
- 向前兼容：`advised_invocation` 字段不变，老调用方不破坏
- 可选加载：AI 优先调 `use_skill`（插件已装），失败则 fallback 读文件
- 断网可用：路径是仓库内相对路径，无需网络

### D4：SKILL.md §6 路由表路径补全

`skills/spec-bridge/SKILL.md` §6 现有路由表改为：

| 对话意图 | bridge 推荐 |
|---|---|
| 想开始一个新功能 | `skills/external-matt/engineering/to-spec/SKILL.md`（如未装 matt 插件）或 `use_skill to-spec` |
| 想写代码 + TDD | 同上 + 仓库根 `skills/external-matt/engineering/tdd/`（v1.10+ 可选加）/ `use_skill tdd` |
| ... | ... |

**理由**：让用户/AI 在 SKILL.md 里直接看到路径，不依赖 use_skill 插件。

### D5：README §1.3 改状态

README.md §1.3 改为：

```markdown
### 1.3 跨 session 传递（to-goal 集成，**v1.10** vendor）

把当前工作编译成 portable execution goal，可丢给：

- **vendor 路径**：`skills/external-matt/engineering/to-goal/SKILL.md`（断网可用）
- **插件路径**：`use_skill to-goal`（如装 matt-skills 插件）

Goal block 五段 + Session recommendation：详见 vendor SKILL.md。
bridge 不重新发明 to-goal——直接 vendor 自 tt-a1i/matt-skills-with-to-goal，
许可证见 `skills/external-matt/VENDOR.md`。
```

**理由**：
- 不删 §1.3：保留 5 段交接单 + session recommendation 的设计思路
- 改状态：`v1.7+ 实装` → `v1.10 vendor`（事实正确）
- 双路径：vendor + use_skill，用户可选

### D6：boundary contract（与"纯桥不干活"哲学一致）

- ❌ **不动** `cmd-*` 任何 CLI 的逻辑（除 cmd-probe 加输出字段）
- ❌ **不写** to-goal 的"目标编译器"代码
- ❌ **不改** 4 件产物格式
- ❌ **不动** `.bridge.yaml` schema
- ❌ **不替 AI 加载** vendor SKILL.md（路径给到就行，加载是 AI 的事）

**理由**：bridge 是"目录管理员"，搬运 ≠ 实装；vendor SKILL.md 的执行由 AI/matt-skills 插件负责，bridge 只给路径。

## Testing Decisions

### T1：probe advised_skill_path 输出测试（4 场景）

新增 `tests/probe-vendor-path.test.mjs`，覆盖：

- **T1.1** advised_skill 为 `(none)` → 不输出 `advised_skill_path`
- **T1.2** advised_skill 为外栈且 vendor 内置 → 输出路径
- **T1.3** advised_skill 为外栈但 vendor 未内置 → 不输出该字段
- **T1.4** advised_skill 为 `builtin` → 不输出该字段

### T2：vendor 目录完整性测试（3 场景）

新增 `tests/vendor-external-matt.test.mjs`，覆盖：

- **T2.1** `skills/external-matt/` 下存在 6 个 SKILL.md（to-spec / to-tickets / to-goal / goal-crafter / spec-executor / execute-spec-in-fork）
- **T2.2** VENDOR.md 包含上游 commit hash + 版本号 + 许可证声明
- **T2.3** LICENSE 文件存在且包含 MIT 字样

### T3：v1.9 探测 fallback 不破坏（1 场景）

确保 v1.9-2 引入的"stacks 配置优先 + 探测 fallback"逻辑仍工作：
- `bridge probe` 在 advised_skill 为 `(none)` 时仍正确输出 fallback 文案

### T4：测试 seam（接缝）

- **CLI exit code**：0 / 1 / 2
- **.bridge.yaml 字段**：不动
- **stdout 末行文本**：新增 `advised_skill_path:` 行（仅 advised_skill 有值时）
- **vendor 文件存在**：readFileSync 验证

## Out of Scope

- ❌ **搬运全部 23 个 skill**：本 change 只搬 6 个核心；其余 17 个（tdd/code-review/diagnosing-bugs 等）按需追加到 v1.10+ 后续
- ❌ **自动化 vendor 同步**：手动同步（见 D2），自动同步是独立 change
- ❌ **vendor 内容修改**：0 行修改（与上游完全一致）
- ❌ **bridge init 自动创建 vendor 目录**：零配置哲学，vendor 是显式行为
- ❌ **CLI 子命令 `bridge goal`**：to-goal 是 AI skill 不是 CLI 命令

## Further Notes

### ADR-0017 待写

开 v1.10-1 时同步写 `skills/spec-bridge/docs/adr/0017-vendor-external-matt.md`，记录：
- D1 独立命名 `external-matt/` 的理由
- D2 手动同步策略的理由
- D3 advised_skill_path 字段的设计权衡
- 引用 AGENTS.md §5 "不要为 to-goal 写新引擎——直接 vendor"

### 关键术语映射

| 工程术语 | 业务话术 |
|---|---|
| vendor | 搬运（把上游文件原样复制下来，零修改） |
| probe advised_skill_path | "导航员告诉你去哪读那份指引" |
| fallback | 兜底（首选失败后用的备胎） |

## SPEC READY

```text
SPEC READY

- Status: ready for implementation
- Source: changes/v1-10-1-vendor-external-skills/specs/v1-10-1-vendor-external-skills/spec.md
- Repository: spec-bridge
- Baseline: 3625aec (v1.9 系列 + .idea/ ignore)
- Test seam: cmd-probe stdout 末行格式 + vendor 文件存在
- Non-goals: 不搬其余 17 skill / 不自动同步 / 不改 4 件产物 / 不加 CLI
- External authority: 默认无授权（git add/commit/push 需用户拍板）
- Next route: fork + /spec-executor (1-2 文件改动，可在单 context 完成)
```