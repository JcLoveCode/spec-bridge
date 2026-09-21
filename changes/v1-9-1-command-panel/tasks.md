# v1.9-1 任务清单

## T1：配置读写基础设施

**输入**：无  
**输出**：`scripts/config-utils.mjs`

**实现**：
1. `readBridgeConfig(projectRoot)` 函数
   - 读取顺序：项目级 → 全局 → 默认值
   - 返回 `{ mode, stacks, source }`
2. `writeBridgeConfig(projectRoot, updates)` 函数
   - 写入项目级 `.bridge-config.json`
   - 合并现有配置（增量更新）
3. 配置验证：`validateConfig(config)`
   - mode 只能是 `full|memory|navigator|off`
   - stacks[].kind 只能是 `openspec|matt|superpowers|builtin`
   - priority 必须是正整数

**验收**：
- 配置不存在时返回默认值 `{ mode: 'full', stacks: [], source: 'default' }`
- 项目级覆盖全局
- 写入后能读回相同值

---

## T2：cmd-mode.mjs 实现

**输入**：T1 的 `config-utils.mjs`  
**输出**：`scripts/cmd-mode.mjs`

**实现**：
```bash
# 查询模式
node bridge.mjs mode
# 输出：Current mode: full (source: default)

# 设置模式
node bridge.mjs mode navigator
# 输出：Mode set to: navigator
```

**行为**：
1. 无参数：查询当前 mode + source
2. 带参数：验证 + 写入 `.bridge-config.json`
3. 非法值：抛错 `Error: Invalid mode: foobar`

**验收**：
- `mode` 无参数返回当前模式
- `mode full` 设置后查询返回 `full`
- `mode invalid` 抛错

---

## T3：cmd-stacks.mjs 实现

**输入**：T1 的 `config-utils.mjs`  
**输出**：`scripts/cmd-stacks.mjs`

**实现**：
```bash
# 查询
node bridge.mjs stacks list
# 输出：[{"kind":"matt","priority":1},{"kind":"superpowers","priority":2}]

# 覆盖式设置
node bridge.mjs stacks set matt,superpowers

# 增加
node bridge.mjs stacks add openspec

# 删除
node bridge.mjs stacks remove matt
```

**行为**：
1. `list`：JSON 输出当前 stacks
2. `set <kinds>`：逗号分隔，按顺序分配 priority
3. `add <kind>`：追加到最后（priority = max + 1）
4. `remove <kind>`：过滤掉指定 kind

**验收**：
- `stacks set matt` 后 `stacks list` 返回 `[{"kind":"matt","priority":1}]`
- `stacks add superpowers` 后长度 +1
- `stacks remove matt` 后不含 matt

---

## T4：bridge.mjs 入口例程修改

**输入**：T1 的 `config-utils.mjs`  
**输出**：修改 `scripts/bridge.mjs`

**变更点**：
1. 在 `layout` 和 `list` 之间加一步：
   ```javascript
   const config = readBridgeConfig(projectRoot);
   ```
2. 根据 `config.mode` 决定行为：
   ```javascript
   if (config.mode === 'off') {
     console.log('[bridge] Mode is off, skipping auto-recommendations');
     return;  // 跳过所有自动推荐
   }
   ```
3. navigator 推荐时使用 `config.stacks`：
   ```javascript
   if (config.mode === 'full' || config.mode === 'navigator') {
     const stacksText = config.stacks
       .map((s, i) => `${i+1}. ${s.kind}`)
       .join('\n');
     console.log(`检测到能力栈配置：\n${stacksText}`);
   }
   ```

**验收**：
- mode=off 时不输出任何推荐
- mode=navigator 时输出 stacks 配置
- mode=full 时正常工作（memory + navigator）

---

## T5：SKILL.md §1 文档更新

**输入**：T4 的行为变更  
**输出**：`skills/spec-bridge/SKILL.md` §1 修改

**变更内容**：
```markdown
## 1. 入口例程

① 定位项目根 → node <bridge> layout <project-root>
② 读取配置 → 自动读取 .bridge-config.json 或全局配置
③ node <bridge> list <project-root>
④ 根据 mode + stacks 决定行为：
   - mode=off：跳过所有自动推荐
   - mode=navigator：只推荐外栈（按 stacks 优先级）
   - mode=memory：只建 memory，不推荐外栈
   - mode=full：memory + navigator + builtin 兜底
⑤ 三分流（有活跃 change / 开新 / 闲聊）
```

新增段落：
```markdown
### 1.6 配置管理（v1.9）

查询当前模式：
node <bridge> mode

设置工作模式：
node <bridge> mode full|memory|navigator|off

管理能力栈：
node <bridge> stacks list
node <bridge> stacks set matt,superpowers
node <bridge> stacks add openspec
node <bridge> stacks remove matt

配置文件位置：
- 项目级：<repo>/.bridge-config.json
- 全局：~/.config/spec-bridge/config.json
```

**验收**：
- 文档准确反映实现行为
- 例子可复现

---

## T6：测试实现（mode-*.test.mjs）

