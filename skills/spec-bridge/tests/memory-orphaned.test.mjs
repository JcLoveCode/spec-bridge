// v1.8-3 测试（ADR-0013 / D8）：cap 归属不明 → 落 .bridge/team/orphaned/
//   1. 空 capabilities → 落 orphaned
//   2. 多 capabilities → 落 orphaned（设计意图：避免歧义）
//   3. capabilities=null（YAML 写 null） → 落 orphaned
//   4. orphaned 文件夹下团队文件可被人审 + reconcile --cap <cap> --include-orphaned 接管
//
// 接缝：直接 import syncTeamMemory 纯函数 + 用 mkdtempSync 建隔离根目录。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncTeamMemory } from '../scripts/cmd-memory.mjs';

function makeChange(root, name, { capabilitiesYaml }) {
  const changeDir = join(root, 'changes', name);
  mkdirSync(join(changeDir, 'specs', name), { recursive: true });
  writeFileSync(join(changeDir, '.bridge.yaml'),
    `stage: executing\nworkflow_kind: builtin\ncapabilities: ${capabilitiesYaml}\n`);
  writeFileSync(join(changeDir, '.bridge.log'), '');
  writeFileSync(join(changeDir, 'memory.md'),
    `# Personal\n\n## §1 decisions\n\nv1.0: 砍 X 因为 Y\n\n## §2 obstacles\n\n(placeholder)\n`);
  return changeDir;
}

test('Scenario: 空 capabilities → 落 orphaned', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-orphan-'));
  try {
    const changeDir = makeChange(root, 'v1-8-3-empty', { capabilitiesYaml: 'null' });
    const result = syncTeamMemory(changeDir);
    assert.equal(result.ok, true);
    assert.equal(result.target, 'orphaned');
    assert.equal(result.kind, 'orphaned');
    const teamPath = join(root, '.bridge', 'team', 'orphaned', 'memory.md');
    assert.ok(existsSync(teamPath));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 多 capabilities（不一致）→ 落 orphaned', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-orphan-'));
  try {
    const changeDir = makeChange(root, 'v1-8-3-multi', { capabilitiesYaml: 'cli,nuxi' });
    const result = syncTeamMemory(changeDir);
    assert.equal(result.ok, true);
    assert.equal(result.target, 'orphaned');
    assert.equal(result.kind, 'orphaned');
    const teamPath = join(root, '.bridge', 'team', 'orphaned', 'memory.md');
    assert.ok(existsSync(teamPath));
    const content = readFileSync(teamPath, 'utf8');
    assert.match(content, /v1\.0: 砍 X 因为 Y/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 字符串 capabilities 但单值 → 落 cap（不被 orphaned 误判）', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-v183-orphan-'));
  try {
    const changeDir = makeChange(root, 'v1-8-3-single', { capabilitiesYaml: 'bridge-cli' });
    const result = syncTeamMemory(changeDir);
    assert.equal(result.ok, true);
    assert.equal(result.target, 'bridge-cli');
    assert.equal(result.kind, 'cap');
    assert.ok(!existsSync(join(root, '.bridge', 'team', 'orphaned', 'memory.md')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});