# ADR-0012: bridge 纯桥模式 + superpowers 加入项目栈优先级（v1.8-2）

- 状态：Accepted（2026-09-21）
- 决策人：JcLoveCode（与 AI grill 锐化）
- 关联 change：changes/v1-8-2-pure-bridge-superpowers/

## 背景

v1.8-1 (ADR-0011) 把 bridge 改成"默认只建台账 + 自动 probe 路由"，但仍留两个口子：

1. **`--builtin` 逃生口**：bridge init 仍可生成 5 件内置模板（proposal/design/tasks/spec/execution-contract）
2. **detect-stack 没把 superpowers 当一等公民**：项目根有 superpowers 信号时，init 仍按 matt > openspec > builtin 推导，可能把 superpowers 栈项目误判成 openspec/matt

实战发现两个痛点：

1. **`--builtin` 与"导航员优先"叙事冲突**——bridge 既然声称是导航员，就不该同时兜底写模板。实战中用户跑 `bridge init` 后被自动 probe 推到外栈（matt `to-spec` / openspec-propose），但同时 `--builtin` 还能生 builtin 5 件模板——两套产物并存，外栈产物接管时 builtin 模板还留在 change 目录里污染 archive。
2. **superpowers 栈用户被误推 openspec**——项目根有 `.claude-plugin/` + `package.json:superpowers` 字段（双信号），按 v1.8-1 detect-stack 应派 openspec（因为 matt 信号缺 matt-skills 字段，openspec 信号只查 openspec/ 目录），但 superpowers 用户其实想被推 superpowers 的 tdd/brainstorming——这是更基础的开发能力。

v1.8-2 砍掉 builtin 兜底 + 把 superpowers 加进优先级，bridge 进入"纯桥模式"。

## 决策

### D1. 砍 `--builtin` flag，bridge init 永远不写模板

- 默认行为：`bridge init <name>` 建 `.bridge.yaml` + `.bridge.log` + 空 `specs/<cap>/` 目录，**不写** proposal/design/tasks/spec/execution-contract
- 完成后自动调 `bridge probe <change-dir>` 给 AI 看导航推荐
- 兼容层：老用户传 `--builtin` 时 stderr 给 `[hint] --builtin flag removed in v1.8-2 (pure bridge mode), no-op`，**flag 变 no-op 不再生模板**

**拒绝的方案**：

- 保留 `--builtin` 但标 deprecated——老用户缓冲期再砍。**拒绝理由**：本项目是单人项目，不需要缓冲期；纯桥叙事要彻底，留 deprecated 等于没说"纯桥"。
- 砍 builtin 但加 `--matt` / `--openspec` / `--superpowers` 显式栈 flag 自动生成对应模板。**拒绝理由**：用户已经能 `--workflow-kind`，多 flag 重复；与"导航员优先"叙事矛盾（导航员不该有能力自动生成模板）。

### D2. superpowers 加入 detect-stack 项目栈优先级

detect-stack 优先级调整为：

1. **superpowers**（新增）：`.claude-plugin/` + `package.json` 含 `"superpowers"` 字段（dependencies/devDependencies/keywords/name/description 任一）→ primary = `superpowers`
2. **matt**：`.claude-plugin/` + `package.json` 含 `"matt-skills"` 字段 → primary = `matt`
3. **openspec**：`openspec/` 目录在场 → primary = `openspec`
4. **builtin**：兜底 → primary = `builtin`

**拒绝的方案**：

- 用 `package.json` 一字段"猜"栈（如看到 `@op/spec` 就 openspec）。**拒绝理由**：单点字符串匹配误报率高，多信号（目录 + 字段）才稳。
- 仅 `.claude-plugin/` 目录在场（单信号）派 superpowers。**拒绝理由**：门槛松，任何 `.claude-plugin/` 项目都被当 superpowers（误报）。
- 仅 `package.json` 含 superpowers 字段（单信号）派 superpowers。**拒绝理由**：很多 superpowers 栈项目不开 `.claude-plugin/`，会漏判。

### D3. WORKFLOW_KINDS 值域扩为 4 个

```js
const WORKFLOW_KINDS = new Set(['superpowers', 'openspec', 'matt', 'builtin']);
```

