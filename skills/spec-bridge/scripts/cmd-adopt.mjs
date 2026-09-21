// scripts/cmd-adopt.mjs — `bridge adopt <change-dir>` 接外栈已存在的 change 到台账（v1.3 D4）。
// 与 cmd-init.mjs 镜像：default export run(args, { stdout, stderr })。
// 不写产物（spec.md / proposal.md 等不动）——只写 .bridge.yaml + .bridge.log 第一条大事记。
// 拒绝：空目录（无接管信号）/ 已有台账（防覆盖）。
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { appendEvent, readState, resolveParent, writeState } from './vendor/bridge-state.mjs';
import { detectProjectRoot } from './cmd-init.mjs';
import { initPersonalMemory } from './cmd-memory.mjs';
import { readBridgeConfig, writeBridgeConfig } from './config-utils.mjs';

const WORKFLOW_KINDS = new Set(['openspec', 'matt', 'builtin']);
// v1.8-1 (ADR-0011 D3)：外栈值域，'auto' 是探测哨兵。
const EXTERNAL_STACKS = new Set(['matt', 'openspec', 'superpowers', 'builtin', 'auto']);
// 接管信号：顶层 4 产物 + specs/<cap>/spec.md 任一在场即满足（D4）。
const TOP_LEVEL_SIGNALS = ['proposal.md', 'design.md', 'tasks.md', 'execution-contract.md'];

// v1.8-1 (ADR-0011 D3)：从接管信号反推外栈。
// 启发式：顶层 4 件标准模板任一在场 → matt（matt `to-spec` / openspec-propose 都从这 4 件产物入手）。
// specs/<cap>/spec.md 单独在场 → 也算 matt（外栈 spec-executor 只产 spec.md）。
// 其它 → builtin。
function detectStackFromSignals(signals) {
  if (signals.length === 0) return 'builtin';
  const hasTopLevel = TOP_LEVEL_SIGNALS.some((s) => signals.includes(s));
  if (hasTopLevel) return 'matt';
  if (signals.some((s) => s.startsWith('specs/'))) return 'matt';
  return 'builtin';
}

function detectLayout(projectRoot) {
  if (existsSync(join(projectRoot, 'openspec'))) {
    return { layout: 'openspec', changesDir: join(projectRoot, 'openspec', 'changes') };
  }
  return { layout: 'standalone', changesDir: join(projectRoot, 'changes') };
}

function deriveWorkflowKind(flags) {
  if (flags['workflow-kind']) {
    return WORKFLOW_KINDS.has(flags['workflow-kind']) ? flags['workflow-kind'] : null;
  }
  return 'builtin';
}

