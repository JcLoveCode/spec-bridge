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

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
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
    const target = positional[1] ? resolve(cwd, positional[1]) : null;
    if (!target) {
      stderr.write('Usage: bridge memory show <change-dir>\n');
      return { exitCode: 2 };
    }
    const result = showPersonalMemory(target);
    if (!result.found) {
      stderr.write(`no memory.md at ${target}\n`);
      return { exitCode: 1 };
    }
    stdout.write(result.content);
    return { exitCode: 0 };
  }
  if (subcmd === 'sync' || subcmd === 'reconcile') {
    stderr.write(`bridge memory ${subcmd}: implemented in v1.8-3 commit 2 (团队层)\n`);
    return { exitCode: 2 };
  }
  usage(stderr);
  return { exitCode: 2 };
}