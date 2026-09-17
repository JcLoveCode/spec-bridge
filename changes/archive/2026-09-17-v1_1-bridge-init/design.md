# Design: bridge init 命令

## Purpose

`bridge init` 是单入口路由 spec-bridge 的"开 change"子命令。它的存在把开 change 从 5 步手动折叠成 1 步，机械重复的事归代码管，决策性的事归人手——这是 spec-bridge 的核心铁律（SKILL.md "prompt 管判断，代码管操作"）在本动作面的具体落点。

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ bridge.mjs                                                       │
│   argv parsing → command dispatch                                │
│   if command === 'init': await runInit(rest, {stdout, stderr})   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ scripts/cmd-init.mjs  (new — symmetric to cmd-sync.mjs)          │
│   run(args, {stdout, stderr})                                    │
│     1. detectProjectRoot(cwd)                                    │
│     2. detectLayout(projectRoot)  ← reuses from bridge.mjs       │
│     3. validateName(name)                                        │
│     4. existsSync(changeDir) → fail if true                      │
│     5. mkdir -p changeDir + changeDir/specs/<cap>                │
│     6. writeFile 5 template files                                │
│     7. bridge-state.mjs writeState + appendEvent                │
│     8. stdout: "<path>\n<one-line next hint>"                    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ scripts/vendor/bridge-state.mjs  (existing — no changes)         │
│   readState / writeState / appendEvent / updateField             │
└──────────────────────────────────────────────────────────────────┘
```

数据流：用户消息 → bridge.mjs 路由 → runInit → 模板写入 + state 写入 → stdout 路径提示 → 用户进入 planning 后续编辑。

## Decisions

### D1 — 单文件 `cmd-init.mjs`（不重构成模块）

**选项**：嵌入 bridge.mjs / 拆出独立 cmd-init.mjs / 拆出 lib/ 子目录
**决定**：独立 `scripts/cmd-init.mjs`，与现有 `cmd-sync.mjs` 对齐。
**理由**：现状 5 个 vendored + 1 个自写文件已经分得清；增加 cmd-init.mjs 后模式 = 每个 CLI 子命令一个文件。bridge.mjs 仅负责路由，单文件 < 350 行是硬上限（防膨胀回 8 态机器）。

### D2 — 模板嵌在代码里（不放外部模板文件）

**选项**：模板作为 string literals / 外部 .md 模板文件 / 走 npm package 模板
**决定**：模板作为 ES module export 的 string constants（`PROPOSAL_TEMPLATE` / `DESIGN_TEMPLATE` / `TASKS_TEMPLATE` / `SPEC_TEMPLATE` / `CONTRACT_TEMPLATE`）。
**理由**：零依赖、零文件副作用（不创建 `templates/` 子目录）；后续 hash 计算也只走产物 hash 不走模板 hash。代价是改模板要改代码——可接受，因为这是 schema-less 的最小模板，不是 schema。

### D3 — 已存在检测走 hard fail，不覆盖

**选项**：直接覆盖 / 报错退出 / 询问用户
**决定**：`fs.existsSync(changeDir)` → 报 `"change '<name>' already exists at <path>"`，exit code 3（区别于 usage=2 / runtime=1）。
**理由**：SKILL.md §4 的"惰性原则"+ 不匹配的输入不创建不修改——已存在的 change 不应被悄悄重置。3 退出码给脚本调用方明确信号（`grep -P '\b3\b'` 就能过滤）。

### D4 — capability 默认值 = 目录名小写 + 简化（不自动 detect 已有 capability）

**选项**：默认 `cli` / 默认 = 目录名 / 扫 specs/ 已存在的 capability 取最近邻
**决定**：默认 = 目录名（取最后一段，转小写、去 `_`、保留 `-`）；`--capability <name>` 可覆盖。
**理由**：第一个 change 没有"最近邻"可言；规则简单可预测；用户覆盖一行参数。

### D5 — `init` 不写 receipts、不调 sync/verify、不写 hashes

**决定**：`init` 只写 `.bridge.yaml` 的 stage/layout/branch/capabilities + `.bridge.log` 第一行；不调 `bridge hashes`、不调 `sync`、不调 `verify`。
**理由**：planning 阶段产物尚未稳定，hash 早写是无意义的；hash 与回执属于 contracted→executing→archived 阶段。SKILL.md §3 的执行器协议明确：`hashes --check` 是执行前的硬门，init 还没过契约批准门，写 hash 是反向。

### D6 — 项目根探测：git toplevel 优先，向上 walk 含 `changes/` 的祖先兜底

**选项**：只用 cwd / 只用 git toplevel / git+walk 兜底 / 强制要求 `--project-root`
**决定**：`spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd })` → 若 stdout 非空且该目录含 `changes/` 或 `openspec/`，用之；否则从 cwd 向上 `statSync` 找含 `changes/` 的祖先目录（最深 10 层防 runaway）；否则用 cwd（layout 探测在该目录同步会打印"未识别 layout"）。
**理由**：单仓库常用人即在仓库根；worktree / 子目录执行也常见；不强制 `--project-root` 是为减少摩擦。失败 fallback = cwd 让脚本仍能创建一个名为 `<name>` 的目录在用户指定位置，错误信息由后续 layout 探测打印。

### D7 — `init` 的输出格式：stdout 路径 + 一行 next hint

**决定**：成功路径 stdout 输出 `<changeDir>\n<one-line next hint>`，stderr 不写。
**理由**：脚本友好（可 `BRIDGE_DIR=$(node bridge init foo | head -1)`）；人眼也好读；不污染 stderr 利于 CI 抓 warning。

## Out-of-scope decisions（明确不做的）

- **不做 `--interactive` 模板填充** —— 模板是空骨架，编辑仍走人手。理由：交互式 prompt 会让 CLI 行为依赖 stdio（不利于脚本调用），且 prompt 内容因 change 类型而异，不如用户拿到骨架后自填。
- **不引入模板版本号** —— 模板是 ASCII 骨架，不构成 spec；hash 不盖它。
- **不复制 bridge.mjs 的 `currentHashes` / `walkSpecs` 到 cmd-init** —— init 不算 hash，调用它们是过度实现。

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| 模板字符串内嵌，未来要改格式必须改代码 | 中 | 模板常量命名一致（PROPOSAL_TEMPLATE 等），改一处 grep 易到；后续若真的变成 schema 化需求，那是另一个 ADR |
| `--capability` 与目录名不一致导致 delta spec 路径漂移 | 低 | 模板里硬编码 `<cap>` 占位符，让用户复制时一致替换；执行器层 `spec-paths.mjs` 仍走 `validateSpecPathLayout` 兜底 |
| init 在 main 分支跑（违反 SKILL.md §3 开工守卫） | 低 | bridge.mjs 路由层不强制（避免 init 与后续 batch 守卫耦合）；执行层 hash gate 与 sync 仍守住 main branch 不能 sync 的硬约束 |