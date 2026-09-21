# Why: v1-7-probe-active-navigator

## Conclusion

把"导航员激活"（ADR-0001 设计原则 + ADR-0008 跨协议推荐器）落到一个可调用的 CLI：

## Source-of-truth

唯一权威源：design.md ## Decisions

### D1 — probe 是 CLI 命令，不是 SKILL.md 段

来源：design.md D1
理由：用户选 A。B 已被 grill 拒绝（AI 不会主动执行探测逻辑；prompt 合规性差）。

### D2 — probe 不写文件，stdout 实时输出

来源：design.md D2
理由：用户选 A。B/C 都被 grill 拒绝（污染状态目录；与 §0 "状态只在磁盘 .bridge.yaml" 原则冲突）。

### D3 — probe 探测 4 维度：项目类型 + 能力缺口 + inventory + 拍点

来源：design.md D3
理由：用户选 A（多选）。B 缺 inventory → 路由错（用户用 OpenSpec explorer 完后 probe 仍推荐 Matt skill）。C 缺项目类型 → 路由缺基础上下文。

### D4 — 路由优先级 Superpowers > Matt > OpenSpec > 都不给

来源：design.md D4
理由：用户原话 "又有 superpower 的能力就执行 superpower 能力建议,没有就继续用 matt skills 都没有就不给建议 skills"——4 级优先级。

### D5 — 输出格式标准化（stdout）

来源：design.md D5
理由：人眼可读 + 解析方便（每行 [key] [value]）+ AI 易解析。JSON 多余的语法噪音。自由格式不稳定。

### D6 — SKILL.md §1 加"每轮状态宣告"段

来源：design.md D6
理由：用户选 A。B 强制 inventory 会让 AI 不调 probe（嫌烦）。C 缺 inventory 维度。

### D7 — probe 内部调 `bridge next`，合并输出

来源：design.md D7
理由：避免 AI 调两次。next 语义不变（单独用还在）。C 是重写没必要。

### D8 — probe 推荐 + 引导，不自动调 skill

来源：design.md D8
理由：保留 ADR-0001 "prompt 管判断，代码管操作"原则。B/C 让 probe 替代 AI 决策，违反设计初衷。


## spec-rev

待 sync 写回执后填（回执 hash 自动盖 spec.md，why.md 只引用）

## Non-Decisions（主动不做 / why 已知）

<!-- 来自 design.md ## Out-of-scope decisions；由 AI 跑 distill 后手动补 -->

## Open Questions for follow-up

<!-- 见 design.md ## Open Questions / 决策未覆盖的问题 -->
