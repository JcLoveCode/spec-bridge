# Change: v1-3-research-xrouter

## Why

v1.2 桥的"导航员"角色只指引桥内 13 条命令（state set / hashes / sync / verify 等），不跨协议路由到 openspec-cn（11 skill）、spec-superflow（9 skill）、superpowers（14 skill）、matt（30+ skill）这四套下游协议栈。

v1.3 要把"桥导航员"角色真正闭环——`bridge next` 在 stage=X 时推荐 `use_skill Y` + `cli Z` 组合。但**在做 v1.3 之前，需要 cited evidence**：4 套下游栈各自的 skill 名/职责/触发条件/CLI 入口，否则 grill 会失真。

## What Changes

- 新增（研究性）change：读 4 套栈全部 SKILL.md，产出一份 cited 笔记到 `.scratch/v1-3-cross-stack-research.md`
- 笔记作为 v1.3 实现期 change（独立 ID）的依据

## Scope

### In Scope

- 读 4 套栈全部 SKILL.md（bridge / openspec-cn / spec-superflow / superpowers / matt）
- 写 `.scratch/v1-3-cross-stack-research.md`（每条断言引用具体文件路径 + 行号）
- 走完桥协议：sync / verify / git mv archive + state set archived
- 蒸馏 `specs/v1-3-research-xrouter/why.md`

### Out of Scope

- **不**改 v1.2 桥代码（`skills/spec-bridge/scripts/*.mjs` / `SKILL.md` / `.bridge.yaml` 模板字段）
- **不**开 v1.3 实现期 change（那是下一个 change，依赖本笔记作为依据）
- **不**做 grill-with-docs（use_skill 列表里不可用；v1.3 motion 锐化由本笔记完成后对话 interview 完成）
