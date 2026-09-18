// scripts/cmd-adopt.mjs — `bridge adopt <change-dir>` 接外栈已存在的 change 到台账（v1.3 D4）。
// 与 cmd-init.mjs 镜像：default export run(args, { stdout, stderr })。
// 不写产物（spec.md / proposal.md 等不动）——只写 .bridge.yaml + .bridge.log 第一条大事记。
// 拒绝：空目录（无接管信号）/ 已有台账（防覆盖）。
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { appendEvent, readState, resolveParent, writeState } from './vendor/bridge-state.mjs';
import { detectProjectRoot } from './cmd-init.mjs';

const WORKFLOW_KINDS = new Set(['openspec', 'matt', 'builtin']);
// 接管信号：顶层 4 产物 + specs/<cap>/spec.md 任一在场即满足（D4）。
const TOP_LEVEL_SIGNALS = ['proposal.md', 'design.md', 'tasks.md', 'execution-contract.md'];

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
  writeState(changeDir, {
    ...readState(changeDir),
    stage: 'planning',
    layout,
    workflow_kind: workflowKind,
    ...(parentSnapshot ? { parent: parentSnapshot.parent, parent_artifacts_hash: parentSnapshot.hash } : {}),
    next: 'edit/add missing artifacts (proposal/design/tasks/contract) to advance to contracted',
  });

  // 第一条大事记（D4 关键事件：adopt 信号原样记录，含 signals 列表供回溯）
  appendEvent(changeDir, `adopt: adopted ${basename(changeDir)} from external artifacts (workflow=${workflowKind}, layout=${layout}, signals=[${signals.join(',')}]${parentSnapshot ? `, parent=${parentSnapshot.parent}` : ''})`);

  stdout.write(`${changeDir}\n`);
  stdout.write(`adopted: wrote .bridge.yaml + .bridge.log; existing artifacts untouched (signals: ${signals.join(', ')})\n`);
  stdout.write(`next: edit/add missing artifacts to advance to contracted\n`);
  return { exitCode: 0 };
}