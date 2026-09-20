# Why: v1-6-init-detectlayout-fix

## Conclusion

让 spec/cli/spec.md R1 场景 1.5 与 detectLayout 实现一致：仅 `openspec/` 目录在场（无 archive 化石、无 config.yaml）时也返回 openspec layout。同时保留 v1.4 ADR-0009 防误判成果（archive 化石优先级 1 保护 spec-bridge 仓库根）。

## Source-of-truth

唯一权威源：design.md ## Decisions

### D1 — detectLayout 优先级链加 openspec/ 目录弱信号（第 4 条）

来源：design.md D1
理由：A 保留 spec 简单语义（"openspec/ 目录在场 = openspec 项目"），符合用户直觉

### D2 — bridge.mjs + cmd-init.mjs mirror 同步

来源：design.md D2
理由：B 需要引入跨文件 import，scope 大；R7 测试已 assert 两文件 mirror 一致（hasAnyBridgeYaml 辅助 + 优先级 if-else 链），继续沿用 mirror 模式。

### D3 — 回归保护：增强 R1.5.1 test 加 2 个 case

来源：design.md D3
理由：v1.4 的误判问题真实复现过——必须有正向断言（"有化石时不走 openspec/ 弱信号"）+ 端到端断言（"spec-bridge 仓库根 list 仍 standalone"）。B 仅覆盖 mirror 一致性，不能保证优先级顺序正确。


## spec-rev

待 sync 写回执后填（回执 hash 自动盖 spec.md，why.md 只引用）

## Non-Decisions（主动不做 / why 已知）

<!-- 来自 design.md ## Out-of-scope decisions；由 AI 跑 distill 后手动补 -->

## Open Questions for follow-up

<!-- 见 design.md ## Open Questions / 决策未覆盖的问题 -->
