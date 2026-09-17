# Contract Mapping — 4 产物 → 1 份执行契约

抽离自 spec-superflow 的 contract-builder（MIT，MageByte-Zero），去掉了 `ssf` CLI 依赖：
模板自备、状态走 `.bridge.yaml`、hash 走 `bridge hashes`。映射表原样保留。

压缩本质：**4 份讨论性文档 → 1 份执行握手契约**。转译，不是复制。
原文原则："Prefer compression over repeating planning details."

## 输入 → 输出映射

| 来源 | 提取 | 契约段落 |
|---|---|---|
| `proposal.md` → `## Why` + `## What Changes` | 问题 + 范围 | **Intent Lock** |
| `proposal.md` → `## Scope > ### Out of Scope` | 范围栅栏 | **Scope Fence** |
| `specs/` → 每个 `### Requirement:` | 已批准需求、场景、测试义务 | **Approved Requirements** |
| `design.md` → `## Decisions` | 架构/接口/依赖约束 | **Constraints** |
| `tasks.md` → 编号任务组 | 执行批次、完成定义、审查时点 | **Execution Batches** |

## 生成前必做的三件事

1. **读完再写**：4 产物全文 + `.bridge.yaml`（尤其 `contract_approved` 之前的决定），不要凭记忆重构。
2. **需求覆盖交叉检查**：把 `specs/` 里每一条 SHALL/MUST 列出来，逐条确认
   (a) 反映进了 Approved Requirements；(b) 有测试义务；(c) 落在至少一个批次。
   映射不上的**不许沉默丢弃**，进 Escalation Rules 显式标出。
3. **跨批次依赖**：批次间的先后/阻塞关系写明。

## 契约模板（`execution-contract.md`）

```markdown
# Execution Contract: <change 名称>

## Intent Lock
<问题一句话 + 要改变什么>

## Scope Fence
### In Scope
- ...
### Out of Scope
- ...

## Approved Requirements
- [ ] R1 <需求名>：<一行行为>（测试义务：<怎么验>）
- ...

## Constraints
- <来自 design Decisions 的架构/接口/依赖约束>

## Execution Batches
- Batch 1: <任务号们> —— 完成定义 <...>，审查时点 <批末>
- ...

## Escalation Rules
- <映射不上的需求 / 未决问题 / 会强制回退规划的条件>
```

## 批准门（DP-3 简化版）

草稿完成后：总结交接规则 → 指出仍存歧义处 → 列出未映射需求 → **请用户显式批准**。
批准后按 SKILL.md §3 写状态（contract_approved / 两个 hash / stage=contracted）。
**不批准不执行，无例外；不许替用户批准。**

## 过期检测（内容级，不看时间戳）

`node <bridge> hashes <change-dir> --check` 报漂移，或人工判断出以下任一条：
proposal 范围变了 / specs 已批准需求变了 / design 约束变了 / tasks 批次实质变化
→ 契约作废，回 `contracted` 之前重走本流程。修改后的契约需要重新过批准门。
