# Design: v1-5-vendor-distill-guard

## Purpose

堵住 v1.4 归档时暴露的"vendor 算错 projectRoot" + "bridge 撒谎写蒸馏"两个口子——让"归档 → verify → 蒸馏 → git mv"四拍的每一步都有 CLI 级守卫（v1.3 §6.2 能力阶梯 L5 桥档案员本职），不再依赖 AI 自觉。

## Architecture

```
                       ┌──────────────────────────────────┐
                       │ bridge archive <change-dir>      │
                       └────────────────┬─────────────────┘
                                        │
                                        ▼
              ┌────────────────────────────────────────────┐
              │ Batch N 模板（archive 前置校验）            │
              │                                            │
              │  1. vendor spec-publication.mjs            │
              │     resolvePublicationContext 走 while 循环│
              │     (D1 修，archive 路径也算对 projectRoot)│
              │                                            │
              │  2. 跑 `bridge distill <dir>`               │
              │     → 从 design.md ## Decisions 蒸馏       │
              │     → 落 specs/<cap>/why.md                │
              │                                            │
              │  3. fs.existsSync(why.md) 校验              │
              │     → 失败 exit 1 + 提示"先 bridge distill"│
              │                                            │
              │  4. 写 .bridge.log "Batch N complete"      │
              │     → 含 "why.md distilled"（这次是真的）  │
              └────────────────┬─────────────────────────┘
                               │
                               ▼
              git mv → changes/archive/<date>-<name>/
              state set stage archived
```

**关键设计点**：
- D1 修根因（vendor 算法对 archive 路径）；D2+D3 是 CLI 级守卫（不再让 AI 跳步骤）
- 三件事都属 v1.3 §6.2 L5 桥档案员本职——不依赖 L4 agent 自觉

## Decisions

### D1 — vendor `resolvePublicationContext` 改 while 循环跳到 `basename === 'changes'`

**选项**：
- A. 加 if 分支：`if (absoluteChangeDir.includes('/archive/')) { ... }` 单独处理
- B. 改 while 循环：从 `absoluteChangeDir` 沿 `dirname` 往上跳，直到 `basename === 'changes'` 再算 projectRoot
- C. 抽 `findProjectRoot(absoluteChangeDir)` 工具函数

**决定**：**B**

**理由**：
- A 是补丁思维，对未来 `changes/archive/<archive>/foo` 套娃场景仍可能漏
- C 抽函数更"工程化"但仅一处用，过度设计
- B while 循环最直接——和原 if-else 同一函数，最小改动
- v1.4 commit `46b80ba` rebuttal 大事记已明确推 B 修法

**实现**：
```js
export function resolvePublicationContext(changeDir) {
  const absoluteChangeDir = resolve(changeDir);
  let cursor = dirname(absoluteChangeDir);
  while (basename(cursor) !== 'changes') {
    if (cursor === dirname(cursor)) break; // 兜底：到根目录
    cursor = dirname(cursor);
  }
  const projectRoot = basename(cursor) === 'changes' ? dirname(cursor) : dirname(absoluteChangeDir);
  return { changeDir: absoluteChangeDir, projectRoot, baselineSpecsDir: join(projectRoot, 'specs') };
}
```

### D2 — 新增 `cmd-distill.mjs` 子命令（蒸馏自动化）

**选项**：
- A. 维持现状（why.md 由 AI 手动写）——v1.4 漏写就是这状态
- B. 写 `cmd-distill.mjs` 子命令，从 `design.md ## Decisions` 蒸馏生成 why.md
- C. 把蒸馏内嵌进 `cmd-sync.mjs`（sync 成功后自动蒸馏）

**决定**：**B**

**理由**：
- A 已被 v1.4 证明不可靠（AI 跳步骤 → 撒谎落地）
- C 隐式触发破坏"sync / verify / distill / git mv"四拍的清晰边界（SKILL.md §3 蒸馏硬规则强调"四拍分开"）
- B 显式命令 + 单独的子命令 + 单独的测试——符合 v1.3 §6.2 L5 桥档案员本职的定位

**实现**：`cmd-distill.mjs` 读 `design.md` 解析 `## Decisions` 段 → 按 ADR-0003 单向蒸馏格式生成 `specs/<cap>/why.md`：
```
# Why: <cap>
## Conclusion
<一句话总结>
## Source-of-truth
<design.md ## Decisions 引用 + spec-rev: <回执hash>>
```

### D3 — bridge archive / Batch N 模板加 `fs.existsSync(why.md)` 校验

**选项**：
- A. 维持现状（写大事记时不管 why.md 是不是真的有）——v1.4 漏的根因
- B. Batch N 模板加 `if (!existsSync(join(changeDir, 'specs', cap, 'why.md'))) exit 1`
- C. 改 `cmd-init.mjs` 一次性生成 stub why.md（避免空缺）

**决定**：**B**

**理由**：
- A 已证明不可靠
- C stub 文件会让"未蒸馏"的假象进入 archive——污染
- B 缺则拒绝——强迫 AI 走 `bridge distill`（D2 子命令）才能进 archive 流程

**实现**：`bridge.mjs` Batch N 写 "Batch N complete" 前，校验 `<changeDir>/specs/<cap>/why.md` 存在；缺则 `console.error` + `exit 1`，提示"run: node bridge.mjs distill <change-dir>"。

## Out-of-scope decisions（明确不做的）

- **D-A**: 不补 v1.4 / v1.3 archive 缺 why.md——已 write-protect，补走 v1.6+ 续作
- **D-B**: 不重写 vendor `spec-publication.mjs` 整体——只修 `resolvePublicationContext` 一处
- **D-C**: 不加 `bridge probe` 激活导航员——v1.6 范围
- **D-D**: 不引入新依赖——仍 Node 内置 + vendored

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| `cmd-distill.mjs` 解析 design.md 失败（格式漂移） | 蒸馏失败 → archive 卡住 | 蒸馏失败时 `exit 1` + 提示设计格式；保留 AI 手动写 fallback（写完跑 archive 流程） |
| `resolvePublicationContext` while 循环到根目录仍无 `'changes'` | projectRoot 退回 dirname(absoluteChangeDir) | 兜底等同旧 else 行为；不优于旧版但不劣 |
| Batch N 校验卡老 archive（v1.3 / v1.4 都没 why.md）| 已归档 change 不动，无影响 | 校验只对 active change 生效；archive 路径走 write-protect（ADR-0005）不走该流程 |
| 蒸馏格式与 v1.3 `specs/v1-3-research-xrouter/why.md` 风格不一致 | 历史续作看着别扭 | D2 蒸馏格式按 v1.3 现有 why.md 模仿（`## Conclusion` + `## Source-of-truth` + `spec-rev:`） |
| 测试覆盖不全 | vendor 修了一半漏一种 case | vendor 测试加 3 case：active 路径 / archive 路径 / 套娃 archive 路径 |