// 从 changeDir 向上 walk 找项目根（复用 cmd-init.detectProjectRoot：git rev-parse → walk 含 changes/ 的祖先）。
function findProjectRoot(changeDir) {
  const detected = detectProjectRoot(changeDir);
  if (detected.source === 'cwd-fallback') return null;
  return detected.root;
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

// 返回 array of 命中的接管信号（顶层 + specs/<cap>/spec.md）。
function detectSignals(changeDir) {
  const found = [];
  for (const signal of TOP_LEVEL_SIGNALS) {
    if (existsSync(join(changeDir, signal))) found.push(signal);
  }
  const specsDir = join(changeDir, 'specs');
  if (existsSync(specsDir)) {
    for (const cap of readdirSync(specsDir)) {
      const specFile = join(specsDir, cap, 'spec.md');
      if (existsSync(specFile)) found.push(`specs/${cap}/spec.md`);
    }
  }
  return found;
}

export async function run(args, { stdout = process.stdout, stderr = process.stderr } = {}) {
  const { positional, flags } = parseArgs(args);

  if (positional.length === 0) {
    stderr.write('Usage: bridge adopt <change-dir> [--workflow-kind <openspec|matt|builtin>] [--layout <openspec|standalone>] [--parent <archived-change-id>]\n');
    return { exitCode: 2 };
  }

  const changeDir = positional[0];
  if (!existsSync(changeDir) || !statSync(changeDir).isDirectory()) {
    stderr.write(`adopt target not found or not a directory: ${changeDir}\n`);
    return { exitCode: 2 };
  }

  // 已台账 → 拒绝覆盖（D4 边界：adopt 仅对外栈）
  if (existsSync(join(changeDir, '.bridge.yaml'))) {
    stderr.write(`WRITE-PROTECTED: ${changeDir} already has .bridge.yaml — adopt is for external artifacts only. Edit via state set, or move the existing one out of the way.\n`);
    return { exitCode: 2 };
  }

  // 无接管信号 → 拒绝空目录
  const signals = detectSignals(changeDir);
  if (signals.length === 0) {
    stderr.write(`no adoptable artifacts at ${changeDir} — at least one of proposal.md / design.md / tasks.md / execution-contract.md / specs/<cap>/spec.md must exist (D4)\n`);
    return { exitCode: 2 };
  }

  const workflowKind = deriveWorkflowKind(flags);
  if (workflowKind === null) {
    stderr.write(`invalid --workflow-kind '${flags['workflow-kind']}' — must be one of: openspec, matt, builtin\n`);
    return { exitCode: 2 };
  }

  // v1.8-1 (ADR-0011 D3)：--stack <kind> 标志显式指定外栈；'auto' 走探测（D3 信号启发式）。
  // v1.9-2 (ADR-0015)：--stack <kind> + 探测（无配置时）；保留信号启发式作为 fallback。
  const stackFlag = flags.stack;
  if (stackFlag && !EXTERNAL_STACKS.has(stackFlag)) {
    stderr.write(`invalid --stack '${stackFlag}' — must be one of: matt, openspec, superpowers, builtin, auto\n`);
    return { exitCode: 2 };
  }
  // v1.9-2：stacks 配置优先；无配置时仍走信号探测（保持 backward compat）。
  const projectRootForConfig = findProjectRoot(changeDir);
  const bridgeConfig = projectRootForConfig ? readBridgeConfig(projectRootForConfig) : null;
  let externalStack;
  if (stackFlag && stackFlag !== 'auto') {
    externalStack = stackFlag;
  } else if (bridgeConfig?.stacks.length > 0) {
    externalStack = bridgeConfig.stacks[0].kind;
  } else {
    // fallback：信号探测（v1.9-3 才完全移除）
    externalStack = detectStackFromSignals(signals);
  }
  // v1.9-3 (ADR-0016)：自动记录 lastUsedStack（context-aware）。
  if (projectRootForConfig) {
    writeBridgeConfig(projectRootForConfig, { lastUsedStack: externalStack });
  }
  const adoptedAt = new Date().toISOString();

  // 探测项目根 → layout（缺省显式 flag 走探测，否则走 flag；非 git 或探测失败 → standalone 兜底）
  const projectRoot = findProjectRoot(changeDir);
  const detected = projectRoot ? detectLayout(projectRoot) : null;
  const layout = flags.layout || (detected ? detected.layout : 'standalone');
  const changesDir = detected
    ? detected.changesDir
    : (projectRoot ? join(projectRoot, layout === 'openspec' ? 'openspec/changes' : 'changes') : null);

  // 续作引用（如有）
  let parentSnapshot = null;
  if (flags.parent) {
    if (!changesDir) {
      stderr.write(`--parent requires a detected project root; cannot resolve from ${changeDir}\n`);
      return { exitCode: 2 };
    }
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

  // 写台账（与 cmd-init.mjs L299-308 同构：stage=planning + workflow_kind + parent snapshot + next hint）
  // v1.8-1 (ADR-0011 D3)：外栈字段 — external_stack + adopted_at。
  writeState(changeDir, {
    ...readState(changeDir),
    stage: 'planning',
    layout,
    workflow_kind: workflowKind,
    external_stack: externalStack,
    adopted_at: adoptedAt,
    ...(parentSnapshot ? { parent: parentSnapshot.parent, parent_artifacts_hash: parentSnapshot.hash } : {}),
    next: `use_skill to-spec — synthesize the conversation into a ${externalStack} spec (adopted from ${externalStack} at ${adoptedAt})`,
  });

  // 第一条大事记（D4 关键事件：adopt 信号原样记录，含 signals 列表供回溯）
  // v1.8-3 (ADR-0013 D1+D2)：个人层 memory init——探测 IDE 自带 memory 不在场时写空骨架
  if (projectRoot) {
    initPersonalMemory(changeDir, projectRoot);
  }
  appendEvent(changeDir, `adopt: adopted ${basename(changeDir)} from external artifacts (workflow=${workflowKind}, stack=${externalStack}, layout=${layout}, signals=[${signals.join(',')}]${parentSnapshot ? `, parent=${parentSnapshot.parent}` : ''})`);

  stdout.write(`${changeDir}\n`);
  stdout.write(`adopted: wrote .bridge.yaml + .bridge.log; existing artifacts untouched (signals: ${signals.join(', ')}, stack=${externalStack})\n`);
  stdout.write(`next: use_skill to-spec — synthesize the conversation into a ${externalStack} spec\n`);
  return { exitCode: 0 };
}