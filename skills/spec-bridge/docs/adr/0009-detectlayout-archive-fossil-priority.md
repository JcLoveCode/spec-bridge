# ADR-0009: detectLayout 改用 archive 化石优先探测 + list 加 archived_count

**Status**：Accepted
**Date**：2026-09-18
**Change**：v1-4-list-archive-visibility（parent: 2026-09-18-v1-3-sdd-meta-navigator）

## Context

v1.3 归档后（commit `875cfdb`），`bridge list .` 输出 `changes: []` + `untracked_artifacts: []`——agent 起 v1.4 时**完全不知道** archive/ 下有 v1.1 / v1.2 / v1.2-b7 / v1.3-research / v1.3-sdd 共 5 条历史可接续。

### 根因 1：list 不展示 archive 条数

v1.2 R3 + D5 的设计：`bridge list` 只展示活跃 change（skip archive/）。这是有意为之，避免 archive 喧宾夺主——但 v1.3 归档后 v1.4 起 change 时，连"archive 里有 N 条历史"这个数字都没了，agent 失忆。

### 根因 2（更深的 bug）：detectLayout 把 spec-bridge 仓库根的 `openspec/` 目录误判为 openspec 布局

`detectLayout` 的探测信号太弱：只看 `openspec/` 目录是否存在。spec-bridge 仓库根有 `openspec/` 目录是 OpenSpec CLI 本地安装的产物（已 commit `fed763a` 写入 .gitignore 忽略），但磁盘还在，被错判为 `layout: openspec`——`bridge list` 走 `openspec/changes/`，根本看不见 `changes/archive/` 的历史。

两个根因都让 agent "看不见历史"——根因 1 是症状，根因 2 是病根。两件合并修复。

## Decision

### D1 — detectLayout 改用 archive 化石优先（4 case if-else）

`bridge.mjs detectLayout()` 与 `cmd-init.mjs mirror detectLayout()` 同步改为：

```js
function detectLayout(projectRoot) {
  const bridgeArchive = join(projectRoot, 'changes', 'archive');
  const openspecArchive = join(projectRoot, 'openspec', 'changes', 'archive');
  if (existsSync(bridgeArchive) && hasAnyBridgeYaml(bridgeArchive)) {
    return { layout: 'standalone', changesDir: join(projectRoot, 'changes'), ... };
  }
  if (existsSync(openspecArchive) && hasAnyBridgeYaml(openspecArchive)) {
    return { layout: 'openspec', changesDir: join(projectRoot, 'openspec', 'changes'), ... };
  }
  if (existsSync(join(projectRoot, 'openspec', 'config.yaml'))) {
    return { layout: 'openspec', changesDir: join(projectRoot, 'openspec', 'changes'), ... };
  }
  return { layout: 'standalone', changesDir: join(projectRoot, 'changes'), ... };
}
```

**优先级**：
1. `changes/archive/*/.bridge.yaml` 在 → `standalone`
2. `openspec/changes/archive/*/.bridge.yaml` 在 → `openspec`
3. `openspec/config.yaml` 在 → `openspec`
4. 缺省 → `standalone`

### D2 — listChanges() 加 archived_count 字段

```js
function listChanges(project_dir) {
  ...
  let archived_count = 0;
  for (const dir of readdirSync(changesDir)) {
    if (dir === 'archive') {
      archived_count = readdirSync(dirPath).filter(...).length;
      continue;
    }
    ...
  }
  return { ..., archived_count };
}
```

只数不展示——保持 v1.2 D5 "skip archive 避免喧宾夺主"。

### D3 — 不动 v1.3 parent 字段 + archive 物理结构

v1.3 `.bridge.yaml` 里 `parent: 2026-09-18-v1-3-research-xrouter` 是 ADR-0005 follow-up 引用字段，清掉 = 失忆。archive 物理位置（`changes/archive/`）按 §6.3 sync 兼容规则第三条"归档目录共享"——三栈共享 archive 才让跨栈续作可行，不分层 / 分栈。

## Consequences

### Positive

