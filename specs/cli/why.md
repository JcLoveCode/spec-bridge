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
