# v1.9-1 命令面板设计

## 1. 架构

```
┌─────────────────────────────────────────┐
│  SKILL.md §1 入口例程                    │
│  ① layout → ② readConfig → ③ list       │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  配置读取层（新增）                      │
│  - readBridgeConfig(projectRoot)         │
│    1. 项目级 .bridge-config.json         │
│    2. 全局 ~/.config/spec-bridge/config  │
│    3. 默认值 {mode:"full", stacks:[]}    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  行为决策层（修改 bridge.mjs）           │
│  根据 mode + stacks 决定：              │
│  - mode=off: 不做任何自动推荐            │
│  - mode=navigator: 只推荐外栈            │
│  - mode=memory: 只建 memory              │
│  - mode=full: memory + navigator + builtin│
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  CLI 命令（新增）                        │
│  - cmd-mode.mjs: mode [preset]           │
│  - cmd-stacks.mjs: stacks list|set|add|rm│
└─────────────────────────────────────────┘
```

---

## 2. 数据结构

### 2.1 配置文件格式（JSON）

```json
{
  "version": "1.9",
  "mode": "full",
  "stacks": [
    {
      "kind": "matt",
      "priority": 1,
      "enabled": true
    },
    {
      "kind": "superpowers",
      "priority": 2,
      "enabled": true
    }
  ],
  "lastUsedStack": "matt",
  "updatedAt": "2026-09-21T16:00:00Z"
}
```

**字段说明**：
- `version`：配置格式版本（用于未来迁移）
- `mode`：`full | memory | navigator | off`
- `stacks[]`：能力栈数组，按 priority 排序
  - `kind`：`openspec | matt | superpowers | builtin`
  - `priority`：数字越小优先级越高（1 > 2 > 3）
  - `enabled`：是否启用（预留，暂不实现禁用单个栈）
- `lastUsedStack`：上次使用的栈（v1.9-3 才用）
- `updatedAt`：最后修改时间（调试用）

### 2.2 内存结构（bridge.mjs）

```javascript
// readBridgeConfig() 返回值
{
  mode: 'full',
  stacks: [
    { kind: 'matt', priority: 1 },
    { kind: 'superpowers', priority: 2 }
  ],
  source: 'project' | 'global' | 'default'  // 配置来源（调试用）
}
```

---

## 3. 核心函数

### 3.1 `cmd-mode.mjs`

```javascript
// 命令：node bridge.mjs mode [preset]
export function cmdMode(args) {
  const projectRoot = args.projectRoot;
  
  if (args._.length === 0) {
    // 查询模式
    const config = readBridgeConfig(projectRoot);
    console.log(`Current mode: ${config.mode}`);
    console.log(`Source: ${config.source}`);
    return;
  }
  
  const newMode = args._[0];
  if (!['full', 'memory', 'navigator', 'off'].includes(newMode)) {
    throw new Error(`Invalid mode: ${newMode}`);
  }
  
  // 写入配置（优先写项目级）
  writeBridgeConfig(projectRoot, { mode: newMode });
  console.log(`Mode set to: ${newMode}`);
}
```

### 3.2 `cmd-stacks.mjs`

```javascript
// 命令：node bridge.mjs stacks list|set|add|remove
export function cmdStacks(args) {
  const subCommand = args._[0];
  const projectRoot = args.projectRoot;
  const config = readBridgeConfig(projectRoot);
  
  switch (subCommand) {
    case 'list':
      console.log(JSON.stringify(config.stacks, null, 2));
      break;
      
    case 'set':
      // stacks set matt,superpowers
      const kinds = args._[1].split(',');
      const newStacks = kinds.map((kind, i) => ({
        kind,
        priority: i + 1
      }));
      writeBridgeConfig(projectRoot, { stacks: newStacks });
      break;
      
    case 'add':
      // stacks add openspec
      const addKind = args._[1];
      const maxPriority = Math.max(...config.stacks.map(s => s.priority), 0);
      config.stacks.push({ kind: addKind, priority: maxPriority + 1 });
      writeBridgeConfig(projectRoot, { stacks: config.stacks });
      break;
      
    case 'remove':
      // stacks remove matt
      const removeKind = args._[1];
      config.stacks = config.stacks.filter(s => s.kind !== removeKind);
      writeBridgeConfig(projectRoot, { stacks: config.stacks });
      break;
      
    default:
      throw new Error(`Unknown subcommand: ${subCommand}`);
  }
}
```