- `bridge list` 在 spec-bridge 仓库正确返回 `layout: standalone, archived_count: 5`
- agent 起 v1.4 / v1.5 时 list 输出报"archive 有 N 条历史"，知道有续作可接
- detectLayout 在 OpenSpec CLI 本地安装场景下不再误判

### Negative

- `cmd-init.mjs` 与 `bridge.mjs` mirror 增加一处必须同步的代码——`hasAnyBridgeYaml` 抽公共辅助函数但仍在两处复制（mirror 模式固有代价）
- 4 case 探测增加维护负担——但都有 test 覆盖（docs-sync-test R7 验证 mirror 一致）

### Neutral

- `archived_count` 数字不展示详情——agent 仍需走 `pattern` / `mention` 拉具体父名
- archive 物理结构 / v1.3 parent 字段不动

## Alternatives Considered

### A. 维持 detectLayout 看 `openspec/` 目录存在
- 拒绝：spec-bridge 仓库被 OpenSpec CLI 本地安装误触发——根因不除

### B. 黑名单模式（detectLayout 排除已知误判目录）
- 拒绝：不通用（其他仓库 OpenSpec 是真布局怎么办）。化石优先是更通用的"历史落点"判断

### C. list 加 `archived: [...]` 数组（name / stage / parent 缩略）
- 拒绝：破坏 v1.2 D5 "skip archive 避免喧宾夺主"——list 输出会塞一堆历史

### D. 加 `bridge list --include-archive` flag
- 拒绝：默认行为仍看不到；要 flag 才看——agent 不会主动加 flag，症状不除

## References

- 设计决策落地：`changes/v1-4-list-archive-visibility/design.md ## D1` 等
- 实现：`skills/spec-bridge/scripts/bridge.mjs` `detectLayout()` + `listChanges()`
- 同步：`skills/spec-bridge/scripts/cmd-init.mjs` mirror `detectLayout()`

---

## v1.6 附录：加 openspec/ 目录在场弱信号兜底

**修订日期**：2026-09-20
**修订原因**：v1.4 改 detectLayout 优先级后，`spec/cli/spec.md R1 场景 1.5`（"项目根含 `openspec/` 子目录 → openspec layout"）对应的集成测试 `tests/init-integration.test.mjs:53 R1 场景 1.5` 持续 FAIL。spec 是 source-of-truth，实现违反 spec。

**修订内容**：在优先级链尾部（`config.yaml` 之后、`缺省 standalone` 之前）加第 4 条弱信号：

```text
4. <root>/openspec/ 目录在场 → layout: openspec  ← v1.6 新加弱信号
```

**安全性论证**：v1.4 关心的 spec-bridge 仓库根有 `openspec/`（OpenSpec CLI 本地安装）误判场景，因仓库根 `changes/archive/` 在场，**优先级 1 命中 → standalone**，**根本走不到第 4 条弱信号**——弱信号不会误伤 spec-bridge 仓库。

**测试**：
- `tests/init-integration.test.mjs` R1 场景 1.5 — RED→GREEN（v1.6 改 detectLayout 前 FAIL，改后 PASS）
- `tests/init-integration.test.mjs` R1 场景 1.6（v1.6 新加）— 验证 archive 化石在场压制 openspec/ 弱信号（PASS 保持）
- `tests/init-integration.test.mjs` R1 场景 1.7（v1.6 新加）— mock spec-bridge 仓库根 list → standalone + archived_count: 5（PASS 保持）

**落地**：
- `changes/v1-6-init-detectlayout-fix/proposal.md`
- `changes/v1-6-init-detectlayout-fix/design.md`
- `changes/v1-6-init-detectlayout-fix/specs/v1-6-init-detectlayout-fix/spec.md`
- 测试：`skills/spec-bridge/tests/docs-sync-test.mjs` R6（archived_count 字段存在）+ R7（mirror 一致）
- 文档：`SKILL.md` §5 list 行 + `CONTEXT.md` Layout 探测规则段
- 父决策：ADR-0005（follow-up 链）/ ADR-0008（bridge as cross-protocol recommender）
- 留的下次处理：spec-bridge 仓库如有 OpenSpec 栈真布局，探测走 case 2/3——已在 future work 段