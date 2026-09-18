// cmd-mention.mjs — `bridge mention` / `bridge rootcause` 信号命令（ADR-0007）。
// 两个入口共享实现：追加事件到 .bridge.log → 输出全库该 tag 的历史计数 → N≥2 附建议行。
// 桥不存会话状态（ADR-0007）；"会话内第二次"由 SKILL.md 协议硬性步骤保证，桥只记账账历史。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
      else {
        flags[key] = next;
        i += 1;
      }
    } else positional.push(token);
  }
  return { positional, flags };
}

// 全库计数：changes/（含 archive/）所有 .bridge.log 中 tag=<t> 的出现次数。
function countAcrossRepo(changesDir, tag) {
  let count = 0;
  const scan = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'archive') {
        scan(join(dir, 'archive'));
        continue;
      }
      const logFile = join(dir, entry.name, '.bridge.log');
      if (existsSync(logFile)) {
        count += readFileSync(logFile, 'utf-8').split('\n').filter((line) => line.includes(`tag=${tag}`)).length;
      }
    }
  };
  scan(changesDir);
  return count;
}

async function runSignal(args, kind, { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
  const { positional, flags } = parseArgs(args);
  const changeDir = positional[0];

  if (!changeDir || !flags.tag) {
    stderr.write(`Usage: bridge ${kind} <change-dir> --tag <t> [--note <text>]\n`);
    return { exitCode: 2 };
  }
  if (!existsSync(join(changeDir, '.bridge.yaml'))) {
    stderr.write(`no .bridge.yaml under ${changeDir} — is it a bridge change directory?\n`);
    return { exitCode: 1 };
  }

  const tag = flags.tag;
  const note = flags.note ? ` note=${flags.note}` : '';
  // 事件格式与 cmd-pattern 的计数约定一致：tag=<t> 必须出现在行内。
  const event = kind === 'rootcause' ? `root-cause: tag=${tag}${note}` : `mention: tag=${tag}${note}`;
  appendEvent(changeDir, event);

  // 全库历史计数（含刚写入的本次）。changes 目录 = change 目录的上一级。
  const changesDir = dirname(join(cwd, changeDir));
  const total = countAcrossRepo(changesDir, tag);

  stdout.write(`${event}\n`);
  stdout.write(`tag '${tag}' ledger history: ${total} time${total === 1 ? '' : 's'} (across repo, incl. this one)\n`);
  if (total >= 2) {
    stdout.write(`→ recurring: consider bridge pattern --tag ${tag}, or open a follow-up (init <name> --parent <change>)\n`);
  }

  const state = readState(changeDir);
  if (!state.tags || !state.tags.split(',').map((t) => t.trim()).includes(tag)) {
    stdout.write(`hint: tag not in this change's tags field — run: state set <dir> tags "${tag}"\n`);
  }
  return { exitCode: 0 };
}

export async function run(args, io) {
  return runSignal(args, 'mention', io);
}

export async function runRootcause(args, io) {
  return runSignal(args, 'rootcause', io);
}
