# Execution Contract: v1-8-3-memory-personal-team

## Intent Lock

让 bridge 拥有"两层记忆"——个人层（探测 IDE 自带 memory 优先 + fallback 在 change 下建空骨架）+ 团队层（archive 触发 CLI 同步 + hash 校验 + cap 边界 + orphaned 沉淀）。bridge 只填结构和元信息，不替 AI 写 memory 内容；硬约束写进 SKILL.md + AGENTS.md。

## Scope Fence

### In Scope

- 新建 `cmd-memory.mjs`（5 子命令：init/append/sync/show/reconcile + 校验 hash）
- 改 `cmd-init.mjs`：探测 IDE memory + 按需调 memory init
- 改 `cmd-adopt.mjs`：同 init 探测逻辑
- 改 `cmd-probe.mjs`：加 memory_hint 字段输出
- 改 `cmd-archive-ready.mjs`：加"个人 memory 有内容或 IDE memory 在场"守门
- 改 `cmd-archive.mjs`（或 archive flow）：archive 通过后自动调 memory sync
- 新建 `.bridge/team/<cap>/memory.md` 目录结构 + `.bridge/team/orphaned/` 沉淀
- 新 spec：`specs/v1-8-3-memory-personal-team/spec.md`
- 新 ADR：`0013-memory-personal-team-rules.md`
- 改 `SKILL.md`：§7 加 v1.8-3 CHANGELOG 段 + §x 写规则硬约束示例
- 改 `AGENTS.md`：业务目的 a' 改写为"两层规则完整版" + 禁事加"不替 AI 写 memory 内容"
- 改 `README.md §1.1 a'`：补两层规则段落
- 测试：31 cases / 9 文件
- archive: sync + verify + distill + archive-ready + git mv + stage=archived + commit + push

### Out of Scope

- 不改 `.codebuddy/memory/` 任何行为（IDE 自管域）
- 不改 distill / why.md 输出位置（memory 在 changes/<name>/memory.md，why.md 在 specs/<cap>/why.md）
- 不加 `--memory / --no-memory` flag
- 不做 memory 自动总结（违反"bridge 不替 AI 写"硬约束）
- 不做跨项目 memory 合并
- 不做 memory 加密 / 权限控制
- 不改 SKILL.md §6 多栈并存守卫
- 不改 probe 路由优先级
- 不加 `bridge memory show --format json`
- 不改 archive flow 的 sync / verify / distill（除守门和触发外）

## Approved Requirements

- [ ] **R1** — 个人层 IDE 优先：探测 `.codebuddy/memory/` 在场跳过生成（测试义务：memory-detect-ide.test.mjs 3 测试）
- [ ] **R2** — 个人层 fallback：IDE 不在场 → `changes/<name>/memory.md` 空骨架（测试义务：memory-init-empty.test.mjs 3 测试）
- [ ] **R3** — memory 命令族 5 子命令：init/append/sync/show/reconcile（测试义务：memory-init-empty + memory-append + memory-sync-hash + memory-show-readonly 共 14 测试）
- [ ] **R4** — probe memory_hint 三态输出：ide/bridge/none + IDE 路径 + bridge 行数 + team caps 列表（测试义务：probe-memory-hint.test.mjs 4 测试）
- [ ] **R5** — archive-ready 守门：IDE 在场或个人 memory 有内容通过；都缺失败 + stderr 提示（测试义务：archive-ready-memory-gate.test.mjs 3 测试）
- [ ] **R6** — archive 触发团队层 sync：CLI 算 hash 校验一致性 + 失败不回滚 archive（测试义务：memory-sync-hash.test.mjs 5 测试）
- [ ] **R7** — 团队层 cap 边界：复用 `--capabilities` + 默认落 default + orphaned 沉淀（测试义务：memory-orphaned.test.mjs 3 测试）
- [ ] **R8** — reconcile 不删原 cap：只追加元信息 + `--include-orphaned` 给人审（测试义务：memory-reconcile.test.mjs 3 测试）
- [ ] **R9** — 写规则硬约束：SKILL.md §x 好/坏示例 + AGENTS.md 禁事（测试义务：grep 文档验证 + 集成测试）

