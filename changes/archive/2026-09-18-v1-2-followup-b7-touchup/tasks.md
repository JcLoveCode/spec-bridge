# v1.2 follow-up B7 — 任务批次

> 仅 2 批，单会话可完成（matt 短路径）。每批开头按硬性步骤（design D1/D2）：先 `bridge next` 看下一步 → 干活 → `bridge next` 留痕。

## Batch 1 — next 命令 stage-aware 扩展 + 2 测试

**目标**：实现 D2 + D3 测试骨架。

**步骤**：
1. `bridge next`（开工前，看当前拍点）
2. 改 `cmd-next.mjs`：contracted-with-approved 分支 + executing-with-batch 命名分支
3. `tests/navigator-b3.test.mjs`：+2 用例
4. 全量回归（48 → 50）
5. `bridge next`（批末，确认进入 Batch 2）

**验证**：next 在 staged change 上输出含 advised 改文案 + Batch N 提示。

## Batch 2 — SKILL.md §3 硬性步骤栏 + 归档收口

**目标**：D1 + D4 文档修订 + follow-up 归档。

**步骤**：
1. `bridge next`（开工前）
2. 改 `SKILL.md` §3 顶部加硬性步骤栏（entering executing + before each batch）
3. 验证 SKILL.md 引用 `bridge` 命令全名（避免拼写漂移）
4. `bridge next`（批末，sync 前）
5. `bridge sync` + `bridge verify`（follow-up 自身没新 spec delta，仅校验父基线）
6. `bridge next`（归档后，看归档态输出确认 ADR-0005 守门）
7. 归档目录移入 `changes/archive/`
8. commit + push v1.2-followup-b7 分支

**验证**：
- SKILL.md §3 硬性步骤栏每条命令可执行
- `bridge next` 在 archive/ 上输出含"已归档 + ADR-0005 守门"
- 全量回归 ≥50 绿