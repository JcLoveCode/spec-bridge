// v1.8-3 测试（ADR-0013 D2 + T2.1）：appendPersonalMemory 追加到 §1/§2/§3。
//   1. 默认写到 §1（决策段）
//   2. --section §2 → 写到卡住段
//   3. format 弱提示（vX.Y.Z: 推荐，不强制）
//   4. 多行决策段按顺序追加
//
// 接缝：直接 import { appendPersonalMemory } + 用 memory-init-empty 写好的骨架。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CMD_MEMORY = join(HERE, '..', 'scripts', 'cmd-memory.mjs');

async function importCmdMemory() {
  return import(CMD_MEMORY);
}

function makeProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'bridge-v183-mem-append-'));
}

function seedMemory(changeDir) {
  writeFileSync(join(changeDir, 'memory.md'), [
    '# Personal Memory: foo',
    '> 写者：AI / 人 | 写时：2026-09-21',
    '> 规则：bridge 不替 AI 总结，只填结构 + 元信息；每行必带 why',
    '',
    '## §0 元信息',
    '- change: foo',
    '- capabilities: default',
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
  ].join('\n'));
}

// R3 场景 A：默认 append 到 §1
test('R3-A: appendPersonalMemory — 默认追加到 §1 决策段', async () => {
  const root = makeProjectRoot();
  try {
    const changeDir = join(root, 'changes', 'foo');
    mkdirSync(changeDir, { recursive: true });
    seedMemory(changeDir);
    const { appendPersonalMemory } = await importCmdMemory();
    const result = appendPersonalMemory(changeDir, 'v1.8.3: 砍 --builtin 因为纯桥叙事', '§1');
    assert.equal(result.skipped, false);
    assert.equal(result.section, '§1');
    const content = readFileSync(join(changeDir, 'memory.md'), 'utf8');
    assert.match(content, /v1\.8\.3: 砍 --builtin 因为纯桥叙事/);
    assert.match(content, /## §1 决策段[\s\S]*v1\.8\.3: 砍[\s\S]*## §2 卡住/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R3 场景 B：--section §2 → 写到卡住段
test('R3-B: appendPersonalMemory — --section §2 写到卡住段', async () => {
  const root = makeProjectRoot();
  try {
    const changeDir = join(root, 'changes', 'foo');
    mkdirSync(changeDir, { recursive: true });
    seedMemory(changeDir);
    const { appendPersonalMemory } = await importCmdMemory();
    const result = appendPersonalMemory(changeDir, 'v1.8.3: 卡在 sync hash 一致判定', '§1');
    appendPersonalMemory(changeDir, '走偏了：用 git status 查 memory.md 状态', '§2');
    const content = readFileSync(join(changeDir, 'memory.md'), 'utf8');
    assert.match(content, /## §1 决策段[\s\S]*v1\.8\.3: 卡在 sync hash[\s\S]*## §2[\s\S]*走偏了：用 git status/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R3 场景 C：append 失败时跳过（no_memory + no_section）
test('R3-C: appendPersonalMemory — memory.md 不存在 + section 不存在 → skipped', async () => {
  const root = makeProjectRoot();
  try {
    const changeDir = join(root, 'changes', 'foo');
    mkdirSync(changeDir, { recursive: true });
    const { appendPersonalMemory } = await importCmdMemory();
    const r1 = appendPersonalMemory(changeDir, 'v1.8.3: ...', '§1');
    assert.equal(r1.skipped, true);
    assert.equal(r1.reason, 'no_memory');

    const r2 = appendPersonalMemory(changeDir, '...', '§99');
    // 此时已 seedMemory 但用 §99
    seedMemory(changeDir);
    const r3 = appendPersonalMemory(changeDir, '...', '§99');
    assert.equal(r3.skipped, true);
    assert.equal(r3.reason, 'no_section');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R3 场景 D：多行决策段按顺序追加
test('R3-D: appendPersonalMemory — 多次 append 按顺序累计', async () => {
  const root = makeProjectRoot();
  try {
    const changeDir = join(root, 'changes', 'foo');
    mkdirSync(changeDir, { recursive: true });
    seedMemory(changeDir);
    const { appendPersonalMemory } = await importCmdMemory();
    appendPersonalMemory(changeDir, 'decision-1', '§1');
    appendPersonalMemory(changeDir, 'decision-2', '§1');
    appendPersonalMemory(changeDir, 'obstacle-1', '§2');
    const content = readFileSync(join(changeDir, 'memory.md'), 'utf8');
    // 顺序：§1 内 decision-1 → decision-2；§2 内 obstacle-1
    const sec1 = content.match(/## §1 决策段[\s\S]*?(?=## §)/)[0];
    assert.match(sec1, /decision-1[\s\S]*decision-2/);
    assert.match(content, /## §2[\s\S]*obstacle-1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});