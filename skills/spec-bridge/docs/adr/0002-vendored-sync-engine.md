# ADR-0002: Vendor spec-superflow 的 sync 引擎（不依赖上游、不复用 openspec archive）

- 状态：Accepted（2026-09-17）
- 决策人：JcLoveCode（与 AI 结对设计）

## 背景

归档要把 delta spec（ADDED/MODIFIED/REMOVED/RENAMED）发布到根 `specs/` 基线。三个可选来源：
(a) openspec 自带 archive；(b) 依赖已安装的 spec-superflow 插件（`ssf sync`）；
(c) vendor（拷贝并自有维护）spec-superflow 的 MIT 引擎。

用户环境里 openspec **可能装也可能没装**，且都要能用。

## 决策

**Vendor（c）**，且 openspec 在场时也**永远用移植版**，一条代码路径。

vendor 范围（精确闭包，见 `scripts/vendor/VENDOR.md`）：`cmd-sync.mjs` + `spec-publication.mjs`
+ `spec-paths.mjs` + `dist/` 编译树；`state-loader.mjs` 替换为自有 `bridge-state.mjs`（唯一接缝）。
上游是参考源不是运行时依赖；升级是自己主动 diff 的事件。

## 理由

1. **一条代码路径**：两套实现 = 两套行为要测试、两种回执格式要兼容，维护成本翻倍。
2. **回执归桥接管**：发布回执被三处消费（closing guard 放行 / why 蒸馏的已发布标记 /
   spec-rev 陈旧判定），格式必须由 spec-bridge 拥有。
3. **openspec 装不装只影响产物由谁生成，不影响合并归谁做**。
4. 引擎行为里值钱的部分（跨 change 冲突检测、near-match 拒绝、全量候选验证、原子发布回滚、
   sha256 回执）是确定性代码，vendor 后即自有资产（MIT 合法，随行保留版权）。

## 后果

- 正面：零外部运行时依赖；`resolvePublicationContext` 天然兼容 openspec/ 与 standalone 两种布局。
- 负面：引擎维护责任转移——用 VENDOR.md 的升级协议 + tests/ 回归用例对冲；
  上游修 bug 不会自动跟进，升级是手动事件。
