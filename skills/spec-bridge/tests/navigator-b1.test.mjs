// v1.2 Batch 1 测试（契约 R1 + R4 测试义务）：
// R1 workflow_kind 三级推导（显式 > capabilities 首值 > builtin）+ 非法值拒绝
// R4 patching 旁路校验（无 parent 拒绝 / 父未归档拒绝 / 合法父放行）
// 接缝：spawn `node bridge.mjs <args>`（与 init-integration.test.mjs 同构）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-nav-b1-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

function readYamlField(root, change, field) {
  const raw = readFileSync(join(root, 'changes', change, '.bridge.yaml'), 'utf-8');
  const match = raw.match(new RegExp(`^${field}: (.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

test('R1 场景 1：显式 --workflow-kind 优先于 capabilities', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['init', 'demo', '--workflow-kind', 'matt', '--capabilities', 'builtin'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(readYamlField(root, 'demo', 'workflow_kind'), 'matt');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R1 场景 2：缺省从 --capabilities 首值推导（首值须在值域内）', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['init', 'demo', '--capabilities', 'matt,tdd'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(readYamlField(root, 'demo', 'workflow_kind'), 'matt');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R1 场景 3：双缺省回落 builtin', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['init', 'demo'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(readYamlField(root, 'demo', 'workflow_kind'), 'builtin');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R1 加强：capabilities 首值不在值域 → 回落 builtin 而非报错', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['init', 'demo', '--capabilities', 'tdd,code-review'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(readYamlField(root, 'demo', 'workflow_kind'), 'builtin');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R1 加强：显式 --workflow-kind 非法值 → exit 2', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['init', 'demo', '--workflow-kind', 'foo'], root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /invalid --workflow-kind/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R4 场景 1：无 parent 转 patching 被拒 exit 2，stage 保持原值', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    const result = bridge(['state', 'set', 'changes/demo', 'stage', 'patching'], root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /patching requires a parent/);
    assert.equal(readYamlField(root, 'demo', 'stage'), 'planning');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R4 场景 2：父未归档 → 拒绝 exit 2', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'parent-change'], root).status, 0);
    assert.equal(bridge(['init', 'child'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/child', 'parent', 'parent-change'], root).status, 0);
    const result = bridge(['state', 'set', 'changes/child', 'stage', 'patching'], root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /not archived/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R4 场景 3：合法 archived 父 → patching 放行 + 事件记录', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'parent-change'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/parent-change', 'stage', 'archived'], root).status, 0);
    assert.equal(bridge(['init', 'child'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/child', 'parent', 'parent-change'], root).status, 0);
    const result = bridge(['state', 'set', 'changes/child', 'stage', 'patching'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(readYamlField(root, 'child', 'stage'), 'patching');
    const log = readFileSync(join(root, 'changes', 'child', '.bridge.log'), 'utf-8');
    assert.match(log, /stage: planning → patching|patching/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R4 加强：parent 引用不存在的 change → 拒绝 exit 2', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'child'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/child', 'parent', 'ghost'], root).status, 0);
    const result = bridge(['state', 'set', 'changes/child', 'stage', 'patching'], root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /not found/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R4 加强：父在归档目录（<date>-<id> 前缀）也能被解析', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'parent-change'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/parent-change', 'stage', 'archived'], root).status, 0);
    mkdirSync(join(root, 'changes', 'archive'), { recursive: true });
    renameSync(join(root, 'changes', 'parent-change'), join(root, 'changes', 'archive', '2026-09-18-parent-change'));
    assert.equal(bridge(['init', 'child'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/child', 'parent', 'parent-change'], root).status, 0);
    const result = bridge(['state', 'set', 'changes/child', 'stage', 'patching'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(readYamlField(root, 'child', 'stage'), 'patching');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
