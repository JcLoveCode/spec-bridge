// v1.8-2 测试（ADR-0012 D1 纯桥模式）：
// 验证 bridge init 永远不写 spec 模板（proposal/design/tasks/spec/execution-contract）。
// 只建台账 + 空 specs/ 目录 + 自动 probe（除非 --no-auto-probe）。
// R1 测试义务：bridge init 不再写 spec 模板。
//
// 接缝同 init-auto-probe.test.mjs：spawn `node bridge.mjs init ...`。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-v182-pure-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

const TEMPLATES = ['proposal.md', 'design.md', 'tasks.md', 'execution-contract.md'];

// R1 场景 A：默认 init 不写任何模板——台账在场 + specs/<cap>/ 目录在场但空。
test('R1-A: 默认 bridge init 不写 5 件模板（纯桥模式核心约束）', () => {
  const root = makeSandbox();
  try {
    const r = bridge(['init', 'foo', '--no-auto-probe'], root);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const changeDir = join(root, 'changes', 'foo');
    // 台账在场
    assert.ok(existsSync(join(changeDir, '.bridge.yaml')), '.bridge.yaml 必须存在');
    assert.ok(existsSync(join(changeDir, '.bridge.log')), '.bridge.log 必须存在');
    // specs/<cap>/ 目录在场
    assert.ok(existsSync(join(changeDir, 'specs', 'foo')), 'specs/<cap>/ 目录必须存在');
    // 5 件模板都不存在
    for (const f of TEMPLATES) {
      assert.ok(!existsSync(join(changeDir, f)), `${f} 必须不存在（纯桥模式）`);
    }
    assert.ok(!existsSync(join(changeDir, 'specs', 'foo', 'spec.md')), 'spec.md 必须不存在（外栈自管）');
    // v1.8-2 新 next 文案
    const stdout = r.stdout;
    assert.match(stdout, /next: use external stack skill — bridge doesn't write templates/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R1 场景 B：--builtin flag 变 no-op——不写模板 + stderr hint。
test('R1-B: --builtin flag 变 no-op（v1.8-2 砍掉 v1.7 5 模板逃生口）', () => {
  const root = makeSandbox();
  try {
    const r = bridge(['init', 'foo', '--builtin', '--no-auto-probe'], root);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const changeDir = join(root, 'changes', 'foo');
    // stderr 提示
    assert.match(r.stderr, /--builtin flag removed in v1.8-2 \(pure bridge mode\), no-op/);
    // 不写模板
    for (const f of TEMPLATES) {
      assert.ok(!existsSync(join(changeDir, f)), `${f} 必须不存在（--builtin no-op）`);
    }
    assert.ok(!existsSync(join(changeDir, 'specs', 'foo', 'spec.md')), 'spec.md 必须不存在（--builtin no-op）');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R1 场景 C：cmd-init.mjs 不再导出 5 件模板常量（pure-bridge 物理证据）。
test('R1-C: cmd-init.mjs 不再导出 5 件模板常量（物理证据）', async () => {
  const mod = await import('../scripts/cmd-init.mjs');
  assert.equal(typeof mod.PROPOSAL_TEMPLATE, 'undefined', 'PROPOSAL_TEMPLATE 必须已删除');
  assert.equal(typeof mod.DESIGN_TEMPLATE, 'undefined', 'DESIGN_TEMPLATE 必须已删除');
  assert.equal(typeof mod.TASKS_TEMPLATE, 'undefined', 'TASKS_TEMPLATE 必须已删除');
  assert.equal(typeof mod.SPEC_TEMPLATE, 'undefined', 'SPEC_TEMPLATE 必须已删除');
  assert.equal(typeof mod.CONTRACT_TEMPLATE, 'undefined', 'CONTRACT_TEMPLATE 必须已删除');
});