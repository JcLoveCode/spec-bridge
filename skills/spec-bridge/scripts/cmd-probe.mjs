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

import { existsSync } from 'node:fs';
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

export async function run(args, { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
  const { positional, flags } = parseArgs(args);
  if (!positional[0]) {
    stderr.write('Usage: bridge probe <change-dir> [--inventory <s1,s2,...>]\n');
    return { exitCode: 2 };
  }
  const changeDir = resolve(cwd, positional[0]);
  const inventory = flags.inventory ? flags.inventory.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const detected = detectLayout(cwd);
  const project_type = detected.layout;
  if (!existsSync(join(changeDir, '.bridge.yaml'))) {
    stderr.write(`no .bridge.yaml under ${changeDir} — is it a bridge change directory?\n`);
    return { exitCode: 1 };
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
  stdout.write(`next_hint: ${next_hint}\n`);
  return { exitCode: 0 };
}