// tests/probe-active-navigator.test.mjs — v1.7 Batch 1 测试
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
  const dir = mkdtempSync(join(tmpdir(), 'bridge-probe-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

test('R1: bridge probe 命令存在且 D5 输出完整', () => {
  const root = makeSandbox();
  try {
    bridge(['init', 'demo'], root);
    const result = bridge(['probe', 'changes/demo'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^project_type: /m);
    assert.match(result.stdout, /^capabilities: /m);
    assert.match(result.stdout, /^stage: /m);
    assert.match(result.stdout, /^inventory: /m);
    assert.match(result.stdout, /^advised_skill: /m);
    assert.match(result.stdout, /^advised_reason: /m);
    assert.match(result.stdout, /^next_hint: /m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('R2 场景 1：inventory 含 superpowers → 路由到 superpowers', () => {
  const root = makeSandbox();
  try {
    bridge(['init', 'demo'], root);
    const result = bridge(['probe', 'changes/demo', '--inventory', 'superpowers:test-driven-development,openspec:foo'], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^advised_skill: superpowers:test-driven-development$/m);
    assert.match(result.stdout, /^advised_reason: .*优先级 1/m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('R2 场景 2：inventory 只含 matt（无 superpowers）→ 路由到 matt', () => {
  const root = makeSandbox();
  try {
    bridge(['init', 'demo'], root);
    const result = bridge(['probe', 'changes/demo', '--inventory', 'matt:spec-executor,openspec:foo'], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^advised_skill: matt:spec-executor$/m);
    assert.match(result.stdout, /^advised_reason: .*优先级 2/m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('R2 场景 3：inventory 只含 openspec → 路由到 openspec', () => {
  const root = makeSandbox();
  try {
    bridge(['init', 'demo'], root);
    const result = bridge(['probe', 'changes/demo', '--inventory', 'openspec:apply-change'], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^advised_skill: openspec:apply-change$/m);
    assert.match(result.stdout, /^advised_reason: .*优先级 3/m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('R2 场景 4（v1.8-2 纯桥）：inventory 空 → 兜底 (none) + 新文案引导 brainstorming', () => {
  const root = makeSandbox();
  try {
    bridge(['init', 'demo'], root);
    const result = bridge(['probe', 'changes/demo'], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^advised_skill: \(none\)$/m);
    // v1.8-2 (ADR-0012 D4)：fallback reason 改为引导 brainstorming/自由发挥
    assert.match(result.stdout, /bridge 不写模板，请 AI 用 brainstorming 或直接编辑自由发挥/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('R3：change-dir 缺失时 exit 2', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['probe'], root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage: bridge probe/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// === v1.7 hotfix：C9 隐式 change-dir fallback ===

test('R4 场景 1：仓库根 + 单个 change → 自动 fallback 成功', () => {
  const root = makeSandbox();
  try {
    bridge(['init', 'demo'], root);
    const result = bridge(['probe', '.'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^advised_skill: \(none\)$/m);
    assert.match(result.stderr, /\[hint\] no \.bridge\.yaml under .* resolved implicit change-dir/m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('R4 场景 2：仓库根 + 多个 change → ambiguous 错误 exit 2', () => {
  const root = makeSandbox();
  try {
    bridge(['init', 'alpha'], root);
    bridge(['init', 'beta'], root);
    const result = bridge(['probe', '.'], root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /ambiguous: found 2 change dirs/);
    assert.match(result.stderr, /specify one explicitly/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('R4 场景 3：仓库根 + 无 change → 原错误保留 exit 1', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['probe', '.'], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no \.bridge\.yaml under/);
    assert.doesNotMatch(result.stderr, /ambiguous/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('R4 场景 4：用户显式给非 cwd 路径且无 .bridge.yaml → 不 fallback exit 1', () => {
  const root = makeSandbox();
  const otherRoot = makeSandbox();
  try {
    bridge(['init', 'demo'], root);
    const result = bridge(['probe', otherRoot], root);
    assert.equal(result.status, 1, `stderr: ${result.stderr}`);
    assert.match(result.stderr, /no \.bridge\.yaml under/);
    assert.doesNotMatch(result.stderr, /resolved implicit change-dir/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(otherRoot, { recursive: true, force: true });
  }
});