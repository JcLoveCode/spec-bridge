# ADR-0017: Vendor External Matt Skills（搬运外栈能力）

> **状态**：accepted（v1.10-1 实装）
> **日期**：2026-09-21
> **作者**：AI + 用户拍板（β/α/α）
> **范围**：spec-bridge 仓库的 `skills/external-matt/` 目录 + probe 加 advised_skill_path 字段 + SKILL.md §6.1.1 + README §1.3

## 背景

spec-bridge README §1.2 导航员路由表推荐用户去调 4 个外栈 skill（openspec / matt / superpowers / builtin），但 §1.3 承诺的 to-goal 集成**实际未交付**：

- 用户找不到 `to-goal` / `goal-crafter` 的入口
- 必须自己装 matt-skills 插件才能用，断网/无插件场景下导航员推荐的路径直接失效
- README §1.3 误导用户以为"v1.7+ 已实装"，但仓库内既没有 to-goal 目录也没有相关 CLI 命令

用户的反馈：

> "实装简化版本吧。但是看看 `skills/engineering/` 下面的能力，那些是搬运的能力，搬运这件事其实也是要搭桥的，这个做是 agent 和 agent 之间做。和'纯桥不干活'哲学逻辑不冲突，是补充。"

核心矛盾：
- "纯桥不干活"哲学禁止 bridge 自己实现 to-goal 编译逻辑（AGENTS.md §5）
- 但"导航员优先"哲学要求 bridge 主动推荐外栈 skill（ADR-0001）
- 解决：bridge 不实现，bridge 搬运——给 AI/用户指路

## 决策

### D1：vendor 目录结构（独立命名 + 平铺）

新建 `skills/external-matt/`（**不混进 `skills/spec-bridge/`**），保留 matt 原仓库目录结构：

```
skills/external-matt/
├── README.md
├── VENDOR.md
├── LICENSE
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

**权衡**：
- 备选 A：混进 `skills/spec-bridge/skills/external-matt/`（缺点：spec-bridge 升级会带走 vendor 内容；用户 git pull 时易混淆）
- 备选 B：作为 git submodule（缺点：增加仓库复杂度；用户 clone 后易忘记 init）

### D2：vendor 同步策略（手动 + 版本钉死）

- **手动同步**（非自动）：每次上游升级由维护者手动执行 `git fetch upstream + cp -r` + 写新 commit
- **版本钉死**：VENDOR.md 记录上游 commit hash + 版本号（`1.2.3-to-goal.2`），便于追踪
- **变更检测**：维护者下次升级时运行 `diff -rq upstream engineering/`，确保本地是上游真子集
- **不同步许可证以外的依赖**：上游文档、CI 配置等不复制

**理由**：
- vendor 模式要求"零修改 + 可重放"，手动同步保证审计链清晰
- 自动同步（如 git subtree）易引入意外修改，难以审计

**权衡**：
- 备选：git subtree 自动同步（缺点：引入外部依赖；vendor 内容与上游的对应关系模糊）

### D3：probe 输出新字段 `advised_skill_path`

`bridge probe` 输出在现有 `advised_invocation` 字段后新增一行：

```
advised_skill_path: skills/external-matt/engineering/to-spec/SKILL.md
```

**规则**：
- advised_skill=`(none)` → 不输出该字段
- advised_skill=外栈（matt/openspec/superpowers）且 vendor 内置 → 输出路径
- advised_skill=外栈但 vendor 未内置 → 不输出该字段（仅保留 use_skill 路径）
- advised_skill=builtin → 不输出该字段

**理由**：
- **向前兼容**：`advised_invocation` 字段不变，老调用方不破坏
- **可选加载**：AI 优先调 `use_skill`（插件已装），失败则 fallback 读文件
- **断网可用**：路径是仓库内相对路径，无需网络

**权衡**：
- 备选 A：同时输出 `use_skill_path`（统一字段名）—— 缺点：模糊 use_skill 和 vendor 路径的语义
- 备选 B：把路径作为 `advised_invocation` 的子字段（嵌进 use_skill 行）—— 缺点：破坏现有解析逻辑

### D4：SKILL.md §6.1.1 vendor 路径表

`skills/spec-bridge/SKILL.md` §6.1 后新增 §6.1.1 段，列出所有 vendor 路径对照表：

| use_skill 路径 | vendor 路径 |
|---|---|
| `use_skill to-spec` | `skills/external-matt/engineering/to-spec/SKILL.md` |
| `use_skill to-tickets` | `skills/external-matt/engineering/to-tickets/SKILL.md` |
| `use_skill to-goal` | `skills/external-matt/engineering/to-goal/SKILL.md` |
| `use_skill goal-crafter` | `skills/external-matt/engineering/goal-crafter/SKILL.md` |
| `use_skill spec-executor` | `skills/external-matt/engineering/spec-executor/SKILL.md` |
| `use_skill execute-spec-in-fork` | `skills/external-matt/engineering/execute-spec-in-fork/SKILL.md` |

**理由**：让用户/AI 在 SKILL.md 里直接看到路径，不依赖 use_skill 插件加载。

### D5：README §1.3 改状态

README §1.3 改为：

```markdown
### 1.3 跨 session 传递（to-goal 集成，**v1.10** vendor）
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

