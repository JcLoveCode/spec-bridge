// cmd-next.mjs — `bridge next <change-dir>` 导航命令（ADR-0004 导航员的最小可见落点）。
// 纯读侧：读 .bridge.yaml → 输出 stage / next / 按 stage 查表的建议动作。
// 不写任何状态（写 next 字段是 `state next` 的职责，本命令只消费——design D2）。
import { readState } from './vendor/bridge-state.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// stage → 建议动作查表（D2：固定查表，不引入新状态）。
const STAGE_ADVICE = {
  planning: '填 proposal / design / tasks / specs 四件套；稳定后写 execution-contract.md 并过批准门（hashes → state set → approved）',
  contracted: '先跑 hashes --check（契约过期检测）；通过后按 tasks.md 批次执行',
  executing: '继续当前批次；每批收尾 state next 写恢复提示，批末审查写 progress.md',
  patching: '本变更是续作（ADR-0005）：对照 parent 契约与回执做修正；收尾走 sync → verify → 归档',
  archived: '无下一步——如需修正，开 follow-up：init <name> --parent <本变更>，勿改原版（ADR-0005）',
  abandoned: '终态，无下一步。',
};

export async function run(args, { stdout = process.stdout, stderr = process.stderr } = {}) {
  const changeDir = args[0];
  if (!changeDir) {
    stderr.write('Usage: bridge next <change-dir>\n');
    return { exitCode: 2 };
  }

  if (!existsSync(join(changeDir, '.bridge.yaml'))) {
    stderr.write(`no .bridge.yaml under ${changeDir} — is it a bridge change directory?\n`);
    return { exitCode: 1 };
  }

  const state = readState(changeDir);
  const stage = state.stage || 'planning';
  const advice = STAGE_ADVICE[stage] ?? `unknown stage '${stage}' — check .bridge.yaml`;

  stdout.write(`change: ${changeDir}\n`);
  stdout.write(`stage:  ${stage}\n`);
  stdout.write(`next:   ${state.next ?? '(unset — run: state next <dir> <hint>)'}\n`);
  stdout.write(`→ ${advice}\n`);
  if (state.parent) {
    stdout.write(`parent: ${state.parent} (${state.parent_artifacts_hash ?? 'hash unset'})\n`);
  }
  if (state.workflow_kind) {
    stdout.write(`workflow: ${state.workflow_kind}\n`);
  }
  return { exitCode: 0 };
}
