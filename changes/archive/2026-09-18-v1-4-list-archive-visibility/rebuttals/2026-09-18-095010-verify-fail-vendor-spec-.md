# Rebuttal — 2026-09-18

**objection**: verify FAIL 因 vendor spec-publication.mjs resolvePublicationContext 处理 archive 路径时走 else 分支算错 projectRoot（指向 changes/archive 而非仓库根），非 v1.4 引发的 v1.4 错——v1.3 archive verify 同样触发。修法走 v1.5 vendor 改动：resolvePublicationContext 加 while 循环跳到 basename === 'changes' 再算 projectRoot。
**tag**: vendor-archive-resolve-bug
**change**: changes/archive/2026-09-18-v1-4-list-archive-visibility

> 人工复验异议（R3-Q2 双轨）。是否升级为 follow-up 由人决定；
> 升级路径：init <name> --parent <本变更>（ADR-0005）。
