# Vendor: External Matt Skills

> **用途**：记录 `skills/external-matt/` 下所有 vendor 内容的来源、同步策略、许可证和升级协议。

## 上游来源

| 项 | 值 |
|---|---|
| **上游仓库** | https://github.com/tt-a1i/matt-skills-with-to-goal |
| **上游作者** | tt-a1i（fork 自 mattpocock/skills v1.1） |
| **上游原版权** | Matt Pocock |
| **当前 vendor 版本** | `1.2.3-to-goal.2` |
| **当前 vendor commit** | `3cca18b`（2026-09-04 同步） |
| **许可证** | MIT（详见 `LICENSE`） |

## Vendor 目录结构

```
skills/external-matt/
├── README.md         ← 本目录说明
├── VENDOR.md         ← 上游来源 + 同步策略 + 升级协议
├── LICENSE           ← 上游 MIT 许可证副本
└── engineering/      ← 与上游目录结构对齐
    ├── to-spec/SKILL.md
    ├── to-tickets/SKILL.md
    ├── to-goal/SKILL.md
    ├── goal-crafter/SKILL.md
    ├── spec-executor/SKILL.md
    └── execute-spec-in-fork/SKILL.md
```

## 已 vendor 的 Skill

| Skill | 业务用途 | 行数 |
|---|---|---|
| `to-spec` | 当前对话 → agent-ready spec | 98 |
| `to-tickets` | spec → 带 blocker 的 ticket | 115 |
| `to-goal` | 已批准来源 → 5 段交接单（**补 README §1.3 缺失**） | 186 |
| `goal-crafter` | 模糊愿望 → 5 问澄清 + 可执行 goal（**补 README §1.3 缺失**） | 207 |
| `spec-executor` | 隔离线程执行 spec 并返回 receipt | 85 |
| `execute-spec-in-fork` | Codex App 编排适配器 | 105 |

**未 vendor 的 Skill**（按需追加到 v1.10+ 后续）：
- `tdd`、`code-review`、`diagnosing-bugs`、`implement`（执行纪律类）
- `codebase-design`、`improve-codebase-architecture`、`domain-modeling`、`triage`（强依赖项目 context）
- `ask-matt`、`setup-matt-pocock-skills`（路由/配置，与 spec-bridge probe 重叠）

## 同步策略（手动）

按 v1.10-1 ADR-0017 D2：**手动同步**，非自动。

### 同步流程

```bash
# 1. 拉取上游最新
cd /tmp && git clone https://github.com/tt-a1i/matt-skills-with-to-goal.git upstream-matt
cd upstream-matt && git log -1 --format="%H %s"  # 记录最新 commit

# 2. 验证本地是上游真子集
diff -rq skills/engineering/ /Users/fujunchuan/IdeaProjects/spec-bridge/skills/external-matt/engineering/

# 3. 复制新版本（覆盖式）
cp -r skills/engineering/<new-skill>/ /Users/fujunchuan/IdeaProjects/spec-bridge/skills/external-matt/engineering/

# 4. 更新本 VENDOR.md
# - 修改"当前 vendor 版本"
# - 修改"当前 vendor commit"

# 5. 提交
cd /Users/fujunchuan/IdeaProjects/spec-bridge
git add skills/external-matt/
git commit -m "vendor: sync external-matt to <version>"
```

### 升级检查清单

- [ ] 上游 commit hash 记录在本文件
- [ ] 上游版本号记录在本文件
- [ ] LICENSE 副本与上游一致（`diff` 验证）
- [ ] SKILL.md 副本与上游一致（`diff -rq` 验证）
- [ ] spec-bridge 端到端测试通过（`npm test`）
- [ ] README §1.3 / SKILL.md §6 路由表引用路径未失效

## 设计原则（与 spec-bridge 哲学一致）

1. **vendor ≠ 实装**（AGENTS.md §5）：bridge 不写 to-goal 编译逻辑
2. **0 修改原则**（ADR-0017 C5）：vendor 内容与上游完全一致
3. **独立命名**（ADR-0017 D1）：`external-matt/` 不混进 `skills/spec-bridge/`
4. **可选加载**（ADR-0017 D3）：用户优先调 `use_skill`（如插件装了），失败 fallback 读 vendor 文件

## 已知遗留

- 上游 `productivity/` 和 `misc/` 目录未 vendor（按需追加）
- 上游 `deprecated/` 目录不 vendor（已废弃内容）

## 变更历史

| 日期 | 版本 | commit | 操作 |
|---|---|---|---|
| 2026-09-21 | 1.2.3-to-goal.2 | 3cca18b | 首次 vendor 6 个核心 skill（v1.10-1） |