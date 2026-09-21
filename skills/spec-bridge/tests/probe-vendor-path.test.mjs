// v1.10-1 Batch 2 测试（C6-C8 + T1）：
// probe 加 advised_skill_path 字段，4 场景覆盖 D3 规则。
// 接缝：spawn `node bridge.mjs probe <args>` 读 stdout 末行文本（沿用 v1.7/v1.8-1 seam）
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
  const dir = mkdtempSync(join(tmpdir(), 'bridge-v1101-b2-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

// v1.10-1 D3：仅当 advised_skill 有值且为外栈且 vendor 内置时输出 advised_skill_path。
test('T1.1: advised_skill=(none) → 不输出 advised_skill_path', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    // 无 --inventory = advised_skill = (none)
    r = bridge(['probe', 'changes/demo'], root);
    assert.equal(r.status, 0, `probe stderr: ${r.stderr}`);
    assert.match(r.stdout, /advised_skill: \(none\)/);
    assert.doesNotMatch(r.stdout, /^advised_skill_path:/m, 'advised_skill=(none) 时不应输出 advised_skill_path');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('T1.2: advised_skill=matt 且 vendor 内置 → 输出 advised_skill_path', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo'], root);
    assert.equal(r.status, 0);
    r = bridge(['probe', 'changes/demo', '--inventory', 'matt to-spec'], root);
    assert.equal(r.status, 0, `probe stderr: ${r.stderr}`);
    assert.match(r.stdout, /advised_skill: matt/);
    assert.match(r.stdout, /^advised_skill_path: skills\/external-matt\/engineering\/to-spec\/SKILL\.md$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('T1.3: advised_skill=openspec 但 vendor 未内置 → 不输出 advised_skill_path', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo'], root);
    assert.equal(r.status, 0);
    r = bridge(['probe', 'changes/demo', '--inventory', 'openspec propose'], root);
    assert.equal(r.status, 0, `probe stderr: ${r.stderr}`);
    assert.match(r.stdout, /advised_skill: openspec/);
    assert.match(r.stdout, /advised_invocation: use_skill openspec-propose/);
    assert.doesNotMatch(r.stdout, /^advised_skill_path:/m, 'openspec 未 vendor，不应输出 advised_skill_path');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('T1.4: advised_skill=(none) 兜底（含 builtin 子串也落到 (none)） → 不输出 advised_skill_path', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo'], root);
    assert.equal(r.status, 0);
    // 'builtin' 在 4 级路由中不匹配 superpowers/matt/openspec，落到 (none) 兜底
    // v1.8-2 pure-bridge 模式：bridge 不再推荐 builtin 模板
    r = bridge(['probe', 'changes/demo', '--inventory', 'builtin'], root);
    assert.equal(r.status, 0, `probe stderr: ${r.stderr}`);
    assert.match(r.stdout, /^advised_skill: \(none\)$/m);
    assert.match(r.stdout, /bridge 不写模板/);
    assert.doesNotMatch(r.stdout, /^advised_skill_path:/m, '(none) 兜底不应输出 advised_skill_path');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});