# ADR-0015: 移除自动探测（v1.9-2）

- 状态：Accepted（2026-09-21）
- 决策人：JcLoveCode
- 关联 change：changes/v1-9-2-remove-auto-detect/

## 背景

v1.8-1/2 引入了 `vendor/detect-stack.mjs` 自动探测项目栈（`.claude-plugin/` + `package.json:matt-skills` / `superpowers` / `openspec/`）。实战发现：

1. **探测脆弱**：依赖磁盘特征文件，跨平台/跨编辑器容易误判
2. **无法手动覆盖**：即使知道要用 matt，也必须等探测完
3. **与 v1.9-1 配置冲突**：v1.9-1 引入 `bridge stacks` 手动配置，但探测仍会触发

v1.9-1 设计文档明确：
> v1.9-1 不破坏 v1.8：自动探测逻辑仍保留（探测在 stacks 配置为空时 fallback）
> v1.9-2 才完全删除探测

## 决策

### D1. 删除 `vendor/detect-stack.mjs` 作为主路径

**从 init / adopt 主路径移除自动探测**。改为：
1. 显式 `--workflow-kind <kind>` flag（最优先）
2. v1.9-1 `stacks` 配置首个栈
3. builtin 兜底

**保留** `vendor/detect-stack.mjs` 模块（v1.9-3 才完全删除）

### D2. 探测作为 fallback（v1.9-2 过渡）

```javascript
// v1.9-2 cmd-init.mjs 派生逻辑
const bridgeConfig = readBridgeConfig(projectRoot);
let configPrimary;
if (bridgeConfig.stacks.length > 0) {
  configPrimary = bridgeConfig.stacks[0].kind;
} else {
  // v1.9-2 过渡：探测作为 fallback（v1.9-3 才完全移除）
  configPrimary = detectStack(projectRoot).primary;
}
```

**拒绝的方案**：v1.9-2 直接彻底删除探测
**理由**：破坏 backward compat（大量 init 测试依赖探测）；v1.9-3 计划完全删除

### D3. stacks 配置完全覆盖探测

**当用户配置 stacks 时，探测信号被完全忽略**。

例：项目根有 superpowers 信号 + package.json 含 superpowers，但配置 `stacks set openspec`：
- v1.8-1/2：推 superpowers（来自探测）
- v1.9-2：推 openspec（来自配置）

**理由**：用户配配置就是显式声明；探测不应抢话

### D5. adopt 优先级：--stack flag > stacks 配置 > 信号探测

```javascript
if (stackFlag && stackFlag !== 'auto') {
  externalStack = stackFlag;          // 显式优先
} else if (bridgeConfig?.stacks.length > 0) {
  externalStack = bridgeConfig.stacks[0].kind;  // 配置优先
} else {
  externalStack = detectStackFromSignals(signals);  // 探测 fallback
}
```

### D6. probe 命令保留 + 加 stack_hint 字段

`bridge probe` 仍存在，但输出新增 `stack_hint` 字段（来自配置）：
```
stack_hint: matt
```

**AI 看到**：`stack_hint` 是推荐起点（按配置优先级）；`advised_skill` 是 inventory 路由结果

### D7. 不提供迁移工具

**v1.9-2 不提供 `bridge migrate-v1.9-detect` 命令**。

**理由**：
- 探测逻辑只是 fallback，用户主动配 `stacks` 即完成迁移
- 提供迁移工具反而把"自动"行为强加给用户，违背 v1.9-1 的"手动配置"原则

## 影响面

### 修改文件（4 个）

- M `skills/spec-bridge/scripts/cmd-init.mjs`（用 stacks 配置替代探测）
- M `skills/spec-bridge/scripts/cmd-adopt.mjs`（优先级：--stack > config > signals）
- M `skills/spec-bridge/scripts/cmd-probe.mjs`（加 stack_hint 输出）
- M `skills/spec-bridge/SKILL.md`（§1 入口例程 + §7 CHANGELOG）

### 新增测试（4 个）

- A `tests/no-auto-detect.test.mjs`：
  - 配置优先于探测
  - 无配置时探测 fallback 生效
  - adopt --stack 显式覆盖配置
  - probe stack_hint 输出

### 保留（不删）

- `skills/spec-bridge/scripts/vendor/detect-stack.mjs`（fallback 备用，v1.9-3 才删）

### 测试覆盖

188 → 192（全绿）

## 与其他 ADR 的关系

- **ADR-0011**（导航员默认外栈）：v1.9-2 是它的"消亡"——自动探测被取代 ✓
- **ADR-0012**（纯桥模式）：v1.9-2 加强纯桥模式（手动配置取代探测）✓
- **ADR-0014**（命令面板）：v1.9-2 是它的"应用层"——stacks 配置生效 ✓

## 风险与限制

1. **breaking change（轻度）**：旧测试 `detect-stack-superpowers` 仍通过（探测作 fallback）；用户无感
3. **stacks 概念用户认知**：用户需要主动配 `stacks` 才有推荐
   - **缓解**：stacks 为空 → builtin 兜底（保持零配置）

## 遗留问题

- **v1.9-3**：完全删除 `vendor/detect-stack.mjs` 和 `detectStackFromSignals`
- **v1.9-3** context-aware：自动记录 lastUsedStack

## 与 ponytail 的对比

ponytail 没有"自动探测"，只通过配置控制行为。v1.9-2 与 ponytail 理念对齐——**配置是唯一真理**。