### 3.3 `readBridgeConfig(projectRoot)` 

```javascript
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export function readBridgeConfig(projectRoot) {
  // 1. 项目级
  const projectConfig = join(projectRoot, '.bridge-config.json');
  if (existsSync(projectConfig)) {
    const data = JSON.parse(readFileSync(projectConfig, 'utf8'));
    return { ...data, source: 'project' };
  }
  
  // 2. 全局
  const globalConfig = join(homedir(), '.config', 'spec-bridge', 'config.json');
  if (existsSync(globalConfig)) {
    const data = JSON.parse(readFileSync(globalConfig, 'utf8'));
    return { ...data, source: 'global' };
  }
  
  // 3. 默认值
  return {
    mode: 'full',
    stacks: [],
    source: 'default'
  };
}
```

### 3.4 `writeBridgeConfig(projectRoot, updates)`

```javascript
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export function writeBridgeConfig(projectRoot, updates) {
  const configPath = join(projectRoot, '.bridge-config.json');
  
  // 读取现有配置（如果有）
  let config = {};
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  }
  
  // 合并更新
  config = {
    ...config,
    ...updates,
    version: '1.9',
    updatedAt: new Date().toISOString()
  };
  
  // 写入
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}
```

---

## 4. 入口例程修改（SKILL.md §1）

### Before (v1.8)
```
① 定位项目根 → node bridge.mjs layout <root>
② node bridge.mjs list <root>
③ 三分流（有活跃 change / 开新 / 闲聊）
```

### After (v1.9-1)
```
① 定位项目根 → node bridge.mjs layout <root>
② 读取配置 → const config = readBridgeConfig(root)
③ node bridge.mjs list <root>
④ 根据 mode + stacks 决定行为：
   - mode=off: 跳过所有自动推荐，只响应显式命令
   - mode=navigator: 只推荐外栈（按 stacks 优先级）
   - mode=memory: 只建 memory，不推荐外栈
   - mode=full: memory + navigator + builtin 兜底
⑤ 三分流（有活跃 change / 开新 / 闲聊）
```

**AI 推荐话术**（mode=navigator 或 full）：
```
检测到能力栈配置：
1. matt（优先）
2. superpowers

建议使用 matt to-spec 开始规划，是否现在调用？
```

---

## 5. 边界情况

### 5.1 stacks 为空 + mode=navigator
```javascript
// 行为：fallback 到 builtin（保持零配置）
if (config.mode === 'navigator' && config.stacks.length === 0) {
  console.warn('[bridge] No stacks configured, falling back to builtin templates');
  // 继续生成 builtin 模板
}
```

### 5.2 stacks 包含无效值
```javascript
// 验证
const VALID_STACKS = ['openspec', 'matt', 'superpowers', 'builtin'];
config.stacks = config.stacks.filter(s => VALID_STACKS.includes(s.kind));
```

### 5.3 项目级 + 全局配置冲突
```javascript
// 策略：项目级完全覆盖全局（不合并）
// 理由：避免"项目设置 matt，全局还带着 openspec"的意外行为
```

### 5.4 mode=off 但用户调 bridge init
```javascript
// 行为：仍然允许（off 只影响"自动推荐"，不禁止显式命令）
if (config.mode === 'off') {
  console.log('[bridge] Mode is off, skipping auto-recommendations');
  // 但 init / list / probe 等命令仍正常执行
}
```

---

## 6. 测试用例

### 6.1 `mode-*.test.mjs`（4 个测试）

1. **mode-get-default**：无配置时返回 `full`
2. **mode-set-and-get**：设置 `navigator` 后查询返回 `navigator`
3. **mode-invalid**：设置非法值（如 `foobar`）抛错
4. **mode-project-override-global**：项目级覆盖全局

