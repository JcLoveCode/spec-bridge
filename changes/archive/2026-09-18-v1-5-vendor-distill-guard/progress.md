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

---

## Batch 2 — cmd-distill 子命令 + 实战 v1.5 why.md

### 任务完成

- ✅ **T2.1** 写 `scripts/cmd-distill.mjs`：default export `run(args, io)`，从 design.md ## Decisions 蒸馏生成 specs/<cap>/why.md
  - 解析 ## Purpose 段 → Conclusion
  - 跨段抽取所有 `### D\d+ — <name>`（修 v1.5 实战 bug：原按段边界截断，Out-of-scope 子段后 D3 会被丢）
  - `extractFirstValue(body, key)` 取下一条非空行的非 bullet 内容（修 v1.5 实战 bug：原 regex 跳空行匹配到 bullet 第一行）
  - 校验：why.md 拒绝覆盖 / design.md 必存在 / 至少一条 D / change-dir 必是有效 bridge change
- ✅ **T2.2** 改 `scripts/bridge.mjs`：import `runDistill` + dispatch 加 `if (command === 'distill')` + usage 加 `distill <change-dir>` 行
- ✅ **T2.3** 写 `tests/cmd-distill.test.mjs`：6 case
  - case 1: design.md 有 D1+D2 → 生成 why.md 含 Conclusion + Source-of-truth + 2 条 D + spec-rev
  - case 2: 缺 ## Decisions 段 → exit 1
  - case 3: why.md 已存在 → exit 1 + 拒绝覆盖
  - case 4: design.md 不存在 → exit 1
  - case 5: 缺 .bridge.yaml → exit 1
  - case 6 (实战场景): design.md 在 ## Decisions 后接 ## Out-of-scope decisions 子段 → D1+D2+D3 全抽到

### TDD 闭环

| 阶段 | cmd-distill test |
|---|---|
| **RED** 预期 | fail（impl 不存在） |
| **GREEN 修后** | 6/6 PASS |

### 实战

```bash
$ node bridge.mjs distill changes/v1-5-vendor-distill-guard
distilled: changes/v1-5-vendor-distill-guard/specs/archive-publish-guard/why.md
  3 decisions extracted from design.md
```

