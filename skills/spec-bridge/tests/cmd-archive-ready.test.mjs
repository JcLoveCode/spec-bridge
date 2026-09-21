// 引擎纯函数测试：cmd-archive-ready 子命令校验 archive 前置条件（why.md 存在 + 已 sync + 未 archived）
// 对应 spec：specs/archive-publish-guard/spec.md R3（归档守卫 CLI）
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '../scripts/cmd-archive-ready.mjs';

function silentIO() {
  return {
    stdout: { write: () => {} },
    stderr: { write: () => {} },
  };
}

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

function makeFixture(opts = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cmd-archive-ready-'));
  const changeDir = join(root, 'changes', 'v1-5-fixture');
  mkdirSync(join(changeDir, 'specs', 'fixture-cap'), { recursive: true });
  writeFileSync(join(changeDir, '.bridge.yaml'), [
    'stage: executing',
    'published: ' + (opts.published === false ? 'false' : 'true'),
    opts.published === false ? '' : 'spec_publication_receipt: eyJ2ZXJzaW9uIjoxLCJzb3VyY2VfaGFzaCI6InNoYTI1NjoxMjM0NTY3ODkwIiwiYmFzZWxpbmVfYmVmb3JlX2hhc2giOiJzaGEyNTY6YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYSIsImJhc2VsaW5lX2FmdGVyX2hhc2giOiJzaGEyNTY6YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYiIsImNhcGFiaWxpdGllcyI6WyJmaXh0dXJlLWNhcCJdfQ',
    opts.archived ? 'stage: archived' : '',
  ].join('\n'));
  writeFileSync(join(changeDir, 'specs', 'fixture-cap', 'spec.md'), '## Purpose\n\nspec body\n');
  if (opts.whyExists !== false) {
    writeFileSync(join(changeDir, 'specs', 'fixture-cap', 'why.md'), '# Why\n');
  }
  // v1.8-3 (ADR-0013 / R5)：archive-ready 需要个人 memory 守门通过。原 makeFixture 不写 personal memory，
  // 现在自动补一份含 §1 决策行的 memory.md（除非 opts.noPersonalMemory=true）。
  if (!opts.noPersonalMemory) {
    writeFileSync(join(changeDir, 'memory.md'),
      '# Personal\n\n## §1 decisions\n\nv1.0: 砍 X 因为 Y\n\n## §2 obstacles\n\n(placeholder)\n');
  }
  return { root, changeDir };
}

test('Scenario: 全前置满足（stage=executing + published + why.md）→ exit 0 PASS', async () => {
  const { root, changeDir } = makeFixture();
  const io = captureIO();
  try {
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 0);
    assert.match(io.out(), /PASS: archive-ready/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 缺 specs/<cap>/why.md → exit 1 + 提示跑 bridge distill', async () => {
  const { root, changeDir } = makeFixture({ whyExists: false });
  const io = captureIO();
  try {
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 1);
    assert.match(io.err(), /FAIL: missing.*why\.md/i);
    assert.match(io.err(), /bridge distill/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 未 sync（published=false / receipt 缺）→ exit 1 + 提示跑 bridge sync', async () => {
  const { root, changeDir } = makeFixture({ published: false });
  const io = captureIO();
  try {
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 1);
    assert.match(io.err(), /FAIL: change not synced/i);
    assert.match(io.err(), /bridge sync/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 已 archived → exit 1 + 提示 write-protect', async () => {
  const { root, changeDir } = makeFixture({ archived: true });
  const io = captureIO();
  try {
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 1);
    assert.match(io.err(), /already archived|write-protected/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 缺 .bridge.yaml → exit 1（不是有效 change dir）', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cmd-archive-ready-'));
  const fakeDir = join(root, 'not-a-change');
  mkdirSync(fakeDir, { recursive: true });
  const io = captureIO();
  try {
    const result = await run([fakeDir], io);
    assert.equal(result.exitCode, 1);
    assert.match(io.err(), /no \.bridge\.yaml/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 多 capability 时任一缺 why.md → exit 1', async () => {
  const { root, changeDir } = makeFixture();
  // 第二个 cap 有 spec.md 但无 why.md
  mkdirSync(join(changeDir, 'specs', 'fixture-cap-2'), { recursive: true });
  writeFileSync(join(changeDir, 'specs', 'fixture-cap-2', 'spec.md'), '## Purpose\n\nspec 2\n');
  const io = captureIO();
  try {
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 1);
    assert.match(io.err(), /FAIL: missing.*fixture-cap-2.*why\.md/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});