### 6.2 `stacks-*.test.mjs`（4 个测试）

1. **stacks-set**：`stacks set matt,superpowers` 后查询返回正确优先级
2. **stacks-add**：`stacks add openspec` 后长度 +1
3. **stacks-remove**：`stacks remove matt` 后不含 matt
4. **stacks-empty-fallback**：stacks 为空时 mode=navigator 仍能工作（fallback builtin）

---

## 7. 迁移策略（v1.8 → v1.9）

### 7.1 自动迁移（可选）

```bash
# 新命令：bridge migrate-v1.8-probe
# 扫描 .bridge.log 提取探测结果，写入 .bridge-config.json
node bridge.mjs migrate-v1.8-probe
```

**实现**：
```javascript
export function cmdMigrateV18Probe(args) {
  const projectRoot = args.projectRoot;
  const logPath = join(projectRoot, 'changes', '*', '.bridge.log');
  
  // 读取所有 .bridge.log
  const logs = glob.sync(logPath);
  const detectedStacks = new Set();
  
  logs.forEach(log => {
    const content = readFileSync(log, 'utf8');
    const match = content.match(/detected: (.*)/);
    if (match) {
      match[1].split(',').forEach(s => detectedStacks.add(s.trim()));
    }
  });
  
  // 写入配置
  const stacks = Array.from(detectedStacks).map((kind, i) => ({
    kind,
    priority: i + 1
  }));
  
  writeBridgeConfig(projectRoot, { stacks });
  console.log(`Migrated ${stacks.length} stacks from v1.8 probe logs`);
}
```

### 7.2 手动迁移（推荐）

文档引导：
```
v1.8 → v1.9 迁移指南

1. 如果你之前用 matt：
   node bridge.mjs stacks set matt

2. 如果你之前用 openspec：
   node bridge.mjs stacks set openspec

3. 如果你混着用（不确定）：
   保持默认（stacks 为空 → fallback builtin）
```

---

## 8. ponytail 对比

| 维度 | ponytail | spec-bridge v1.9-1 |
|---|---|---|
| 命令 | `/ponytail [lite\|full\|ultra\|off]` | `bridge mode [full\|memory\|navigator\|off]` |
| 配置位置 | `~/.config/ponytail/config.json` | 项目级 + 全局两层 |
| 强度级别 | 4 档 | 4 档（语义不同） |
| 子智能体 | 支持过滤注入 | v1.9-1 不支持（主对话生效） |
| 状态标记 | `~/.claude/.ponytail-active` | 不需要（每轮读配置） |

**借鉴点**：
1. 强度级别 ≠ 功能开关，而是"工作模式"
2. 配置持久化（设置一次，永久生效）
3. 命令简洁（一个命令搞定，不需要复杂语法）

---

## 9. ADR 关键决策

### D1：配置格式 JSON vs YAML
**决策**：JSON  
**理由**：Node.js 内置支持、ponytail 用 JSON、无需额外依赖

### D2：项目级 vs 全局优先级
**决策**：项目级完全覆盖全局（不合并）  
**理由**：避免"项目想用 matt，全局配置还带着 openspec"的意外

### D3：mode 切换是否需要重启会话
**决策**：不需要（每轮重算）  
**理由**：bridge 是"状态只在磁盘"，每轮入口例程重读配置

### D4：stacks 为空时的 fallback
**决策**：fallback 到 builtin  
**理由**：保持零配置（开箱即用），不强制用户配置

### D5：mode=off 是否禁止所有命令
**决策**：只禁止"自动推荐"，不禁止显式命令  
**理由**：off 是"关闭自动行为"，不是"禁用 bridge"

---

## 10. 下一步

1. **实现 cmd-mode.mjs + cmd-stacks.mjs**
2. **修改 bridge.mjs 入口例程**（加 ② readConfig 步骤）
3. **修改 SKILL.md §1**（文档入口例程新步骤）
4. **8 个测试**（mode 4 + stacks 4）
5. **ADR-0014**：command-panel-and-stacks.md