why.md 实战生成内容：
- `# Why: v1-5-vendor-distill-guard`
- `## Conclusion`：从 design.md ## Purpose 取第一段（"堵住 v1.4 归档时暴露的两个口子..."）
- `## Source-of-truth` + D1+D2+D3 三条决策（每条 = 来源 + 理由取自 design.md **决定**/**理由**：）
- `## spec-rev` 占位（待 sync 盖 hash）
- `## Non-Decisions` + `## Open Questions` 占位

### 完成定义 vs 实际

**tasks.md Batch 2 完成定义**：
> `bridge distill <change-dir>` 可独立调用，从 design.md ## Decisions 蒸馏生成 specs/<cap>/why.md；why.md 含 Conclusion + Source-of-truth + spec-rev 占位

**实际**：✅ 严格达成。why.md 含上述三段 + 决策列表 + 占位段。

### 全套回归

```
tests 90 / pass 89 / fail 1
```

**唯一 fail**：`init-integration.test.mjs:53 R1 场景 1.5 — 探测 openspec layout（openspec/ 在场 → openspec/changes/）`

**根因诊断**：
- v1.4 commit `3398bab` 改 `detectLayout` 优先级（archive 化石 > openspec/config.yaml > 缺省 standalone）
- 但 init-integration test fixture 是临时目录 `<root>/openspec/`（无 archive 化石、无 openspec/config.yaml）
- 按 v1.4 新逻辑 → fall through 到 standalone → change 落 `changes/demo/` 而非 `openspec/changes/demo/`
- **v1.4 latent bug**（test 期望与 v1.4 detectLayout 优先级不一致）

**验证 v1.5 无关**：
```bash
$ git stash  # 暂存 v1.5 改动
$ node --test tests/init-integration.test.mjs
tests 8 / pass 7 / fail 1   # 仍 fail 同一 case
$ git stash pop  # 恢复 v1.5 改动
```

v1.5 改动无回归。fail 是 v1.4 引入的 latent bug，记入 v1.5 已知遗留（与 vendor / distill scope 无关，**v1.5 不修**）。

### 验收证据

- 新增：`skills/spec-bridge/scripts/cmd-distill.mjs`（约 100 行）
- 新增：`skills/spec-bridge/tests/cmd-distill.test.mjs`（约 130 行，6 case）
- 改动：`skills/spec-bridge/scripts/bridge.mjs`（3 处：import + usage + dispatch，共 +9 行）
- why.md：`changes/v1-5-vendor-distill-guard/specs/archive-publish-guard/why.md`（38 行）

### 下一步

进入 **Batch 3**（cmd-archive-ready.mjs 守门员子命令 + bridge.mjs dispatch + tests）：
- T3.1 写 `scripts/cmd-archive-ready.mjs`（校验 4 条件：change-dir 有效 / 未 archived / 已 sync / specs/<cap>/why.md 全在）
- T3.2 改 `scripts/bridge.mjs` dispatch + usage 加 `archive-ready`
- T3.3 写 `tests/cmd-archive-ready.test.mjs`（4 case：全 PASS / 缺 why.md / 未 sync / 已 archived）

---

## Batch 3 — cmd-archive-ready 守门员

### 任务完成

- ✅ **T3.1** 写 `scripts/cmd-archive-ready.mjs`：default export `run(args, io)`，校验 4 条件
  1. `.bridge.yaml` 存在
  2. stage ≠ archived（write-protect，ADR-0005）
  3. published=true + spec_publication_receipt 已写（已 sync）
  4. 所有 `specs/<cap>/spec.md` 对应的 `specs/<cap>/why.md` 全在
- ✅ **T3.2** 改 `scripts/bridge.mjs`：import `runArchiveReady` + dispatch 加 `if (command === 'archive-ready')` + usage 加行
- ✅ **T3.3** 写 `tests/cmd-archive-ready.test.mjs`：6 case
  - case 1: 全前置满足 → exit 0 PASS
  - case 2: 缺 why.md → exit 1 + 提示 bridge distill
  - case 3: 未 sync → exit 1 + 提示 bridge sync
  - case 4: 已 archived → exit 1 + 提示 write-protect
  - case 5: 缺 .bridge.yaml → exit 1
  - case 6: 多 cap 任一缺 why.md → exit 1（指出哪个 cap 缺）
- ✅ **修 case 5 实战 bug**：原实现用 `readState` try/catch，但 readState 在文件不存在时返回 BUILTIN_DEFAULTS 不抛错，走到了 "change not synced yet" 分支。修：先 `existsSync(.bridge.yaml)` 显式校验，再 readState。

### TDD 闭环

| 阶段 | cmd-archive-ready test |
|---|---|
| **RED**（初版） | 5/6 PASS（case 5 fail：readState 不抛 → 走到 synced 分支） |
| **GREEN**（修后） | 6/6 PASS |

### 实战 v1.5

```bash
$ node bridge.mjs archive-ready changes/v1-5-vendor-distill-guard
FAIL: change not synced yet — run: bridge sync <change-dir>
exit 1
```

D3 守门员**正确工作**：v1.5 当前 stage=executing + published=false → 拒绝 archive + 提示先跑 `bridge sync`。这正是设计意图——Batch N 流程的"第一步关卡"。

### 全套回归

```
tests 96 / pass 95 / fail 1
```

**唯一 fail** 仍是 init-integration R1.5.1（v1.4 latent bug），与 v1.5 无关。

### 验收证据

- 新增：`skills/spec-bridge/scripts/cmd-archive-ready.mjs`（约 60 行）
- 新增：`skills/spec-bridge/tests/cmd-archive-ready.test.mjs`（约 110 行，6 case）
- 改动：`skills/spec-bridge/scripts/bridge.mjs`（3 处：import + usage + dispatch，共 +9 行）

### 下一步

进入 **Batch N — v1.5 归档流程**：
- TN.1 `bridge sync changes/v1-5-vendor-distill-guard`（vendor 修后真 sync，写 receipt）
- TN.2 `bridge verify changes/v1-5-vendor-distill-guard`（校验 receipt PASS）
- TN.3 `bridge archive-ready changes/v1-5-vendor-distill-guard`（D3 守门员 PASS）
- TN.4 `git mv changes/v1-5-vendor-distill-guard changes/archive/2026-09-18-v1-5-vendor-distill-guard/`
- TN.5 `bridge state set ... stage archived`
- TN.6 commit Batch N + （可选）push

**预期风险**：TN.2 verify 应 PASS（v1.5 receipt 用新算法算，baseline 真实存在）；不重现 v1.4 偏差（v1.4 是历史 receipt 已废）。

---

## Batch N — v1.5 归档流程 ✅

### 任务完成

| 步骤 | 命令 | 结果 |
|---|---|---|
| TN.1 | `bridge sync changes/v1-5-vendor-distill-guard` | ✅ exit 0 — Published 1 canonical spec to specs/archive-publish-guard/spec.md + wrote receipt |
| TN.2 | `bridge verify changes/v1-5-vendor-distill-guard` | ✅ exit 0 PASS — `publication receipt matches current deltas and published baseline` |
| TN.3 | `bridge archive-ready changes/v1-5-vendor-distill-guard` | ✅ exit 0 PASS — `1 capability with why.md present` |
| TN.4 | `git mv changes/v1-5-vendor-distill-guard changes/archive/2026-09-18-v1-5-vendor-distill-guard/` | ✅ |
| TN.5 | `bridge state set <archive-path> stage archived` | ✅ exit 0 — `stage updated` |
| TN.6 | `bridge event <archive-path> "Batch N complete: ..."` | ✅ `event recorded` |

### 关键里程碑

**v1.5 是 spec-bridge 第一个跑通"sync → verify → distill → archive-ready → git mv → state archived"完整 6 步流程的 change**：

- D1 vendor while 循环修复 → v1.5 sync 用新算法算出真实 baseline hash → verify PASS
- D2 cmd-distill 子命令 → why.md 真生成含 D1+D2+D3 三条决策 + Conclusion + Source-of-truth
- D3 cmd-archive-ready 守门员 → 三连绿（sync + verify + archive-ready）后才允许 git mv

**v1.4 偏差不复现**：v1.5 receipt 是新算法下生成的真 hash（baseline_after_hash = `sha256:65c7b3ee...`，真实 specs/archive-publish-guard/spec.md 的 hash），未来 v1.5 verify 仍会 PASS（除非 specs/ 被人改）。

### v1.5 commits (v1.2 分支)

```
1bedfa2 v1.5 vendor-distill-guard: 加 cmd-archive-ready 守门员子命令
dc18747 v1.5 vendor-distill-guard: 加 cmd-distill 子命令 + 实战生成 why.md
4a90dd1 v1.5 vendor-distill-guard: 修 archive resolvePublicationContext + 建 v1.5
```

+ Batch N archive commit（含 git mv + state archived + sync 写的 specs/）

### 最终验收清单

- [x] R1（vendor fix）— tests/vendor-resolve-publication-context.test.mjs 3/3 PASS
- [x] R2（distill CLI）— tests/cmd-distill.test.mjs 6/6 PASS + 实战 v1.5 生成 why.md
- [x] R3（archive guard）— tests/cmd-archive-ready.test.mjs 6/6 PASS + 三连绿实战
- [x] 全套回归 95/96 PASS（1 fail = v1.4 latent bug，已记录未修）
- [x] v1.5 已 git mv + state archived + event 追加
- [x] spec 根基线 specs/archive-publish-guard/spec.md 已生成

### 已知遗留（v1.6+ 续作候选）

1. **v1.4 archive verify FAIL**（receipt 历史值 vs 新算法真 hash 不匹配）—— v1.6 续作 rebase v1.4 receipt
2. **init-integration R1.5.1 fail**（v1.4 latent bug：detectLayout 优先级与 test fixture 不一致）—— v1.6 续作或补 test fixture
3. **vendor spec-publication.mjs receipt 算法在 receipt 已写入后改算法 → 旧 receipt 永久失效** —— 这是结构性风险，v1.6 续作考虑 receipt 重算路径

### v1.5 完工

3 个核心决策（D1 / D2 / D3）全部实现 + 测试覆盖 + 实战验证 + 归档。
v1.5 是 spec-bridge 第一个"完整闭环"的 change（从 init 到 archived 全程 CLI 守卫）。