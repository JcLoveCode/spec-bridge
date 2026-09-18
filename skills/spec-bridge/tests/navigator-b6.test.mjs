// v1.2 Batch 6 测试（契约 R7 + R8 测试义务）：
// rebuttal 落盘（零状态变更）/ sync 归档守卫 exit 4 / state set 白名单 / hashes archived 漂移提示 / verify 提示。
// 接缝：spawn `node bridge.mjs <args>`（与 init-integration.test.mjs 同构）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-nav-b6-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

const DELTA = `## ADDED Requirements

### Requirement: demo cap

The system SHALL do something.

#### Scenario: it works

- **WHEN** invoked
- **THEN** it works
`;

test('R7 场景 1：rebuttal 落盘 + .bridge.yaml 零状态变更', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    const before = readFileSync(join(root, 'changes', 'demo', '.bridge.yaml'), 'utf-8');
    const result = bridge(['rebuttal', 'changes/demo', 'spec says A but code does B', '--tag', 'spec-drift'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const rebuttalsDir = join(root, 'changes', 'demo', 'rebuttals');
    const files = existsSync(rebuttalsDir) ? readdirSync(rebuttalsDir) : [];
    assert.equal(files.length, 1, `应恰好写一个 rebuttal 文件，实际: ${files}`);
    const content = readFileSync(join(rebuttalsDir, files[0]), 'utf-8');
    assert.match(content, /spec says A but code does B/);
    assert.match(content, /tag\*\*: spec-drift/);
    const after = readFileSync(join(root, 'changes', 'demo', '.bridge.yaml'), 'utf-8');
    assert.equal(after, before, '.bridge.yaml 不得有任何变更');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R8 场景 1：sync 拒绝 archive/ 路径 exit 4', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    mkdirSync(join(root, 'changes', 'archive'), { recursive: true });
    renameSync(join(root, 'changes', 'demo'), join(root, 'changes', 'archive', '2026-09-18-demo'));
    const result = bridge(['sync', 'changes/archive/2026-09-18-demo'], root);
    assert.equal(result.status, 4);
    assert.match(result.stderr, /WRITE-PROTECTED/);
    assert.match(result.stderr, /follow-up/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R8 场景 2：archived change 的 state set 仅放行 stage', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/demo', 'stage', 'archived'], root).status, 0);
    // 非 stage 字段拒绝
    const denied = bridge(['state', 'set', 'changes/demo', 'tags', 'some-tag'], root);
    assert.equal(denied.status, 2);
    assert.match(denied.stderr, /WRITE-PROTECTED/);
    // stage 字段放行（patching 出口需要 parent，这里测 abandoned 终态转换也被路由层接受）
    const allowed = bridge(['state', 'set', 'changes/demo', 'stage', 'abandoned'], root);
    assert.equal(allowed.status, 0, `stderr: ${allowed.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R8 场景 3：archived 漂移提示开 follow-up 而非改原版', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/demo', 'artifacts_hash', 'sha256:pinned'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/demo', 'stage', 'archived'], root).status, 0);
    // 事后篡改产物 → 漂移
    appendFileSync(join(root, 'changes', 'demo', 'proposal.md'), '\nsneaky edit\n', 'utf-8');
    const result = bridge(['hashes', 'changes/demo', '--check'], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /STALE/);
    assert.match(result.stderr, /follow-up/);
    assert.match(result.stderr, /do not edit the original/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R8 附：verify 失败路径提示 rebuttal / follow-up 双轨', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo', '--capability', 'demo-cap'], root).status, 0);
    writeFileSync(join(root, 'changes', 'demo', 'specs', 'demo-cap', 'spec.md'), DELTA, 'utf-8');
    assert.equal(bridge(['sync', 'changes/demo'], root).status, 0);
    // 篡改基线 → verify 失败
    appendFileSync(join(root, 'specs', 'demo-cap', 'spec.md'), '\ntampered\n', 'utf-8');
    const result = bridge(['verify', 'changes/demo'], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /consider: bridge rebuttal/);
    assert.match(result.stderr, /开续作修复|--parent/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
