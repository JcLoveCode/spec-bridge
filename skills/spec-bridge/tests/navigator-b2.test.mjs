// v1.2 Batch 2 测试（契约 R3 测试义务）：
// init --parent 父快照——合法父（快照 hash）/ 父不存在 exit 2 / 父未归档 exit 2 / 归档前缀父可解析。
// 接缝：spawn `node bridge.mjs <args>`（与 init-integration.test.mjs 同构）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-nav-b2-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

function makeArchivedParent(root, name = 'parent-change', hash = 'sha256:deadbeef') {
  assert.equal(bridge(['init', name], root).status, 0);
  assert.equal(bridge(['state', 'set', `changes/${name}`, 'artifacts_hash', hash], root).status, 0);
  assert.equal(bridge(['state', 'set', `changes/${name}`, 'stage', 'archived'], root).status, 0);
}

test('R3 场景 1：合法 archived 父 → 快照 parent + parent_artifacts_hash', () => {
  const root = makeSandbox();
  try {
    makeArchivedParent(root, 'parent-change', 'sha256:abc123');
    const result = bridge(['init', 'child-fix-1', '--parent', 'parent-change'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const state = readFileSync(join(root, 'changes', 'child-fix-1', '.bridge.yaml'), 'utf-8');
    assert.match(state, /parent: parent-change/);
    assert.match(state, /parent_artifacts_hash: sha256:abc123/);
    const log = readFileSync(join(root, 'changes', 'child-fix-1', '.bridge.log'), 'utf-8');
    assert.match(log, /parent=parent-change/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R3 场景 2：父不存在 → exit 2，不创建任何目录', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['init', 'child-fix-1', '--parent', 'ghost'], root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /not found/);
    assert.ok(!existsSync(join(root, 'changes', 'child-fix-1')), '失败时不得创建 change 目录');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R3 场景 3：父未归档（planning）→ exit 2', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'parent-change'], root).status, 0); // stage 仍是 planning
    const result = bridge(['init', 'child-fix-1', '--parent', 'parent-change'], root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /not archived/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R3 加强：父已移入归档目录（<date>-<id> 前缀）仍可解析快照', () => {
  const root = makeSandbox();
  try {
    makeArchivedParent(root, 'parent-change', 'sha256:cafe42');
    mkdirSync(join(root, 'changes', 'archive'), { recursive: true });
    renameSync(join(root, 'changes', 'parent-change'), join(root, 'changes', 'archive', '2026-09-17-parent-change'));
    const result = bridge(['init', 'child-fix-1', '--parent', 'parent-change'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const state = readFileSync(join(root, 'changes', 'child-fix-1', '.bridge.yaml'), 'utf-8');
    assert.match(state, /parent: parent-change/);
    assert.match(state, /parent_artifacts_hash: sha256:cafe42/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
