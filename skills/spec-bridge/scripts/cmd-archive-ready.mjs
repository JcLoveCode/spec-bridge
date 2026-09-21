// cmd-archive-ready.mjs — `bridge archive-ready <change-dir>` 守门员子命令（v1.5 D3 + v1.8-3 ADR-0013）。
// 校验 archive 前置条件：change-dir 有效 / 未 archived / 已 sync / 所有 capability 都有 why.md / 个人 memory 不空（v1.8-3 R5）。
// 校验通过 → exit 0 + 输出 PASS；任一不满足 → exit 1 + 提示下一步命令。
// 不动文件（git mv / state set 属 archive 流程本身，由调用方负责）。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { join } from 'node:path';
import { readState } from './vendor/bridge-state.mjs';
import { detectIdeMemory } from './cmd-memory.mjs';

// v1.8-3 (ADR-0013 / R5)：守门 2 态。
// - 项目根 .codebuddy/memory/ 在场（且非空）→ PASS（IDE 自管，不查个人 memory.md）
// - 不在场 → 检查 <change>/memory.md §1 决策段至少 1 行非空内容 → PASS
// - 都缺 → FAIL
//
// 决策段解析：从 "## §1" 开始到下一段 "## §X" 或 EOF，统计非空非注释行数。
function countSectionLines(changeDir, sectionHeader) {
  const memPath = join(changeDir, 'memory.md');
  if (!existsSync(memPath)) return 0;
  const content = readFileSync(memPath, 'utf8');
  const escaped = sectionHeader.replace(/[§.]/g, '\\$&');
  const startRe = new RegExp(`^## ${escaped}[^\\n]*$`, 'm');
  const m = content.match(startRe);
  if (!m) return 0;
  const after = content.slice(m.index + m[0].length);
  const nextRe = /\n## §/;
  const tailMatch = after.match(nextRe);
  const endIdx = tailMatch ? after.indexOf(tailMatch[0]) : after.length;
  const section = after.slice(0, endIdx);
  // 跳过纯空行 + 注释行（# 开头）+ 模板占位行（<!-- ... -->）
  return section
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .filter((line) => !line.trim().startsWith('#'))
    .filter((line) => !line.trim().startsWith('<!--'))
    .length;
}

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

  // v1.8-1 (ADR-0011 D4)：external_stack change 的 why.md 由外栈自带生成器写，
  // bridge 不强制要求 why.md（与 distill-skip-external 行为对齐）。memory 也跳（外栈自带）。
  if (state.external_stack) {
    stdout.write(`PASS: archive-ready (external_stack=${state.external_stack}, why.md provided by external stack)\n`);
    return { exitCode: 0 };
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

  // 5. v1.8-3 (ADR-0013 / R5)：个人 memory 守门
  // changeDir = changes/<name>/ → 项目根 = dirname(dirname(changeDir)) = changes/ 的父目录
  const projectRoot = dirname(dirname(changeDir));
  const ideProbe = detectIdeMemory(projectRoot);
  let memoryGate = 'none';
  if (ideProbe.present && !ideProbe.isEmpty) {
    memoryGate = 'ide';
  } else {
    const sectionLines = countSectionLines(changeDir, '§1');
    if (sectionLines >= 1) memoryGate = 'personal';
  }
  if (memoryGate === 'none') {
    stderr.write(`FAIL: no personal memory recorded — either:\n`);
    stderr.write(`  1) ensure project root .codebuddy/memory/ exists with at least one .md (IDE-managed)\n`);
    stderr.write(`  2) append at least one decision to ${changeDir}/memory.md §1: bridge memory append ${changeDir} --text "vX.Y.Z: 砍 X 因为 Y"\n`);
    return { exitCode: 1 };
  }

  stdout.write(`PASS: archive-ready (${caps.length} capability${caps.length === 1 ? '' : 'ies'} with why.md present; memory_gated=${memoryGate})\n`);
  stdout.write(`next: git mv ${changeDir} <changes/archive/$(date +%Y-%m-%d)-<change-name>/> + bridge state set <dir> stage archived\n`);
  return { exitCode: 0 };
}