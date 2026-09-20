# Change: v1-6-init-detectlayout-fix

## Why

v1.4 commit `3398bab` 改 `detectLayout` 优先级为 **archive 化石 > openspec/config.yaml > 缺省 standalone** 后（ADR-0009，修 spec-bridge 仓库根 `openspec/` 目录被 OpenSpec CLI 本地安装误判），**遗留 1 个测试 fail**：

- `tests/init-integration.test.mjs:53 R1 场景 1.5` —— fixture 是 `<root>/openspec/`（**无 archive 化石、无 config.yaml**），按 v1.4 新逻辑 fall through 到 standalone，change 落 `changes/demo/`；但 `spec/cli/spec.md R1 场景 1.5` 写的是 "**WHEN 项目根含 `openspec/` 子目录** THEN `layout: openspec`" —— 实现违反 spec。
- v1.5 progress.md 已记录为 v1.6+ 续作 #2。

**核心矛盾**：spec 是 source-of-truth（spec-bridge 哲学），v1.4 改动未同步更新 spec 或 test。

## What Changes

- `skills/spec-bridge/scripts/bridge.mjs:103-121` `detectLayout`：优先级链加第 4 条 `openspec/ 目录在场` 弱信号兜底（archive 化石 > config.yaml > openspec/ 目录在场 > standalone）
- `skills/spec-bridge/scripts/cmd-init.mjs:206-219` mirror `detectLayout`：同步加同一条弱信号
- `skills/spec-bridge/tests/init-integration.test.mjs`：增强 R1 场景 1.5 test，加 2 个回归 case 保护 v1.4 ADR-0009 防误判成果
- `skills/spec-bridge/docs/adr/0009-detectlayout-archive-fossil-priority.md`：补一段"v1.6 加 openspec/ 目录弱信号兜底"附录
- `skills/spec-bridge/CONTEXT.md § Layout 探测规则`：补第 4 条弱信号

## Scope

### In Scope

1. 改 `bridge.mjs detectLayout` 加弱信号
2. 改 `cmd-init.mjs mirror detectLayout` 加弱信号
3. 增强 `init-integration.test.mjs` R1.5.1（加 2 个回归 case）
4. ADR-0009 补 v1.6 附录段
5. CONTEXT.md Layout 段补第 4 条

### Out of Scope

- **不重写 `cmd-adopt.mjs detectLayout`**（adopt 用更简单的实现，仅看 `openspec/` 目录存在，与 archive 化石无关；v1.6 不动保持现状）
- **不补 v1.4 其它 verify FAIL 遗留**（v1.4 receipt rebase 是 v1.6 #1 候选，独立 spec）
- **不立 receipt lifecycle 规范**（v1.6 #3 候选，独立 spec）
- **不引入新依赖 / 不改 hash 算法 / 不改 vendored 子模块**