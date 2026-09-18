# Why: v1-3-research-xrouter

## Conclusion

v1.2 桥的"导航员"角色只指引桥内 13 条命令，不跨协议路由到 openspec-cn / spec-superflow / superpowers / matt 4 套下游协议栈。v1.3 改桥的最小化设计 = `cmd-next.mjs` 在 `advised` 字段追加跨协议 use_skill 推荐（推荐项限 superpowers + matt，不推 4 套 Coordinator 替代以避免认知负担）。

## Source-of-truth

唯一权威源：`changes/v1-3-research-xrouter/design.md ## Decisions`

### D1 — research 不改桥代码（继承）

来源：design.md D1
理由：v1.2 协议 ADR-0005 要求"归档后改桥必须开 follow-up change"——边 research 边改桥会污染 research change 的 stage 语义。

### D2 — 笔记写到 .scratch/（继承）

来源：design.md D2
理由：`.scratch/` 是 matt-skills 标准位置（临时研究笔记）；`specs/` 是根基线（要 sync 才落）；change 内的文件会随 archive 移到 archive/（不利于 v1.3 实现期 change 引用）。

### D3 — research 用主 agent 直接读（继承）

来源：design.md D3
理由：use_skill 列表里没 `research`；Task 子代理适合读 100+ 文件，本研究 4 套栈 ~35 SKILL.md 不大；主 agent 直接读能立刻判断。

### D4 — v1.3 改点 = cmd-next.mjs 加 advised.protocol 字段（新增）

来源：research 蒸馏产生，evidence：.scratch/v1-3-cross-stack-research.md §7
理由：v1.3 闭环 = 桥"导航员"角色跨协议路由；最小化改 = 不动 13 命令、不动 .bridge.yaml schema，只在 advised 加 1 字段。

### D5 — 推荐限 superpowers + matt（新增）

来源：research §6.3 + §8.1 风险
理由：openspec-cn / spec-superflow / spec-bridge 三套同质 Coordinator，并存 = 认知负担；superpowers 纪律层 + matt 跨 session 是**正交价值**——推荐这俩避免第 4 套 Coordinator 抢用户。

## Linked Evidence

- 研究笔记：`.scratch/v1-3-cross-stack-research.md`（401 行，cited 5 套栈）
- design decisions：changes/v1-3-research-xrouter/design.md

## spec-rev

待 sync 写回执后填（回执 hash 自动盖 spec.md，why.md 只引用）

## Non-Decisions（主动不做 / why 已知）

- **不**改桥 13 命令清单（research §1.5 已 evidence）
- **不**改 .bridge.yaml schema（research §1.5）
- **不**支持 spec-superflow build-executor 委托（research §6.3 A 候选留 v2+）
- **不**支持多 wave 并行（research §6.2 spec-superflow 独有，桥不复制）

## Open Questions for v1.3 follow-up

1. v1.3 路由表测试用 mjs 还是 yaml 静态测试？
2. SKILL.md §6 跨协议路由小节何时写？（v1.3 实现期一并）
3. ADR-0008 何时落？（v1.3 实施第一批）
4. v1.3 是否真要在 cmd-next.mjs 加 advised.protocol，还是只更新 SKILL.md 建议？
