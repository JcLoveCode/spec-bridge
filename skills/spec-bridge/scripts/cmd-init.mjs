// cmd-init.mjs — `bridge init <name>` 一键脚手架子命令。
// 与 cmd-sync.mjs 风格对齐：default export run(args, { stdout, stderr })。
// 模板为 ES module exports 的 string constants（D2）。不写 hash / 回执 / 调 sync（D5）。
import { spawnSync as spawnShim } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
import { appendEvent, readState, writeState, resolveParent } from './vendor/bridge-state.mjs';

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_WALENCH = 10;
// v1.2 (ADR-0004/D1)：workflow_kind 合法值域。
const WORKFLOW_KINDS = new Set(['openspec', 'matt', 'builtin']);

// v1.2 (ADR-0004/D1)：三级推导——显式 --workflow-kind > --capabilities 首值（须在值域内）> builtin。
// 返回 null 表示显式给了非法值（调用方报错 exit 2）。
function deriveWorkflowKind(flags) {
  if (flags['workflow-kind']) {
    return WORKFLOW_KINDS.has(flags['workflow-kind']) ? flags['workflow-kind'] : null;
  }
  if (flags.capabilities) {
    const first = flags.capabilities.split(',')[0].trim();
    if (WORKFLOW_KINDS.has(first)) return first;
  }
  return 'builtin';
}

// ─────────────────────────────────────────────────────────────────────────────
// 模板常量（D2）。改模板改代码，hash 不盖模板（D2 + D5）。
// 占位符：
//   {{NAME}}           — change 目录名
//   {{CAP}}            — capability 名（默认 = 目录名小写化）
//   {{CAP_PASCAL}}     — capability 名 PascalCase（仅 demo 占位，不影响 spec 解析）
// ─────────────────────────────────────────────────────────────────────────────

export const PROPOSAL_TEMPLATE = `# Change: {{NAME}}

## Why

<!-- 问题一句话：为什么要做这个变更？现在的痛是什么？ -->

## What Changes

<!-- 改变什么：新增 / 修改 / 删除 / 重命名。简短列点即可。 -->

## Scope

### In Scope

<!-- 本变更包含哪些工作 -->

### Out of Scope

<!-- 明确不做的（防止范围蔓延）。每条都是主动选择，不是遗忘。 -->
`;

export const DESIGN_TEMPLATE = `# Design: {{NAME}}

## Purpose

<!-- 简述设计意图。这一节是 why 蒸馏的次级源（## Decisions 才是主源）。 -->

## Architecture

<!-- 可选。架构图 / 数据流图 / 组件清单。 -->

## Decisions

<!-- 唯一权威源。每条决策包含：选项 / 决定 / 理由。这是后面 why 蒸馏的唯一依据。 -->

### D1 — <决策名>

**选项**：...
**决定**：...
**理由**：...

## Out-of-scope decisions（明确不做的）

<!-- 与 proposal §Out of Scope 呼应；这里强调"为什么不做"。 -->

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| ... | ... | ... |
`;

export const TASKS_TEMPLATE = `# Tasks: {{NAME}}

按 [executor-protocol](../../skills/spec-bridge/references/executor-protocol.md) 的"自动启发式"排成批次；每批 ≤2 任务时 inline，否则派发子代理。

## Batch 1 — <批名>

- [ ] **T1.1** <任务>
- [ ] **T1.2** <任务>

完成定义：<可验证的收尾标准>
审查时点：<批末>

## Batch 2 — <批名>

- [ ] **T2.1** ...

完成定义：...

## Batch N — 归档

- [ ] **TN.1** \`node bridge.mjs sync changes/{{NAME}}\` → 写回执
- [ ] **TN.2** \`node bridge.mjs verify changes/{{NAME}}\` → PASS
- [ ] **TN.3** 写 \`specs/{{CAP}}/why.md\`（蒸馏）
- [ ] **TN.4** \`git mv changes/{{NAME}} changes/archive/<YYYY-MM-DD>-{{NAME}}/\`
- [ ] **TN.5** commit + push {{NAME}} 分支
`;

export const SPEC_TEMPLATE = `## Purpose

<!-- 一句话说明本 capability 的存在意义。vendored 引擎对 NEW baseline 缺 Purpose 会自动套默认值，但显式写出更利于阅读。 -->

## ADDED Requirements

### Requirement: <需求名>

The system SHALL <行为>.

#### Scenario: <场景名>

- **WHEN** <前置>
- **THEN** <可观察结果>
`;