**理由**：
- bridge 是"目录管理员"，搬运 ≠ 实装
- vendor SKILL.md 的执行由 AI/matt-skills 插件负责，bridge 只给路径
- AGENTS.md §5 明确："不要为 to-goal 写新引擎——直接 vendor 抄过来"

## 影响

### 受益

- ✅ 补 README §1.3 缺失承诺（to-goal 现在真的有路径）
- ✅ bridge probe 推荐更完整（多了 vendor 路径，断网可用）
- ✅ spec-bridge 用户断网/无插件也能用 to-goal / goal-crafter
- ✅ 维护者升级上游有清晰的同步策略

### 风险

- ⚠️ vendor 文件可能与上游未来版本漂移 → VENDOR.md 版本钉死 + 手动同步
- ⚠️ probe advised_skill_path 可能影响老调用方 → 保留 advised_invocation 字段不动
- ⚠️ 搬运路径错误导致用户找不到文件 → VENDOR.md 路径表 + 测试覆盖
- ⚠️ 上游许可证变更 → LICENSE 副本 + VENDOR.md 许可证声明 + 升级时复核

## 备选方案（被拒）

### 方案 1：实现 to-goal 编译器（不 vendor）
- ❌ 违反 AGENTS.md §5"不要为 to-goal 写新引擎"
- ❌ 与"纯桥不干活"哲学冲突
- ❌ 工作量巨大（5 段交接单 + session recommendation 至少 500+ 行代码）

### 方案 2：要求用户自己装 matt-skills 插件
- ❌ 违反"零配置"铁律（用户必须装插件才能用 bridge 推荐的路径）
- ❌ 断网/无插件场景直接失效

### 方案 3：用 git subtree 自动同步
- ❌ 引入外部依赖（git subtree 工具）
- ❌ vendor 内容与上游的对应关系模糊
- ❌ 手动同步的审计链更清晰

## 验证

- ✅ T1（probe-vendor-path.test.mjs）：4/4 全绿（4 场景覆盖 D3 规则）
- ✅ T2（vendor-external-matt.test.mjs）：3/3 全绿（vendor 完整性）
- ✅ T3（v1.9-2 fallback 不破坏）：已有 v1.9-2 测试覆盖
- ✅ 不破坏 v1.7-v1.9 既有测试（4 改 1 加）

## 参考

- AGENTS.md §5：不要为 to-goal 写新引擎——直接 vendor 抄过来
- ADR-0001：prompt 管判断，代码管操作（bridge 是导航员）
- ADR-0011：bridge-as-navigator default routing
- ADR-0015：remove-auto-detect（探测降为 fallback）
- ADR-0016：context-aware-navigator（lastUsedStack）
- 上游：https://github.com/tt-a1i/matt-skills-with-to-goal（commit `3cca18b`，2026-09-04）
- ponytail：https://github.com/DietrichGebert/ponytail（v1.9 命令面板灵感来源）