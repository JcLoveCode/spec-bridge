# ADR-0003: 单向蒸馏——why 共址 specs，hash 只盖 spec.md

- 状态：Accepted（2026-09-17）
- 决策人：JcLoveCode（与 AI 结对设计）

## 背景

归档时刻同时存在两个"汇"：spec-mrg 的发布（delta → 根基线，确定性代码）和知识蒸馏
（抽取 why/结论，LLM 判断）。它们感觉像一件事，但动词、执行者、信任模型都不同。
若合并进一个引擎：要么 LLM 碰基线（危险），要么代码做蒸馏（不可能）。
若拆成两棵树（specs/ + kb/）：两套格式、两个检索入口，重。

## 决策

1. **层级合并，不合并引擎**：归档是**一个用户可见步骤**，内部四拍
   `sync → verify → why 蒸馏 → 挪 archive/`；前两拍走 vendored 引擎，第三拍是 LLM 模块。
2. **同树共址，不建第二棵树**：why 笔记直接放 `specs/<capability>/why.md`，与 spec.md 比邻。
   不引入独立知识库树，不复用 OKF 格式。
3. **hash 只盖 `spec.md`**：发布回执不包含 why.md——基线保持确定性与可验证性，
   why.md 可以随时被 LLM 补写/修订而不作废回执。
4. **单向**：蒸馏只读 change 产物 + 基线，只写 why.md，**永不写 spec.md 或 changes/**；
   只蒸馏有发布回执的 change；不可还原的 why 写"why 未知"，禁止编造；
   每条带 `spec-rev: <回执hash>` 供陈旧判定。
5. **定时通道只做兜底**：按 commit 界扫 `specs/` + `changes/archive/` 增量补漏，
   主通道永远是归档时的当场蒸馏（归档那一刻 why 最热）。

## 拒绝的备选

- **引擎级合并**：见背景，两种实现都会坏掉一方的信任模型。
- **保留独立 kb/ 树（OKF）**：两棵树的重没有被价值抵消；kb-distill 作为独立项目 skill
  继续存在，管**非 spec 类**知识（API 契约、答疑结论），与本 skill 彻底分家。

## 后果

- 正面：一棵树；基线验证不受 why 修订影响；检索入口唯一。
- 负面：why.md 无 schema 校验（自由 markdown），质量靠"溯源到断言 + spec-rev"两条纪律兜底；
  若未来需要结构化知识消费，需另立机制（那是新 ADR 的事）。
