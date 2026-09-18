# Progress: v1-5-vendor-distill-guard

## Batch 1 — vendor resolvePublicationContext while 循环

### 任务完成

- ✅ **T1.1** 改 `scripts/vendor/spec-publication.mjs:271-280` `resolvePublicationContext`：单 if-else → while 循环跳到 `basename === 'changes'`
- ✅ **T1.2** 写 `skills/spec-bridge/tests/vendor-resolve-publication-context.test.mjs`：3 case（active / archive / 套娃 archive）全 PASS
- ✅ **delta-apply.test.mjs** 回归 6/6 PASS（无 vendor regression）

### TDD 闭环

| 阶段 | active case | archive case | 套娃 archive case |
|---|---|---|---|
| **RED**（改前） | ✅ PASS | ❌ FAIL | ❌ FAIL |
| **GREEN**（改后） | ✅ PASS | ✅ PASS | ✅ PASS |

bug 真实复现：archive 路径下 projectRoot 被算成 `…/changes/archive/`（archive 目录被当仓库根），baselineSpecsDir 找不到 specs/，verify 走 hash 比对时全 `<missing>` 占位 → FAIL。修复后三种路径都正确解析回仓库根。

### 完成定义 vs 实际 — 偏差报告

**tasks.md Batch 1 完成定义**：
> `node bridge.mjs verify changes/archive/2026-09-18-v1-4-list-archive-visibility` 不再因 projectRoot 错而 FAIL

**实际**：
```bash
$ node bridge.mjs verify changes/archive/2026-09-18-v1-4-list-archive-visibility
FAIL: The published baseline has changed since publication.
exit 1
```

**根因**（v1.4 rebuttal 大事记预言过）：
- v1.4 归档时 vendor bug 还没修，projectRoot 算成 `…/changes/archive/`
- v1.4 receipt 的 `baseline_after_hash` = `sha256:009f1ec3...` 是按"archive 下 specs 全 `<missing>` 占位"算的**假 hash**
- vendor 修后，verify 重算 baseline hash = 真实仓库根 specs/<cap>/spec.md 的 hash
- 两个 hash 必然不等 → "baseline has changed" → FAIL

**好消息**：FAIL 原因从"vendor 算法错"（找不到 specs）变成"receipt 历史值错"（假 hash vs 真 hash）——**vendor bug 实际修了**（R1 实现完成），是 receipt 历史值需要 rebase。

### v1.4 verify FAIL 的解决路径

v1.4 archive 已 `stage: archived`（write-protect，ADR-0005），不能改 .bridge.yaml 的 receipt。两条路：

1. **v1.5 加 sub-task**：用 `bridge rebuttal` 标记 v1.4 receipt 为"按 bug 算法算的已废 hash"——不修 verify FAIL，但让"verify FAIL 是已知偏差"成为 archive 的官方记录
2. **v1.6+ 续作**：rebase v1.4 receipt（用新算法重算 `baseline_after_hash` 并写回 .bridge.yaml）——但这要破 ADR-0005 写保护规则，scope 大

**推荐**：v1.5 不动 v1.4，Batch 1 完成度判定 = "T1.1 + T1.2 实现完成，verify FAIL 偏差已识别并记录"。v1.6 续作 rebase receipt。

### 验收证据

- vendor 改 diff：`scripts/vendor/spec-publication.mjs:271-280`（if-else → while，10 行替换 2 行）
- 新测试：`skills/spec-bridge/tests/vendor-resolve-publication-context.test.mjs`（50 行，3 case）
- 测试输出：`tests 3 / pass 3 / fail 0` + `delta-apply tests 6 / pass 6 / fail 0`

### 下一步

进入 **Batch 2**（cmd-distill.mjs 新子命令 + bridge.mjs dispatch + tests）：
- T2.1 写 `scripts/cmd-distill.mjs`
- T2.2 改 `scripts/bridge.mjs` dispatch 加 `distill` 入口
- T2.3 写 `tests/cmd-distill.test.mjs`