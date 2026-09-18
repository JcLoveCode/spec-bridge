# Design: v1-3-research-xrouter

## Purpose

本 change 是 v1.3 "桥导航员"闭环的**前置研究**——读 4 套下游栈全部 SKILL.md，产 cited 笔记。无代码改动。

## Architecture

N/A（无架构改动）。笔记结构：

1. 总览表（5 套栈 + 入口 + skill 数 + CLI）
2. 各栈 skill 详解（name / description / 触发条件 / CLI 入口）
3. 跨协议路由机会（哪两个 skill 在哪个 stage 能互替）
4. v1.3 改桥 `next` 命令的最小化设计（路由表草案）

## Decisions

### D1 — research 不改桥代码

**选项**：A. 边 research 边改桥  B. 先 research 出笔记，再开 v1.3 改桥
**决定**：B
**理由**：v1.2 协议 ADR-0005 要求"归档后改桥必须开 follow-up change"——边 research 边改桥会污染 research change 的 stage 语义（应该是 research-only，archive 时不能携带代码改动）

### D2 — 笔记写到 `.scratch/` 而非 `specs/`

**选项**：A. `.scratch/v1-3-cross-stack-research.md`  B. `specs/v1-3-research-xrouter/spec.md`  C. `changes/v1-3-research-xrouter/research-notes.md`
**决定**：A
**理由**：`.scratch/` 是 matt-skills 标准位置（临时研究笔记）；`specs/` 是根基线（要 sync 才落）；change 内的文件会随 archive 移到 archive/（不利于 v1.3 实现期 change 引用）。`.scratch/` 是 v1.3 change 的"前置证据"层

### D3 — research 用主 agent 直接读，不用 `/research` 后台 agent

**选项**：A. use_skill research（matt）  B. Task 子代理  C. 主 agent 直接 read_file
**决定**：C
**理由**：（a）use_skill 列表里没 `research`（只有 ask-matt 间接提到）；（b）Task 子代理适合读 100+ 文件，本研究 4 套栈 ~35 SKILL.md 不大；（c）主 agent 直接读能立刻判断哪些值得深读，无需跨进程

## Out-of-scope decisions（明确不做的）

- 不写 v1.3 实现代码（那是下一个 change）
- 不做 grill-with-docs（v1.2 归档 → v1.3 改桥需要新 follow-up change，而 follow-up 引用本 change 的 artifacts_hash）

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| research 超长导致 context 爆 | 笔记不完整 | 分批 read_file，每批 ≤5 文件 |
| 4 套栈 SKILL.md 数量变化 | research 漏读 | research 完用 `find` 复核已读清单 |
| openspec-cn CLI 实际未装 | skill 描述说"需要 openspec-cn"但本地无 | 在笔记 §风险 注明，不阻塞 v1.3 设计 |
| superpowers 元 skill 未读 | 漏掉 `using-superpowers` 的全局规则 | 显式把 `using-superpowers` 列进 Batch 4 |
