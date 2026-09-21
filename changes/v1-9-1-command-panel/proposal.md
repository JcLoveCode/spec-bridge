# v1.9-1 命令面板 + 持久化配置

## 问题

当前 v1.8 的 bridge 采用"自动探测外栈"模式：
- `bridge probe` 探测磁盘特征文件（`openspec/`、`.mattskills/`、git 历史）判断该用哪个外栈 skill
- 探测逻辑复杂且脆弱，无法手动覆盖
- 用户实际工作流是"固定技术栈"（一个 repo 长期用 matt 或 openspec），不需要每次探测

**用户需求**：
> 手动设置用什么流程开发 openspec / superpowers / mattskills 或者多选。
> 这样其实探测是否存在就可以去掉了，只需要根据对话场景和上下文还有上一次用的能力，指引用户用哪个能力。

**设计灵感**：[ponytail](https://github.com/DietrichGebert/ponytail) 的命令面板机制——`/ponytail [lite|full|ultra|off]` 强度级别 + 持久化配置。

---

## 提议方案

### 1. 命令面板：`bridge mode [preset]`

提供 4 个预设强度级别：

| 强度 | 启用能力 | 说明 |
|---|---|---|
| `full` | memory + navigator + builtin | 全功能（默认） |
| `memory` | memory only | 只启用 v1.8-3 的个人/团队 memory |
| `navigator` | navigator only | 只推荐外栈，不建 memory、不生成模板 |
| `off` | — | 关闭所有自动行为，变纯 CLI 工具 |

**用法**：
```bash
node bridge.mjs mode              # 查询当前模式
node bridge.mjs mode full         # 设置为全功能
node bridge.mjs mode navigator    # 设置为只推荐外栈
node bridge.mjs mode off          # 关闭所有自动行为
```

### 2. 能力栈配置：`bridge stacks [list|set|add|remove]`

手动声明该 repo 使用哪些外栈 skill，**去掉自动探测**：

```bash
node bridge.mjs stacks list                    # 查看当前配置
node bridge.mjs stacks set matt,superpowers    # 设置能力栈（覆盖式）
node bridge.mjs stacks add openspec            # 增加一个栈
node bridge.mjs stacks remove matt             # 删除一个栈
```

**三种能力栈**：
- `openspec`：openspec-* 系列（openspec-propose / openspec-new-change）
- `matt`：matt-skills（to-spec / implement）
- `superpowers`：superpowers（tdd / execute）
- `builtin`：bridge 内置 5 件模板（最低优先级兜底）

**多选 + 优先级**：
```json
{
  "stacks": [
    {"kind": "matt", "priority": 1},
    {"kind": "superpowers", "priority": 2}
  ]
}
```
AI 推荐时："建议使用 matt to-spec（priority 1），也可用 superpowers tdd（priority 2）"

### 3. 持久化配置

**配置文件位置**：
```
~/.config/spec-bridge/config.json    # 全局默认
<repo>/.bridge-config.json           # 项目级覆盖
```

**配置格式**：
```json
{
  "mode": "full",
  "stacks": [
    {"kind": "matt", "priority": 1},
    {"kind": "superpowers", "priority": 2}
  ],
  "lastUsedStack": "matt"
}
```

**读取顺序**（SKILL.md §1 入口例程）：
1. 项目级 `.bridge-config.json`（优先）
2. 全局 `~/.config/spec-bridge/config.json`
3. 默认值：`mode=full, stacks=[]`（零配置兜底）

---

## 预期效果

### Before (v1.8)
```bash
# 用户：我想用 matt 开发这个 change
AI：正在探测外栈... 检测到 openspec/，建议用 openspec-propose
用户：不，我想用 matt（需要手动覆盖）
```

### After (v1.9-1)
```bash
# 一次性配置
node bridge.mjs stacks set matt

# 以后每次
AI：检测到配置：优先使用 matt to-spec，是否现在开始？
用户：是（直接进入）
```

---

## 风险

1. **breaking change**：v1.8 用户依赖 probe 自动探测，v1.9 需要手动配置
   - **缓解**：首次使用时提示："未检测到能力栈配置，请运行 `bridge stacks set <kind>`"
   - **或**：提供迁移工具 `bridge migrate-v1.8-probe`（从旧 `.bridge.log` 提取探测结果）

2. **零配置原则冲突**：要求用户手动配置 ≠ 零配置
   - **缓解**：stacks 为空时 fallback 到 builtin（保持开箱即用）
   - **零配置**指"不创建状态"，**不是**指"不允许配置"

3. **配置文件同步**：团队协作时每个人都要配？
   - **缓解**：`.bridge-config.json` 可 commit 到 repo（团队共享）
   - **或**：全局配置 `~/.config/` 对个人生效

---

## 后续 change

- **v1.9-2-remove-auto-detect**：删除 `cmd-probe.mjs` 的探测逻辑
- **v1.9-3-context-aware-navigator**：记住上次使用的能力栈（`lastUsedStack`）

---

## 拍板项

1. ✅ mode 强度级别：`full / memory / navigator / off` 是否合理？
2. ✅ stacks 能力栈：`openspec / matt / superpowers / builtin` 是否完整？
3. ⚠️ 配置文件位置：全局 vs 项目级，优先级如何？
4. ⚠️ 零配置 vs 手动配置的平衡：stacks 为空时是否 fallback builtin？
