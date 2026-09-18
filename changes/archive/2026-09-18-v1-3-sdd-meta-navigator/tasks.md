# Tasks: v1-3-sdd-meta-navigator

按 [executor-protocol](../../skills/spec-bridge/references/executor-protocol.md) 的"自动启发式"排成批次；每批 ≤2 任务时 inline，否则派发子代理。

## Batch 1 — `bridge next` 按栈路由（TDD 优先）

- [ ] **T1.1** 写测试 `tests/xrouter-protocol.test.mjs`（RED）：stage=planning/contracted/executing/archived × workflow_kind=openspec/matt/builtin → advised.protocol 输出快照
- [ ] **T1.2** 改 `skills/spec-bridge/scripts/cmd-next.mjs`：加 `PROTOCOL_HINTS` 路由表 + 在 advised 末尾追加 `→ use_skill X` 行（GREEN）

完成定义：`$HOME/.nvm/versions/node/v20.3.0/bin/node tests/xrouter-protocol.test.mjs` 全 PASS；`bridge next changes/v1-3-sdd-meta-navigator` 输出含 `→ use_skill <按栈推荐>`
审查时点：批末（手测 + 自动测试双轨）

## Batch 2 — `bridge init` 按栈分支

- [ ] **T2.1** 改 `skills/spec-bridge/scripts/cmd-init.mjs`：检测 `--workflow-kind` 值（`openspec`/`matt` → 只建 `.bridge.yaml` + `.bridge.log` + 空 `specs/<cap>/`；`builtin` → 现状 5 模板）
- [ ] **T2.2** 写 `tests/init-workflow-kind.test.mjs`（RED → GREEN）：验证三种 kind 的产物差异

完成定义：`bridge init foo --workflow-kind openspec` 不产出 proposal/design/tasks；`bridge init foo --workflow-kind builtin` 产出 5 模板；`bridge init foo`（默认）= builtin
审查时点：批末

## Batch 3 — `bridge adopt` + `bridge list` 提示

- [ ] **T3.1** 新建 `skills/spec-bridge/scripts/cmd-adopt.mjs`：扫描 `<dir>`，按 openspec/matt 格式识别 → 建 `.bridge.yaml` + `.bridge.log` + stage 推断（有 execution-contract.md → contracted，只有四件套 → planning）
- [ ] **T3.2** 改 `skills/spec-bridge/scripts/cmd-list.mjs`（或 list 内联逻辑）：输出加 `untracked artifacts:` 段，列扫描到的 openspec/matt 历史产物目录 + 给建议 `bridge adopt <dir>` 命令
- [ ] **T3.3** 在 `bridge.mjs` dispatch 加 `adopt` 命令入口
- [ ] **T3.4** 写 `tests/adopt.test.mjs`：fixtures 两种格式样例 + list untracked 段快照

完成定义：`bridge adopt /tmp/fixture-openspec-style` 建台账 + log 留痕；`bridge list .` 输出 untracked 段含 fixture 目录
审查时点：批末

## Batch 4 — 文档批（SKILL.md / CONTEXT.md / ADR-0008）

- [ ] **T4.1** `skills/spec-bridge/SKILL.md` 加 §6 跨协议路由小节（路由表 + 能力阶梯 v2 摘要 + sync 兼容规则）+ §1 例程加 "多栈并存守卫"
- [ ] **T4.2** `skills/spec-bridge/CONTEXT.md` 更新"能力阶梯"术语为 v2 五级（原生/matt/状态机中断/agent 自身/桥档案员保留）+ 加"SDD 产物"/"外部产物"新术语
- [ ] **T4.3** 写 `skills/spec-bridge/docs/adr/0008-bridge-as-cross-protocol-recommender.md`
- [ ] **T4.4** 写 `tests/docs-sync-test.mjs`（验证 §6 路由表与 `cmd-next.mjs` `PROTOCOL_HINTS` 一致——防文档漂移）

完成定义：所有文档与代码一致；`docs-sync-test.mjs` PASS
审查时点：批末

## Batch N — 归档

- [ ] **TN.1** `node bridge.mjs sync changes/v1-3-sdd-meta-navigator` → 写回执
- [ ] **TN.2** `node bridge.mjs verify changes/v1-3-sdd-meta-navigator` → PASS
- [ ] **TN.3** 写 `specs/v1-3-sdd-meta-navigator/why.md`（蒸馏 D1-D8 + D6 v1.4 附录）
- [ ] **TN.4** `git mv changes/v1-3-sdd-meta-navigator changes/archive/<YYYY-MM-DD>-v1-3-sdd-meta-navigator/`
- [ ] **TN.5** `node bridge.mjs state set changes/archive/<...> stage archived`
- [ ] **TN.6** commit + push v1.3 分支