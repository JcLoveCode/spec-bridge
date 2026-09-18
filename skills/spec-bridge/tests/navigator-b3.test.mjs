// v1.2 Batch 3 测试（契约 R2 测试义务）：
// bridge next 只读导航——5 个 stage 的建议输出 / change 不存在 exit 1 / parent 与 workflow 展示。
// 接缝：spawn `node bridge.mjs <args>`（与 init-integration.test.mjs 同构）。
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
  const dir = mkdtempSync(join(tmpdir(), 'bridge-nav-b3-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

const STAGE_TO_ADVICE = [
  ['planning', /execution-contract\.md 并过批准门/],
  ['contracted', /hashes --check/],
  ['executing', /继续当前批次/],
  ['patching', /续作/],
  ['archived', /follow-up/],
];

for (const [stage, adviceRe] of STAGE_TO_ADVICE) {
  test(`R2 场景 1：stage=${stage} 输出对应建议`, () => {
    const root = makeSandbox();
    try {
      assert.equal(bridge(['init', 'demo'], root).status, 0);
      if (stage === 'patching') {
        // patching 需要合法 archived 父（B1 校验）
        assert.equal(bridge(['init', 'parent-change'], root).status, 0);
        assert.equal(bridge(['state', 'set', 'changes/parent-change', 'stage', 'archived'], root).status, 0);
        assert.equal(bridge(['state', 'set', 'changes/demo', 'parent', 'parent-change'], root).status, 0);
      }
      assert.equal(bridge(['state', 'set', 'changes/demo', 'stage', stage], root).status, 0);
      const result = bridge(['next', 'changes/demo'], root);
      assert.equal(result.status, 0, `stderr: ${result.stderr}`);
      assert.match(result.stdout, new RegExp(`^stage:\\s+${stage}$`, 'm'));
      assert.match(result.stdout, adviceRe);
      assert.match(result.stdout, /^→ /m);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('R2 场景 1 附：next 字段与提示语在输出中', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    assert.equal(bridge(['state', 'next', 'changes/demo', '写契约中'], root).status, 0);
    const result = bridge(['next', 'changes/demo'], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /next:\s+写契约中/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R2 场景 2：archived 建议开 follow-up 而非执行类建议', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/demo', 'stage', 'archived'], root).status, 0);
    const result = bridge(['next', 'changes/demo'], root);
    assert.match(result.stdout, /init <name> --parent/);
    assert.match(result.stdout, /勿改原版/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R2 场景 3：change 不存在（无 .bridge.yaml）→ exit 1', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['next', 'changes/ghost'], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no \.bridge\.yaml/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R2 加强：parent 与 workflow_kind 在导航输出中可见', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'parent-change'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/parent-change', 'artifacts_hash', 'sha256:ff11'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/parent-change', 'stage', 'archived'], root).status, 0);
    assert.equal(bridge(['init', 'child', '--parent', 'parent-change', '--workflow-kind', 'matt'], root).status, 0);
    const result = bridge(['next', 'changes/child'], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /parent: parent-change \(sha256:ff11\)/);
    assert.match(result.stdout, /workflow: matt/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
