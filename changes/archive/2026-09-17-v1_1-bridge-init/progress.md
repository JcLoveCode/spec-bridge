# Progress: v1_1-bridge-init

> 每批审查结论台账（executor-protocol §"Review Before Drift"）。回执引擎是 v2 升级项，台账先行。

## Batch 1 审查（cmd-init.mjs 核心）

- 状态：完成（含一次死代码清理返工）
- 结论：**通过，含 1 次返工**
- 返工记录：初版文件尾部遗留 `writeStateCompat` + `loadBridgeState` 间接层死代码（约 28 行），起因是误判 bridge-state.mjs 未导出 `writeState`。已改为直接 import 并删除间接层。
- 铁律符合性：
  - Contract First ✓（按 D1–D7 实现，未重开已定决策）
  - TDD ✗（先实现后测试，未走 RED→GREEN——已知偏差，最终回执中声明）
  - 范围 ✓（未越 Out of Scope）

## Batch 2 审查（bridge.mjs 路由 + usage）

- 状态：完成
- 结论：**通过**
- 行数检查：bridge.mjs ≈ 265 行 < 350 硬上限 ✓（E2 未触发）
- 既有命令行为：sync/verify/state/hashes/layout/list/event 路由未动 ✓（Batch 3 回归测试再证）

## Spec 缺陷发现与处置（执行期 spec 碰撞，狗粮首次咬人）

**发现**：`specs/cli/spec.md` 的 R3 场景与设计语义不一致——

- spec 原文写"exit code 非 0（layout 探测会失败）……`layout` 字段为 `null`"
- 但 `detectLayout` 的契约是二选一（`openspec/` 在场 → openspec，否则 standalone），永不返回 null；空 cwd 下首个 change 落盘即自举确立 standalone 布局，这是 D6 fallback 的设计意图
- 判定：**spec 写错了，不是实现错了**——起草 spec 时臆想了一条不存在的"layout 探测失败"路径

**处置**（executor-protocol 铁律 4 轻量版 + contract-mapping 过期检测规则）：

1. 修正 `specs/cli/spec.md` R3 场景为 standalone 自举语义（exit 0、layout=standalone）
2. 重算 `artifacts_hash` 并 `state set` 重锁
3. 重新过批准门（预授权代理批准；原因：spec 缺陷修正，无行为变更，execution-contract.md 内容不受影响）
4. 本条留痕（.bridge.log 同步记录）

**价值注**：这正是内容级 hash 过期检测存在的意义——如果只看时间戳或文件名，这次 spec 静默漂移就会溜进基线。

## Batch 3 审查（测试）

- 状态：完成
- 结论：**通过**
- `init-templates.test.mjs`：7 用例（5 模板非空 + 节段骨架 + 占位符）
- `init-integration.test.mjs`：8 用例（R1 场景 1.1/1.2/1.3/1.4/1.5 + R2 + R3 修正后语义 + D4 覆盖 + list 回归）
- 全部场景编号对齐 specs/cli/spec.md，测试义务逐条兑现契约 Approved Requirements

## Batch 4 审查（验证门）

- 状态：完成
- 结论：**通过**
- `npm test`：**25/25 pass**（既有 delta-apply + sync 回归 10 例 + 新增 15 例全绿）
- `hashes --check`：`CURRENT: no drift detected`（R3 修正后重锁的 hash 稳定）
- `bridge list .`：v1_1-bridge-init 可见，has_state=true

## Batch 5 审查（归档四拍）

- 状态：完成
- ① `sync`：发布 `specs/cli/spec.md` 根基线 + 写回执（published: true）✓
- ② `verify`：`PASS: publication receipt matches current deltas and published baseline` ✓
- ③ why 蒸馏：`specs/cli/why.md` 落盘，8 条结论全部溯源到 design.md D1–D7 + out-of-scope，每条带 spec-rev ✓
- ④ 归档：stage=archived + git mv 到 changes/archive/2026-09-17-v1_1-bridge-init/ ✓

