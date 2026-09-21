# Design: v1-8-2-pure-bridge-superpowers

## Purpose

把 bridge 从"导航员 + 兜底模板生成"收缩成"纯导航员"——bridge 只建台账 + 路由，不写任何 spec 模板；同时把 superpowers 加入项目栈探测优先级，让 superpowers 栈的用户被正确推 superpowers 栈的具体 skill（tdd / brainstorming）。

## Architecture

无新增模块。改动落 4 个文件：

```
skills/spec-bridge/scripts/
├── cmd-init.mjs              # 删 --builtin + 5 件模板 + WORKFLOW_KINDS 扩值
├── cmd-probe.mjs             # fallback reason 文案改
└── vendor/
    └── detect-stack.mjs      # 加 superpowers 双信号 + 改优先级
```

```
skills/spec-bridge/
├── SKILL.md                  # §7 加 v1.8-2 CHANGELOG 段
├── docs/adr/
│   └── 0012-pure-bridge-mode-superpowers-priority.md   # 新增 ADR-0012
└── tests/                    # 删/改/新增测试
    ├── init-no-builtin.test.mjs                # 新：验证 init 不写模板
    ├── init-workflow-kind-superpowers.test.mjs # 新：superpowers 派生测试
    └── detect-stack-superpowers.test.mjs       # 新：双信号探测测试
```

## Decisions

### D1 — 砍 --builtin flag，bridge init 永远不写模板

**选项**：
- A. 全砍 `--builtin` flag + 5 件模板生成代码 + 5 个 TEMPLATE 常量 + `fillTemplate` 函数（约 165 行）
- B. 保留 `--builtin` 但标记 deprecated（SKILL.md 公告不推荐），老用户缓冲期再砍
- C. 只砍 builtin，加 `--matt` / `--openspec` / `--superpowers` 显式栈 flag 自动生成对应模板

**决定**：A（全砍）

**理由**：
- 砍 `--builtin` 是 v1.8-2 的核心叙事——"纯桥模式"。留 deprecated 等于留逃生口 = 没说"纯桥"
- 实战中 builtin 模板与外栈产物并存，污染 change 目录（archive 时多 5 个无用文件）
- 外栈产物由外栈自管生成（matt `to-spec` / openspec-propose / superpowers `brainstorming`），builtin 模板从来不该被同时使用
- B/C 都是"过渡方案"，但本项目是单人项目，不需要缓冲期
- 用户拍板：全砍

**影响**：
- 删 5 个模板常量（PROPOSAL_TEMPLATE / DESIGN_TEMPLATE / TASKS_TEMPLATE / SPEC_TEMPLATE / CONTRACT_TEMPLATE）
- 删 `fillTemplate` 函数
- 删 `const builtin = flags.builtin === 'true';`
- 删 `if (builtin) { ... 5 件 writeFileSync ... }`
- 删 usage 字符串的 `[--builtin]`
- 简化 `if (autoProbe && !builtin)` → `if (autoProbe)`
- 删 appendEvent 中的 `builtin=` 参数

### D2 — superpowers 加入 detect-stack 优先级

**选项**：
- A. 双信号（`.claude-plugin/` + `package.json` 含 `"superpowers"` 字段），优先级 superpowers > matt > openspec > builtin
- B. 单信号（仅 `.claude-plugin/` 目录在场）
- C. 单信号（仅 `package.json` 含 `"superpowers"` 字段）

**决定**：A

**理由**：
- 与 matt 同等强度（matt 也是双信号：`.claude-plugin/` + `package.json` 含 `"matt-skills"` 字段），逻辑对称
- 单信号误报率高：B 任何 `.claude-plugin/` 项目都被当 superpowers；C 很多 superpowers 用户不开 `.claude-plugin/`
- 用户拍板：双信号

**实现细节**：
- 加 `hasSuperpowersSignals(projectRoot)` 函数：
  - `hasClaudePlugin(projectRoot)` 返回 true（复用现有函数）
  - 新加 `packageJsonMentionsSuperpowers(projectRoot)`：扫 package.json 是否含 `"superpowers"` 字段（dependencies / devDependencies / keywords / name / description 任一）
  - 与 matt 类似，用字符串扫描不解析 JSON（零依赖 + 快）
- `detectStack()` 优先级：
  1. **superpowers**：`claudePlugin && packageJsonSuperpowers` → primary = `superpowers`
  2. **matt**：`claudePlugin && packageJsonMatt` → primary = `matt`
  3. **openspec**：`openspecDir` → primary = `openspec`
  4. **builtin**：兜底 → primary = `builtin`
- 输出 signals 加 `packageJsonSuperpowers` 字段

### D3 — WORKFLOW_KINDS 值域扩为 4 个

**决定**：`new Set(['superpowers', 'openspec', 'matt', 'builtin'])`

**影响**：
- `cmd-init.mjs` line 14 `WORKFLOW_KINDS` 增 `superpowers`
- `cmd-init.mjs` line 260 usage 字符串 `[--workflow-kind <openspec|matt|builtin>]` → `[--workflow-kind <superpowers|openspec|matt|builtin>]`
- `cmd-init.mjs` line 293 非法值报错同步
- 任何其它读 workflow_kind 的脚本无需改（值域校验）

### D4 — probe fallback 行为文案调整

**决定**：无外栈时 advised_skill 返 `(none)`，advised_reason 改为：

