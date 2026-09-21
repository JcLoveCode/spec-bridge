// cmd-init.mjs — `bridge init <name>` 一键脚手架子命令。
// 与 cmd-sync.mjs 风格对齐：default export run(args, { stdout, stderr })。
// 模板为 ES module exports 的 string constants（D2）。不写 hash / 回执 / 调 sync（D5）。
import { spawnSync as spawnShim } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
import { appendEvent, readState, writeState, resolveParent } from './vendor/bridge-state.mjs';
import { detectStack } from './vendor/detect-stack.mjs';
import { run as runProbe } from './cmd-probe.mjs';
import { initPersonalMemory } from './cmd-memory.mjs';

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_WALENCH = 10;
// v1.2 (ADR-0004/D1)：workflow_kind 合法值域。v1.8-2 (ADR-0012 D3) 扩为 4 个值。
const WORKFLOW_KINDS = new Set(['superpowers', 'openspec', 'matt', 'builtin']);

// v1.2 (ADR-0004/D1)：四级推导——显式 --workflow-kind > --capabilities 首值（须在值域内）> 项目栈探测 > builtin。
// 返回 null 表示显式给了非法值（调用方报错 exit 2）。
// v1.8-1 (ADR-0011 D2)：第 4 级 fallback 从硬编码 'builtin' 改成 `detectedPrimary`（detect-stack.mjs 输出）。
// v1.8-2 (ADR-0012 D2)：detectedPrimary 可能是 'superpowers'（detect-stack 新优先级）；builtin 兜底仍然存在。
function deriveWorkflowKind(flags, detectedPrimary = 'builtin') {
  if (flags['workflow-kind']) {
    return WORKFLOW_KINDS.has(flags['workflow-kind']) ? flags['workflow-kind'] : null;
  }
  if (flags.capabilities) {
    const first = flags.capabilities.split(',')[0].trim();
    if (WORKFLOW_KINDS.has(first)) return first;
  }
  return detectedPrimary;
}

// v1.8-2 (ADR-0012 D1)：5 件模板常量与 fillTemplate 函数已删除——bridge init 不再写任何 spec 模板。
// spec 产物（proposal/design/tasks/spec/execution-contract）由用户自己用外栈 skill 生成：
//   • openspec-propose skill（openspec 栈项目）
//   • matt to-spec skill（matt 栈项目）
//   • superpowers brainstorming skill（superpowers 栈项目）
//   • AI 直接编辑（无外栈时，按 probe fallback 文案引导）

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

export async function run(args, { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
  const { positional, flags } = parseArgs(args);

  if (positional.length === 0) {
    // v1.8-2 (ADR-0012 D1)：--builtin flag 已砍（纯桥模式），usage 不再列出。
    stderr.write('Usage: bridge init <name> [--capability <cap>] [--branch <branch>] [--layout <standalone|openspec>] [--capabilities <comma,list>] [--workflow-kind <superpowers|openspec|matt|builtin>] [--parent <archived-change-id>] [--no-auto-probe]\n');
    return { exitCode: 2 };
  }

  const name = positional[0];
  if (!KEBAB_RE.test(name)) {
    stderr.write(`invalid change name: '${name}' — must be kebab-case (lowercase letters/digits separated by '-')\n`);
    return { exitCode: 2 };
  }

  // v1.8-1 (ADR-0011 D1)：默认行为变 — 只建台账（不生成 5 件模板）。
  // v1.8-2 (ADR-0012 D1)：纯桥模式 — init 永远不写模板（--builtin 砍掉），--no-auto-probe 跳过默认自动 probe。
  // v1.8-2 (ADR-0012 D1 兼容层）：老用户传 --builtin flag 时给 stderr 提示后忽略。
  if (flags.builtin === 'true') {
    stderr.write(`[hint] --builtin flag removed in v1.8-2 (pure bridge mode), no-op\n`);
  }
  const noAutoProbe = flags['no-auto-probe'] === 'true';
  const autoProbe = !noAutoProbe;

  // v1.2 (ADR-0005/D3)：续作引用快照——占位，实际解析在 changesDir 确定后执行。
  let parentSnapshot = null;

  const detected = detectProjectRoot(cwd);
  if (detected.source === 'cwd-fallback') {
    stderr.write(`${detected.root}: no project root detected, using cwd as-is (init may fail layout detection later)\n`);
  }

  const projectRoot = detected.root;
  const detectedLayout = detectLayout(projectRoot);
  // v1.8-1 (ADR-0011 D2)：项目栈探测 — 用于 init 默认 workflow_kind fallback。
  const stackDetection = detectStack(projectRoot);
  const layout = flags.layout || detectedLayout.layout;

  // workflowKind 派生（flags > capabilities > 项目栈探测 > builtin）；非法显式值报错 exit 2。
  // v1.8-2 (ADR-0012 D3)：值域扩为 4 个（superpowers/openspec/matt/builtin）；非法值报错同步。
  const workflowKind = deriveWorkflowKind(flags, stackDetection.primary);
  if (workflowKind === null) {
    stderr.write(`invalid --workflow-kind '${flags['workflow-kind']}' — must be one of: superpowers, openspec, matt, builtin\n`);
    return { exitCode: 2 };
  }
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
  // v1.8-2 (ADR-0012 D1)：纯桥模式——bridge init 永远不写 proposal/design/tasks/spec/execution-contract。
  // spec 产物由用户自己用外栈 skill 生成（openspec-propose / matt to-spec / superpowers brainstorming）。

  // 初始化 .bridge.yaml + 第一条大事记（D5：仅写状态，不写 hash / 回执）。
  const next = writeState(changeDir, {
    ...readState(changeDir),
    stage: 'planning',
    layout,
    workflow_kind: workflowKind,
    ...(parentSnapshot ? { parent: parentSnapshot.parent, parent_artifacts_hash: parentSnapshot.hash } : {}),
    ...(flags.branch ? { branch: flags.branch } : {}),
    ...(flags.capabilities ? { capabilities: flags.capabilities } : {}),
    // v1.8-2 (ADR-0012 D1)：next 字段文案同步——不再引导编辑 5 件模板，引导用外栈 skill。
    next: 'use external stack skill (openspec-propose / matt to-spec / superpowers brainstorming) — when done, bridge archive entry',
  });
  // v1.8-3 (ADR-0013 D1+D2)：个人层 memory init——探测 IDE 自带 memory 不在场时写空骨架
  initPersonalMemory(changeDir, projectRoot);
  appendEvent(changeDir, `init: scaffolded ${basename(changeDir)} (layout=${layout}, workflow=${workflowKind}, autoProbe=${autoProbe}, capabilities=${next.capabilities ?? 'unset'}${parentSnapshot ? `, parent=${parentSnapshot.parent}` : ''})`);

  stdout.write(`${changeDir}\n`);
  stdout.write(`next: use external stack skill — bridge doesn't write templates (pure bridge mode)\n`);
  // v1.8-1 (ADR-0011 D2)：init 完成后自动调 probe，让 AI 立即看到导航推荐。
  // v1.8-2 (ADR-0012 D1)：--no-auto-probe 标志跳过（CI 用）。
  if (autoProbe) {
    await runProbe([changeDir], { stdout, stderr, cwd });
  }
  return { exitCode: 0 };
}