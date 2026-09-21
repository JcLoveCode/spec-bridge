// v1.8-3 测试（ADR-0013 / R5）：archive-ready 个人 memory 守门 3 场景
//   1. 项目根 .codebuddy/memory/ 在场 → PASS（不检查个人 memory.md）
//   2. 项目根 IDE 不在场 + 个人 memory §1 有内容 → PASS
//   3. IDE 不在场 + 个人 memory §1 空（仅占位） → FAIL
//
// 接缝：直接 import cmd-archive-ready.mjs 的 run()，用 captureIO 抓输出。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../scripts/cmd-archive-ready.mjs';

function captureIO() {
  const stdout = [];
  const stderr = [];
  return {
    stdout: { write: (msg) => stdout.push(String(msg)) },
    stderr: { write: (msg) => stderr.push(String(msg)) },
    out: () => stdout.join(''),
    err: () => stderr.join(''),
  };
}

function makeFixtureWithPublished(root, { withIde, withPersonal, withPersonalDecisions = true }) {
  const changeDir = join(root, 'changes', 'v1-8-3-memgate');
  mkdirSync(join(changeDir, 'specs', 'memgate-cap'), { recursive: true });
  writeFileSync(join(changeDir, '.bridge.yaml'),
    `stage: executing\nworkflow_kind: builtin\npublished: true\nspec_publication_receipt: eyJ2ZXJzaW9uIjoxLCJzb3VyY2VfaGFzaCI6InNoYTI1NjoxMjM0NTY3ODkwIiwiYmFzZWxpbmVfYmVmb3JlX2hhc2giOiJzaGEyNTY6YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYSIsImJhc2VsaW5lX2FmdGVyX2hhc2giOiJzaGEyNTY6YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmYmYmYiLCJjYXBhYmlsaXRpZXMiOlsibWVtZ2F0ZS1jYXAiXX0=\ncapabilities: memgate-cap\n`);
  writeFileSync(join(changeDir, '.bridge.log'), '');
  writeFileSync(join(changeDir, 'specs', 'memgate-cap', 'spec.md'), '## Purpose\n\nspec body\n');
  writeFileSync(join(changeDir, 'specs', 'memgate-cap', 'why.md'), '# Why\n');
  if (withIde) {
    const idePath = join(root, '.codebuddy', 'memory');
    mkdirSync(idePath, { recursive: true });
    writeFileSync(join(idePath, 'MEMORY.md'), '# Curated\n\nline1\n');
  }
  if (withPersonal) {
    writeFileSync(join(changeDir, 'memory.md'),
      withPersonalDecisions
        ? `# Personal\n\n## §1 decisions\n\nv1.0: 砍 X 因为 Y\n\n## §2 obstacles\n\n(placeholder)\n`
        : `# Personal\n\n## §1 decisions\n\n\n## §2 obstacles\n\n(placeholder)\n`);
  }
  return changeDir;
}

test('Scenario: 项目根 IDE .codebuddy/memory/ 在场 → archive-ready PASS（不查个人 memory.md）', async () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-memgate-'));
  try {
    const changeDir = makeFixtureWithPublished(root, { withIde: true, withPersonal: false });
    const io = captureIO();
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 0);
    assert.match(io.out(), /memory_gated=ide/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: IDE 不在场 + 个人 memory §1 有决策 → PASS', async () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-memgate-'));
  try {
    const changeDir = makeFixtureWithPublished(root, { withIde: false, withPersonal: true, withPersonalDecisions: true });
    const io = captureIO();
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 0);
    assert.match(io.out(), /memory_gated=personal/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: IDE 不在场 + 个人 memory §1 空（仅占位） → FAIL', async () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-memgate-'));
  try {
    const changeDir = makeFixtureWithPublished(root, { withIde: false, withPersonal: true, withPersonalDecisions: false });
    const io = captureIO();
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 1);
    assert.match(io.err(), /no personal memory recorded/i);
    assert.match(io.err(), /bridge memory append/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});