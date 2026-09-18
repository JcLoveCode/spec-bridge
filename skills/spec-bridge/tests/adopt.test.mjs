// v1.3 Batch 3 测试（exec R3 + R4 测试义务）：
// bridge adopt 接外栈已存在的 artifacts → 只写台账 + 第一条大事记，不动产物（D4）。
// bridge list 加 untracked_artifacts 段 — 列出有 artifact 无 .bridge.yaml 的目录（D4）。
// 接缝同 init-integration.test.mjs：spawn `node bridge.mjs <args>`。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');
const FIXTURE_OPENSPEC_SPEC = join(HERE, 'fixtures', 'external-openspec-spec.md');
const FIXTURE_MATT_PROPOSAL = join(HERE, 'fixtures', 'external-matt-proposal.md');

function makeSandbox(withOpenspec = false) {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-adopt-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  if (withOpenspec) mkdirSync(join(dir, 'openspec'), { recursive: true });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

// R3 场景 1：adopt 已存在的 openspec 风格 change（只有 specs/<cap>/spec.md 在场）
test('R3 场景 1：adopt 只建台账 + 不动 spec.md（openspec 风格 + openspec layout）', () => {
  const root = makeSandbox(true);
  try {
    // 在 openspec/changes/ 下建外栈 change
    const changeDir = join(root, 'openspec', 'changes', 'adopted-1');
    mkdirSync(join(changeDir, 'specs', 'cli'), { recursive: true });
    copyFileSync(FIXTURE_OPENSPEC_SPEC, join(changeDir, 'specs', 'cli', 'spec.md'));
    // 先抓原文 hash
    const specBefore = readFileSync(join(changeDir, 'specs', 'cli', 'spec.md'), 'utf-8');

    const result = bridge(['adopt', changeDir, '--workflow-kind', 'openspec'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);

    // .bridge.yaml 写出来了
    assert.ok(existsSync(join(changeDir, '.bridge.yaml')));
    const state = readFileSync(join(changeDir, '.bridge.yaml'), 'utf-8');
    assert.match(state, /workflow_kind:\s*openspec/);
    assert.match(state, /layout:\s*openspec/);
    assert.match(state, /stage:\s*planning/);
    // .bridge.log 写出来了 + 第一条大事记含 adopt 字样
    const log = readFileSync(join(changeDir, '.bridge.log'), 'utf-8');
    assert.match(log, /adopt:/);
    // spec.md 不动（不增不减不修改）
    const specAfter = readFileSync(join(changeDir, 'specs', 'cli', 'spec.md'), 'utf-8');
    assert.equal(specAfter, specBefore, 'spec.md 内容不得被 adopt 修改');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R3 场景 2：adopt 已存在的 matt 风格 change（只有 proposal.md 在场）
test('R3 场景 2：adopt 只建台账 + 不动 proposal.md（matt 风格 + standalone layout）', () => {
  const root = makeSandbox(false);
  try {
    const changeDir = join(root, 'changes', 'adopted-matt');
    mkdirSync(changeDir, { recursive: true });
    copyFileSync(FIXTURE_MATT_PROPOSAL, join(changeDir, 'proposal.md'));
    const proposalBefore = readFileSync(join(changeDir, 'proposal.md'), 'utf-8');

    const result = bridge(['adopt', changeDir, '--workflow-kind', 'matt'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);

    assert.ok(existsSync(join(changeDir, '.bridge.yaml')));
    const state = readFileSync(join(changeDir, '.bridge.yaml'), 'utf-8');
    assert.match(state, /workflow_kind:\s*matt/);
    assert.match(state, /layout:\s*standalone/);
    assert.match(state, /stage:\s*planning/);
    const log = readFileSync(join(changeDir, '.bridge.log'), 'utf-8');
    assert.match(log, /adopt:/);
    const proposalAfter = readFileSync(join(changeDir, 'proposal.md'), 'utf-8');
    assert.equal(proposalAfter, proposalBefore, 'proposal.md 内容不得被 adopt 修改');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R3 场景 3：adopt 一个没有任何 artifact 的目录 → exit 2（防止空目录误接管）
test('R3 场景 3：adopt 空目录（无任何 artifact）拒绝 exit 2', () => {
  const root = makeSandbox(false);
  try {
    const changeDir = join(root, 'changes', 'empty-adopt');
    mkdirSync(changeDir, { recursive: true });
    // 不放任何文件
    const result = bridge(['adopt', changeDir, '--workflow-kind', 'builtin'], root);
    assert.equal(result.status, 2, `stderr: ${result.stderr}`);
    assert.match(result.stderr, /no adoptable artifacts|proposal\.md|spec\.md/);
    // .bridge.yaml 不应有
    assert.ok(!existsSync(join(changeDir, '.bridge.yaml')), '空目录不应创建 .bridge.yaml');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R4 场景 1：bridge list 加 untracked_artifacts 段，列出有 spec.md/proposal.md 但无 .bridge.yaml 的目录
test('R4 场景 1：bridge list untracked_artifacts 段列出有产物无台账的目录', () => {
  const root = makeSandbox(false);
  try {
    mkdirSync(join(root, 'changes'), { recursive: true });
    // 1) 一个 tracked change（有 .bridge.yaml）
    const tracked = join(root, 'changes', 'tracked-change');
    mkdirSync(tracked, { recursive: true });
    writeFileSync(join(tracked, '.bridge.yaml'), 'stage: planning\n', 'utf-8');
    writeFileSync(join(tracked, 'proposal.md'), 'tracked', 'utf-8');
    // 2) 一个 untracked change（有 proposal.md 无 .bridge.yaml）
    const untracked = join(root, 'changes', 'untracked-change');
    mkdirSync(untracked, { recursive: true });
    writeFileSync(join(untracked, 'proposal.md'), 'untracked', 'utf-8');
    // 3) 另一个 untracked change（有 specs/x/spec.md 无 .bridge.yaml）
    const untrackedSpec = join(root, 'changes', 'untracked-spec');
    mkdirSync(join(untrackedSpec, 'specs', 'x'), { recursive: true });
    writeFileSync(join(untrackedSpec, 'specs', 'x', 'spec.md'), 'external', 'utf-8');

    const result = bridge(['list', root], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const listing = JSON.parse(result.stdout);
    assert.ok(Array.isArray(listing.untracked_artifacts), 'listing must include untracked_artifacts array');
    assert.equal(listing.untracked_artifacts.length, 2, 'must list both untracked changes');
    const names = listing.untracked_artifacts.map((e) => e.name).sort();
    assert.deepEqual(names, ['untracked-change', 'untracked-spec']);
    // tracked change 不应在 untracked 段
    assert.ok(!names.includes('tracked-change'));
    // 每条 untracked entry 应含存在的产物名（顶层 4 产物或 specs/<cap>/spec.md）
    const isAdoptable = (a) =>
      ['proposal.md', 'design.md', 'tasks.md', 'execution-contract.md'].includes(a) ||
      a.endsWith('spec.md');
    for (const entry of listing.untracked_artifacts) {
      assert.ok(Array.isArray(entry.artifacts), 'untracked entry must list artifacts');
      assert.ok(
        entry.artifacts.some(isAdoptable),
        `untracked entry must list at least one adoptable artifact, got: ${JSON.stringify(entry.artifacts)}`,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});