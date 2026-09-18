# why — cli capability

> 单向蒸馏产物（ADR-0003）：只读 `changes/` + 基线，只写本文件，永不写 spec.md。
> 每条 = 结论 + 溯源 + `spec-rev`（发布回执的 source_hash，供陈旧判定）。
> 权威源：`changes/archive/2026-09-17-v1_1-bridge-init/design.md ## Decisions`。

## `bridge init` 命令（v1.1）的决策依据

### 为什么每个子命令一个文件？

结论：`cmd-init.mjs` 独立于 `bridge.mjs`，与 vendored 的 `cmd-sync.mjs` 对称。`bridge.mjs` 只做路由分发，350 行是硬上限——防止入口文件膨胀回 spec-superflow 那种 8 态机器（ADR-0001 拒绝过的路线）。
溯源：[design.md D1](../../changes/archive/2026-09-17-v1_1-bridge-init/design.md)
spec-rev: sha256:47d7664a6c3225d6abfbf13fae48aab27b713d08d22d646fe879a2f1988c9c39

### 为什么模板内嵌代码而不是外部模板文件？

结论：模板作为 ES module string constants（`PROPOSAL_TEMPLATE` 等 5 个）。零依赖、零文件副作用（不引入 `templates/` 目录）；产物 hash 只盖 proposal/design/tasks/specs/contract，不盖模板。代价是改模板要改代码——可接受，因为模板是 ASCII 骨架，不是 schema。
溯源：[design.md D2](../../changes/archive/2026-09-17-v1_1-bridge-init/design.md)
spec-rev: sha256:47d7664a6c3225d6abfbf13fae48aab27b713d08d22d646fe879a2f1988c9c39

### 为什么已存在 change 时直接拒绝而不是覆盖？

结论：`existsSync` → stderr 报 `already exists` + exit 3（与 usage=2 / runtime=1 区分）。这是 SKILL.md §4"惰性原则"的落点：不匹配的输入不创建、不修改任何状态。已存在的 change 被悄悄重置是最坏故障模式。独立退出码让脚本调用方可以精确分流。
溯源：[design.md D3](../../changes/archive/2026-09-17-v1_1-bridge-init/design.md)
spec-rev: sha256:47d7664a6c3225d6abfbf13fae48aab27b713d08d22d646fe879a2f1988c9c39

### 为什么 capability 默认值 = 目录名？

结论：首个 change 没有"最近邻 capability"可参考；规则必须简单可预测（目录名小写化）。`--capability` 一行参数可覆盖。扫描 `specs/` 猜最近邻是过度智能。
溯源：[design.md D4](../../changes/archive/2026-09-17-v1_1-bridge-init/design.md)
spec-rev: sha256:47d7664a6c3225d6abfbf13fae48aab27b713d08d22d646fe879a2f1988c9c39

### 为什么 init 不写 hash、不调 sync/verify？

结论：planning 阶段产物尚未稳定，提前写 `artifacts_hash` 是反向操作——hash 与回执属于 contracted→executing→archived 阶段（契约批准门之后才有意义）。这条边界让 `hashes --check` 的语义保持干净：它只对已批准的契约负责。
溯源：[design.md D5](../../changes/archive/2026-09-17-v1_1-bridge-init/design.md)
spec-rev: sha256:47d7664a6c3225d6abfbf13fae48aab27b713d08d22d646fe879a2f1988c9c39

### 为什么项目根探测是 git 优先 + 向上 walk 兜底？

结论：`git rev-parse --show-toplevel` 是最常见情形（人在仓库根或子目录）；向上找含 `changes/` 的祖先覆盖 worktree/裸目录；都失败回退 cwd 并在 stderr 提示。探测失败**不阻塞创建**——standalone 布局自举：首个 change 落盘即确立布局，这是"空仓库测试"（CONTEXT.md）能成立的前提。
溯源：[design.md D6](../../changes/archive/2026-09-17-v1_1-bridge-init/design.md)
spec-rev: sha256:47d7664a6c3225d6abfbf13fae48aab27b713d08d22d646fe879a2f1988c9c39

### 为什么 stdout 只输出路径 + 一行 next hint？

结论：脚本友好（`DIR=$(bridge init foo | head -1)` 即取路径）；人眼好读；stderr 只留给告警/错误，CI 抓 warning 不会被污染。
溯源：[design.md D7](../../changes/archive/2026-09-17-v1_1-bridge-init/design.md)
spec-rev: sha256:47d7664a6c3225d6abfbf13fae48aab27b713d08d22d646fe879a2f1988c9c39

### 为什么不做 --interactive 引导填模板？

结论：交互式 prompt 会让 CLI 行为依赖 stdio（破坏脚本调用确定性）；且 prompt 内容因 change 类型而异，无法通用。模板给骨架、人手填内容——"prompt 管判断，代码管操作"的边界不 blur。
溯源：[design.md Out-of-scope decisions](../../changes/archive/2026-09-17-v1_1-bridge-init/design.md)
spec-rev: sha256:47d7664a6c3225d6abfbf13fae48aab27b713d08d22d646fe879a2f1988c9c39