```
inventory 未含任何已知栈 skill — bridge 不写模板，请 AI 用 brainstorming 或直接编辑自由发挥
```

**理由**：
- v1.8-1 现状 reason 是"按 D4 优先级 4 兜底（AI 自由发挥）"——技术话术
- v1.8-2 砍掉 builtin 后，"自由发挥"需要更明确的指引——brainstorming 是 superpowers 栈的具体 skill，能给 AI 立即可用的下一步

**影响**：
- `cmd-probe.mjs` line 68 reason 字符串改一行

### D5 — 测试更新

**决定**：

1. **删** `init-auto-probe.test.mjs` 里 `--builtin` 相关测试（约 30 行）
2. **新加** `init-no-builtin.test.mjs`（3 测试）：
   - 验证 `--builtin` flag 不再生模板
   - 验证默认 init 不写 proposal.md / design.md / tasks.md / execution-contract.md / spec.md
   - 验证 init 后 change 目录只有 `.bridge.yaml` + `.bridge.log` + 空 `specs/<cap>/` 目录
3. **新加** `detect-stack-superpowers.test.mjs`（4 测试）：
   - 双信号都在场 → primary = superpowers
   - 缺 `.claude-plugin/` → 不派 superpowers（兜底 openspec 或 builtin）
   - 缺 `superpowers` 字段 → 不派 superpowers
   - 仅 superpowers 缺 matt-skills 时，superpowers 优先于 openspec
4. **改** `init-workflow-kind.test.mjs`：扩值域到 4 个 + 加 superpowers 派生用例
5. **新加** `probe-fallback-bridge-pure.test.mjs`（2 测试）：
   - 无任何 inventory 走 → advised_skill = `(none)` + 新文案
   - advised_invocation fallback 文案对齐 D4

### D6 — 文档同步

**决定**：

- **新加** ADR-0012（`docs/adr/0012-pure-bridge-mode-superpowers-priority.md`）：
  - 状态：Accepted
  - 决策人：JcLoveCode（与 AI grill 锐化）
  - D1 砍 builtin / D2 superpowers 双信号 / D3 值域扩 / D4 fallback 文案 / D7 删 `--builtin` 测试的回归保护

- **改** `SKILL.md §7`：
  - 加 `### v1.8-2 CHANGELOG（ADR-0012，pure-bridge-mode）` 段
  - D1 全砍 builtin / D2 superpowers 探测 / D3 值域扩 / D4 fallback 文案 / 影响面
  - "为什么是纯桥"理由段

- **改** `AGENTS.md` 禁止事项 §3：
  - v1.8-1 schema 扩字段 `external_stack` / `adopted_at` 仍 v1.8 起允许
  - v1.8-2 起 `workflow_kind` 值域扩为 `{superpowers, openspec, matt, builtin}`（**注意**：旧值 `matt` / `openspec` / `builtin` 仍兼容，新增 `superpowers`）
  - 同步更新禁止事项描述："不要改 4 个 receipt 字段名 + schema 字段扩展需走 SDD"

## Out-of-scope decisions（明确不做的）

- **不**改 probe 路由优先级（C6 写死 Superpowers > Matt > OpenSpec > builtin，已是 v1.7 设计）
- **不**改 distill/sync/archive-ready 行为（外栈产物自管机制不变，external_stack 接管逻辑不变）
- **不**加 `--matt` / `--openspec` / `--superpowers` 显式栈 flag（用户已经能 `--workflow-kind`，多 flag 重复）
- **不**改 detect-stack 探测细节（如 superpowers 是否用 package.json `description` 之外位置探测）—— 双信号就够，不堆砌
- **不**在 v1.8-2 改 superpowers 栈的 advised_invocation 映射（probe 现有 fallback `use_skill <advised_skill>` 已能 cover）
- **不**改 cmd-adopt.mjs 的 matt/openspec 启发式（D3 实战逻辑不动）

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| 砍 `--builtin` 后老用户的 CI/脚本报错 | 老脚本可能传 `--builtin` flag | flag 不再被读，stderr 给 `[hint] flag removed in v1.8-2, no-op`；SKILL.md CHANGELOG 公告；archive 时不变 |
| superpowers 双信号误判 | 项目根有 `.claude-plugin/` + 任意 npm 包含 "superpowers" 子串（如 `@scope/superpowers-util`）→ 误判 | 字段匹配严格 `"superpowers"`（带双引号），不是子串；测试覆盖"同名字段在 dependencies"；用户可 `--workflow-kind` 覆盖 |
| superpowers 信号缺失 | 某些 superpowers 栈项目不开 `.claude-plugin/` 也不在 package.json 提 superpowers → 兜底 builtin | 用户跑 `bridge init --workflow-kind superpowers` 显式覆盖；SKILL.md 公告 |
| 删除 5 件模板常量后无法手动 fallback | 用户跑 `bridge init --builtin` 不再生模板 | advised_skill `(none)` + reason 引导 brainstorming/直接编辑；外栈模板由用户自管 |
| archive sync 校验问题（v1.8-1 已踩过） | spec.md 校验失败 | v1.8-2 spec.md 直接写 builtin 模板结构（含 ADDED Requirements 段），无需 `--external-skip` |
| 测试 134 → 138 → ?_new 全绿 | 测试增量 + 旧测试保留 | 整体过 `npm test` 后再 commit |