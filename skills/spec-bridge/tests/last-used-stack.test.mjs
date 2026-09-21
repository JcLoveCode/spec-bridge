// tests/last-used-stack.test.mjs — v1.9-3 context-aware navigator
// 验证：lastUsedStack 自动记录 + 推荐优先级
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const BRIDGE = new URL('../scripts/bridge.mjs', import.meta.url).pathname;

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-v193-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

function rmTmp(root) {
  try { rmSync(root, { recursive: true, force: true }); } catch {}
}

function readConfig(tmp) {
  return JSON.parse(readFileSync(join(tmp, '.bridge-config.json'), 'utf8'));
}

test('v1.9-3: init 自动记录 lastUsedStack', () => {
  const tmp = makeSandbox();
  try {
    // 配置成 matt
    bridge(['stacks', 'set', 'matt'], tmp);

    const result = bridge(['init', 'test-change'], tmp);
    assert.equal(result.status, 0, `init stderr: ${result.stderr}`);

    const cfg = readConfig(tmp);
    assert.equal(cfg.lastUsedStack, 'matt', `lastUsedStack 应为 matt，实际为 ${cfg.lastUsedStack}`);
  } finally {
    rmTmp(tmp);
  }
});

test('v1.9-3: adopt 自动记录 lastUsedStack', () => {
  const tmp = makeSandbox();
  try {
    const changeDir = join(tmp, 'changes', 'test-change');
    mkdirSync(join(changeDir, 'specs', 'cap'), { recursive: true });
    writeFileSync(join(changeDir, 'proposal.md'), '# Proposal');

    const result = bridge(['adopt', changeDir, '--stack', 'openspec'], tmp);
    assert.equal(result.status, 0, `adopt stderr: ${result.stderr}`);

    const cfg = readConfig(tmp);
    assert.equal(cfg.lastUsedStack, 'openspec', `lastUsedStack 应为 openspec`);
  } finally {
    rmTmp(tmp);
  }
});

test('v1.9-3: probe stack_hint 优先使用 lastUsedStack 而非 stacks[0]', () => {
  const tmp = makeSandbox();
  try {
    bridge(['stacks', 'set', 'openspec'], tmp);
    // 手动设置 lastUsedStack 为 matt（模拟上次用了 matt）
    const cfg = JSON.parse(readFileSync(join(tmp, '.bridge-config.json'), 'utf8'));
    cfg.lastUsedStack = 'matt';
    writeFileSync(join(tmp, '.bridge-config.json'), JSON.stringify(cfg));

    const changeDir = join(tmp, 'changes', 'test-change');
    mkdirSync(join(changeDir, 'specs', 'cap'), { recursive: true });
    writeFileSync(join(changeDir, '.bridge.yaml'), 'stage: planning\n');

    const result = bridge(['probe', changeDir], tmp);
    assert.equal(result.status, 0, `probe stderr: ${result.stderr}`);
    // stack_hint 应为 matt（lastUsedStack），不是 openspec（stacks[0]）
    assert.match(result.stdout, /stack_hint: matt/, `stack_hint 应为 matt，实际：${result.stdout}`);
    assert.match(result.stdout, /last_used: matt/, `last_used 应为 matt`);
  } finally {
    rmTmp(tmp);
  }
});

test('v1.9-3: probe 无 lastUsedStack 时回退 stacks[0]', () => {
  const tmp = makeSandbox();
  try {
    bridge(['stacks', 'set', 'matt,superpowers'], tmp);
    // 确保 lastUsedStack 为 null
    const cfg = readConfig(tmp);
    assert.equal(cfg.lastUsedStack, null);

    const changeDir = join(tmp, 'changes', 'test-change');
    mkdirSync(join(changeDir, 'specs', 'cap'), { recursive: true });
    writeFileSync(join(changeDir, '.bridge.yaml'), 'stage: planning\n');

    const result = bridge(['probe', changeDir], tmp);
    assert.equal(result.status, 0, `probe stderr: ${result.stderr}`);
    assert.match(result.stdout, /stack_hint: matt/, `stack_hint 应回退到 stacks[0]=matt`);
    assert.match(result.stdout, /last_used: \(unset\)/, `last_used 应为 unset`);
  } finally {
    rmTmp(tmp);
  }
});

test('v1.9-3: stacks reset-used 重置 lastUsedStack', () => {
  const tmp = makeSandbox();
  try {
    bridge(['stacks', 'set', 'matt'], tmp);
    bridge(['init', 'test-change'], tmp);

    const cfgBefore = readConfig(tmp);
    assert.equal(cfgBefore.lastUsedStack, 'matt', 'lastUsedStack 应被记录为 matt');

    const result = bridge(['stacks', 'reset-used'], tmp);
    assert.equal(result.status, 0, `reset-used stderr: ${result.stderr}`);
    assert.match(result.stdout, /Last-used stack reset/);

    const cfgAfter = readConfig(tmp);
    assert.equal(cfgAfter.lastUsedStack, null, 'reset 后 lastUsedStack 应为 null');
  } finally {
    rmTmp(tmp);
  }
});