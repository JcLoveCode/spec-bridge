# ADR-0014: 命令面板 + 能力栈配置（v1.9-1）

- 状态：Accepted（2026-09-21）
- 决策人：JcLoveCode
- 关联 change：changes/v1-9-1-command-panel/

## 背景

v1.8-1 把 bridge 升级为"导航员"，通过 `bridge probe` 自动探测外栈 skill 是否存在（`openspec/`、`.mattskills/`、git 历史）。实战发现三个问题：

1. **探测逻辑脆弱**：依赖磁盘特征文件，跨平台/跨编辑器容易误判
2. **无法手动覆盖**：即使知道要用 matt，也必须等探测完，且无法强制指定
3. **工作流固定**：一个 repo 长期只用 1-2 个栈，每次探测浪费 tokens

**用户原话**：
> 手动设置用什么流程开发 openspec / superpowers / mattskills 或者多选。
> 这样其实探测是否存在就可以去掉了，只需要根据对话场景和上下文还有上一次用的能力，指引用户用哪个能力。

**设计灵感**：[ponytail](https://github.com/DietrichGebert/ponytail) 的 `/ponytail [lite|full|ultra|off]` 强度级别 + 持久化配置。

## 决策

### D1. 引入 4 档强度级别（mode）

| 级别 | 启用能力 | 适用场景 |
|---|---|---|
| `full` (默认) | memory + navigator + builtin | 完整体验 |
| `memory` | personal + team memory only | 只记录决策 |
| `navigator` | 外栈推荐 only | 只引导不记忆 |
| `off` | — | 关闭所有自动行为 |

**命令**：`bridge mode [preset]`
- 无参数：查询当前 mode + config source
- 带参数：写入 `.bridge-config.json`

**拒绝的方案**：保留 `full` 单档 + 开关细分（"关 navigator"、"关 memory"）
**理由**：多开关组合爆炸；预设级别让选择更简单（参考 ponytail 4 档）

### D2. 去掉自动探测，改用手动配置能力栈

新增 `bridge stacks [list|set|add|remove]`：
- `stacks list`：查看当前配置
- `stacks set <kinds>`：覆盖式设置（按顺序分配 priority）
- `stacks add <kind>`：追加到末尾
- `stacks remove <kind>`：删除（自动重新分配 priority）

**3 种能力栈**：
- `openspec`：openspec-* 系列
- `matt`：matt-skills
- `superpowers`：superpowers 系列
- `builtin`：bridge 内置模板（最低优先级兜底）

**多选 + 优先级**：
```json
{
  "stacks": [
    {"kind": "matt", "priority": 1},
    {"kind": "superpowers", "priority": 2}
  ]
}
```
AI 推荐时按 priority 顺序："建议使用 matt（priority 1），也可用 superpowers（priority 2）"

**拒绝的方案**：保留自动探测 + 手动覆盖
**理由**：复杂度叠加；手动配置本身已经够用

### D3. 持久化配置（项目级 + 全局两层）

**配置文件位置**：
```
<repo>/.bridge-config.json          # 项目级（优先）
~/.config/spec-bridge/config.json   # 全局默认
```

**读取顺序**：
1. 项目级（如果存在）
2. 全局（如果存在）
3. 默认值 `{ mode: 'full', stacks: [] }`

**拒绝的方案**：只支持全局 / 只支持项目级
**理由**：两层覆盖提供灵活性（个人偏好 + 团队共享）

### D4. 项目级完全覆盖全局（不合并）

```javascript
// 策略：项目级完全替换全局的 stacks 数组
// 不合并、不追加
```

**拒绝的方案**：项目级 + 全局合并（如全局有 matt，项目级加 superpowers → 两者都有）
**理由**：避免意外行为（用户配项目级就是想完全接管）

### D5. stacks 为空时 fallback 到 builtin

```javascript
if (config.mode === 'navigator' && config.stacks.length === 0) {
  console.warn('[bridge] No stacks configured, falling back to builtin templates');
  // 继续生成 builtin 模板
}
```

**拒绝的方案**：stacks 为空时禁止推荐（exit 1）
**理由**：保持零配置（开箱即用），用户不配也能用

### D6. mode=off 不禁止显式命令

```javascript
if (config.mode === 'off') {
  console.log('[bridge] Mode is off, skipping auto-recommendations');
  // 但 init / list / memory 等命令仍正常执行
}
```

**拒绝的方案**：mode=off 禁止所有命令
**理由**：off 是"关闭自动行为"，不是"禁用 bridge"

### D7. mode/stacks 命令族（2 子命令 × 4 子子命令）

| 命令 | 子命令 | 功能 |
|---|---|---|
| `bridge mode` | — | 查询 mode |
| `bridge mode <preset>` | — | 设置 mode |
| `bridge stacks list` | list | 查询配置 |
| `bridge stacks set <kinds>` | set | 覆盖设置 |
| `bridge stacks add <kind>` | add | 追加 |
| `bridge stacks remove <kind>` | remove | 删除 |

**命令族边界**：**不**包含 `edit` / `merge` / `disable`（人是决策者）

### D8. 每轮入口例程读取配置（不依赖会话状态）

**SKILL.md §1 入口例程**：
```
① 定位项目根 → bridge layout <root>
② 读取配置 → readBridgeConfig(root)
③ bridge list <root>
④ 根据 mode + stacks 决定行为
```

**拒绝的方案**：mode 切换后重启会话
**理由**：bridge 是"状态只在磁盘"，每轮重读即可（参考 ponytail 的环境变量覆盖）

### D9. 配置格式：JSON（非 YAML）

```json
{
  "version": "1.9",
  "mode": "full",
  "stacks": [{"kind": "matt", "priority": 1}],
  "lastUsedStack": "matt",
  "updatedAt": "ISO-8601"
}
```

**拒绝的方案**：YAML / TOML
**理由**：Node.js 内置支持 JSON；ponytail 也用 JSON；不引入额外依赖

### D10. 写入 0 错误处理（throw → stderr）

```javascript
// 命令调度处
runMode({ _, projectRoot });
process.exit(0);  // 出错时不会到这里
```

```javascript
// cmd-mode.mjs 内部
try {
  setMode(projectRoot, newMode);
} catch (err) {
  console.error(`[bridge] mode error: ${err.message}`);
  process.exit(1);
}
```

**拒绝的方案**：静默忽略错误（只 log）
**理由**：用户需要明确知道 mode 是否设置成功（CI/CD 友好）

## 影响面

### 新增文件（4 个）

- A `skills/spec-bridge/scripts/config-utils.mjs`（140 行）
- A `skills/spec-bridge/scripts/cmd-mode.mjs`（30 行）
- A `skills/spec-bridge/scripts/cmd-stacks.mjs`（60 行）
- A `skills/spec-bridge/tests/mode.test.mjs`（6 测试）
- A `skills/spec-bridge/tests/stacks.test.mjs`（8 测试）
- A `skills/spec-bridge/docs/adr/0014-command-panel-and-stacks.md`（本 ADR）

### 修改文件（2 个）

- M `skills/spec-bridge/scripts/bridge.mjs`（+import +dispatcher +usage）
- M `skills/spec-bridge/SKILL.md`（§1 入口例程 + §7 CHANGELOG）

### 测试覆盖（+14 测试）

| 测试 | 场景 |
|---|---|
| `mode-get-default` | 无配置 → `full, source=default` |
| `mode-set-and-get` | 设置 navigator 后查询 |
| `mode-set-off` | 设置 off |
| `mode-set-memory` | 设置 memory |
| `mode-invalid` | 设置非法值抛错 |
| `mode-write-file` | 配置文件含 mode + updatedAt |
| `stacks-list-empty` | 空配置返回 `[]` |
| `stacks-set` | set 后 priority 正确分配 |
| `stacks-add` | add 后 priority = max+1 |
| `stacks-remove` | remove 后 priority 重新编号 |
| `stacks-add-duplicate` | 重复 add 是 no-op |
| `stacks-set-invalid` | 非法 kind 抛错 |
| `stacks-add-invalid` | 非法 kind 抛错 |
| `stacks-persistence` | 配置含所有 stack |

测试数：174 → 188

## 与其他 ADR 的关系

- **ADR-0001**（prompt 不合并文本）：mode 推荐由 AI 输出，stacks 配置由 CLI 读写 ✓
- **ADR-0004**（导航员不调度）：mode=navigator 推荐外栈不调 skill ✓
- **ADR-0007**（无会话状态）：每轮重读配置 ✓
- **ADR-0010**（probe 导航员）：probe 输出仍在，但探测逻辑在 v1.9-2 删除 ✓
- **ADR-0011**（导航员默认外栈）：stacks 配置取代自动探测 ✓
- **ADR-0012**（纯桥模式）：v1.9-1 仍是"加法"（加 mode/stacks），不删探测 ✓
- **ADR-0013**（memory 规则）：memory 模式与 mode=memory 兼容 ✓

## 风险与限制

1. **breaking change**：v1.8 用户已有探测逻辑，v1.9-1 加配置优先但不删探测（探测仍 fallback）
   - **缓解**：v1.9-2 才删探测，给用户过渡期
2. **stacks 概念用户认知负担**："stacks" vs "skills" vs "plugins" 易混淆
   - **缓解**：SKILL.md §1.6 文档清晰列出 3 种栈的对应 skill
3. **配置文件脏数据**：手动编辑 `.bridge-config.json` 可能写错 priority
   - **缓解**：`validateConfig()` 过滤非法 kind + 自动重新分配 priority
4. **mode=off 误用**：用户可能误设 off 然后"bridge 坏了"
   - **缓解**：off 时 stderr 输出明确提示"Mode is off, skipping auto-recommendations"

## 遗留问题

- **v1.9-2**：删除 `cmd-probe.mjs` 的探测逻辑
- **v1.9-3**：context-aware（记住上次用的栈 lastUsedStack）
- **lastUsedStack 字段**：v1.9-1 预留，v1.9-3 才实装

## ponytail 借鉴点

| ponytail | spec-bridge v1.9-1 |
|---|---|
| `/ponytail [lite\|full\|ultra\|off]` | `bridge mode [full\|memory\|navigator\|off]` |
| `~/.config/ponytail/config.json` | `~/.config/spec-bridge/config.json` + 项目级覆盖 |
| 环境变量覆盖 `PONYTAIL_DEFAULT_MODE` | （未实现，留后续） |
| `PONYTAIL_SUBAGENT_MATCHER` 控制子智能体 | （v1.9-1 不支持） |
| `node scripts/uninstall.js` 卸载 | `bridge mode off` + 删除 config.json |

**核心借鉴**：
1. 强度级别 ≠ 功能开关，而是"工作模式"
2. 持久化配置让用户"设置一次，永久生效"
3. 命令简洁（一个命令搞定，不引入复杂语法）