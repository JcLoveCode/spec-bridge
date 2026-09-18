// v1.3 Batch 1 测试（exec R2 测试义务）：
// bridge next 按 stage + workflow_kind 路由 use_skill 推荐（仅推荐不执行，ADR-0004 不代理）。
// 接缝同 navigator-b3.test.mjs：spawn `node bridge.mjs <args>`。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-xrouter-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

// R2 场景 1：executing + openspec → protocol 段含 openspec-apply-change + test-driven-development
test('R2 场景 1：executing + workflow_kind=openspec 推荐 openspec-apply-change + TDD', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo', '--workflow-kind', 'openspec'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/demo', 'stage', 'executing'], root).status, 0);
    const result = bridge(['next', 'changes/demo'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^stage:\s+executing$/m);
    assert.match(result.stdout, /^→ protocol:$/m, 'must emit `→ protocol:` header in executing+openspec');
    assert.match(result.stdout, /→ use_skill openspec-apply-change/);
    assert.match(result.stdout, /→ use_skill test-driven-development/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R2 场景 2：planning 阶段不输出 protocol 段（路由不污染前置阶段）
test('R2 场景 2：planning 阶段不输出 protocol 段（路由不污染前置阶段）', () => {
  const root = makeSandbox();
  try {
    bridge(['init', 'demo'], root);
    // stage 默认 = planning
    const result = bridge(['next', 'changes/demo'], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^stage:\s+planning$/m);
    assert.doesNotMatch(result.stdout, /^→ protocol:$/m, 'planning must not emit protocol header');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R2 场景 3：archived 终态不输出 protocol 段
test('R2 场景 3：archived 终态不输出 protocol 段', () => {
  const root = makeSandbox();
  try {
    bridge(['init', 'demo'], root);
    bridge(['state', 'set', 'changes/demo', 'stage', 'archived'], root);
    const result = bridge(['next', 'changes/demo'], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^stage:\s+archived$/m);
    assert.doesNotMatch(result.stdout, /^→ protocol:$/m, 'archived must not emit protocol header');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R2 场景 4：matt kind planning 推荐 grill-with-docs（小雾）+ wayfinder（大雾）
test('R2 场景 4：matt kind + planning 推荐 grill-with-docs + wayfinder（D8 wayfinder 档位）', () => {
  const root = makeSandbox();
  try {
    bridge(['init', 'demo', '--workflow-kind', 'matt'], root);
    // stage = planning (default)
    const result = bridge(['next', 'changes/demo'], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^stage:\s+planning$/m);
    assert.match(result.stdout, /^→ protocol:$/m, 'planning + matt must emit protocol header');
    assert.match(result.stdout, /→ use_skill grill-with-docs/);
    assert.match(result.stdout, /→ use_skill wayfinder/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});