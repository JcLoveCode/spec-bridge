# Tasks: v1-3-research-xrouter

按 [executor-protocol](../../skills/spec-bridge/references/executor-protocol.md) 的"自动启发式"排成批次；每批 ≤2 任务时 inline，否则派发子代理。

## Batch 1 — research spec-bridge 自身

- [ ] **T1.1** 读 `skills/spec-bridge/SKILL.md` 全文
- [ ] **T1.2** 列 13 命令的 CLI 实现源码（`skills/spec-bridge/scripts/cmd-*.mjs`）

完成定义：笔记 §1 + §2 (bridge 部分) 写完
审查时点：批末

## Batch 2 — research openspec-cn 11 skill

- [ ] **T2.1** 读 `.codebuddy/skills/openspec-*/SKILL.md` 全部 11 个
- [ ] **T2.2** 验证 `openspec-cn` CLI 是否实际安装（`which openspec-cn`）

完成定义：笔记 §3 (openspec-cn 部分) 写完
审查时点：批末

## Batch 3 — research spec-superflow 9 skill

- [ ] **T3.1** 读 `~/.codebuddy/plugins/marketplaces/MageByte-Zero_spec-superflow/skills/*/SKILL.md` 全部 9 个
- [ ] **T3.2** 读 `plugin.json` + `README.md` 概览

完成定义：笔记 §4 (spec-superflow 部分) 写完
审查时点：批末

## Batch 4 — research superpowers 14 skill

- [ ] **T4.1** 读 `~/.codebuddy/plugins/marketplaces/.../superpowers/skills/*/SKILL.md` 全部 14 个
- [ ] **T4.2** 读 `using-superpowers/SKILL.md`（元 skill）

完成定义：笔记 §5 (superpowers 部分) 写完
审查时点：批末

## Batch 5 — research matt-skills 30+ skill

- [ ] **T5.1** 列 `~/.codebuddy/plugins/marketplaces/tt-a1i_matt-skills-with-to-goal/skills/` 全 skill 名
- [ ] **T5.2** 选核心 5 skill 读 SKILL.md（ask-matt / grill-with-docs / to-spec / to-goal / spec-executor）

完成定义：笔记 §6 (matt 部分) 写完
审查时点：批末

## Batch 6 — 综合：跨协议路由表

- [ ] **T6.1** 从 5 套栈抽"等价 skill"（如 spec-bridge `sync` vs openspec-cn `sync-specs`）
- [ ] **T6.2** 设计 v1.3 `bridge next` 路由表（stage → 推荐 use_skill + cli）

完成定义：笔记 §7 + §8 写完
审查时点：批末

## Batch 7 — 归档

- [ ] **T7.1** 写 `specs/v1-3-research-xrouter/why.md`（蒸馏）
- [ ] **T7.2** `node bridge.mjs sync changes/v1-3-research-xrouter` → 写回执
- [ ] **T7.3** `node bridge.mjs verify changes/v1-3-research-xrouter` → PASS
- [ ] **T7.4** `git mv changes/v1-3-research-xrouter changes/archive/2026-09-18-v1-3-research-xrouter/`
- [ ] **T7.5** commit + push v1.3 分支
