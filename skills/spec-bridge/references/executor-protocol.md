# Executor Protocol — 契约执行器

流程与回执格式内化自 Matt Pocock 的 `spec-executor`（原文件标注出处），叠加 spec-superflow
build-executor 的 TDD 铁律与批次审查。harness 无关：CodeBuddy 里"派发子代理"= Task 工具。

## 执行器选择（按 `.bridge.yaml` 的 capabilities 快照）

| 条件 | 执行方式 |
|---|---|
| superpowers 在场 | 用它的 TDD/SDD 流程做纪律层，`execution-contract.md` 作输入锚点注入 prompt |
| matt `spec-executor` 在场 | 它做基座（approved source = 契约），`tdd` / `code-review` 补纪律 |
| 都没有 | 本协议全文 + [implementer-prompt.md](./implementer-prompt.md) 派发子代理 |

## 执行前：Execution Lock（动手前先广播）

```
Executing: <一句话结果>
Source: execution-contract.md @ <change-dir>
In scope: <紧凑列表>
Out of scope: <紧凑列表>
Validation: <验证缝 + 必过门槛>
```

- 对照 `hashes --check`：漂移 → 停，回 contracted。
- 检查分支：`main`/`master` 上 → 停，切/建需求号分支。

## 四条铁律

1. **Contract First** — 契约是批准过的交接产物，不是聊天记录；不重开已定决策。
2. **TDD** — RED → GREEN → REFACTOR；测试义务逐条对上契约里的 R 编号。
3. **Review Before Drift** — 每批完成必须过一道审查（范围/规格符合性/缺测试），结论写
   `<change-dir>/progress.md`；逻辑缺陷、违反规格、缺测试、范围膨胀 = 阻塞。
4. **契约破裂即回退** — 新行为出现/接口变化 → 停止实现，回规划层裁决。

## 执行方式（自动启发式，报告但不阻塞）

- ≤2 任务 → inline 直接做
- 有独立并行波次 → Task 工具派发（**串行就是串行，绝不冒充并行**）
- 开工时向用户报告一行：`执行方式：batch（理由：…）`，用户当场反悔可覆盖

## 每批收尾

- 审查结论追加进 `progress.md`（无回执引擎，台账先行——wave receipt 是 v2 升级项）
- `node <bridge> state next <change-dir> "<下一步>"`

## 阻塞与上下文溢出

- 阻塞：先穷尽只读调查和本地验证，然后带着证据停，说明需要规划层做的最小决定。
- 太大做不完：**不许悄悄丢历史**——保留 worktree 状态，写部分回执，建议拆分。

## 执行回执（收尾必给，格式照抄 spec-executor）

```text
SPEC EXECUTION RECEIPT

- Conclusion: completed / partially completed / blocked
- Contract source: <change-dir>/execution-contract.md
- Requirements: <逐条 R 编号 + pass/fail + 证据（命令/计数/链接）>
- Main changes / Changed files:
- Branch:
- Validation results:
- Not validated or not executed:
- Risks and remaining work:
- Planning decision needed: <无则写 none>
```

不声称没验证过的环境/部署/外部动作；回执离开执行线程前脱敏。