export const CONTRACT_TEMPLATE = `# Execution Contract: {{NAME}}

## Intent Lock

<!-- 一句话：问题 + 要改变什么。来自 proposal §Why + §What Changes。 -->

## Scope Fence

### In Scope
<!-- 来自 proposal §Scope > ### In Scope -->

### Out of Scope
<!-- 来自 proposal §Scope > ### Out of Scope -->

## Approved Requirements

<!-- 映射自 specs/{{CAP}}/spec.md。每条 SHALL/MUST 必须有一条测试义务 + 落进至少一个 Batch。 -->
- [ ] **R1** — <需求名>：<一行行为>（测试义务：<怎么验>）

## Constraints

<!-- 唯一权威源：design.md ## Decisions。每条 C 编号对到 D 编号。 -->

## Execution Batches

<!-- 来源：tasks.md。每批 — 任务号们 — 完成定义 — 审查时点。 -->

## Escalation Rules

<!-- 执行过程中遇到哪些情况必须停下回 planning 重开。 -->
`;

// ─────────────────────────────────────────────────────────────────────────────
// 项目根探测（D6）。git toplevel 优先 → 向上 walk 含 changes/ 的祖先 → fallback cwd。
// ─────────────────────────────────────────────────────────────────────────────

export function detectProjectRoot(cwd) {
  try {
    const result = spawnShim('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf-8' });
    if (result && result.status === 0 && result.stdout) {
      const gitRoot = result.stdout.trim();
      if (existsSync(join(gitRoot, 'changes')) || existsSync(join(gitRoot, 'openspec'))) {
        return { root: gitRoot, source: 'git-toplevel' };
      }
    }
  } catch {
    // git 不可用或非 git 仓库：继续 fallback。
  }

  let current = resolve(cwd);
  for (let depth = 0; depth < MAX_WALENCH; depth += 1) {
    if (existsSync(join(current, 'changes'))) {
      return { root: current, source: 'walk-changes' };
    }
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }

  return { root: resolve(cwd), source: 'cwd-fallback' };
}

// ─────────────────────────────────────────────────────────────────────────────
// layout 探测：与 bridge.mjs detectLayout 同款（mirror，避免跨文件依赖）。
// 修正（v1.3 Batch N 补丁）：bridge 历史归档目录在哪 = layout 真信号（archive 化石最准）。
// 优先级：archive 历史 > openspec/config.yaml (CLI 标志) > 缺省 standalone。
// ─────────────────────────────────────────────────────────────────────────────

function hasAnyBridgeYaml(dir) {
  if (!existsSync(dir)) return false;
  for (const sub of readdirSync(dir)) {
    if (existsSync(join(dir, sub, '.bridge.yaml'))) return true;
  }
  return false;
}

export function detectLayout(projectRoot) {
  const bridgeArchive = join(projectRoot, 'changes', 'archive');
  const openspecArchive = join(projectRoot, 'openspec', 'changes', 'archive');
  if (existsSync(bridgeArchive) && hasAnyBridgeYaml(bridgeArchive)) {
    return { layout: 'standalone', changesDir: join(projectRoot, 'changes') };
  }
  if (existsSync(openspecArchive) && hasAnyBridgeYaml(openspecArchive)) {
    return { layout: 'openspec', changesDir: join(projectRoot, 'openspec', 'changes') };
  }
  if (existsSync(join(projectRoot, 'openspec', 'config.yaml'))) {
    return { layout: 'openspec', changesDir: join(projectRoot, 'openspec', 'changes') };
  }
  if (existsSync(join(projectRoot, 'openspec'))) {
    return { layout: 'openspec', changesDir: join(projectRoot, 'openspec', 'changes') };
  }
  return { layout: 'standalone', changesDir: join(projectRoot, 'changes') };
}

function defaultCapability(name) {
  return name.toLowerCase().replace(/_/g, '-');
}

function parseArgs(rawArgs) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < rawArgs.length; i += 1) {
    const token = rawArgs[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rawArgs[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = 'true';
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(token);
    }
  }
  return { positional, flags };
}

function fillTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (values[key] ?? match));
}

