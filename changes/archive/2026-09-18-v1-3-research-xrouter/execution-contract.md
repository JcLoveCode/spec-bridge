# Execution Contract: v1-3-research-xrouter

## Intent Lock

v1.2 桥的"导航员"只指引桥内命令，不跨协议路由；v1.3 闭环需要前置 evidence——本 change 读 4 套下游栈 SKILL.md 产 cited 笔记。

## Scope Fence

### In Scope

- 读 5 套栈全部 SKILL.md
- 写 `.scratch/v1-3-cross-stack-research.md`
- 走完桥协议归档流程（sync / verify / archive）

### Out of Scope

- 改 v1.2 桥代码（`skills/spec-bridge/`）
- 开 v1.3 实现期 change（独立 follow-up）
- 跑 `/grill-with-docs`（use_skill 列表不可用；改由对话 interview 完成）

## Approved Requirements

- [x] **R1** — research-evidence-base：产 cited 笔记覆盖 5 套栈（测试义务：笔记存在 + 引用文件路径 + 行号）

## Constraints

- 笔记写到 `.scratch/`，不写 `specs/`（理由：design D2）
- 不改 v1.2 桥代码（理由：design D1）
- research 用主 agent 直接读，不用 `/research` 后台（理由：design D3）

## Execution Batches

参见 tasks.md（7 batch）：

- Batch 1: research spec-bridge
- Batch 2: research openspec-cn
- Batch 3: research spec-superflow
- Batch 4: research superpowers
- Batch 5: research matt-skills
- Batch 6: 跨协议路由表
- Batch 7: 归档

## Escalation Rules

- openspec-cn CLI 实际未装 → 笔记注明，不阻塞 research
- 4 套栈 SKILL.md 总数超过 50 → 改用 Task 子代理分担
- 笔记超过 10000 字 → 拆 §1-§8 为 8 个文件
- bridge 协议本身与 4 套栈语义冲突 → 笔记 §风险 章记录，不强解
