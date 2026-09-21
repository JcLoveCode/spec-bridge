#!/usr/bin/env node
// cmd-probe.mjs — bridge probe <change-dir> --inventory <s1,s2,...>
// 导航员激活（v1.7 / ADR-0010 / D4）：4 维度探测 + 4 级路由 + 合并 next hint + D5 输出。
//
// 关键边界（C 约束）：
//   C2: probe 只输出不写入（不动 .bridge.yaml / .bridge.log）
//   C3: probe 不自动调 skill（仅给 AI 看 advised_skill，AI 据此问用户拍板）
//   C4: inventory 必须 AI 显式宣告（probe 不替 AI 猜）
//   C5: 合并 bridge next 的 next_hint（不重复造车）
//   C6: 4 级路由优先级固定写死（Superpowers > Matt > OpenSpec > 兜底）
//   C8: 输出格式 D5（KEY:value 文本，人类可读）
//   C9: 隐式 change-dir fallback（v1.7 hotfix）：当用户传 `bridge probe .` 或
//       其他等于 cwd 的路径时，自动在 cwd/changes/ 下找唯一含 .bridge.yaml
//       的 change 目录；用户显式给非 cwd 路径不兜底（避免掩盖错）

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readState } from './vendor/bridge-state.mjs';
import { detectLayout } from './bridge.mjs';
import { run as runNext } from './cmd-next.mjs';

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

// v1.8-1 (ADR-0011 D4)：advised_skill → use_skill 命令的映射，让 AI 可机械执行（不再查 SKILL.md）。
// 映射规则：advised_skill 子串 → use_skill 调用语法。
function skillToInvocation(advisedSkill) {
  if (advisedSkill === '(none)') {
    return '(fallback to builtin: edit proposal/design/tasks/spec)';
  }
  const lower = advisedSkill.toLowerCase();
  if (lower.includes('matt') || lower.includes('to-spec')) return 'use_skill to-spec';
  if (lower.includes('openspec') || lower.includes('propose')) return 'use_skill openspec-propose';
  if (lower.includes('superpowers') || lower.includes('tdd')) return 'use_skill tdd';
  // 默认：直接把 advised_skill 当 use_skill 的参数
  return `use_skill ${advisedSkill}`;
}

function routeSkill(inventory) {
  const lower = inventory.map((s) => s.toLowerCase());
  for (const skill of lower) {
    if (skill.includes('superpowers')) {
      return { advised_skill: skill, advised_reason: 'inventory 含 Superpowers skill，按 D4 优先级 1 路由' };
    }
  }
  for (const skill of lower) {
    if (skill.includes('matt')) {
      return { advised_skill: skill, advised_reason: 'inventory 含 Matt skill，按 D4 优先级 2 路由' };
    }
  }
  for (const skill of lower) {
    if (skill.includes('openspec')) {
      return { advised_skill: skill, advised_reason: 'inventory 含 OpenSpec skill，按 D4 优先级 3 路由' };
    }
  }
  return { advised_skill: '(none)', advised_reason: 'inventory 未含任何已知栈 skill，按 D4 优先级 4 兜底（AI 自由发挥）' };
}

async function getNextHint(changeDir) {
  const chunks = [];
  const fakeStdout = { write: (c) => { chunks.push(String(c)); return true; } };
  const fakeStderr = { write: () => true };
  await runNext([changeDir], { stdout: fakeStdout, stderr: fakeStderr });
  const text = chunks.join('');
  const adviceLine = text.split('\n').find((l) => l.startsWith('→ '));
  return adviceLine ? adviceLine.replace(/^→ /, '').trim() : '(unknown)';
}

function resolveImplicitChangeDir(cwd) {
  // 1. cwd 自身是 change dir
  if (existsSync(join(cwd, '.bridge.yaml'))) return { found: cwd };
  // 2. cwd/changes/<name>/ 下找
  const changesDir = join(cwd, 'changes');
  if (!existsSync(changesDir)) return { found: null };
  const subs = readdirSync(changesDir, { withFileTypes: true });
  const matches = subs
    .filter((d) => d.isDirectory() && existsSync(join(changesDir, d.name, '.bridge.yaml')))
    .map((d) => join(changesDir, d.name));
  if (matches.length === 1) return { found: matches[0] };
  if (matches.length > 1) return { found: null, ambiguous: matches };
  return { found: null };
}

export async function run(args, { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
  const { positional, flags } = parseArgs(args);
  if (!positional[0]) {
    stderr.write('Usage: bridge probe <change-dir> [--inventory <s1,s2,...>]\n');
    return { exitCode: 2 };
  }
  const rawDir = resolve(cwd, positional[0]);
  const inventory = flags.inventory ? flags.inventory.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const detected = detectLayout(cwd);
  const project_type = detected.layout;
  // 隐式 fallback：仅当 rawDir === cwd 时启用（用户显式给其他路径不兜底）
  let changeDir = rawDir;
  if (!existsSync(join(changeDir, '.bridge.yaml'))) {
    const implicit = resolve(cwd) === rawDir ? resolveImplicitChangeDir(cwd) : { found: null };
    if (implicit.found) {
      changeDir = implicit.found;
      stderr.write(`[hint] no .bridge.yaml under ${rawDir}; resolved implicit change-dir → ${changeDir}\n`);
    } else if (implicit.ambiguous) {
      stderr.write(`ambiguous: found ${implicit.ambiguous.length} change dirs with .bridge.yaml:\n`);
      for (const m of implicit.ambiguous) stderr.write(`  - ${m}\n`);
      stderr.write('specify one explicitly: bridge probe <change-dir>\n');
      return { exitCode: 2 };
    } else {
      stderr.write(`no .bridge.yaml under ${rawDir} — is it a bridge change directory?\n`);
      return { exitCode: 1 };
    }
  }
  const state = readState(changeDir);
  const stage = state.stage || 'planning';
  const capabilities = state.capabilities ?? '(unset)';
  const routed = routeSkill(inventory);
  const next_hint = await getNextHint(changeDir);
  stdout.write(`project_type: ${project_type}\n`);
  stdout.write(`capabilities: ${capabilities}\n`);
  stdout.write(`stage: ${stage}\n`);
  stdout.write(`inventory: ${inventory.join(',')}\n`);
  stdout.write(`advised_skill: ${routed.advised_skill}\n`);
  stdout.write(`advised_reason: ${routed.advised_reason}\n`);
  stdout.write(`advised_invocation: ${skillToInvocation(routed.advised_skill)}\n`);
  stdout.write(`next_hint: ${next_hint}\n`);
  return { exitCode: 0 };
}