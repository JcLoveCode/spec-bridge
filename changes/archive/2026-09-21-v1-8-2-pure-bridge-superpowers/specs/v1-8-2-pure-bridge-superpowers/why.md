# Why: v1-8-2-pure-bridge-superpowers

## Conclusion

把 bridge 从"导航员 + 兜底模板生成"收缩成"纯导航员"——bridge 只建台账 + 路由，不写任何 spec 模板；同时把 superpowers 加入项目栈探测优先级，让 superpowers 栈的用户被正确推 superpowers 栈的具体 skill（tdd / brainstorming）。

## Source-of-truth

唯一权威源：design.md ## Decisions

### D1 — 砍 --builtin flag，bridge init 永远不写模板

来源：design.md D1
理由：砍 `--builtin` 是 v1.8-2 的核心叙事——"纯桥模式"。留 deprecated 等于留逃生口 = 没说"纯桥"

### D2 — superpowers 加入 detect-stack 优先级

来源：design.md D2
理由：与 matt 同等强度（matt 也是双信号：`.claude-plugin/` + `package.json` 含 `"matt-skills"` 字段），逻辑对称

### D3 — WORKFLOW_KINDS 值域扩为 4 个

来源：design.md D3
理由：

### D4 — probe fallback 行为文案调整

来源：design.md D4
理由：v1.8-1 现状 reason 是"按 D4 优先级 4 兜底（AI 自由发挥）"——技术话术

### D5 — 测试更新

来源：design.md D5
理由：

### D6 — 文档同步

来源：design.md D6
理由：


## spec-rev

待 sync 写回执后填（回执 hash 自动盖 spec.md，why.md 只引用）

## Non-Decisions（主动不做 / why 已知）

<!-- 来自 design.md ## Out-of-scope decisions；由 AI 跑 distill 后手动补 -->

## Open Questions for follow-up

<!-- 见 design.md ## Open Questions / 决策未覆盖的问题 -->
