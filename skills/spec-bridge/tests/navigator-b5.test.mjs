// v1.2 Batch 5 测试（契约 R6 测试义务）：
// mention / rootcause 信号——首次无建议 / 第二次触发建议行 / root-cause 前缀 / 跨 change 计数。
// 接缝：spawn `node bridge.mjs <args>`（与 init-integration.test.mjs 同构）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-nav-b5-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

test('R6 场景 1：首次提及——事件入台账，计数 1，无建议行', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    const result = bridge(['mention', 'changes/demo', '--tag', 'authz-bypass', '--note', 'found in users API'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /mention: tag=authz-bypass note=found in users API/);
    assert.match(result.stdout, /ledger history: 1 time/);
    assert.doesNotMatch(result.stdout, /→ recurring/);
    const log = readFileSync(join(root, 'changes', 'demo', '.bridge.log'), 'utf-8');
    assert.match(log, /mention: tag=authz-bypass/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R6 场景 2：第二次同 tag——建议行触发', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    assert.equal(bridge(['mention', 'changes/demo', '--tag', 'authz-bypass'], root).status, 0);
    const second = bridge(['mention', 'changes/demo', '--tag', 'authz-bypass'], root);
    assert.equal(second.status, 0);
    assert.match(second.stdout, /ledger history: 2 times/);
    assert.match(second.stdout, /→ recurring.*bridge pattern --tag authz-bypass/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R6 场景 3：rootcause 事件以 root-cause 前缀记录', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    const result = bridge(['rootcause', 'changes/demo', '--tag', 'authz-bypass', '--note', 'missing guard'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /root-cause: tag=authz-bypass note=missing guard/);
    const log = readFileSync(join(root, 'changes', 'demo', '.bridge.log'), 'utf-8');
    assert.match(log, /root-cause: tag=authz-bypass/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R6 加强：跨 change 计数——另一 change 的历史 mention 计入', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'change-a'], root).status, 0);
    assert.equal(bridge(['init', 'change-b'], root).status, 0);
    assert.equal(bridge(['mention', 'changes/change-a', '--tag', 'authz-bypass'], root).status, 0);
    const result = bridge(['mention', 'changes/change-b', '--tag', 'authz-bypass'], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /ledger history: 2 times/);
    assert.match(result.stdout, /→ recurring/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R6 加强：缺 --tag → usage exit 2；目录无效 → exit 1', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'ghost'], root).status, 0);
    assert.equal(bridge(['mention', 'changes/ghost', '--tag', 'x'], root).status, 0);
    assert.equal(bridge(['mention', 'changes/ghost'], root).status, 2);
    assert.equal(bridge(['mention', 'changes/nowhere', '--tag', 'x'], root).status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
