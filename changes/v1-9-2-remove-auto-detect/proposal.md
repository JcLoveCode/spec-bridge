# v1.9-2 移除自动探测（remove-auto-detect）

## 问题

v1.8-1/2 引入了 `vendor/detect-stack.mjs` 自动探测项目栈（`.claude-plugin/` + `package.json:matt-skills` / `superpowers` / `openspec/`），存在三个问题：

1. **探测脆弱**：依赖磁盘特征文件，跨平台/跨编辑器容易误判
2. **无法手动覆盖**：即使知道要用 matt，也必须等探测完
3. **与 v1.9-1 配置冲突**：v1.9-1 引入了 `bridge stacks` 手动配置，但探测仍会触发（优先级模糊）

v1.9-1 设计文档明确：
> v1.9-1 不破坏 v1.8：自动探测逻辑仍保留（探测在 stacks 配置为空时 fallback）
> v1.9-2 才完全删除探测

## 提议方案

### 1. 删除 `vendor/detect-stack.mjs`

**彻底删除**自动探测模块。

**替代方案**：
- 有 `.bridge-config.json` 配置 → 读 stacks（v1.9-1）
- 无配置 → 默认 `workflow_kind: 'builtin'`（不再探测）

### 2. 修改 `cmd-init.mjs`

```javascript
// Before (v1.8-1/2)
const stackDetection = detectStack(projectRoot);
const workflowKind = detectedKind || 'builtin';

// After (v1.9-2)
const config = readBridgeConfig(projectRoot);
const workflowKind = config.stacks[0]?.kind || 'builtin';
```

**行为**：
- 有 stacks 配置 → 用第一个 stack 的 kind 作为 workflow_kind
- 无配置 → `builtin`（不再尝试探测磁盘）

### 3. 修改 `cmd-adopt.mjs`

```javascript
// Before
const externalStack = (stackFlag && stackFlag !== 'auto') ? stackFlag : detectStackFromSignals(signals);

// After
const externalStack = (stackFlag && stackFlag !== 'auto') ? stackFlag : readBridgeConfig(projectRoot).stacks[0]?.kind || 'builtin';
```

**行为**：
- 有 `--stack <kind>` 显式 → 用之
- 有 stacks 配置 → 用第一个 stack 的 kind
- 都无 → `builtin`

### 4. 修改 `cmd-probe.mjs`

**保留** probe 命令（AI 仍可通过 inventory 显式声明），**但移除**自动探测逻辑：
- 不再调 `detectStack()`
- probe 输出 `stack_hint` 字段：从 stacks 配置读

### 5. 删除探测相关测试

| 测试 | 处置 |
|---|---|
| `detect-stack-superpowers.test.mjs` | 删除 |
| `init-auto-probe.test.mjs` 中探测部分 | 删除（保留其他） |
| `cmd-adopt-detect-*` 测试 | 改为读配置测试 |
| `probe-fallback-bridge-pure.test.mjs` | 保留（验证纯桥模式） |

## 预期效果

### Before (v1.8)
```bash
# 用户：我想用 matt 开发
AI：探测到 .claude-plugin/ + matt-skills 字段，建议用 matt
# 探测失败时：建议用 openspec（误判！）
```

### After (v1.9-2)
```bash
# 用户先配置（一次性）
bridge stacks set matt

# 后续：bridge 直接用 matt，不用探测
```

## breaking change 风险

| 用户类型 | 影响 |
|---|---|
| 已配置 stacks | ✅ 无影响（v1.9-1 配置优先） |
| 未配置 + 项目根有 openspec/ | ⚠️ workflow_kind 从 openspec → builtin |
| 不在乎 workflow_kind | ✅ 无影响（默认就是 builtin） |

**缓解措施**：
- 提供 `bridge migrate-v1.9-detect` 命令：扫描 `.bridge.log` 历史记录，把探测结果写入 `.bridge-config.json`
- 文档提示：迁移指南

## 拍板项

1. ✅ 删除 `vendor/detect-stack.mjs` 是否接受？
2. ⚠️ `cmd-adopt.mjs` 是否同步改为读配置？
3. ⚠️ 是否提供迁移工具 `bridge migrate-v1.9-detect`？