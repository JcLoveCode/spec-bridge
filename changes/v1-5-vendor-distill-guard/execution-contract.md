# Execution Contract: v1-5-vendor-distill-guard

## Intent Lock

堵住 v1.4 归档时暴露的两个口子：
- vendor `resolvePublicationContext` 走 else 分支算错 projectRoot（让 archive 路径下 verify 永远 FAIL）
- bridge 写 "why.md distilled" 大事记不校验（让 AI 跳步骤撒谎成功落地）

让"归档 → verify → 蒸馏 → git mv"四拍的每一步都有 CLI 级守卫；蒸馏从 AI 手动变 CLI 子命令。

## Scope Fence

### In Scope

（来自 proposal §Scope > ### In Scope）

1. 改 `scripts/vendor/spec-publication.mjs` `resolvePublicationContext`（while 循环）
2. 写 `scripts/cmd-distill.mjs`（distill 子命令，从 design.md Decisions 蒸馏）
3. 改 `scripts/bridge.mjs` Batch N 模板（archive 流程校验 why.md 存在性）
4. 改 `scripts/bridge.mjs` dispatch 加 `distill` 入口 + help 加行
5. 写 `tests/vendor-resolve-publication-context.test.mjs`（3 case）
6. 写 `tests/cmd-distill.test.mjs`（2 case）
7. 写 `tests/archive-distill-guard.test.mjs`（2 case）
8. 改 `tests/docs-sync-test.mjs`（验证文档同步）
9. `SKILL.md` §3 蒸馏段 / `SKILL.md` §5 命令表 / `CONTEXT.md` 文档同步

### Out of Scope

（来自 proposal §Scope > ### Out of Scope）

- 不补 v1.4 / v1.3 archive 缺 why.md（write-protect，走 v1.6+ 续作）
- 不引入新依赖
- 不重写 vendor `spec-publication.mjs` 整体
- 不开 `bridge probe` 激活导航员（v1.6 范围）
- 不改 `cmd-rebuttal.mjs`

## Approved Requirements

（映射自 `specs/archive-publish-guard/spec.md`）

- [ ] **R1** — vendor resolvePublicationContext 支持 archive 嵌套路径：active / archive / 套娃 archive 三种 case 的 projectRoot 都正确解析（测试义务：`tests/vendor-resolve-publication-context.test.mjs` 3 case 全 PASS）
- [ ] **R2** — bridge archive 流程校验 why.md 落盘：Batch N 写大事记前 `fs.existsSync(why.md)`，缺则 exit 1（测试义务：`tests/archive-distill-guard.test.mjs` 2 case 全 PASS：有 why.md 放行 / 缺 why.md exit 1）
- [ ] **R3** — bridge distill CLI 子命令：从 design.md ## Decisions 蒸馏生成 why.md（测试义务：`tests/cmd-distill.test.mjs` 2 case 全 PASS：design.md 有 Decisions / 缺 Decisions exit 1）

## Constraints

（唯一权威源：`design.md ## Decisions`。每条 C 编号对到 D 编号。）

- **C1** → D1：vendor `resolvePublicationContext` 用 while 循环跳到 `basename === 'changes'`（不用 if-else 补丁、不抽 findProjectRoot 函数）
- **C2** → D2：distill 是新子命令 `cmd-distill.mjs`（不内嵌进 cmd-sync.mjs；AI 手动写 fallback 保留但 CLI 是主路径）
- **C3** → D3：archive 流程校验是 `fs.existsSync`（不写 stub why.md 占位）

## Execution Batches

（来源：`tasks.md`）

- **Batch 1** — vendor fix（T1.1, T1.2）：完成定义 = `bridge verify changes/archive/2026-09-18-v1-4-list-archive-visibility` 不再 FAIL
- **Batch 2** — cmd-distill.mjs 新子命令（T2.1, T2.2, T2.3）：完成定义 = `bridge distill` 成功生成 why.md
- **Batch 3** — bridge archive 校验（T3.1, T3.2, T3.3）：完成定义 = 测试套 PASS
- **Batch 4** — 文档同步（T4.1, T4.2, T4.3, T4.4）：完成定义 = docs-sync-test PASS
- **Batch N** — 归档（TN.1~TN.5）：完成定义 = stage archived + push 完成

## Escalation Rules

执行过程中遇到以下情况必须停下回 planning 重开：
- vendor while 循环改完后跑 v1.4 archive verify 仍 FAIL（说明 vendor bug 不只 resolvePublicationContext 一处）
- cmd-distill.mjs 解析 design.md 失败率 > 30%（说明 v1.5 design.md 格式与 ADR-0003 蒸馏格式有结构性冲突）
- bridge archive 校验改动让 v1.3 / v1.4 已有 archive change 跑出意外错误（说明改动影响了 archive 路径逻辑而非仅 active 路径）
- TN.1 sync 失败（vendor 修改让 receipt 计算 hash 不一致——回 Batch 1 修）
- TN.2 verify 失败（回 Batch 1 或 Batch 3 排查）
