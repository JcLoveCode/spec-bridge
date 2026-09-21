#!/usr/bin/env node
// cmd-memory.mjs — bridge memory 子命令族（v1.8-3 / ADR-0013 / 个人层 + 团队层）
//
// 原则：
//   D1 个人层优先用 IDE 自带 memory（探测 .codebuddy/memory/），不存在时建 changes/<name>/memory.md 空骨架
//   D2 fallback：不存在 → 写 §0 元信息 + §1/§2/§3 占位段
//   D3 memory 命令族 5 子命令：init / append / sync / show / reconcile（commit 1 含 init + append；sync/show/reconcile 在 commit 2）
//   D9 写规则硬约束：bridge 不替 AI 总结，不写过程日志，每行必带 why
//
// C 约束：
//   C1 (ADR-0001)：bridge 不现场合并文本（团队层 sync CLI 算 sha256 校验一致性）
//   C6 (调研报告 §六风险 1)：memory 命令族复用 appendEvent，不另起账本
//   C7 (调研报告 §六风险 3)：LLM 不在场时 memory.md / team/memory.md 只读不写（避免现场合并污染）

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { appendEvent, readState } from './vendor/bridge-state.mjs';

function parseArgs(rawArgs) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < rawArgs.length; i += 1) {
    const token = rawArgs[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rawArgs[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = 'true';
      else { flags[key] = next; i += 1; }
    } else positional.push(token);
  }
  return { positional, flags };
}

// D1：探测 IDE 自带 memory。检查目录存在 + 至少一个 .md 文件 + 统计 MEMORY.md 行数 + daily 文件数（不读内容）
export function detectIdeMemory(projectRoot) {
  const ideDir = join(projectRoot, '.codebuddy', 'memory');
  const result = { present: false, path: null, dailyCount: 0, curatedLines: 0, isEmpty: false };
  if (!existsSync(ideDir)) return result;
  result.present = true;
  result.path = ideDir;
  try {
    const entries = readdirSync(ideDir);
    const mdFiles = entries.filter((f) => f.endsWith('.md'));
    if (mdFiles.length === 0) {
      result.isEmpty = true;
      return result;
    }
    const dailyFiles = mdFiles.filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));
    result.dailyCount = dailyFiles.length;
    if (mdFiles.includes('MEMORY.md')) {
      const memoryPath = join(ideDir, 'MEMORY.md');
      const content = readFileSync(memoryPath, 'utf8');
      result.curatedLines = content.split('\n').filter((l) => l.trim().length > 0).length;
    }
  } catch (err) {
    result.present = false;
    result.path = null;
  }
  return result;
}

// D2：生成个人 memory.md 空骨架。已存在时 no-op
export function initPersonalMemory(changeDir, projectRoot) {
  const memPath = join(changeDir, 'memory.md');
  if (existsSync(memPath)) {
    return { skipped: true, reason: 'exists', path: memPath };
  }
  const ide = detectIdeMemory(projectRoot);
  if (ide.present && !ide.isEmpty) {
    return { skipped: true, reason: 'ide_present', path: memPath, ide };
  }
  const today = new Date().toISOString().slice(0, 10);
  const state = readState(changeDir);
  const capabilities = state.capabilities ?? 'default';
  const parent = state.parent ?? null;
  const name = changeDir.split('/').filter(Boolean).pop();
  const content = [
    `# Personal Memory: ${name}`,
    `> 写者：AI / 人 | 写时：${today}`,
    `> 规则：bridge 不替 AI 总结，只填结构 + 元信息；每行必带 why`,
    '',
    '## §0 元信息',
    `- change: ${name}`,
    `- capabilities: ${capabilities}`,
    `- parent: ${parent ?? '(none)'}`,
    `- generated_by: bridge v1.8.3`,
    '',
    '## §1 决策段（vX.Y.Z: 砍 X 因为 Y）',
    '<!-- AI 填：做完决策时记 -->',
    '',
    '## §2 卡住 / 走偏',
    '<!-- AI 填：为啥走偏 / 怎么绕的 -->',
    '',
    '## §3 父 archive 继承（如有）',
    '<!-- bridge 自动从父 archive memory.md 抽取 -->',
    '',
  ].join('\n');
  writeFileSync(memPath, content, 'utf8');
  appendEvent(changeDir, `memory: generated personal memory.md (capabilities=${capabilities}, parent=${parent ?? 'none'})`);
  return { skipped: false, path: memPath, capabilities, parent };
}

