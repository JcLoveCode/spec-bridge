# Change: bridge init 命令 — 把开 change 从 5 步手动压到 1 步

## Why

目前 spec-bridge 的入口 CLI (`bridge.mjs`) 缺少 `init` 子命令。开一个新 change 必须：

1. 手工 `mkdir changes/<需求号>-<slug>/specs/<cap>/`
2. 拷贝 4 个产品模板（proposal.md / design.md / tasks.md / specs/<cap>/spec.md）
3. 写一份 execution-contract.md 模板
4. 调 `bridge state init` 把 .bridge.yaml 落下来
5. .bridge.log 起一条大事记

5 步全靠人，机械重复、容易漏；ADR-0001 §4 已经把这个口子留好了（"项目级 `.spec-bridge.yaml`，可选 init 命令"），现在收。

## What Changes

新增 `bridge init <name>` 子命令，自动完成上述 1–5 步：

- 探测项目根（`git rev-parse --show-toplevel` 优先，回退向上找含 `changes/` 的祖先，否则 cwd）
- 探测 layout（沿用现有 `detectLayout`：openspec/ 在场 → openspec，否则 standalone）
- 创建 `<changesDir>/<name>/{specs/<cap>/, proposal.md, design.md, tasks.md, execution-contract.md}`
- 写入 `.bridge.yaml`（stage=planning, layout, branch, capabilities）+ `.bridge.log` 第一行
- 默认 capability 名 = 目录名（去掉 `-<slug>` 后缀，转小写）；可用 `--capability` 指定
- 模板是 ASCII 骨架，不依赖外部文件；不改模板用户改不动

## Scope

### In Scope

- 单文件命令 `scripts/cmd-init.mjs`（与 `cmd-sync.mjs` 风格对齐，default export 一个 `run(args)` 函数）
- 在 `bridge.mjs` 增加 `init` 命令路由 + 使用说明更新
- 2 个测试：模板渲染单元 + 端到端 init（用 tmpdir 隔离）
- 既有 `state init` / `layout` / `list` 行为不变
- `bridge.mjs` 单文件 ≤ 350 行（防止一处膨胀回 8 态机器）

### Out of Scope

- 修改 vendor/ 接缝（无 vendored 文件改动）
- `--from-archive`（从归档恢复 change）—— 留作后续 v1.2
- `--stack <A|B|C>` 显式指定栈 —— 探测规则在 SKILL.md §2 已经定，CLI 不重复
- `--interactive` 引导填模板 —— 第一版只发空模板，编辑仍走人手
- 跨平台 shebang 检测 —— 沿用现有 `#!/usr/bin/env node`
- `init` 阶段写入 `artifacts_hash` / `contract_hash` / 回执 —— 那些属于 contracted → executing → archived 阶段