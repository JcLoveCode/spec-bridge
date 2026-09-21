// v1.3 Batch 2 测试（exec R3 测试义务）：
// `bridge init --workflow-kind <openspec|matt>` 只建台账 + 空 specs/，不写 5 模板（D3）。
// 避免与外栈产物生成器冲突：openspec 自己出 proposal/design/tasks/spec；matt 走 to-spec。
// builtin kind（默认）兜底出 5 模板，向后兼容 v1.2 R1。
// 接缝同 init-integration.test.mjs：spawn `node bridge.mjs init ...`。
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
  const dir = mkdtempSync(join(tmpdir(), 'bridge-init-wk-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

const TEMPLATES = ['proposal.md', 'design.md', 'tasks.md', 'execution-contract.md'];

// R3 场景 1：--workflow-kind openspec → 只建台账 + 空 specs 目录
test('R3 场景 1：openspec kind 只建台账 + 空 specs/（不写 5 模板）', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['init', 'demo', '--workflow-kind', 'openspec'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const changeDir = join(root, 'changes', 'demo');
    // 台账在场
    assert.ok(existsSync(join(changeDir, '.bridge.yaml')), '.bridge.yaml 必须存在');
    // specs/ 目录在场但空（外栈产物生成器会自己写 spec.md）
    assert.ok(existsSync(join(changeDir, 'specs', 'demo')), 'specs/demo/ 目录必须存在');
    assert.ok(!existsSync(join(changeDir, 'specs', 'demo', 'spec.md')), 'openspec kind 不应写 spec.md（由 openspec 自己出）');
    // 5 模板都不应有
    for (const f of TEMPLATES) {
      assert.ok(!existsSync(join(changeDir, f)), `${f} 不应由桥生成（openspec kind）`);
    }
    // .bridge.yaml 写 workflow_kind=openspec
    const bridgeYaml = readFileSync(join(changeDir, '.bridge.yaml'), 'utf-8');
    assert.match(bridgeYaml, /workflow_kind:\s*openspec/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R3 场景 2：--workflow-kind matt → 只建台账 + 空 specs 目录
test('R3 场景 2：matt kind 只建台账 + 空 specs/（不写 5 模板）', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['init', 'demo', '--workflow-kind', 'matt'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const changeDir = join(root, 'changes', 'demo');
    assert.ok(existsSync(join(changeDir, '.bridge.yaml')));
    assert.ok(existsSync(join(changeDir, 'specs', 'demo')));
    assert.ok(!existsSync(join(changeDir, 'specs', 'demo', 'spec.md')), 'matt kind 不应写 spec.md（由 to-spec 出）');
    for (const f of TEMPLATES) {
      assert.ok(!existsSync(join(changeDir, f)), `${f} 不应由桥生成（matt kind）`);
    }
    const bridgeYaml = readFileSync(join(changeDir, '.bridge.yaml'), 'utf-8');
    assert.match(bridgeYaml, /workflow_kind:\s*matt/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R3 场景 3（v1.8-1）：--builtin 标志显式触发 v1.7 5 模板路径，向后兼容 v1.2 R1。
// 默认行为在 v1.8-1 已变（不再生成 5 模板），所以测的是"显式 --builtin"逃生口。
test('R3 场景 3（v1.8-1）：bridge init --builtin 走 v1.7 5 模板路径（逃生口）', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['init', 'demo', '--builtin'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const changeDir = join(root, 'changes', 'demo');
    assert.ok(existsSync(join(changeDir, '.bridge.yaml')));
    assert.ok(existsSync(join(changeDir, 'specs', 'demo', 'spec.md')));
    for (const f of TEMPLATES) {
      assert.ok(existsSync(join(changeDir, f)), `${f} 必须存在（--builtin 逃生口）`);
    }
    const bridgeYaml = readFileSync(join(changeDir, '.bridge.yaml'), 'utf-8');
    assert.match(bridgeYaml, /workflow_kind:\s*builtin/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});