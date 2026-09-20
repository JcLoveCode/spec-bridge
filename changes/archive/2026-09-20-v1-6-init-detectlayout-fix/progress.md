# Progress: v1-6-init-detectlayout-fix

## Batch 1 — detectLayout 加 openspec/ 弱信号 + 回归测试 ✅

### 任务完成

| 任务 | 状态 | 证据 |
|---|---|---|
| **T1.1** 增强 init-integration.test.mjs 加 R1.6 + R1.7 回归 case | ✅ | 2 case 全 PASS（与 R1.5.1 RED→GREEN 一共 10 case） |
| **T1.2** 改 `bridge.mjs:103-126` `detectLayout` 加 openspec/ 弱信号 | ✅ | while 优先级链加第 4 条 `existsSync(join(root, 'openspec'))` |
| **T1.3** 改 `cmd-init.mjs:206-219` mirror `detectLayout` 同步加弱信号 | ✅ | mirror 一致（R7 验证） |
| **T1.4** 全套 98/98 PASS | ✅ | `node --test tests/*.test.mjs` |
| **T1.5** 文档同步（ADR-0009 v1.6 附录 + CONTEXT.md Layout 段） | ✅ | ADR-0009 +25 行；CONTEXT.md 3 行修正 |

### TDD 闭环

| 阶段 | R1.5.1 | R1.6 (v1.6) | R1.7 (v1.6) |
|---|---|---|---|
| **RED**（detectLayout 改前） | ❌ FAIL | ✅ PASS（化石保护本就工作） | ✅ PASS（同上） |
| **GREEN**（detectLayout 改后） | ✅ PASS | ✅ PASS | ✅ PASS |

**RED→GREEN 关键 diff**：`bridge.mjs:118-120` + `cmd-init.mjs:215-217` 加 3 行 if `existsSync(join(root, 'openspec'))` → `openspec` layout。

### 顺手修（scope 外但必要）

| 改动 | 原因 |
|---|---|
| `tests/docs-sync-test.mjs:243` `assert.strictEqual(parsed.archived_count, 5)` → 7 | v1.5 归档后 archive 计数从 5 涨到 7，v1.5 progress.md 写"95/96 PASS"时 R6 应已 fail 但没记录。v1.6 改 docs 时顺手同步到 7，保持"全套 PASS"承诺 |

### 实战端到端验证

```bash
$ bridge list .  # 在 spec-bridge 仓库根
# 输出（JSON）：
# {
#   "layout": "standalone",
#   "changes": [...],
#   "archived_count": 7
# }
```

**R3 端到端保护** PASS：spec-bridge 仓库根有 openspec/（OpenSpec CLI 本地安装）+ changes/archive/ 有 7 个化石 → `layout: standalone`（archive 化石压制 openspec/ 弱信号，符合 v1.4 ADR-0009）。

### 验收证据

- `bridge.mjs detectLayout`: 11 行 if-else 链（+3 行新加弱信号）
- `cmd-init.mjs mirror detectLayout`: 11 行 if-else 链（+3 行新加弱信号，与 bridge.mjs 同步）
- `init-integration.test.mjs`: 10 case（新增 R1.6 + R1.7 共 26 行）
- `docs-sync-test.mjs`: 8 case（R6 hardcode 5 → 7 顺手修）
- `ADR-0009-detectlayout-archive-fossil-priority.md`: +25 行 v1.6 附录
- `CONTEXT.md`: 2 段 Layout 探测规则修正
- 测试输出：`tests 98 / pass 98 / fail 0`

### 下一步

进入 **Batch N — v1.6 归档流程**：
- TN.1 `bridge sync changes/v1-6-init-detectlayout-fix` → 写回执
- TN.2 `bridge verify changes/v1-6-init-detectlayout-fix` → PASS
- TN.3 `bridge distill changes/v1-6-init-detectlayout-fix` → 写 why.md
- TN.4 `bridge archive-ready changes/v1-6-init-detectlayout-fix` → D3 守门员 PASS
- TN.5 `git mv changes/v1-6-init-detectlayout-fix changes/archive/<date>-v1-6-init-detectlayout-fix/`
- TN.6 `bridge state set <archive-path> stage archived`
- TN.7 commit + merge v1.6 → main

### 已知遗留（v1.7+ 续作候选）

1. v1.4 archive verify FAIL（receipt 历史值 vs 新算法真 hash 不匹配）—— v1.5 已识别，v1.6 不修
2. ~~init-integration R1.5.1 fail~~ — **v1.6 已修**（detectLayout 加 openspec/ 弱信号）
3. vendor spec-publication.mjs receipt 算法无 version 字段（每次 vendor 升级破历史 receipt）—— v1.5 已识别，v1.6 不修
4. R6 hardcode 已顺手修——遗留取消