// T2.1：append 个人 memory.md。section 默认 §1，可选 §2 / §3
export function appendPersonalMemory(changeDir, text, section = '§1') {
  const memPath = join(changeDir, 'memory.md');
  if (!existsSync(memPath)) {
    return { skipped: true, reason: 'no_memory', path: memPath };
  }
  let content = readFileSync(memPath, 'utf8');
  // 找 section 行（"## §X ..."）
  const escapedSection = section.replace(/[§.]/g, '\\$&');
  const sectionRe = new RegExp(`^## ${escapedSection}[^\\n]*$`, 'm');
  const m = content.match(sectionRe);
  if (!m) return { skipped: true, reason: 'no_section', section, path: memPath };
  // 在 section 末尾（下一段或文件末）插入
  const insertAt = m.index + m[0].length;
  const tail = content.slice(insertAt);
  const nextSectionRe = /\n## §/;
  const tailMatch = tail.match(nextSectionRe);
  let endPos;
  if (tailMatch) {
    endPos = insertAt + tailMatch.index;
  } else {
    endPos = content.length;
  }
  const before = content.slice(0, endPos).replace(/\s+$/, '');
  const after = content.slice(endPos);
  content = `${before}\n${text}\n${after}`;
  writeFileSync(memPath, content, 'utf8');
  const truncatedText = text.length > 50 ? `${text.slice(0, 50)}...` : text;
  appendEvent(changeDir, `memory: appended [${section}] ${truncatedText}`);
  return { skipped: false, path: memPath, section };
}

// D7：defaultCapability(name) 推 default/ 落点。name kebab-case 第一段（commit 2 团队层 sync 复用）
export function defaultCapability(name) {
  return 'default';
}

// D4 / commit 1 用：show 个人 memory（纯读）。team show 在 commit 2 实现
export function showPersonalMemory(changeDir) {
  const memPath = join(changeDir, 'memory.md');
  if (!existsSync(memPath)) return { found: false, path: memPath };
  const content = readFileSync(memPath, 'utf8');
  return { found: true, path: memPath, content };
}

// T5.1 (commit 2)：从个人 memory.md §1 提取决策段文本。复用 countSectionLines 思路但返回段文本。
function extractSectionText(changeDir, sectionHeader) {
  const memPath = join(changeDir, 'memory.md');
  if (!existsSync(memPath)) return null;
  const content = readFileSync(memPath, 'utf8');
  const escaped = sectionHeader.replace(/[§.]/g, '\\$&');
  const startRe = new RegExp(`^## ${escaped}[^\\n]*$`, 'm');
  const m = content.match(startRe);
  if (!m) return null;
  const after = content.slice(m.index + m[0].length);
  const nextRe = /\n## §/;
  const tailMatch = after.match(nextRe);
  const endIdx = tailMatch ? after.indexOf(tailMatch[0]) : after.length;
  return after.slice(0, endIdx);
}

// T5.1：算文本 sha256（含段头）
import { createHash } from 'node:crypto';
function contentHash(text) {
  return createHash('sha256').update(text).digest('hex');
}

// T5.1：team memory.md 文件格式：metadata header + 决策段块。
// metadata 用 YAML-like frontmatter（与 why.md 风格对齐）便于人读 + 机器解析。
function readTeamMemory(teamPath) {
  if (!existsSync(teamPath)) return null;
  return readFileSync(teamPath, 'utf8');
}

function parseTeamMemory(content) {
  // frontmatter: ---\n...key: value\n---\n\n<body>... <body>
  if (!content.startsWith('---\n')) return { meta: {}, body: content };
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return { meta: {}, body: content };
  const metaBlock = content.slice(4, end);
  const body = content.slice(end + 5);
  const meta = {};
  for (const line of metaBlock.split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2];
  }
  return { meta, body };
}

