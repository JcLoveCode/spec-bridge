// cmd-archive-ready.mjs — `bridge archive-ready <change-dir>` 守门员子命令（v1.5 D3）。
// 校验 archive 前置条件：change-dir 有效 / 未 archived / 已 sync / 所有 capability 都有 why.md。
// 校验通过 → exit 0 + 输出 PASS；任一不满足 → exit 1 + 提示下一步命令。
// 不动文件（git mv / state set 属 archive 流程本身，由调用方负责）。
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readState } from './vendor/bridge-state.mjs';

function listCapabilities(changeDir) {
  const specsDir = join(changeDir, 'specs');
  if (!existsSync(specsDir)) return [];
  return readdirSync(specsDir)
    .filter((name) => existsSync(join(specsDir, name, 'spec.md')))
    .sort();
}

export async function run(args, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const [changeDir] = args;

  if (!changeDir) {
    stderr.write('Usage: bridge archive-ready <change-dir>\n');
    return { exitCode: 2 };
  }

  // 1. .bridge.yaml 存在 + 有 stage 字段
  const stateFile = join(changeDir, '.bridge.yaml');
  if (!existsSync(stateFile)) {
    stderr.write(`no .bridge.yaml under ${changeDir} — is it a bridge change directory?\n`);
    return { exitCode: 1 };
  }
  const state = readState(changeDir);
  if (!state.stage) {
    stderr.write(`.bridge.yaml under ${changeDir} has no stage field — run: bridge state init ${changeDir}\n`);
    return { exitCode: 1 };
  }

  // 2. 已 archived → write-protect（ADR-0005）
  if (state.stage === 'archived') {
    stderr.write(`FAIL: change is already archived (ADR-0005 write-protect) — open a follow-up: init <name> --parent <change-id>\n`);
    return { exitCode: 1 };
  }

  // 3. 已 sync（published + receipt）
  if (!state.published || !state.spec_publication_receipt) {
    stderr.write(`FAIL: change not synced yet — run: bridge sync <change-dir>\n`);
    return { exitCode: 1 };
  }

  // 4. 所有 capability 都有 why.md
  const caps = listCapabilities(changeDir);
  if (caps.length === 0) {
    stderr.write(`FAIL: no specs/<cap>/spec.md found under ${changeDir} — nothing to archive\n`);
    return { exitCode: 1 };
  }
  for (const cap of caps) {
    const whyPath = join(changeDir, 'specs', cap, 'why.md');
    if (!existsSync(whyPath)) {
      stderr.write(`FAIL: missing specs/${cap}/why.md — run: bridge distill <change-dir>\n`);
      return { exitCode: 1 };
    }
  }

  stdout.write(`PASS: archive-ready (${caps.length} capability${caps.length === 1 ? '' : 'ies'} with why.md present)\n`);
  stdout.write(`next: git mv ${changeDir} <changes/archive/$(date +%Y-%m-%d)-<change-name>/> + bridge state set <dir> stage archived\n`);
  return { exitCode: 0 };
}