export async function run(args, { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
  const { positional, flags } = parseArgs(args);

  if (positional.length === 0) {
    stderr.write('Usage: bridge init <name> [--capability <cap>] [--branch <branch>] [--layout <standalone|openspec>] [--capabilities <comma,list>] [--workflow-kind <openspec|matt|builtin>] [--parent <archived-change-id>]\n');
    return { exitCode: 2 };
  }

  const name = positional[0];
  if (!KEBAB_RE.test(name)) {
    stderr.write(`invalid change name: '${name}' — must be kebab-case (lowercase letters/digits separated by '-')\n`);
    return { exitCode: 2 };
  }

  const workflowKind = deriveWorkflowKind(flags);
  if (workflowKind === null) {
    stderr.write(`invalid --workflow-kind '${flags['workflow-kind']}' — must be one of: openspec, matt, builtin\n`);
    return { exitCode: 2 };
  }

  // v1.2 (ADR-0005/D3)：续作引用快照——占位，实际解析在 changesDir 确定后执行。
  let parentSnapshot = null;

  const detected = detectProjectRoot(cwd);
  if (detected.source === 'cwd-fallback') {
    stderr.write(`${detected.root}: no project root detected, using cwd as-is (init may fail layout detection later)\n`);
  }

  const projectRoot = detected.root;
  const detectedLayout = detectLayout(projectRoot);
  const layout = flags.layout || detectedLayout.layout;
  const changesDir = layout === 'openspec'
    ? join(projectRoot, 'openspec', 'changes')
    : join(projectRoot, 'changes');
  const changeDir = join(changesDir, name);
  const capDir = join(changeDir, 'specs', flags.capability || defaultCapability(name));

  if (existsSync(changeDir)) {
    stderr.write(`change '${name}' already exists at ${changeDir}\n`);
    return { exitCode: 3 };
  }

  // v1.2 (ADR-0005/D3)：续作引用——父必存在且已归档，快照其 artifacts_hash（版本链可重放）。
  if (flags.parent) {
    const parent = resolveParent(changesDir, flags.parent);
    if (!parent) {
      stderr.write(`parent '${flags.parent}' not found under ${changesDir} (active or archive)\n`);
      return { exitCode: 2 };
    }
    if (parent.state.stage !== 'archived') {
      stderr.write(`parent '${flags.parent}' is stage=${parent.state.stage}, not archived — follow-ups may only reference archived changes (ADR-0005)\n`);
      return { exitCode: 2 };
    }
    parentSnapshot = { parent: flags.parent, hash: parent.state.artifacts_hash };
  }

  mkdirSync(capDir, { recursive: true });
  const values = { NAME: name, CAP: flags.capability || defaultCapability(name) };

  // v1.3 Batch 2 (D3)：按 --workflow-kind 分支产物路径。
  // openspec / matt → 只建台账 + 空 specs/，避免与外栈产物生成器冲突（openspec 自出 proposal/design/tasks/spec；matt 走 to-spec）。
  // builtin → 现状 5 模板（v1.2 R1 向后兼容）。
  if (workflowKind === 'builtin') {
    writeFileSync(join(changeDir, 'proposal.md'), fillTemplate(PROPOSAL_TEMPLATE, values), 'utf-8');
    writeFileSync(join(changeDir, 'design.md'), fillTemplate(DESIGN_TEMPLATE, values), 'utf-8');
    writeFileSync(join(changeDir, 'tasks.md'), fillTemplate(TASKS_TEMPLATE, values), 'utf-8');
    writeFileSync(join(capDir, 'spec.md'), fillTemplate(SPEC_TEMPLATE, values), 'utf-8');
    writeFileSync(join(changeDir, 'execution-contract.md'), fillTemplate(CONTRACT_TEMPLATE, values), 'utf-8');
  }

  // 初始化 .bridge.yaml + 第一条大事记（D5：仅写状态，不写 hash / 回执）。
  const next = writeState(changeDir, {
    ...readState(changeDir),
    stage: 'planning',
    layout,
    workflow_kind: workflowKind,
    ...(parentSnapshot ? { parent: parentSnapshot.parent, parent_artifacts_hash: parentSnapshot.hash } : {}),
    ...(flags.branch ? { branch: flags.branch } : {}),
    ...(flags.capabilities ? { capabilities: flags.capabilities } : {}),
    next: 'edit proposal/design/tasks/spec — when stable, write execution-contract.md and advance to contracted',
  });
  appendEvent(changeDir, `init: scaffolded ${basename(changeDir)} (layout=${layout}, workflow=${workflowKind}, capabilities=${next.capabilities ?? 'unset'}${parentSnapshot ? `, parent=${parentSnapshot.parent}` : ''})`);

  stdout.write(`${changeDir}\n`);
  stdout.write(`next: edit proposal/design/tasks/specs — when stable, write execution-contract.md and advance to contracted\n`);
  return { exitCode: 0 };
}