function writeTeamMemory(teamPath, meta, body) {
  // meta 是完整对象；动态写所有 key（避免 reconcile 加字段时再写一次 writeTeamMemory）
  const lines = ['---'];
  // 保留关键字段顺序（先 sync_* 再 reconcile_*）
  const orderedKeys = ['last_synced_hash', 'last_synced_at', 'last_synced_source', 'sync_count', 'last_reconciled_by', 'last_reconciled_at'];
  const seen = new Set();
  for (const k of orderedKeys) {
    if (meta[k] !== undefined) {
      lines.push(`${k}: ${meta[k]}`);
      seen.add(k);
    }
  }
  for (const k of Object.keys(meta)) {
    if (!seen.has(k)) lines.push(`${k}: ${meta[k]}`);
  }
  lines.push('---');
  writeFileSync(teamPath, `${lines.join('\n')}\n\n${body}`, 'utf8');
}

// T5.1：D8 orphaned 判定 — capabilities 多 cap 或空 → orphaned
// 设计意图：capabilities 字段是数组（如 ["bridge-cli"]）或逗号分隔字符串（"cli,nuxi"）；
// 空数组 / 多个不一致 cap / 字段不存在 → orphaned。
// 单字符串如 "bridge-cli" 或单元素数组 → 落该 cap。
function resolveSyncTarget(changeDir, capabilities) {
  let caps = [];
  if (Array.isArray(capabilities)) {
    caps = capabilities;
  } else if (typeof capabilities === 'string' && capabilities !== 'null' && capabilities.length > 0) {
    caps = capabilities.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  }
  if (caps.length === 0) return { kind: 'orphaned', cap: 'orphaned' };
  if (caps.length > 1) return { kind: 'orphaned', cap: 'orphaned' };
  return { kind: 'cap', cap: caps[0] };
}

// T5.1：sync 子命令主逻辑
export function syncTeamMemory(changeDir, opts = {}) {
  // 1. 读个人 memory §1
  const sectionText = extractSectionText(changeDir, '§1');
  if (sectionText === null) {
    return { ok: false, reason: 'no_memory', path: join(changeDir, 'memory.md') };
  }
  // 过滤空行 / 注释 / 模板占位 → 实际决策行
  const lines = sectionText
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim().length > 0)
    .filter((l) => !l.trim().startsWith('#'))
    .filter((l) => !l.trim().startsWith('<!--'));
  if (lines.length === 0) {
    return { ok: false, reason: 'empty_decisions' };
  }
  const decisionsText = lines.join('\n');
  const hash = contentHash(decisionsText);

  // 2. 读 capabilities
  const state = readState(changeDir);
  const target = resolveSyncTarget(changeDir, state.capabilities);
  const teamDir = join(changeDir, '..', '..', '.bridge', 'team', target.cap);
  // 上溯 2 级：changes/<name>/ → 项目根
  // 但 changeDir 可能是绝对路径，dirname 两次更稳
  const projectRoot = resolve(join(changeDir, '..', '..'));
  const teamDirAbs = join(projectRoot, '.bridge', 'team', target.cap);
  const teamFilePath = join(teamDirAbs, 'memory.md');

  // 3. 读已有 team memory（同步创建目录 — 首次 sync 时 .bridge/team/<cap>/ 还不存在）
  if (!existsSync(teamDirAbs)) {
    mkdirSync(teamDirAbs, { recursive: true });
  }
  let existing = null;
  if (existsSync(teamFilePath)) {
    existing = parseTeamMemory(readTeamMemory(teamFilePath));
  }

  // 4. 决策段块（source change 名 + 日期 + 内容）
  const changeName = opts.changeName || resolve(changeDir).split('/').pop();
  const today = new Date().toISOString().slice(0, 10);
  const block = `### from ${changeName} (${today})\n\n${decisionsText}\n\n`;

  // 5. 一致 → no-op
  if (existing && existing.meta.last_synced_hash === hash) {
    return { ok: true, noop: true, target: target.cap, kind: target.kind };
  }

  // 6. 不一致 / 不存在 → 追加 + 写
  const syncCount = existing ? (parseInt(existing.meta.sync_count || '0', 10) + 1) : 1;
  const meta = {
    last_synced_hash: hash,
    last_synced_at: today,
    last_synced_source: changeName,
    sync_count: String(syncCount),
  };
  const body = existing ? `${existing.body}${block}` : `# Team memory — ${target.cap}\n\n${block}`;
  writeTeamMemory(teamFilePath, meta, body);

  // 7. appendEvent
  appendEvent(changeDir, `memory: sync to team/${target.cap} (${lines.length} decisions, ${syncCount === 1 ? 'first' : `sync #${syncCount}`})`);

  return { ok: true, noop: false, target: target.cap, kind: target.kind, syncCount, decisionsCount: lines.length };
}