**输出**：`skills/spec-bridge/tests/mode-*.test.mjs`（4 个测试）

1. **mode-get-default.test.mjs**
   - 场景：无配置文件
   - 期望：返回 `mode=full, source=default`

2. **mode-set-and-get.test.mjs**
   - 场景：设置 `mode navigator` 后查询
   - 期望：返回 `mode=navigator`

3. **mode-invalid.test.mjs**
   - 场景：设置非法值 `mode foobar`
   - 期望：抛错 `Invalid mode: foobar`

4. **mode-project-override-global.test.mjs**
   - 场景：全局设置 `full`，项目级设置 `navigator`
   - 期望：查询返回 `navigator, source=project`

**验收**：
- 4 个测试全绿
- 覆盖默认值、设置、非法值、优先级场景

---

## T7：测试实现（stacks-*.test.mjs）

**输出**：`skills/spec-bridge/tests/stacks-*.test.mjs`（4 个测试）

1. **stacks-set.test.mjs**
   - 场景：`stacks set matt,superpowers`
   - 期望：查询返回 `[{kind:matt,priority:1},{kind:superpowers,priority:2}]`

2. **stacks-add.test.mjs**
   - 场景：已有 `[matt]`，执行 `stacks add openspec`
   - 期望：长度 2，openspec priority=2

3. **stacks-remove.test.mjs**
   - 场景：已有 `[matt, superpowers]`，执行 `stacks remove matt`
   - 期望：只剩 `[superpowers]`

4. **stacks-empty-fallback.test.mjs**
   - 场景：stacks=[]，mode=navigator
   - 期望：fallback 到 builtin（不抛错）

**验收**：
- 4 个测试全绿
- 覆盖 set/add/remove/empty 场景

---

## T8：ADR-0014 撰写

**输出**：`skills/spec-bridge/docs/adr/0014-command-panel-and-stacks.md`

**内容结构**：
1. Status：Accepted
2. Context：v1.8 自动探测的局限
3. Decision：命令面板 + 手动配置能力栈
4. Consequences：
   - 优势：用户可控、简化探测逻辑
   - 劣势：breaking change、需手动配置
   - 缓解：fallback builtin 保持零配置

**关键决策记录**：
- D1：配置格式 JSON（非 YAML）
- D2：项目级完全覆盖全局（不合并）
- D3：mode 每轮重算（不需重启会话）
- D4：stacks 为空 fallback builtin

**验收**：
- ADR 清晰记录决策上下文
- 后续维护者能理解为何这样设计

---

## T9：集成测试 + 冒烟测试

**输出**：验证整体流程

**场景 1：首次使用（零配置）**
```bash
node bridge.mjs mode
# 期望：Current mode: full (source: default)

node bridge.mjs stacks list
# 期望：[]

# 行为：fallback builtin（保持零配置）
```

**场景 2：手动配置后**
```bash
node bridge.mjs stacks set matt
node bridge.mjs mode navigator

# 下次 AI 调用入口例程
# 期望：推荐 matt to-spec，不建 memory，不生成 builtin 模板
```

**场景 3：mode=off**
```bash
node bridge.mjs mode off

# 下次 AI 调用入口例程
# 期望：跳过所有自动推荐，只响应显式命令
```

**验收**：
- 3 个场景手动走通
- AI 推荐行为符合 mode 设置

---

## T10：CHANGELOG 更新

**输出**：`skills/spec-bridge/SKILL.md` §7 加 v1.9-1 段落

**内容**：
```markdown
### v1.9-1 命令面板 + 持久化配置（2026-09-21）

**新增**：
- `bridge mode [full|memory|navigator|off]`：工作模式切换
- `bridge stacks list|set|add|remove`：能力栈配置
- 配置文件：`.bridge-config.json`（项目级）+ `~/.config/spec-bridge/config.json`（全局）

**变更**：
- 入口例程加"读取配置"步骤（SKILL.md §1 ②）
- mode=off 跳过所有自动推荐
- mode=navigator 按 stacks 优先级推荐外栈

**breaking change**：
- v1.8 的自动探测逻辑仍保留（v1.9-2 才删除）
- 配置优先于探测（有 stacks 配置时不触发探测）
```

**验收**：
- CHANGELOG 准确概括变更
- 用户能快速了解新功能

---

## 依赖关系

```
T1 (config-utils) 
  ├→ T2 (cmd-mode)
  ├→ T3 (cmd-stacks)
  └→ T4 (bridge.mjs)
      └→ T5 (SKILL.md)

T6 (mode 测试) ← T2
T7 (stacks 测试) ← T3

T8 (ADR) ← T1-T5
T9 (集成测试) ← T4
T10 (CHANGELOG) ← T1-T9
```

**推荐实施顺序**：
1. T1 → T2/T3（并行）→ T6/T7（并行）
2. T4 → T5 → T9
3. T8 → T10

**预计工作量**：
- 核心实现（T1-T5）：~200 行代码
- 测试（T6-T7）：8 个测试，~150 行
- 文档（T5, T8, T10）：~100 行
- **总计**：~450 行新增 + ~50 行修改
