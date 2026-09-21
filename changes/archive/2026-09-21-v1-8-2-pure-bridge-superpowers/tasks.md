# Tasks: v1-8-2-pure-bridge-superpowers

按 [executor-protocol](../../skills/spec-bridge/references/executor-protocol.md) 的"自动启发式"排成批次；每批 ≤2 任务时 inline，否则派发子代理。

## Batch 1 — 砍 builtin 模板生成

- [ ] **T1.1** 改 `cmd-init.mjs`：删 `--builtin` flag 解析 + 5 件模板常量 + `fillTemplate` 函数 + `if (builtin) { ... }` 块 + usage 字符串中的 `[--builtin]` + 简化 `if (autoProbe && !builtin)` → `if (autoProbe)` + 删 appendEvent 中的 `builtin=` 参数
- [ ] **T1.2** 改 `cmd-init.mjs` 的 `WORKFLOW_KINDS`：值域扩为 `{superpowers, openspec, matt, builtin}` + 同步 usage 字符串的 `[--workflow-kind <...>]` + 非法值报错文案同步

完成定义：grep `builtin` 与 `PROPOSAL_TEMPLATE` 在 cmd-init.mjs 不存在；`node skills/spec-bridge/scripts/bridge.mjs init test-foo` 在临时目录不写模板文件；usage 输出 `workflow-kind` 值含 superpowers
审查时点：批末

## Batch 2 — superpowers 加入 detect-stack

- [ ] **T2.1** 改 `vendor/detect-stack.mjs`：加 `packageJsonMentionsSuperpowers(projectRoot)` 函数（扫 package.json 字符串包含 `"superpowers"`）+ `detectStack()` 优先级调整为 superpowers > matt > openspec > builtin + signals 加 `packageJsonSuperpowers` 字段
- [ ] **T2.2** 同步 superpowers 探测文件头标：注释 + 函数命名 + 复用方说明

完成定义：detect-stack.mjs 4 测试通过（双信号在 / 缺 .claude-plugin / 缺 superpowers 字段 / 同项目下 superpowers 优先于 openspec）
审查时点：批末

## Batch 3 — probe fallback 文案调整

- [ ] **T3.1** 改 `cmd-probe.mjs` line 68：advised_skill `(none)` 分支的 advised_reason 文案改为"inventory 未含任何已知栈 skill — bridge 不写模板，请 AI 用 brainstorming 或直接编辑自由发挥"
- [ ] **T3.2** 同步 `skillToInvocation` 函数（line 41）：`(none)` 分支返 `"bridge 不写模板 — AI 用 brainstorming 或直接编辑自由发挥"`（去掉旧的 `(fallback to builtin: ...)`）

完成定义：probe 测试 fallback 分支验文案 + 跑 `bridge probe ... -o /tmp/probe.out` 看 advised_reason 行
审查时点：批末

## Batch 4 — 测试覆盖

- [ ] **T4.1** 删 `init-auto-probe.test.mjs` 里 `--builtin` 相关测试用例（约 30 行）
- [ ] **T4.2** 新加 `init-no-builtin.test.mjs`：3 测试（默认 init 不写模板 / `--builtin` flag no-op / init 后 change 目录结构验证）
- [ ] **T4.3** 新加 `detect-stack-superpowers.test.mjs`：4 测试（双信号在 / 缺 .claude-plugin / 缺 superpowers 字段 / 优先级 superpowers > openspec）
- [ ] **T4.4** 改 `init-workflow-kind.test.mjs`：扩值域到 4 个 + 新加 superpowers 派生用例
- [ ] **T4.5** 新加 `probe-fallback-bridge-pure.test.mjs`：2 测试（无 inventory 走 advised_skill `(none)` + 新文案 + advised_invocation fallback 对齐）

完成定义：`npm test` 全绿；测试数 138 → 143+ （新加 9+，旧测试不动）
审查时点：批末

## Batch 5 — 文档 + ADR

- [ ] **T5.1** 新加 `skills/spec-bridge/docs/adr/0012-pure-bridge-mode-superpowers-priority.md`：D1-D7 决策（砍 builtin / superpowers 双信号 / 值域扩 / fallback 文案 / 测试策略 / 文档策略 / 删 `--builtin` 回归保护）
- [ ] **T5.2** 改 `skills/spec-bridge/SKILL.md §7`：加 `### v1.8-2 CHANGELOG（ADR-0012，pure-bridge-mode）` 段 + D1-D5 变更 + 双信号细节 + "为什么是纯桥"理由
- [ ] **T5.3** 改 `AGENTS.md` 禁止事项 §3：v1.8-2 schema 扩字段说明（workflow_kind 值域扩 + cross_refs 仍 v1.8 后开）

完成定义：grep v1.8-2 / pure-bridge-mode 在文档能找到；AGENTS.md 禁止事项同步
审查时点：批末

## Batch N — 归档

- [ ] **TN.1** `node skills/spec-bridge/scripts/bridge.mjs sync changes/v1-8-2-pure-bridge-superpowers` → 写回执（builtin 风格 spec.md 走标准校验无需 `--external-skip`）
- [ ] **TN.2** `node skills/spec-bridge/scripts/bridge.mjs verify changes/v1-8-2-pure-bridge-superpowers` → PASS
- [ ] **TN.3** `node skills/spec-bridge/scripts/bridge.mjs distill changes/v1-8-2-pure-bridge-superpowers` → 写 specs/v1-8-2-pure-bridge-superpowers/why.md
- [ ] **TN.4** `node skills/spec-bridge/scripts/bridge.mjs archive-ready changes/v1-8-2-pure-bridge-superpowers` → PASS
- [ ] **TN.5** `git mv changes/v1-8-2-pure-bridge-superpowers changes/archive/2026-09-21-v1-8-2-pure-bridge-superpowers/`
- [ ] **TN.6** `node skills/spec-bridge/scripts/bridge.mjs state set changes/archive/2026-09-21-v1-8-2-pure-bridge-superpowers stage archived`
- [ ] **TN.7** `git add -A && git commit -m "v1.8-2: pure bridge mode + superpowers priority (砍 builtin + superpowers 双信号探测)"` + `git pushp origin v1-8-2-pure-bridge-superpowers`