function usage(stderr) {
  stderr.write('Usage: bridge memory <init|append|show|sync|reconcile> [...]\n');
  stderr.write('  init <change-dir>             scaffold personal memory.md (no-op if exists or IDE memory present)\n');
  stderr.write('  append <change-dir> --text "..." [--section §1|§2|§3]\n');
  stderr.write('                                append a decision/obstacle line to personal memory.md\n');
  stderr.write('  show <change-dir|cap>         show personal or team memory (read-only)\n');
  stderr.write('  sync <change-dir>             sync personal decisions to team <cap>/memory.md (CLI sha256)\n');
  stderr.write('  reconcile [--team] [--cap <cap>] [--include-orphaned]\n');
  stderr.write('                                reconcile team memory (no deletions; metadata only)\n');
}

export async function run(args, { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
  const { positional, flags } = parseArgs(args);
  const subcmd = positional[0];
  if (!subcmd) {
    usage(stderr);
    return { exitCode: 2 };
  }
  if (subcmd === 'init') {
    const changeDir = positional[1] ? resolve(cwd, positional[1]) : null;
    if (!changeDir) {
      stderr.write('Usage: bridge memory init <change-dir>\n');
      return { exitCode: 2 };
    }
    const result = initPersonalMemory(changeDir, cwd);
    if (result.skipped) {
      const msg = result.reason === 'exists'
        ? '[hint] memory.md already exists, no-op\n'
        : '[hint] IDE .codebuddy/memory/ present, skipping personal init\n';
      stderr.write(msg);
      stdout.write(`${changeDir}/memory.md\n`);
      return { exitCode: 0 };
    }
    stdout.write(`${changeDir}/memory.md\n`);
    return { exitCode: 0 };
  }
  if (subcmd === 'append') {
    const changeDir = positional[1] ? resolve(cwd, positional[1]) : null;
    if (!changeDir || !flags.text) {
      stderr.write('Usage: bridge memory append <change-dir> --text "..." [--section §1|§2|§3]\n');
      return { exitCode: 2 };
    }
    const section = flags.section || '§1';
    const result = appendPersonalMemory(changeDir, flags.text, section);
    if (result.skipped) {
      const msg = result.reason === 'no_memory'
        ? `[error] memory.md not found at ${changeDir} — run \`bridge memory init ${changeDir}\` first\n`
        : `[error] section ${section} not found in memory.md\n`;
      stderr.write(msg);
      return { exitCode: 1 };
    }
    // 弱提示：推荐 vX.Y.Z: 砍 X 因为 Y 格式（不强制）
    if (!/^v\d+\.\d+\.\d+:/.test(flags.text)) {
      stderr.write('[hint] 推荐 vX.Y.Z: 砍 X 因为 Y 格式（不强制）\n');
    }
    stdout.write(`${changeDir}/memory.md [${section}]\n`);
    return { exitCode: 0 };
  }
  if (subcmd === 'show') {
    const target = positional[1];
    if (!target) {
      stderr.write('Usage: bridge memory show <change-dir|cap>\n');
      return { exitCode: 2 };
    }
    // R3 / commit 2：先尝试当 changeDir（个人），再尝试当 cap（团队）。
    // show 是 read-only —— 不写任何文件。
    const asChangeDir = resolve(cwd, target);
    const personalResult = showPersonalMemory(asChangeDir);
    if (personalResult.found) {
      stdout.write(personalResult.content);
      return { exitCode: 0 };
    }
    const teamFile = join(cwd, '.bridge', 'team', target, 'memory.md');
    if (existsSync(teamFile)) {
      stdout.write(readFileSync(teamFile, 'utf8'));
      return { exitCode: 0 };
    }
    stderr.write(`no memory at ${target} (checked: <change>/memory.md and .bridge/team/${target}/memory.md)\n`);
    return { exitCode: 1 };
  }
  if (subcmd === 'sync') {
    const changeDir = positional[1] ? resolve(cwd, positional[1]) : null;
    if (!changeDir) {
      stderr.write('Usage: bridge memory sync <change-dir>\n');
      return { exitCode: 2 };
    }
    const result = syncTeamMemory(changeDir);
    if (!result.ok) {
      const msg = result.reason === 'no_memory'
        ? `no memory.md at ${changeDir} — run \`bridge memory init ${changeDir}\` first\n`
        : `§1 decisions section is empty — append at least one decision: bridge memory append ${changeDir} --text "vX.Y.Z: 砍 X 因为 Y"\n`;
      stderr.write(`[error] ${msg}`);
      return { exitCode: 1 };
    }
    if (result.noop) {
      stdout.write(`noop: team/${result.target} last_synced_hash matches\n`);
    } else {
      stdout.write(`synced ${result.decisionsCount} decision${result.decisionsCount === 1 ? '' : 's'} → team/${result.target} (${result.syncCount === 1 ? 'first sync' : `sync #${result.syncCount}`})\n`);
      if (result.kind === 'orphaned') {
        stderr.write(`[hint] capabilities == .sync'd to team/orphaned (use 'bridge memory reconcile --cap <cap> --include-orphaned' to assign)\n`);
      }
    }
    return { exitCode: 0 };
  }
  if (subcmd === 'reconcile') {
    // T5.2 commit 2: --team / --cap / --include-orphaned
    const flags2 = flags;
    const projectRoot = cwd;
    const teamDir = join(projectRoot, '.bridge', 'team');
    const orphanedDir = join(teamDir, 'orphaned');
    if (!existsSync(teamDir)) {
      stderr.write(`no team memory yet at ${teamDir} — run \`bridge memory sync <change>\` first\n`);
      return { exitCode: 1 };
    }
    const includeOrphaned = flags2['include-orphaned'] === 'true';
    const targetCap = flags2.cap;
    if (!targetCap && !includeOrphaned) {
      stderr.write('Usage: bridge memory reconcile [--team] [--cap <cap>] [--include-orphaned]\n');
      stderr.write('  --include-orphaned  show orphaned/ entries to assign to a cap\n');
      return { exitCode: 2 };
    }
    // 不删任何决策段，只标 "reconcile YYYY-MM-DD by <actor>" 头
    const today = new Date().toISOString().slice(0, 10);
    const actor = process.env.USER || process.env.USERNAME || 'unknown';
    const targetFile = targetCap ? join(teamDir, targetCap, 'memory.md') : join(orphanedDir, 'memory.md');
    if (!existsSync(targetFile)) {
      stderr.write(`no team memory at ${targetFile}\n`);
      return { exitCode: 1 };
    }
    const content = readFileSync(targetFile, 'utf8');
    const reconciledTag = `<!-- reconcile ${today} by ${actor} (no deletions; metadata only) -->\n`;
    if (content.includes(reconciledTag)) {
      stdout.write(`already reconciled ${today} by ${actor}: no-op\n`);
      return { exitCode: 0 };
    }
    // 把 tag 插到 frontmatter 之后、body 之前
    const parsed = parseTeamMemory(content);
    // 过滤 undefined 值（避免 last_synced_source: undefined 这种占位）
    const cleanMeta = {};
    for (const [k, v] of Object.entries(parsed.meta)) {
      if (v !== undefined && v !== null && v !== '') cleanMeta[k] = v;
    }
    const newMeta = { ...cleanMeta, last_reconciled_by: actor, last_reconciled_at: today };
    writeTeamMemory(targetFile, newMeta, reconciledTag + parsed.body);
    appendEvent(projectRoot, `memory: reconcile ${targetCap || 'orphaned'} by ${actor} on ${today}`);
    stdout.write(`reconciled ${targetCap || 'orphaned'} (no deletions; metadata only) by ${actor} on ${today}\n`);
    return { exitCode: 0 };
  }
  usage(stderr);
  return { exitCode: 2 };
}