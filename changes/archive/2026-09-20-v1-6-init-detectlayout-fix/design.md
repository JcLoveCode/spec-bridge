# Design: v1-6-init-detectlayout-fix

## Purpose

让 spec/cli/spec.md R1 场景 1.5 与 detectLayout 实现一致：仅 `openspec/` 目录在场（无 archive 化石、无 config.yaml）时也返回 openspec layout。同时保留 v1.4 ADR-0009 防误判成果（archive 化石优先级 1 保护 spec-bridge 仓库根）。

## Architecture

detectLayout 优先级链（v1.6 修正版）：

```
1. <root>/changes/archive/*.bridge.yaml 在 → layout: standalone（v1.4 第一性原则）
2. <root>/openspec/changes/archive/*.bridge.yaml 在 → layout: openspec
3. <root>/openspec/config.yaml 在 → layout: openspec（OpenSpec CLI 标志）
4. <root>/openspec/ 目录在场 → layout: openspec  ← v1.6 新加弱信号
5. 缺省 → layout: standalone
```

**关键安全属性**：v1.4 ADR-0009 关心的 spec-bridge 仓库根有 `openspec/`（OpenSpec CLI 本地安装）场景，因仓库根 `changes/archive/` 在场，**优先级 1 命中 → standalone**，**根本走不到第 4 条弱信号**——v1.6 弱信号不会误伤 spec-bridge 仓库。

## Decisions

### D1 — detectLayout 优先级链加 openspec/ 目录弱信号（第 4 条）

**选项**：
- A. 加 openspec/ 目录在场弱信号作兜底（v1.6 选）
- B. 改 spec.md R1 场景 1.5 WHEN 条件（要求 openspec/config.yaml 在场）
- C. 改 init-integration R1.5.1 test fixture 加 config.yaml

**决定**：A

**理由**：
- A 保留 spec 简单语义（"openspec/ 目录在场 = openspec 项目"），符合用户直觉
- A 保留 v1.4 第一性原则（archive 化石优先级 1），不破 ADR-0009
- A 实战安全：spec-bridge 仓库根 openspec/ 误判场景被优先级 1 保护
- B/C 改 spec/test fixture 让 "openspec/ 目录在场 ≠ openspec 项目" 是反直觉的——用户跑 init 时期望"看到 openspec/ 就走 openspec"

### D2 — bridge.mjs + cmd-init.mjs mirror 同步

**选项**：
- A. 两文件 inline 同步（v1.5 + R7 测试已强约束）
- B. 抽 detectLayout 到独立共享模块

**决定**：A

**理由**：B 需要引入跨文件 import，scope 大；R7 测试已 assert 两文件 mirror 一致（hasAnyBridgeYaml 辅助 + 优先级 if-else 链），继续沿用 mirror 模式。

### D3 — 回归保护：增强 R1.5.1 test 加 2 个 case

**选项**：
- A. 在 init-integration.test.mjs 加 2 个 test（"有 archive 化石 → standalone" + "spec-bridge 仓库根 → standalone"）
- B. 不加 test，依赖 R7 mirror 一致性测试覆盖

**决定**：A

**理由**：v1.4 的误判问题真实复现过——必须有正向断言（"有化石时不走 openspec/ 弱信号"）+ 端到端断言（"spec-bridge 仓库根 list 仍 standalone"）。B 仅覆盖 mirror 一致性，不能保证优先级顺序正确。

## Out-of-scope decisions

- **不修 cmd-adopt.mjs detectLayout**：adopt 用更简单的 `existsSync(openspec/)` 实现——adopt 场景不需要"archive 化石优先级 1" 保护（adopt 是把现有变更接进 bridge，不冲突）。改动它会扩大 scope，引入未验证的回归风险。
- **不补 v1.4 verify FAIL**：v1.4 已 archived 写保护，receipt rebase 是独立 spec 范畴。

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| spec-bridge 仓库根 list 被 openspec/ 弱信号误判为 openspec | 高（v1.4 已修问题复现） | 优先级 1 (changes/archive 化石) 保护——回归测试 R1.5+1 case 校验 |
| 其它项目装 OpenSpec CLI 到项目根但未 init 变更 → 误判为 openspec | 中 | 弱信号兜底是 fallback 而非主信号，priority 1+2+3 三层强信号先命中 |
| mirror 一致性破坏（bridge.mjs 改了 cmd-init.mjs 没改） | 中（历史已发生） | R7 测试 + 同步两文件 + 跑全套 init-integration + docs-sync-test |
| v1.4 真实 bug（"spec-bridge 仓库根 has_openspec_dir → 误判"）回归 | 中 | 新增 R1.5.2 test "有 changes/archive 化石 + 有 openspec/ 目录 → standalone" 强校验 |