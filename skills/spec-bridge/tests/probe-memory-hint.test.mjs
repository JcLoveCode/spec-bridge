// v1.8-3 测试（ADR-0013 D4）：probe 输出 memory_hint 三态 + team caps。
//   1. IDE 在场 → personal=ide(.codebuddy/memory/,daily=N,curated=N); team_caps=(none); team_lines=0
//   2. IDE 不在场 + 个人 memory.md 在场 → personal=bridge(<path>,lines=N)
//   3. 两者都不在场 → personal=none(empty)
//   4. team_caps 遍历 .bridge/team/*/memory.md
//
// 接缝：spawn `node bridge.mjs probe <changeDir>` → 解析 stdout memory_hint: 行。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-v183-probe-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

function makeChange(root, name, { withIde = false, withPersonal = false, teamCaps = [] } = {}) {
  const changeDir = join(root, 'changes', name);
  mkdirSync(join(changeDir, 'specs', name), { recursive: true });
  writeFileSync(join(changeDir, '.bridge.yaml'), `stage: planning\nworkflow_kind: builtin\n`);
  writeFileSync(join(changeDir, '.bridge.log'), '');
  if (withIde) {
    const ideDir = join(root, '.codebuddy', 'memory');
    mkdirSync(ideDir, { recursive: true });
    writeFileSync(join(ideDir, 'MEMORY.md'), '# Curated\n\nline1\nline2\n');
    writeFileSync(join(ideDir, '2026-09-21.md'), '# daily\n');
  }
  if (withPersonal) {
    writeFileSync(join(changeDir, 'memory.md'), '# Personal\n\ndecision 1\ndecision 2\n');
  }
  if (teamCaps.length > 0) {
    for (const cap of teamCaps) {
      mkdirSync(join(root, '.bridge', 'team', cap), { recursive: true });
      writeFileSync(join(root, '.bridge', 'team', cap, 'memory.md'),
        `# Team ${cap}\ndecision A\ndecision B\ndecision C\n`);
    }
  }
  return changeDir;
}

function parseMemoryHint(stdout) {
  const m = stdout.match(/^memory_hint:\s*(.+)$/m);
  return m ? m[1] : null;
}

// R4 场景 A：IDE 在场 → personal=ide
test('R4-A: probe memory_hint — IDE 在场 → personal=ide(...)', () => {
  const root = makeSandbox();
  try {
    makeChange(root, 'foo', { withIde: true });
    const r = bridge(['probe', 'changes/foo'], root);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const hint = parseMemoryHint(r.stdout);
    assert.match(hint, /^personal=ide\(\.codebuddy\/memory\/,daily=\d+,curated=\d+\)/);
    assert.match(hint, /team_caps=\(none\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R4 场景 B：IDE 不在场 + 个人 memory.md 在场 → personal=bridge
test('R4-B: probe memory_hint — 个人 memory.md 在场 → personal=bridge(...)', () => {
  const root = makeSandbox();
  try {
    makeChange(root, 'foo', { withPersonal: true });
    const r = bridge(['probe', 'changes/foo'], root);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const hint = parseMemoryHint(r.stdout);
    assert.match(hint, /^personal=bridge\(.+\/changes\/foo\/memory\.md,lines=\d+\)/);
    assert.match(hint, /team_caps=\(none\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R4 场景 C：两者都不在场 → personal=none
test('R4-C: probe memory_hint — 两者都不在场 → personal=none(empty)', () => {
  const root = makeSandbox();
  try {
    makeChange(root, 'foo', {});
    const r = bridge(['probe', 'changes/foo'], root);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const hint = parseMemoryHint(r.stdout);
    assert.match(hint, /^personal=none\(empty\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R4 场景 D：team_caps 遍历 .bridge/team/*/memory.md
test('R4-D: probe memory_hint — team_caps 含 cap 列表 + team_lines 总行数', () => {
  const root = makeSandbox();
  try {
    makeChange(root, 'foo', { teamCaps: ['default', 'v1-8-3'] });
    const r = bridge(['probe', 'changes/foo'], root);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const hint = parseMemoryHint(r.stdout);
    assert.match(hint, /team_caps=default,v1-8-3/);
    // 每个 cap memory.md 4 行非空 → 总 8
    assert.match(hint, /team_lines=8/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});