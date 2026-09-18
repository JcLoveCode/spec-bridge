# Change: v1-5-vendor-distill-guard

## Why

v1.4 归档时（commit `46b80ba`）暴露两个阻塞"归档后想 verify 一下"信任链的 bug：

1. **vendor `resolvePublicationContext` 走 else 分支算错 projectRoot**：
   对 `changes/archive/<id>/` 路径，`dirname(absoluteChangeDir)` 是 `changes/archive`，`basename` 是 `archive`（非 `changes`），
   走 else 分支把 projectRoot 算成 `changes/archive/`（archive 目录被当成仓库根），
   验证时 `hashPublishedBaseline` 找不到 `specs/<cap>/spec.md` → 全部 `<missing>` → verify FAIL。
   v1.3 / v1.4 归档都触发；靠"人工复验 verify FAIL"标记成 rebuttal 才没阻塞归档。

2. **bridge archive 流程写"why.md distilled"不校验**：
   v1.4 收尾时 `.bridge.log` 写 `Batch N complete: ... why.md distilled ...`，
   但 archive 目录里**没有 why.md**——AI 跳了蒸馏步骤就 commit + push，撒谎成功落地。
   桥的 14 条命令里没 `distill` 子命令，why.md 是 AI 手动写，缺守卫。

两件事合起来：v1.4 归档能跑通但**完全靠 AI 自觉**——verify FAIL 被人工复验消化，why.md 缺失被大事记撒谎消化。归档流程的"每一步可验证"信任链断了。

## What Changes

- **vendor `scripts/vendor/spec-publication.mjs:271-280`** `resolvePublicationContext` 单 if-else 改 while 循环：沿 `dirname` 跳到 `basename === 'changes'` 的祖先目录再算 projectRoot
- **新增 `scripts/cmd-distill.mjs`**：从 `<change-dir>/design.md ## Decisions` 蒸馏 → 生成 `specs/<cap>/why.md`（ADR-0003 单向蒸馏自动化）
- **`scripts/bridge.mjs` Batch N 模板 / archive 流程**：写 "Batch N complete" 大事记前 `fs.existsSync(why.md)` 校验，缺则 `console.error` + `exit 1` 提示跑 `bridge distill`
- **`scripts/bridge.mjs` dispatch 加 `distill` 入口** + help 加 `distill <change-dir>` 行
- **测试覆盖**：3 处各加 case（vendor archive 路径 resolve / distill 子命令 / archive 流程校验）
- **文档同步**：`SKILL.md` §3 蒸馏段（"AI 手动写"→"走 `bridge distill`"）+ `SKILL.md` §5 加 `distill` 命令行 + `CONTEXT.md` 补 distill 子命令

## Scope

### In Scope

1. 改 `scripts/vendor/spec-publication.mjs` `resolvePublicationContext`（while 循环）
2. 写 `scripts/cmd-distill.mjs`（distill 子命令，从 design.md Decisions 蒸馏）
3. 改 `scripts/bridge.mjs` Batch N 模板（archive 流程校验 why.md 存在性）
4. 改 `scripts/bridge.mjs` dispatch 加 `distill` 入口 + help 加行
5. 写 `tests/vendor-resolve-publication-context.test.mjs`（active / archive / 套娃 archive 三 case）
6. 写 `tests/cmd-distill.test.mjs`（design.md 有 Decisions / 缺 Decisions 两 case）
7. 写 `tests/archive-distill-guard.test.mjs`（有 why.md 放行 / 缺 exit 1 两 case）
8. 改 `tests/docs-sync-test.mjs`（验证 SKILL.md §3 蒸馏段 + §5 命令表已加 distill）
9. `SKILL.md` §3 蒸馏段 / `SKILL.md` §5 命令表 / `CONTEXT.md` 文档同步

### Out of Scope

- **不补 v1.4 archive 缺 why.md**（v1.4 已 commit + push，write-protect 不可改；补走 v1.6+ 续作）
- **不补 v1.3 archive 缺 why.md**（v1.3 已归档，写保护；同 v1.4 处理）
- **不引入新依赖**（`spec-publication.mjs` 仍用 Node 内置 + vendored 依赖）
- **不重写 vendor `spec-publication.mjs` 整体**（只修 `resolvePublicationContext` 那一处）
- **不开 `bridge probe` 激活导航员**（v1.3 L3 状态机中断能力的真正激活是 v1.6 范围；本 change 只修 v1.4 暴露的 bug）
- **不改 `cmd-rebuttal.mjs`**（v1.4 rebuttal 落盘功能正常，v1.5 不动）
