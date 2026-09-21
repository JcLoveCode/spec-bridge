// v1.8-3 测试（ADR-0013 / R6 + D6）：memory sync 子命令 CLI 算 sha256 校验一致性。
//   1. 首次 sync：capabilities 有 → 写 .bridge/team/<cap>/memory.md 含 frontmatter + 决策段
//   2. 二次 sync 一致：决策段未变 → no-op（sync_count 不递增）
//   3. 二次 sync 不一致：决策段追加了新行 → 同步追加新段 + sync_count=2
//   4. 跨 change 累计：capabilities 相同的两个 change 都 sync → team/<cap>/memory.md 含 2 个 from 块
//   5. 失败不 archive：sync 失败时 archive 不回滚（这里只测 sync 本身 ok=false 路径）
//
// 接缝：直接 import syncTeamMemory 纯函数 + 用 mkdtempSync 建隔离根目录。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncTeamMemory } from '../scripts/cmd-memory.mjs';

function makeChangeWithMemory(root, name, { capabilities = ['bridge-cli'], decisions = ['v1.0: 砍 X 因为 Y'] } = {}) {
  const changeDir = join(root, 'changes', name);
  mkdirSync(join(changeDir, 'specs', name), { recursive: true });
  const capsYaml = Array.isArray(capabilities) ? capabilities.join(',') : capabilities;
  writeFileSync(join(changeDir, '.bridge.yaml'),
    `stage: executing\nworkflow_kind: builtin\ncapabilities: ${capsYaml}\n`);
  writeFileSync(join(changeDir, '.bridge.log'), '');
  writeFileSync(join(changeDir, 'memory.md'),
    `# Personal\n\n## §1 decisions\n\n${decisions.join('\n')}\n\n## §2 obstacles\n\n(placeholder)\n`);
  return changeDir;
}

test('Scenario: 首次 sync → 写 .bridge/team/<cap>/memory.md（frontmatter + 决策段）', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-sync-'));
  try {
    const changeDir = makeChangeWithMemory(root, 'v1-8-3-test', { capabilities: ['bridge-cli'] });
    const result = syncTeamMemory(changeDir);
    assert.equal(result.ok, true);
    assert.equal(result.noop, false);
    assert.equal(result.target, 'bridge-cli');
    assert.equal(result.syncCount, 1);
    assert.equal(result.decisionsCount, 1);
    const teamPath = join(root, '.bridge', 'team', 'bridge-cli', 'memory.md');
    assert.ok(existsSync(teamPath), `team memory file should exist at ${teamPath}`);
    const content = readFileSync(teamPath, 'utf8');
    assert.match(content, /^---\n/);
    assert.match(content, /last_synced_hash: [a-f0-9]{64}/);
    assert.match(content, /sync_count: 1/);
    assert.match(content, /### from v1-8-3-test/);
    assert.match(content, /v1\.0: 砍 X 因为 Y/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 二次 sync 决策未变 → no-op（sync_count 不递增）', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-sync-'));
  try {
    const changeDir = makeChangeWithMemory(root, 'v1-8-3-test', { capabilities: ['bridge-cli'] });
    syncTeamMemory(changeDir); // 首次
    const second = syncTeamMemory(changeDir);
    assert.equal(second.ok, true);
    assert.equal(second.noop, true);
    assert.equal(second.target, 'bridge-cli');
    const teamPath = join(root, '.bridge', 'team', 'bridge-cli', 'memory.md');
    const content = readFileSync(teamPath, 'utf8');
    assert.match(content, /sync_count: 1/); // 不递增
    // from 块只出现 1 次
    const fromMatches = content.match(/### from/g);
    assert.equal(fromMatches.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 二次 sync 决策追加 → 同步追加新段 + sync_count=2', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-sync-'));
  try {
    const changeDir = makeChangeWithMemory(root, 'v1-8-3-test', {
      capabilities: ['bridge-cli'],
      decisions: ['v1.0: 砍 X 因为 Y'],
    });
    syncTeamMemory(changeDir);
    // 追加决策
    writeFileSync(join(changeDir, 'memory.md'),
      `# Personal\n\n## §1 decisions\n\nv1.0: 砍 X 因为 Y\nv1.1: 加 Y 因为 Z\n\n## §2 obstacles\n\n(placeholder)\n`);
    const second = syncTeamMemory(changeDir);
    assert.equal(second.ok, true);
    assert.equal(second.noop, false);
    assert.equal(second.syncCount, 2);
    assert.equal(second.decisionsCount, 2);
    const teamPath = join(root, '.bridge', 'team', 'bridge-cli', 'memory.md');
    const content = readFileSync(teamPath, 'utf8');
    assert.match(content, /sync_count: 2/);
    const fromMatches = content.match(/### from/g);
    assert.equal(fromMatches.length, 2);
    assert.match(content, /v1\.1: 加 Y 因为 Z/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 跨 change 累计（同一 cap）→ team/<cap>/memory.md 含多个 from 块', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-sync-'));
  try {
    const c1 = makeChangeWithMemory(root, 'v1-8-3-a', {
      capabilities: ['bridge-cli'],
      decisions: ['v1.0: 砍 X 因为 Y'],
    });
    const c2 = makeChangeWithMemory(root, 'v1-8-3-b', {
      capabilities: ['bridge-cli'],
      decisions: ['v1.1: 加 Y 因为 Z'],  // 不同决策 → 不同 hash → 否则 no-op
    });
    syncTeamMemory(c1);
    syncTeamMemory(c2);
    const teamPath = join(root, '.bridge', 'team', 'bridge-cli', 'memory.md');
    const content = readFileSync(teamPath, 'utf8');
    const fromMatches = content.match(/### from/g);
    assert.equal(fromMatches.length, 2);
    assert.match(content, /from v1-8-3-a/);
    assert.match(content, /from v1-8-3-b/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 失败路径 — 无 memory.md → ok=false reason=no_memory', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-sync-'));
  try {
    const changeDir = join(root, 'changes', 'v1-8-3-empty');
    mkdirSync(changeDir, { recursive: true });
    writeFileSync(join(changeDir, '.bridge.yaml'),
      `stage: executing\nworkflow_kind: builtin\ncapabilities: bridge-cli\n`);
    const result = syncTeamMemory(changeDir);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no_memory');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});