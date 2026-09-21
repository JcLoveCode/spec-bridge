# v1.10-1 Design Decisions

> 外部 spec 的 design（matt 模板未要求 design.md，但 bridge distill 需要 Decisions 段）。
> 本文件只含**为什么这样做**的决策段，让 `bridge distill` 能产出 why.md。

## Decisions（distill 源）

### Decision 1：只搬 6 个核心 skill（不搬全部 23 个）

- **为什么**：用户的拍板（β 选项），核心 6 个已覆盖 README §1.2 路由表 + §1.3 缺失承诺；其余 17 个（tdd/code-review 等）按需追加
- **影响**：vendor 目录小、可控；后续 v1.10+ 可增量加
- **替代方案**：一次搬全部 23 个（缺点：vendor 目录膨胀；上游升级成本高）

### Decision 2：vendor 目录独立命名 `skills/external-matt/`

- **为什么**：与"纯桥不干活"哲学一致——bridge 是"目录管理员"，搬运 ≠ 实装；spec-bridge 升级不影响 vendor（vendor 走自己的同步策略）
- **影响**：升级 spec-bridge 不影响 vendor 内容；用户 git pull 时易区分
- **替代方案 A**：混进 `skills/spec-bridge/skills/external-matt/`（缺点：spec-bridge 升级会带走 vendor；用户易混淆）
- **替代方案 B**：git subtree 自动同步（缺点：引入外部依赖；vendor 内容与上游对应关系模糊）

### Decision 3：probe 加 advised_skill_path 字段（不动 advised_invocation）

- **为什么**：向前兼容（老调用方不破坏）+ AI 可选加载（优先 use_skill，失败 fallback 读文件）+ 断网可用
- **影响**：probe 输出多 1 行（仅 advised_skill 有值时）；4 场景规则：(none)/builtin/openspec/superpowers 不输出，matt 输出
- **替代方案**：把路径作为 advised_invocation 子字段（缺点：破坏现有解析逻辑）

### Decision 4：手动同步策略（不自动）

- **为什么**：vendor 模式要求"零修改 + 可重放"，手动同步保证审计链清晰；自动同步（如 git subtree）易引入意外修改
- **影响**：维护者下次升级上游时手动 `cp -r` + 写新 commit；版本钉死在 VENDOR.md
- **替代方案**：自动同步脚本（缺点：引入自动化逻辑；出错时难以审计）

### Decision 5：bridge 不实现 to-goal 编译逻辑（AGENTS.md §5）

- **为什么**：与"纯桥不干活"哲学一致；to-goal 是 matt 的责任不是 bridge 的责任；AGENTS.md §5 明确禁止
- **影响**：bridge 只给路径，不替 AI 加载 vendor SKILL.md；加载由 AI/matt-skills 插件负责
- **替代方案**：bridge 自己实现 to-goal 编译器（缺点：500+ 行代码；与哲学冲突；工作量巨大）

## Constraints（蒸馏源）

- 搬运内容 0 行修改（与上游完全一致）
- 不动 `cmd-*` 其他 CLI 逻辑（除 cmd-probe 加输出字段）
- 不改 4 件产物格式
- 不动 `.bridge.yaml` schema