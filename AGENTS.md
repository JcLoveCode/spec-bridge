# AGENTS.md — spec-bridge 项目

> 给贡献者 AI 看：业务目的 + 设计铁律 + 禁止事项。
> 注意：这是 **spec-bridge 项目根**的 AGENTS.md（贡献者视角）。
> spec-bridge **使用方项目**的 AGENTS.md 由使用方自行加，见 README §4。

## 这是什么项目

**组织级工作桥**：把人和 agent 的产物汇总成个人+团队两层（跨迭代保留）；
导航员主动路由到 superpowers / matt / openspec 三栈的 skill；
工作可丢给另一个窗口执行。

## 业务目的（**先读**，所有代码设计都按这个走）

- **a. 桥** — 跨人跨迭代汇总（个人 + 团队两层），v1.7+ 实施
- **a'. 两层记忆规则** — 个人层（IDE memory 优先 + fallback bridge 空骨架）+ 团队层（archive 触发 sync + hash 校验 + cap 边界 + orphaned 沉淀），**v1.8-3** 实装（ADR-0013）
- **b. 导航员** — 主动识别对话层意图，路由到三栈具体 skill，**v1.7** 实装（`bridge probe`）
- **c. to-goal** — 跨 session 传递工作，**v1.7+** 实施

详细描述与实现状态：[README.md §1](./README.md#1-业务目的)。

## 设计铁律（不可违反）

1. **状态只在磁盘**（`changes/<name>/.bridge.yaml`）——不依赖对话记忆。
2. **prompt 管判断，代码管操作**——CLI 是唯一确定性入口（Node ≥ 20）。
3. **零配置**——任何仓库开箱即用，零项目改动。

## 禁止事项（写代码前自查）

1. **不要**让 LLM 现场合并文本——所有合并走 `bridge sync / verify`。
2. **不要**给 bridge 增加 a/b/c 以外的能力——超出的能力属于下游 tool / 上游 plugin（如 OpenSpec / Matt / Superpowers）。
3. **不要**改 4 个 receipt 字段名（`artifacts_hash / contract_hash / published / spec_publication_receipt`）——`cross_refs` 字段是 **v1.8** 才开；`external_stack` / `adopted_at` 字段在 v1.8-1 起允许；`workflow_kind` 值域在 v1.8-2 扩为 `{superpowers, openspec, matt, builtin}`。
4. **不要**动 schema 不写 spec——任何 schema 改动必须先开 change（`changes/<name>/`）走 SDD 流程。
5. **不要**为 to-goal 写新引擎——直接 vendor 抄过来，完整内容见 matt-skills `to-goal` skill。
6. **不要**替 AI 写 memory 内容——bridge 只填骨架结构和元信息（`generated_by`），不总结决策 / 写 why / 写实现细节。AI 是决策者，bridge 是档案员（v1.8-3 / ADR-0013）。

## CLI 速查（13 条主线）

| 类别 | 命令 |
|---|---|
| 开新工作 | `bridge init / adopt` |
| 摸项目 | `bridge layout / list` |
| 推进导航 | `bridge next / probe / mention / rootcause / pattern` |
| 执行约束 | `bridge hashes / state set` |
| 收尾归档 | `bridge sync / verify / distill / archive-ready` |
| 维护 | `bridge rebuttal / event / state` |

完整业务化速查：[NAVIGATOR-AND-FUNCTIONS.md](./NAVIGATOR-AND-FUNCTIONS.md)

## 提交前自查

- `npm test` 全过（98+ cases）
- 改 CLI 命令：开 change（`changes/<name>/`）走 SDD 流程
- 改 schema 字段：先开 ADR 再开 change
- 业务目的偏离 a/b/c：先开 ADR 修订 README §1
