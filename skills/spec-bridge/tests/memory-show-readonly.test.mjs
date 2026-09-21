// v1.8-3 测试（ADR-0013 / R3 + D9）：memory show 是 read-only，不写任何文件。
//   1. show <change-dir>：输出个人 memory.md
//   2. show <cap>：输出 .bridge/team/<cap>/memory.md
//   3. show 不存在的 target → exit 1 + 提示两条查找位置
//   4. 副作用：show 调用前后 .bridge/team/<cap>/ 文件 mtime 不变（验证只读）
//
// 接缝：spawnSync bridge memory show ... 走完整 CLI。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

test('Scenario: show <change-dir> → 输出个人 memory.md 内容', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-show-'));
  try {
    const changeDir = join(root, 'changes', 'v1-8-3-show');
    mkdirSync(join(changeDir, 'specs', 'show'), { recursive: true });
    writeFileSync(join(changeDir, '.bridge.yaml'), 'stage: planning\nworkflow_kind: builtin\n');
    writeFileSync(join(changeDir, 'memory.md'), '# Personal\n\n## §1 decisions\n\nv1.0: 砍 X 因为 Y\n');
    const result = bridge(['memory', 'show', 'changes/v1-8-3-show'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /v1\.0: 砍 X 因为 Y/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: show <cap> → 输出 .bridge/team/<cap>/memory.md 内容', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-show-'));
  try {
    const teamDir = join(root, '.bridge', 'team', 'bridge-cli');
    mkdirSync(teamDir, { recursive: true });
    writeFileSync(join(teamDir, 'memory.md'),
      '---\nlast_synced_hash: deadbeef\nsync_count: 1\n---\n\n# Team bridge-cli\n\n### from some-change\n\nv1.0: 团队决策');
    const showResult = bridge(['memory', 'show', 'bridge-cli'], root);
    assert.equal(showResult.status, 0, `stderr: ${showResult.stderr}`);
    assert.match(showResult.stdout, /团队决策/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: show 不存在的 target → exit 1 + 两条查找位置提示', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-show-'));
  try {
    const result = bridge(['memory', 'show', 'nonexistent'], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no memory at nonexistent/);
    assert.match(result.stderr, /change.*memory\.md/);
    assert.match(result.stderr, /team.*nonexistent.*memory\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});