# Execution Contract — v1.2 follow-up B7 硬性步骤栏

## 意图锁

补 v1.2 B7 的执行期盲点：把"每批前 bridge next" + "进入 executing 必须 state set" 从 SKILL.md 的"建议"升级为"硬性步骤"，让导航员角色真正上岗。继承父 `2026-09-18-v1-2-navigator-architect`（artifacts_hash sha256:1e3159da64f24de1c1809462e783436b2bddb86c73f64c62a2a5b5df5d3e05a5）。

## 范围

**In scope**：2 个 ADDED Requirement（stage-aware 导航 + SKILL.md §3 硬性步骤栏）、2 个 Batch（B1 next 命令扩展 + B2 SKILL.md 修订 + 归档）。

**Out of scope**：归档后的 stage 历史修正 / 主动调度 hook / 其他 § 的硬性化。

## Requirements 摘要

| ID | 描述 | 验收 | Batch |
|----|------|------|-------|
| R1 | stage-aware 导航提示（contracted/archived/patching/executing 五分支） | 3 scenarios | B1 |
| R2 | SKILL.md §3 硬性步骤栏（2 条 hard step） | 1 scenario | B2 |

## 约束

1. bridge.mjs 行数 ≤ 350（继承 v1.2 C9）
2. cmd-next.mjs 改动 ≤ 30 行
3. SKILL.md 改动只在 §3 顶部加 1 段（不破坏 §1/§2/§4/§5）
4. 测试通过率 ≥ 100%
5. 父引用完整性：parent_artifacts_hash 必须从父 .bridge.yaml 快照，本次不重算

## 升级规则

- next 命令的 stage-aware 输出与现有调用方语义冲突 → 立即停，回 planning
- bridge.mjs 行数突破 350 → 立即停，回 planning 拆 slices
- SKILL.md 硬性步骤栏导致 §3 其他段失效 → 立即停，回 planning
- 父 parent_artifacts_hash 校验失败（v1.2 自身被改） → 立即停，按 ADR-0005 开新 follow-up

## 批次

| Batch | 内容 | 验证 |
|-------|------|------|
| B1 | cmd-next.mjs stage-aware 扩展 + navigator-b3 +2 用例 | 全量回归 ≥48 绿 |
| B2 | SKILL.md §3 硬性步骤栏 + sync + verify + 归档 | 归档态 next 输出含 ADR-0005 |

## Workflow

`workflow_kind: matt`（继承父）。本变更体量小，跳过 matt `/to-spec` 重演；所有内容来自 grill 会话决策 + 本会话协议自证。