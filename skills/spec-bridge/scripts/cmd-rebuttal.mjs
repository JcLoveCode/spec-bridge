// cmd-rebuttal.mjs — `bridge rebuttal <change-dir> <一句话> [--tag <t>]`（R3-Q2 双轨的人工标记侧）。
// 复验异议的轻量落点：写 rebuttals/<date>-<slug>.md，零状态变更（design D8）。
// 是否升级为 follow-up 由人决定（ADR-0004：提示不决策）。
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

function slugify(text, max = 24) {
  const ascii = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return ascii.slice(0, max) || 'note';
}

export async function run(args, { stdout = process.stdout, stderr = process.stderr } = {}) {
  const { positional, flags } = parseArgs(args);
  const changeDir = positional[0];
  const text = positional.slice(1).join(' ');

  if (!changeDir || !text) {
    stderr.write('Usage: bridge rebuttal <change-dir> <one-line objection> [--tag <t>]\n');
    return { exitCode: 2 };
  }
  if (!existsSync(join(changeDir, '.bridge.yaml'))) {
    stderr.write(`no .bridge.yaml under ${changeDir} — is it a bridge change directory?\n`);
    return { exitCode: 1 };
  }

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  const file = join(changeDir, 'rebuttals', `${date}-${time}-${slugify(text)}.md`);

  mkdirSync(join(changeDir, 'rebuttals'), { recursive: true });
  writeFileSync(file, [
    `# Rebuttal — ${date}`,
    '',
    `**objection**: ${text}`,
    flags.tag ? `**tag**: ${flags.tag}` : null,
    `**change**: ${changeDir}`,
    '',
    '> 人工复验异议（R3-Q2 双轨）。是否升级为 follow-up 由人决定；',
    '> 升级路径：init <name> --parent <本变更>（ADR-0005）。',
    '',
  ].filter((line) => line !== null).join('\n'), 'utf-8');

  // 只追加日志，不触发 last_event 刷新（appendEvent 会写 .bridge.yaml——R7 要求零状态变更）。
  appendFileSync(join(changeDir, '.bridge.log'), `- ${now.toISOString()} rebuttal: ${text}${flags.tag ? ` tag=${flags.tag}` : ''}\n`, 'utf-8');
  stdout.write(`${file}\n`);
  return { exitCode: 0 };
}
