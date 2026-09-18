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

// v1.2 follow-up B7 / R1 场景 1：contracted + approved → advice 含 "proceed to executing"
test('R1 场景 1：contracted + approved 提示进 executing', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/demo', 'stage', 'contracted'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/demo', 'contract_approved', 'approver 2026-09-18 note'], root).status, 0);
    const result = bridge(['next', 'changes/demo'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^stage:\s+contracted$/m);
    assert.match(result.stdout, /proceed to executing/);
    assert.match(result.stdout, /state set.*stage executing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// v1.2 follow-up B7 / R1 场景 2：executing + next 是 Batch 格式 → 末尾追加 "→ Batch N"
test('R1 场景 2：executing + Batch N next 字段末尾追加显式编号', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/demo', 'stage', 'executing'], root).status, 0);
    assert.equal(bridge(['state', 'next', 'changes/demo', 'Batch 3: 改 cmd-next stage-aware'], root).status, 0);
    const result = bridge(['next', 'changes/demo'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^stage:\s+executing$/m);
    assert.match(result.stdout, /^→ Batch 3$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// v1.2 follow-up B7 / R1 场景 3：归档态守门 (archived advice 含 ADR-0005 + follow-up + 勿改原版)
test('R1 场景 3：archived 守门同时满足新 spec 与旧测试', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/demo', 'stage', 'archived'], root).status, 0);
    const result = bridge(['next', 'changes/demo'], root);
    assert.match(result.stdout, /ADR-0005/);
    assert.match(result.stdout, /follow-up/);
    assert.match(result.stdout, /init <name> --parent/);
    assert.match(result.stdout, /勿改原版/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// v1.2 follow-up B7 / R1 场景 4：patching 含 patching bypass + ADR-0005 + verify parent still archived
test('R1 场景 4：patching 提示含 patching bypass + ADR-0005', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'parent-change'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/parent-change', 'artifacts_hash', 'sha256:ff11'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/parent-change', 'stage', 'archived'], root).status, 0);
    assert.equal(bridge(['init', 'patch-child', '--parent', 'parent-change'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/patch-child', 'stage', 'patching'], root).status, 0);
    const result = bridge(['next', 'changes/patch-child'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /patching bypass/);
    assert.match(result.stdout, /verify parent still archived/);
    assert.match(result.stdout, /ADR-0005/);
    assert.match(result.stdout, /续作/);  // 旧 v1.2 B3 测试 regex 兼容
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
