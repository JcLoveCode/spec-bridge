// cmd-pattern.mjs — `bridge pattern --tag <t> [project-root]` 模式聚合（ADR-0006）。
// 横向维度：跨变更（含 archive/）按自由文本 tag 聚类，输出 stage 与 mention 计数。
// 纯读侧，零写操作。mention 计数源自 .bridge.log 中的 `tag=<t>` 事件行（B5 mention 命令的写入格式）。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readState } from './vendor/bridge-state.mjs';
import { detectProjectRoot } from './cmd-init.mjs';

function parseArgs(rawArgs) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < rawArgs.length; i += 1) {
    const token = rawArgs[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rawArgs[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = 'true';
      else {
        flags[key] = next;
        i += 1;
      }
    } else positional.push(token);
  }
  return { positional, flags };
}

function countTagMentions(changeDir, tag) {
  const logFile = join(changeDir, '.bridge.log');
  if (!existsSync(logFile)) return 0;
  const lines = readFileSync(logFile, 'utf-8').split('\n');
  let count = 0;
  for (const line of lines) {
    if (line.includes(`tag=${tag}`)) count += 1;
  }
  return count;
}

function collectMatches(changesDir, tag, location) {
  const matches = [];
  if (!existsSync(changesDir)) return matches;
  for (const entry of readdirSync(changesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'archive') continue;
    const dir = join(changesDir, entry.name);
    if (!existsSync(join(dir, '.bridge.yaml'))) continue;
    const state = readState(dir);
    const tags = (state.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.includes(tag)) {
      // 归档目录名带 <YYYY-MM-DD>- 前缀（存储约定）；change 身份名与 --parent 引用一致，剥离前缀。
      const name = entry.name.replace(/^\d{4}-\d{2}-\d{2}-/, '');
      matches.push({ name, stage: state.stage, location, mentions: countTagMentions(dir, tag) });
    }
  }
  return matches;
}

export async function run(args, { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
  const { positional, flags } = parseArgs(args);

  if (!flags.tag) {
    stderr.write('Usage: bridge pattern --tag <t> [project-root]\n');
    return { exitCode: 2 };
  }
  const tag = flags.tag;

  const detected = detectProjectRoot(positional[0] ? resolve(cwd, positional[0]) : cwd);
  const root = detected.root;
  const changesDir = existsSync(join(root, 'openspec'))
    ? join(root, 'openspec', 'changes')
    : join(root, 'changes');

  const matches = [
    ...collectMatches(changesDir, tag, 'active'),
    ...collectMatches(join(changesDir, 'archive'), tag, 'archived'),
  ];
  matches.sort((a, b) => a.name.localeCompare(b.name));

  const totalMentions = matches.reduce((sum, m) => sum + m.mentions, 0);
  stdout.write(`${JSON.stringify({ tag, matches, total_mentions: totalMentions }, null, 2)}\n`);

  if (totalMentions >= 2) {
    stdout.write(`→ pattern recurring: tag '${tag}' mentioned ${totalMentions} times — consider a root-cause follow-up (ADR-0006/0007)\n`);
  }
  return { exitCode: 0 };
}