- 旧值 `openspec` / `matt` / `builtin` 仍兼容
- 新值 `superpowers` 由 detect-stack 自动派生 + `--workflow-kind superpowers` 显式覆盖
- 非法值报错文案同步扩为 4 个

### D4. probe fallback 文案引导 brainstorming

无 inventory 时 advised_skill 返 `(none)`，文案改为：

```
advised_reason: inventory 未含任何已知栈 skill — bridge 不写模板，请 AI 用 brainstorming 或直接编辑自由发挥
advised_invocation: bridge 不写模板 — AI 用 brainstorming 或直接编辑自由发挥
```

**拒绝的方案**：

- 保留 v1.8-1 文案"按 D4 优先级 4 兜底（AI 自由发挥）"。**拒绝理由**：技术话术，"自由发挥"含糊，AI 不知道下一步具体做什么。
- 在 fallback 给具体 skill 名推荐（如 `superpowers:brainstorming`）。**拒绝理由**：用户没装 superpowers 时推荐也错。

### D5. 测试更新策略

- **删** `init-templates.test.mjs`（5 件模板常量已物理删除，测试失去作用对象）
- **新加** 3 套测试：init-no-builtin（3）+ detect-stack-superpowers（5）+ probe-fallback-bridge-pure（2）
- **改** 现有 4 个测试：init-auto-probe / init-integration / init-workflow-kind / probe-active-navigator / distill-skip-external
- 整体目标：`npm test` 138+ 全绿

### D6. 文档同步

- 新加 ADR-0012（本文档）
- `SKILL.md §7` 加 v1.8-2 CHANGELOG 段
- `AGENTS.md` 禁止事项 §3 增补 workflow_kind 值域扩字段说明

### D7. 删 `--builtin` 测试的回归保护

`init-auto-probe.test.mjs B3 T1` + `init-workflow-kind.test.mjs R3 场景 3` 都改测"`--builtin` flag no-op + stderr hint"，作为 v1.8-2 纯桥模式的回归保护。未来如果有人加回 `--builtin` 行为，这两个测试会立刻 fail。

## 后果

### 正面

- "纯桥模式"从 CLI 默认行为彻底落地——bridge init 永远不写模板，叙事与实现一致
- superpowers 栈用户被正确路由——避免被误推 openspec/matt
- probe fallback 文案更明确——"bridge 不写模板，请 AI 用 brainstorming 或直接编辑"给 AI 立即可用指引
- 与 ADR-0011 "导航员优先"叙事一致——bridge 是导航员，不是 spec 生成器

### 负面

- 砍 `--builtin` 后老用户的 CI/脚本报错——已有兼容层 hint，老脚本能继续跑（flag no-op）
- 5 件模板常量物理删除后无法手动 fallback——advised_skill `(none)` + reason 引导 brainstorming/直接编辑；外栈模板由用户自管
- superpowers 双信号门槛较高（需 `.claude-plugin/` + 字段）——用户可 `--workflow-kind superpowers` 显式覆盖

### 中性

- `init-templates.test.mjs` 删除（5 件模板常量已物理删除，测试失去作用对象）——净测试增量：-4 + 10 = +6
- cmd-init.mjs 删除 134 行（5 件模板常量）+ 4 行（fillTemplate）= 138 行
- detect-stack.mjs 增 superpowers 字段 + 调整优先级约 25 行
- cmd-probe.mjs 改 fallback 文案 2 行

## 关联

| 项目 | 路径 / 关系 |
|---|---|
| 实施 change | changes/v1-8-2-pure-bridge-superpowers/ |
| 上游 ADR | ADR-0001（prompt 管判断）/ ADR-0004（workflow_kind 三级推导）/ ADR-0008（跨协议推荐器）/ ADR-0010（probe 主动激活）/ ADR-0011（bridge-as-navigator）/ ADR-0009（detect-layout 优先级） |
| 下游 skill | openspec-propose（外栈）/ matt to-spec（外栈）/ superpowers brainstorming（外栈） |
| 测试增量 | init-no-builtin.test.mjs (3) + detect-stack-superpowers.test.mjs (5) + probe-fallback-bridge-pure.test.mjs (2) |
| 测试修改 | init-auto-probe / init-integration / init-workflow-kind / probe-active-navigator / distill-skip-external |
| spec 增量 | changes/v1-8-2-pure-bridge-superpowers/specs/v1-8-2-pure-bridge-superpowers/spec.md |