## 过程教训（来自 progress.md，非 Decisions 但值得沉淀）

- spec 起草时会臆想不存在的失败路径（R3 的"layout 探测失败"）：实现碰撞发现后走 hash 重锁 + 重新批准修正。内容级 hash 门不是官僚步骤，是真实防线。
- 先实现后测试的偏差被如实记录而非掩盖——回执的"Risks and remaining work"是唯一正确的去处。

## v1.2 navigator-architect 的决策依据

### 为什么 workflow_kind 是顶层单值而不是复用 capabilities？

结论：capabilities 是"哪些槽位谁供职"（能力快照，可逗号多项）；workflow_kind 是"这条变更走哪条流程线"（单值声明）。语义不同分开存；顶层字段 grep 友好。三级推导（显式 > capabilities 首值 ∈ 值域 > builtin）让旧用法零迁移。
溯源：[design.md D1](../../changes/archive/2026-09-18-v1-2-navigator-architect/design.md)（ADR-0004）
spec-rev: sha256:fd27d4517923a9ff737f2ec9d5337bc090cb3d6bcdfb03d3643f02f460ff4bbd

### 为什么 bridge next 纯读、不写状态？

结论：导航员的职责是"告知"，不是"记录"——写 next 字段是 `state next` 的职责。next 命令只消费状态 + 按 stage 查表输出建议，这让它能随时随便跑无副作用，成为最安全的用户入口。
溯源：[design.md D2](../../changes/archive/2026-09-18-v1-2-navigator-architect/design.md)（ADR-0004）
spec-rev: sha256:fd27d4517923a9ff737f2ec9d5337bc090cb3d6bcdfb03d3643f02f460ff4bbd

### 为什么 follow-up 是普通 change + parent 快照，而不是新目录结构？

结论：CLI 结构零新增 = 零学习成本；`parent_artifacts_hash` 快照让版本链可重放（父归档改名后仍可溯源）。父必已归档的校验在 init 时一次完成。
溯源：[design.md D3](../../changes/archive/2026-09-18-v1-2-navigator-architect/design.md)（ADR-0005）
spec-rev: sha256:fd27d4517923a9ff737f2ec9d5337bc090cb3d6bcdfb03d3643f02f460ff4bbd

### 为什么 patching 是 stage 值而不是新状态机拓扑？

结论：ADR-0001 拒绝状态机膨胀；patching 的全部特殊语义 = "parent 必填且父已归档"，一条转换校验（state set 入口）足够表达。拓扑保持线性 + 旁路值。
溯源：[design.md D4](../../changes/archive/2026-09-18-v1-2-navigator-architect/design.md)（ADR-0005）
spec-rev: sha256:fd27d4517923a9ff737f2ec9d5337bc090cb3d6bcdfb03d3643f02f460ff4bbd

### 为什么归档写保护只守 CLI 边界？

结论：桥能守住的边界是命令入口（sync exit 4 / state set 白名单 / hashes 提示续作）；文件级编辑归 git 管辖，桥不越权。"拒绝悄悄改"比"物理不可改"更诚实。
溯源：[design.md D5](../../changes/archive/2026-09-18-v1-2-navigator-architect/design.md)（ADR-0005）
spec-rev: sha256:fd27d4517923a9ff737f2ec9d5337bc090cb3d6bcdfb03d3643f02f460ff4bbd

### 为什么 mention 只记台账历史、不存会话状态？

结论：会话连续性是 agent 的能力，CLI 无法可靠检测压缩（ADR-0007 的核心判断）。桥记 .bridge.log 历史 + 全库计数 + N≥2 提示；"会话内第二次"由 SKILL.md 硬性步骤保证。压缩后重提触发重复提示是记录在案的退化，不是 bug。
溯源：[design.md D7](../../changes/archive/2026-09-18-v1-2-navigator-architect/design.md)（ADR-0007）
spec-rev: sha256:fd27d4517923a9ff737f2ec9d5337bc090cb3d6bcdfb03d3643f02f460ff4bbd

### 为什么 rebuttal 不调 appendEvent？

结论：appendEvent 会连带刷新 .bridge.yaml 的 last_event——违反 R7"零状态变更"。改为直接 appendFileSync 写 .bridge.log。这个坑是测试咬出来的（B6 审查记录）：台账"日志追加"与"状态变更"是两个动作，appendEvent 混合了它们。
溯源：[progress.md Batch 6](../../changes/archive/2026-09-18-v1-2-navigator-architect/progress.md)
spec-rev: sha256:fd27d4517923a9ff737f2ec9d5337bc090cb3d6bcdfb03d3643f02f460ff4bbd