合计 31 测试（v1.8-2 是 9 测试）。`npm test` 143 → 174+。

## Constraints

- **C1**（来自 ADR-0001）：bridge 不现场合并文本，所有合并走 CLI——团队层 sync 必须 CLI 算 hash，不让 LLM 现场合并
- **C2**（来自 ADR-0010 D4）：probe 不自动调 skill，只输出 advised_skill/invocation 给 AI 看
- **C3**（来自 ADR-0011 D7）：所有"默认行为变"必须配逃生口 flag——本 change 不加逃生口（memory 命令族本身就是逃生口，缺 memory 不阻止 init/adopt，只阻止 archive-ready）
- **C4**（来自 ADR-0005）：归档 stage=archived 后不可改——本 change 走完整 archive 流程
- **C5**（来自 AGENTS.md 禁止事项 §3）：改 schema 字段名要先开 ADR——本 change 不改字段名，只加 probe 输出字段（已通过 ADR-0013 决策）
- **C6**（来自调研报告 §六风险 1）：memory 命令族复用 `cmd-event.mjs` 的 `appendEvent`，不另起账本
- **C7**（来自调研报告 §六风险 3）：LLM 不在场时 memory.md / team/memory.md **只读不写**——避免现场合并污染

## Execution Batches

- **Batch 1**（cmd-memory.mjs 骨架 + 个人层 init）— T1.1 cmd-memory.mjs init 子命令 + T1.2 cmd-init.mjs 探测 IDE memory — 完成定义：grep 验证 + init 测试通过
- **Batch 2**（个人层 append + 写规则硬约束）— T2.1 append 子命令 + T2.2 SKILL.md §x — 完成定义：append 测试通过 + grep SKILL.md §x
- **Batch 3**（probe memory_hint + cmd-adopt 探测）— T3.1 probe 加 memory_hint + T3.2 cmd-adopt 探测 — 完成定义：probe 三态测试 + adopt 测试通过
- **Batch 4**（archive-ready 守门 + archive 触发 sync）— T4.1 archive-ready 守门 + T4.2 archive 触发 sync — 完成定义：守门测试 + sync 测试通过
- **Batch 5**（团队层 sync + orphaned + reconcile）— T5.1 sync 子命令 + T5.2 show + reconcile + orphaned — 完成定义：sync/orphaned/reconcile 测试通过
- **Batch 6**（测试覆盖 31 cases）— T6.1-T6.9 共 9 测试文件 — 完成定义：`npm test` 全绿，143 → 174+
- **Batch 7**（文档 + ADR）— T7.1 ADR-0013 + T7.2 SKILL.md §7 + T7.3 AGENTS.md + T7.4 README.md — 完成定义：grep 文档 + 同步验证
- **Batch N**（归档）— TN.1 sync + TN.2 verify + TN.3 distill + TN.4 archive-ready + TN.5 git mv + TN.6 stage=archived + TN.7 commit + push

## Escalation Rules

执行过程中遇到以下情况必须停下回 planning 重开：

- IDE memory 探测误判严重（`.codebuddy/memory/` 存在但用户期待有 bridge memory）→ 评估是否加 `--force-memory-init` 显式 flag 强制生成
- 个人 memory.md 格式校验失败导致 sync 失败 → 评估是否放宽 format 校验（v1.8-3 设计已是"不强制"，但可能仍有边界情况）
- 团队层 cap 边界冲突（同一 cap 被多 change 反复 sync 累积过快）→ 评估是否加"决策段去重"或"按月份汇总"
- archive 触发 sync 但 sync 失败频繁 → 评估是否加 retry 或同步队列
- `--parent` 续作时父 archive memory.md 抽不到决策段 → 评估是否加 fallback 默认值
- orphaned 累积超过 N 行（人为设个阈值如 1000 行）→ 评估是否强制 reconcile 才能继续 sync
- 测试用真实 `.codebuddy/memory/` 路径污染 IDE 数据 → 评估是否加测试隔离层
- 4 个 memory 命令与 cmd-event 系统的账本一致性 → 评估是否需要 hash 一致性检查