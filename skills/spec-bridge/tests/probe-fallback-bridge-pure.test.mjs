// v1.8-2 测试（ADR-0012 D4 probe fallback 文案）：
// R4 测试义务：probe 无 inventory 时 advised_skill=(none) + 新文案引导 brainstorming/自由发挥。
//
// 接缝同 init-auto-probe.test.mjs B2 T4：spawn `node bridge.mjs probe ...`。
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
  const dir = mkdtempSync(join(tmpdir(), 'bridge-v182-fallback-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

// R4 场景 A：空 inventory → advised_skill=(none) + 新文案引导 brainstorming
test('R4-A: 空 inventory → advised_skill=(none) + advised_reason 引导 brainstorming/自由发挥', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo', '--no-auto-probe'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    r = bridge(['probe', 'changes/demo'], root);
    assert.equal(r.status, 0, `probe stderr: ${r.stderr}`);
    // v1.8-2 (ADR-0012 D4) 新文案
    assert.match(r.stdout, /advised_skill: \(none\)/);
    assert.match(r.stdout, /advised_reason: inventory 未含任何已知栈 skill — bridge 不写模板，请 AI 用 brainstorming 或直接编辑自由发挥/);
    assert.match(r.stdout, /advised_invocation: bridge 不写模板 — AI 用 brainstorming 或直接编辑自由发挥/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R4 场景 B：inventory 含已知栈（matt）→ advised_skill=具体 skill，不走 fallback
test('R4-B: inventory 含 matt → advised_skill=matt-to-spec 不走 fallback', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo', '--no-auto-probe'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    r = bridge(['probe', 'changes/demo', '--inventory', 'matt:to-spec'], root);
    assert.equal(r.status, 0, `probe stderr: ${r.stderr}`);
    // 应路由到 matt，不走 (none) fallback
    assert.match(r.stdout, /advised_skill: matt:to-spec/);
    assert.match(r.stdout, /advised_invocation: use_skill to-spec/);
    assert.doesNotMatch(r.stdout, /advised_reason: inventory 未含任何已知栈 skill/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});