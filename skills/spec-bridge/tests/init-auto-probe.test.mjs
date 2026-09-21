// v1.8-1 Batch 1 测试（C9 schema 扩字段）：
// B1 红 → 绿：TDD 验证 schema 扩字段
// 接缝：spawn `node bridge.mjs <args>`（与 navigator-b1.test.mjs 同构，沿用 v1.7 seam）
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-v181-b1-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

function readYamlField(root, change, field) {
  const raw = readFileSync(join(root, 'changes', change, '.bridge.yaml'), 'utf-8');
  const match = raw.match(new RegExp(`^${field}: (.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

test('B1 T1: state set external_stack 写入合法（不再 unknown field）', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    r = bridge(['state', 'set', 'changes/demo', 'external_stack', 'matt'], root);
    assert.equal(r.status, 0, `state set external_stack stderr: ${r.stderr} stdout: ${r.stdout}`);
    assert.equal(readYamlField(root, 'demo', 'external_stack'), 'matt');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('B1 T2: state set adopted_at 写入合法（不再 unknown field）', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    r = bridge(['state', 'set', 'changes/demo', 'adopted_at', '2026-09-21T03:30:04.000Z'], root);
    assert.equal(r.status, 0, `state set adopted_at stderr: ${r.stderr} stdout: ${r.stdout}`);
    assert.equal(readYamlField(root, 'demo', 'adopted_at'), '2026-09-21T03:30:04.000Z');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('B1 T3: writeState 保留 external_stack 字段（不被后续 set 操作丢失）', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    r = bridge(['state', 'set', 'changes/demo', 'external_stack', 'openspec'], root);
    assert.equal(r.status, 0, `state set external_stack stderr: ${r.stderr}`);
    // 后续 set 触发 writeState
    r = bridge(['state', 'set', 'changes/demo', 'workflow_kind', 'openspec'], root);
    assert.equal(r.status, 0, `state set workflow_kind stderr: ${r.stderr}`);
    // 字段不能丢
    assert.equal(readYamlField(root, 'demo', 'external_stack'), 'openspec');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('B1 T4: writeState 保留 adopted_at 字段', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    r = bridge(['state', 'set', 'changes/demo', 'adopted_at', '2026-09-21T03:30:04.000Z'], root);
    assert.equal(r.status, 0, `state set adopted_at stderr: ${r.stderr}`);
    // 后续 set 触发 writeState
    r = bridge(['state', 'set', 'changes/demo', 'workflow_kind', 'matt'], root);
    assert.equal(r.status, 0, `state set workflow_kind stderr: ${r.stderr}`);
    // 字段不能丢
    assert.equal(readYamlField(root, 'demo', 'adopted_at'), '2026-09-21T03:30:04.000Z');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// v1.8-1 Batch 2 测试（C5 probe 输出 advised_invocation 字段）：
// B2 红 → 绿：TDD 验证 probe 新输出字段
test('B2 T1: probe 在 matt inventory 下输出 advised_invocation: use_skill to-spec', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    r = bridge(['probe', 'changes/demo', '--inventory', 'matt-to-spec'], root);
    assert.equal(r.status, 0, `probe stderr: ${r.stderr}`);
    assert.match(r.stdout, /advised_invocation: use_skill to-spec/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('B2 T2: probe 在 openspec inventory 下输出 advised_invocation: use_skill openspec-propose', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    r = bridge(['probe', 'changes/demo', '--inventory', 'openspec-explorer'], root);
    assert.equal(r.status, 0, `probe stderr: ${r.stderr}`);
    assert.match(r.stdout, /advised_invocation: use_skill openspec-propose/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('B2 T3: probe 在 superpowers inventory 下输出 advised_invocation: use_skill tdd', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    r = bridge(['probe', 'changes/demo', '--inventory', 'superpowers-tdd'], root);
    assert.equal(r.status, 0, `probe stderr: ${r.stderr}`);
    assert.match(r.stdout, /advised_invocation: use_skill tdd/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('B2 T4: probe 在无 inventory 下输出 advised_invocation: (bridge 不写模板 — AI 用 brainstorming 或直接编辑自由发挥)', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'demo'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    r = bridge(['probe', 'changes/demo'], root);
    assert.equal(r.status, 0, `probe stderr: ${r.stderr}`);
    // v1.8-2 (ADR-0012 D4)：fallback 文案改为引导 brainstorming/自由发挥。
    assert.match(r.stdout, /advised_invocation: bridge 不写模板 — AI 用 brainstorming 或直接编辑自由发挥/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// v1.8-1 Batch 3 测试（init 改造 C1-C4 + 逃生口）：
// B3 红 → 绿：TDD 验证 init 默认行为变 + 双 flag 逃生口
// v1.8-2 (ADR-0012 D1)：--builtin 砍掉——flag 变 no-op，stderr 提示，不写 5 件模板。
test('B3 T1: bridge init foo --builtin flag 变 no-op（v1.8-2 纯桥模式）', () => {
  const root = makeSandbox();
  try {
    const r = bridge(['init', 'foo', '--builtin'], root);
    assert.equal(r.status, 0, `init --builtin stderr: ${r.stderr}`);
    const changeDir = join(root, 'changes', 'foo');
    // v1.8-2：--builtin 不再生任何模板
    for (const f of ['proposal.md', 'design.md', 'tasks.md', 'execution-contract.md', join('specs', 'foo', 'spec.md')]) {
      assert.ok(!existsSync(join(changeDir, f)), `${f} should NOT exist under pure bridge mode (--builtin no-op)`);
    }
    // 兼容层 hint
    assert.match(r.stderr, /--builtin flag removed in v1.8-2 \(pure bridge mode\), no-op/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('B3 T2: bridge init foo --no-auto-probe 只建台账 + 不调 probe（C4 逃生口）', () => {
  const root = makeSandbox();
  try {
    const r = bridge(['init', 'foo', '--no-auto-probe'], root);
    assert.equal(r.status, 0, `init --no-auto-probe stderr: ${r.stderr}`);
    const changeDir = join(root, 'changes', 'foo');
    // 应该有：.bridge.yaml + .bridge.log + specs/
    assert.ok(existsSync(join(changeDir, '.bridge.yaml')), '.bridge.yaml should exist');
    assert.ok(existsSync(join(changeDir, '.bridge.log')), '.bridge.log should exist');
    assert.ok(existsSync(join(changeDir, 'specs')), 'specs/ should exist');
    // 不应该有：5 件模板
    for (const f of ['proposal.md', 'design.md', 'tasks.md', 'execution-contract.md']) {
      assert.ok(!existsSync(join(changeDir, f)), `${f} should NOT exist under --no-auto-probe`);
    }
    // stdout 不含 advised_*
    assert.ok(!/advised_(skill|invocation)/.test(r.stdout), `stdout should NOT contain advised_*: got: ${r.stdout}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('B3 T3: bridge init foo --workflow-kind matt 显式覆盖默认（D1）', () => {
  const root = makeSandbox();
  try {
    const r = bridge(['init', 'foo', '--workflow-kind', 'matt'], root);
    assert.equal(r.status, 0, `init --workflow-kind stderr: ${r.stderr}`);
    assert.equal(readYamlField(root, 'foo', 'workflow_kind'), 'matt');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('B3 T4: bridge init foo 重复 init 同一 name → exit 3（边界）', () => {
  const root = makeSandbox();
  try {
    let r = bridge(['init', 'foo'], root);
    assert.equal(r.status, 0, `first init stderr: ${r.stderr}`);
    r = bridge(['init', 'foo'], root);
    assert.equal(r.status, 3, `duplicate init should exit 3, got: ${r.status} stderr: ${r.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// v1.8-1 Batch 4 测试（adopt 增强 C6+C7+C8）：
// B4 红 → 绿：TDD 验证 adopt 写 external_stack + adopted_at + 改 next 提示
test('B4 T1: bridge adopt changes/x --stack matt 写 external_stack + adopted_at（C6+C7）', () => {
  const root = makeSandbox();
  try {
    const changeDir = join(root, 'changes', 'demo');
    mkdirSync(changeDir, { recursive: true });
    writeFileSync(join(changeDir, 'proposal.md'), '# proposal', 'utf-8'); // 接管信号
    const r = bridge(['adopt', 'changes/demo', '--stack', 'matt'], root);
    assert.equal(r.status, 0, `adopt --stack stderr: ${r.stderr} stdout: ${r.stdout}`);
    assert.equal(readYamlField(root, 'demo', 'external_stack'), 'matt');
    const adoptedAt = readYamlField(root, 'demo', 'adopted_at');
    assert.ok(adoptedAt, 'adopted_at 应写入');
    assert.match(adoptedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, `adopted_at 应为 ISO 8601 格式: ${adoptedAt}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('B4 T2: bridge adopt changes/x 自动探测 → matt（D3：4 件标准模板在场）', () => {
  const root = makeSandbox();
  try {
    const changeDir = join(root, 'changes', 'demo');
    mkdirSync(changeDir, { recursive: true });
    writeFileSync(join(changeDir, 'proposal.md'), '# proposal', 'utf-8');
    writeFileSync(join(changeDir, 'design.md'), '# design', 'utf-8');
    const r = bridge(['adopt', 'changes/demo'], root);
    assert.equal(r.status, 0, `adopt auto-detect stderr: ${r.stderr}`);
    assert.equal(readYamlField(root, 'demo', 'external_stack'), 'matt');
    assert.match(readYamlField(root, 'demo', 'adopted_at') ?? '', /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// v1.8-1 Batch 5 测试（项目栈自动探测 D2）：
// B5 红 → 绿：TDD 验证 detect-stack.mjs + cmd-init 集成
test('B5 T1: matt 项目（.claude-plugin + package.json matt-skills）→ init workflow_kind=matt', () => {
  const root = makeSandbox();
  try {
    mkdirSync(join(root, '.claude-plugin'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { 'matt-skills': '*' } }), 'utf-8');
    const r = bridge(['init', 'foo'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    assert.equal(readYamlField(root, 'foo', 'workflow_kind'), 'matt');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('B5 T2: openspec 项目（openspec/ 目录在场）→ init workflow_kind=openspec', () => {
  const root = makeSandbox();
  try {
    mkdirSync(join(root, 'openspec'), { recursive: true });
    const r = bridge(['init', 'foo'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    // openspec layout → changeDir = openspec/changes/foo（不是 changes/foo）
    const raw = readFileSync(join(root, 'openspec', 'changes', 'foo', '.bridge.yaml'), 'utf-8');
    assert.match(raw, /^workflow_kind: openspec/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
