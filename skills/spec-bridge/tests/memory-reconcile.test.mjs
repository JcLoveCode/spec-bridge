// v1.8-3 测试（ADR-0013 / D8 reconcile）：reconcile 不删任何决策段，只标 metadata。
//   1. reconcile --cap <cap> → 写 last_reconciled_by/at + 插入注释 tag（不删决策段）
//   2. reconcile --include-orphaned（无 --cap） → 标 orphaned/memory.md
//   3. 二次 reconcile 同日 → no-op（已存在 tag 不重写）
//
// 接缝：spawnSync bridge memory reconcile ... 走完整 CLI。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function setupTeam(root, cap, withContent = true) {
  const teamDir = join(root, '.bridge', 'team', cap);
  mkdirSync(teamDir, { recursive: true });
  if (withContent) {
    writeFileSync(join(teamDir, 'memory.md'),
      '---\nlast_synced_hash: deadbeef\nlast_synced_at: 2026-09-21\nsync_count: 3\n---\n\n# Team ' + cap + '\n\n### from some-change (2026-09-20)\n\nv1.0: 决策 A\n');
  }
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

test('Scenario: reconcile --cap <cap> → 标 last_reconciled_by/at + 注释 tag；决策段不删', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-reconcile-'));
  try {
    setupTeam(root, 'bridge-cli');
    const capFile = join(root, '.bridge', 'team', 'bridge-cli', 'memory.md');
    const before = readFileSync(capFile, 'utf8');
    assert.ok(before.includes('### from some-change'));
    assert.ok(before.includes('v1.0: 决策 A'));
    const result = bridge(['memory', 'reconcile', '--cap', 'bridge-cli'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const after = readFileSync(capFile, 'utf8');
    assert.ok(after.includes('### from some-change'), 'decision block must remain');
    assert.ok(after.includes('v1.0: 决策 A'), 'decision content must remain');
    assert.match(after, /<!-- reconcile \d{4}-\d{2}-\d{2} by .* \(no deletions; metadata only\) -->/);
    assert.match(after, /last_reconciled_by: /);
    assert.match(after, /last_reconciled_at: \d{4}-\d{2}-\d{2}/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: reconcile --include-orphaned（无 --cap） → 标 orphaned/memory.md', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-reconcile-'));
  try {
    setupTeam(root, 'orphaned');
    const orphanFile = join(root, '.bridge', 'team', 'orphaned', 'memory.md');
    const result = bridge(['memory', 'reconcile', '--include-orphaned'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const after = readFileSync(orphanFile, 'utf8');
    assert.match(after, /<!-- reconcile \d{4}-\d{2}-\d{2} by .* -->/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 二次 reconcile 同日 → no-op', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-reconcile-'));
  try {
    setupTeam(root, 'bridge-cli');
    const capFile = join(root, '.bridge', 'team', 'bridge-cli', 'memory.md');
    bridge(['memory', 'reconcile', '--cap', 'bridge-cli'], root);
    const second = bridge(['memory', 'reconcile', '--cap', 'bridge-cli'], root);
    assert.equal(second.status, 0);
    assert.match(second.stdout, /already reconciled|no-op/i);
    const after = readFileSync(capFile, 'utf8');
    // 注释 tag 只出现 1 次
    const tagMatches = after.match(/<!-- reconcile \d{4}-\d{2}-\d{2}/g);
    assert.equal(tagMatches.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});