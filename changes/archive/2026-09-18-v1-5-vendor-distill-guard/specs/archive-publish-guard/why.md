# Why: v1-5-vendor-distill-guard

## Conclusion

堵住 v1.4 归档时暴露的"vendor 算错 projectRoot" + "bridge 撒谎写蒸馏"两个口子——让"归档 → verify → 蒸馏 → git mv"四拍的每一步都有 CLI 级守卫（v1.3 §6.2 能力阶梯 L5 桥档案员本职），不再依赖 AI 自觉。

## Source-of-truth

唯一权威源：design.md ## Decisions

### D1 — vendor `resolvePublicationContext` 改 while 循环跳到 `basename === 'changes'`

来源：design.md D1
理由：A 是补丁思维，对未来 `changes/archive/<archive>/foo` 套娃场景仍可能漏

### D2 — 新增 `cmd-distill.mjs` 子命令（蒸馏自动化）

来源：design.md D2
理由：A 已被 v1.4 证明不可靠（AI 跳步骤 → 撒谎落地）

### D3 — bridge archive / Batch N 模板加 `fs.existsSync(why.md)` 校验

来源：design.md D3
理由：A 已证明不可靠


## spec-rev

待 sync 写回执后填（回执 hash 自动盖 spec.md，why.md 只引用）

## Non-Decisions（主动不做 / why 已知）

<!-- 来自 design.md ## Out-of-scope decisions；由 AI 跑 distill 后手动补 -->

## Open Questions for follow-up

<!-- 见 design.md ## Open Questions / 决策未覆盖的问题 -->
