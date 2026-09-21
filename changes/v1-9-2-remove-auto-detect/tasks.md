# v1.9-2 任务清单

## T1：删除 vendor/detect-stack.mjs

**输出**：删除 `skills/spec-bridge/scripts/vendor/detect-stack.mjs`

**验收**：
- 文件被删除
- 没有其他文件引用该模块

## T2：修改 cmd-init.mjs 用配置替代探测

**输出**：修改 `skills/spec-bridge/scripts/cmd-init.mjs`

**变更**：
```javascript
// 移除
import { detectStack } from './vendor/detect-stack.mjs';

// 改为
import { readBridgeConfig } from './config-utils.mjs';

// init 逻辑
const config = readBridgeConfig(projectRoot);
const workflowKind = config.stacks[0]?.kind || 'builtin';
```

**验收**：
- 无 stacks 配置 → workflow_kind = builtin
- 有 stacks 配置 → workflow_kind = stacks[0].kind

## T3：修改 cmd-adopt.mjs 用配置替代探测

**输出**：修改 `skills/spec-bridge/scripts/cmd-adopt.mjs`

**变更**：
- 移除 `detectStackFromSignals()` 函数
- 改为读 `readBridgeConfig(projectRoot).stacks[0]?.kind`

**验收**：
- 有 `--stack` flag → 用之
- 有 stacks 配置 → 用 stacks[0].kind
- 都没有 → builtin

## T4：修改 cmd-probe.mjs 输出 stack_hint

**输出**：修改 `skills/spec-bridge/scripts/cmd-probe.mjs`

**变更**：
- 移除 `detectStack()` 调用
- 新增输出字段 `stack_hint`：从 stacks 配置读

**验收**：
- probe 输出含 `stack_hint: <kind>`（如 `stack_hint: matt`）
- 无 stacks 配置 → `stack_hint: builtin`

## T5：删除探测相关测试

**输出**：删除/修改以下测试：
- `detect-stack-superpowers.test.mjs` — 整个删除
- `init-auto-probe.test.mjs` — 删除探测相关 case，保留其他
- `cmd-adopt-detect-*.test.mjs` — 删除探测相关，改为读配置测试

**验收**：
- 删除的测试不再运行
- 替换的测试覆盖 v1.9-2 行为

## T6：新增 v1.9-2 行为测试

**输出**：
- `tests/no-auto-detect.test.mjs`（3-4 测试）
- `tests/init-uses-config.test.mjs`（3 测试）

**测试用例**：
1. init 无配置 → workflow_kind = builtin（不探测）
2. init 有 stacks 配置 → workflow_kind = stacks[0].kind
3. adopt 无 `--stack` + 无 stacks 配置 → external_stack = builtin
4. adopt 有 stacks 配置 → external_stack = stacks[0].kind

**验收**：
- 全部测试通过
- 覆盖 v1.9-2 行为变化

## T7：迁移工具 bridge migrate-v1.9-detect（可选）

**输出**：新增 `skills/spec-bridge/scripts/cmd-migrate-detect.mjs`

**行为**：
```bash
bridge migrate-v1.9-detect
# 扫描 .bridge.log 历史
# 提取已探测到的 stack kind
# 写入 .bridge-config.json
```

**验收**：
- 命令可执行
- 不影响现有用户（v1.9-1 已配置的用户 no-op）

## T8：ADR-0015 撰写

**输出**：`skills/spec-bridge/docs/adr/0015-remove-auto-detect.md`

**内容**：记录删除探测的决策上下文

## T9：CHANGELOG 更新

**输出**：在 `SKILL.md §7` 加 v1.9-2 条目

## T10：SKILL.md §1 入口例程更新

**输出**：修改 `SKILL.md §1`

**变更**：
- 移除"探测外栈"步骤
- 改为"读 stacks 配置"
- 推荐话术改为基于配置的优先级

## 依赖关系

```
T1 → T2/T3/T4（并行）
T5（删除测试）→ T6（新增测试）
T7（迁移工具）独立
T8 → T9 → T10
```

## 预计工作量

- 删除/修改：~150 行
- 新增测试：~80 行
- 文档：~80 行
- **总计**：~310 行变更