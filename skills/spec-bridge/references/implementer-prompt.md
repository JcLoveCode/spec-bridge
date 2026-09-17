# Implementer Prompt — 子代理派发模板

改编自 spec-superflow build-executor 的 implementer-prompt（MIT，MageByte-Zero），
去掉 `ssf execution show` / wave receipt 依赖，其余协议原样保留。

派发实现者子代理（CodeBuddy = Task 工具）时，用这个骨架填 prompt：

```text
Subagent: code-explorer / general-purpose
  description: "Implement Task N: [任务名]"

  You are implementing Task N: [任务名]

  ## Task Description
  Read your task brief first: <change-dir>/execution-contract.md（只做分配给你的批次）
  It contains the approved requirements, scope fence, and validation obligations.

  ## Context
  [场景：这个任务在变更里的位置、依赖、架构上下文（来自 design Decisions）]

  ## Before You Begin
  If you have questions about the requirements, acceptance criteria, approach,
  dependencies, or anything unclear — **ask them now.** Don't guess.

  ## Your Job
  1. Implement exactly what the task specifies（TDD：先 RED 后 GREEN）
  2. Run the smallest relevant validation during development
  3. Compare the finished diff against every assigned requirement
  4. Self-review（见下方清单）
  5. Report back

  Work from: [目录]

  While you work: anything unexpected or unclear → pause and ask. Never guess.

  ## Hard Boundaries
  - In scope: <批次任务清单>
  - Out of scope: <Scope Fence 内容>；不做顺手重构、不拉下游任务
  - 不 push、不开 PR、不动 tracker、不部署

  ## Self-Review Checklist
  - [ ] 完整性：每个分配的需求都有对应实现与验证
  - [ ] 质量：遵循仓库既有模式；行为证据优先于实现细节断言
  - [ ] 纪律：没有超范围改动；契约破裂立即报告而非绕过
  - [ ] 测试：跑了最小相关验证；结果如实记录

  ## Report Format
  Write the full report to <change-dir>/progress.md (append), then reply with
  a summary of AT MOST 15 lines, first line being exactly one of:
  DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
```

## 四种回执状态的含义

| 状态 | 含义 | 控制器动作 |
|---|---|---|
| `DONE` | 全部完成且验证通过 | 推进批次，安排审查 |
| `DONE_WITH_CONCERNS` | 完成但有保留（残余风险/偏离说明） | 审查时重点核对 concerns |
| `BLOCKED` | 被阻塞（技术/依赖/契约矛盾） | 带 evidence 上抛规划层 |
| `NEEDS_CONTEXT` | 任务描述不足以开工 | 补充上下文后重新派发 |
