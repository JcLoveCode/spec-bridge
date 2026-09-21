// 端到端集成测试（契约 R1/R2/R3 测试义务）：
// tmpdir + git init 隔离，真实 spawn `node bridge.mjs init ...`。
// 场景编号对齐 changes/<本变更>/specs/cli/spec.md 的 Scenario 小节。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function makeSandbox(withGit = true) {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-init-test-'));
  if (withGit) execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

test('R1 场景 1.1 + 1.4（v1.8-2 纯桥）：成功脚手架 standalone change（仅 state + log + 空 specs/）', () => {
  const root = makeSandbox(true);
  try {
    // v1.8-2 (ADR-0012 D1)：纯桥模式——不传 --builtin（默认）；验证只建台账，不写 5 件模板。
    const result = bridge(['init', 'demo-feature', '--branch', 'REQ-42', '--no-auto-probe'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const changeDir = join(root, 'changes', 'demo-feature');
    // v1.8-2 纯桥：5 件模板都不存在
    for (const file of ['proposal.md', 'design.md', 'tasks.md', 'execution-contract.md']) {
      assert.ok(!existsSync(join(changeDir, file)), `${file} 必须不存在（纯桥模式）`);
    }
    // spec.md 不存在（空 specs/ 目录等外栈产物生成器填）
    const specFile = join(changeDir, 'specs', 'demo-feature', 'spec.md');
    assert.ok(!existsSync(specFile), 'spec.md 必须不存在（外栈自管）');
    // 台账在场
    assert.ok(existsSync(join(changeDir, '.bridge.yaml')), '.bridge.yaml 应存在');
    assert.ok(existsSync(join(changeDir, '.bridge.log')), '.bridge.log 应存在');
    // specs/<cap>/ 目录在场（空）
    assert.ok(existsSync(join(changeDir, 'specs', 'demo-feature')), 'specs/<cap>/ 应存在');
    // 验证 .bridge.yaml 内容
    const state = readFileSync(join(changeDir, '.bridge.yaml'), 'utf-8');
    assert.match(state, /stage: planning/);
    assert.match(state, /layout: standalone/);
    assert.match(state, /branch: REQ-42/);
    // v1.8-2：appendEvent 不再含 builtin= 字段
    const log = readFileSync(join(changeDir, '.bridge.log'), 'utf-8');
    assert.match(log, /init: scaffolded demo-feature/);
    assert.ok(!log.includes('builtin=true'), 'appendEvent 不应含 builtin=true（v1.8-2 纯桥）');
    // D7：stdout 首行含 change 路径，第二行是 next hint（v1.8-2 新文案）
    const [firstLine, secondLine] = result.stdout.trim().split('\n');
    assert.ok(firstLine.includes('demo-feature'), `stdout 首行应含 change 路径，实际: ${firstLine}`);
    assert.match(secondLine, /^next: use external stack skill — bridge doesn't write templates/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R1 场景 1.5：探测 openspec layout（openspec/ 在场 → openspec/changes/）', () => {
  const root = makeSandbox(true);
  try {
    mkdirSync(join(root, 'openspec'), { recursive: true });
    const result = bridge(['init', 'demo'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const stateFile = join(root, 'openspec', 'changes', 'demo', '.bridge.yaml');
    assert.ok(existsSync(stateFile), 'change 应落在 openspec/changes/ 下');
    assert.match(readFileSync(stateFile, 'utf-8'), /layout: openspec/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// v1.6 R1：archive 化石在场压制 openspec/ 弱信号 — 模拟 v1.4 ADR-0009 防误判场景。
// openspec/ 目录在场（OpenSpec CLI 本地安装）+ changes/archive 化石在场（spec-bridge 仓库根）
// → layout: standalone（化石优先级 1 保护），不能被 openspec/ 弱信号误判。
test('R1 场景 1.6（v1.6）：archive 化石在场 + openspec/ 目录同时在场 → standalone（防 v1.4 误判）', () => {
  const root = makeSandbox(true);
  try {
    mkdirSync(join(root, 'openspec'), { recursive: true });
    const fakeArchiveId = '2026-09-18-fake-archive';
    mkdirSync(join(root, 'changes', 'archive', fakeArchiveId), { recursive: true });
    writeFileSync(join(root, 'changes', 'archive', fakeArchiveId, '.bridge.yaml'), 'stage: archived\n', 'utf-8');
    const result = bridge(['init', 'demo'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const stateFile = join(root, 'changes', 'demo', '.bridge.yaml');
    assert.ok(existsSync(stateFile), '化石在场时 change 应落 changes/ 下（standalone），不被 openspec/ 弱信号误判');
    assert.match(readFileSync(stateFile, 'utf-8'), /layout: standalone/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// v1.6 R3：spec-bridge 仓库根 list 端到端回归 — 模拟真实 spec-bridge 仓库布局
// （openspec/ + changes/archive/ 有 5 个化石）跑 bridge list 应返回 standalone + archived_count: 5。
// 这测的是 v1.4 修复成果未被 v1.6 弱信号破坏。
test('R1 场景 1.7（v1.6）：mock spec-bridge 仓库根 list → standalone + archived_count: 5', () => {
  const root = makeSandbox(true);
  try {
    mkdirSync(join(root, 'openspec'), { recursive: true });
    for (let i = 1; i <= 5; i += 1) {
      const archiveId = `2026-09-18-fake-archive-${i}`;
      mkdirSync(join(root, 'changes', 'archive', archiveId), { recursive: true });
      writeFileSync(join(root, 'changes', 'archive', archiveId, '.bridge.yaml'), 'stage: archived\n', 'utf-8');
    }
    const result = bridge(['list', root], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const listing = JSON.parse(result.stdout);
    assert.equal(listing.layout, 'standalone', 'v1.4 修复成果：化石在场时 layout 应为 standalone');
    assert.equal(listing.archived_count, 5, 'archived_count 应正确数出 5 个化石');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R2：init 不写 hash / 回执字段（hash 与回执属 contracted→archived 阶段）', () => {
  const root = makeSandbox(true);
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    const state = readFileSync(join(root, 'changes', 'demo', '.bridge.yaml'), 'utf-8');
    assert.match(state, /artifacts_hash: null/);
    assert.match(state, /contract_hash: null/);
    assert.match(state, /published: false/);
    assert.match(state, /spec_publication_receipt: null/);
    assert.match(state, /stage: planning/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R1 场景 1.2：重名拒绝 exit 3，不覆盖任何已存在文件', () => {
  const root = makeSandbox(true);
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0);
    const proposalPath = join(root, 'changes', 'demo', 'proposal.md');
    const marker = 'SENTINEL — do not overwrite';
    writeFileSync(proposalPath, marker, 'utf-8');
    const second = bridge(['init', 'demo'], root);
    assert.equal(second.status, 3, `stderr: ${second.stderr}`);
    assert.match(second.stderr, /already exists/);
    assert.equal(readFileSync(proposalPath, 'utf-8'), marker, '已存在文件不得被修改');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R1 场景 1.3：非法 name（非 kebab-case）拒绝 exit 2', () => {
  const root = makeSandbox(true);
  try {
    const bad = bridge(['init', 'Foo_Bar'], root);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /kebab-case/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R3（修正后语义）：非 git 且无 changes/ 祖先 → cwd 兜底 + stderr 提示 + standalone 自举 exit 0', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-init-nogit-'));
  try {
    const result = bridge(['init', 'demo'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stderr, /no project root detected/);
    const state = readFileSync(join(root, 'changes', 'demo', '.bridge.yaml'), 'utf-8');
    assert.match(state, /layout: standalone/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('D4（v1.8-2 纯桥）：--capability 覆盖默认 capability 目录名（空 specs/<cap>/）', () => {
  const root = makeSandbox(true);
  try {
    // v1.8-2 纯桥：不传 --builtin，验证 --capability 覆盖目录名 + specs/<cap>/ 目录在场但空
    const result = bridge(['init', 'demo-feature', '--capability', 'cli', '--no-auto-probe'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.ok(existsSync(join(root, 'changes', 'demo-feature', 'specs', 'cli')), 'specs/<cap>/ 应存在（纯桥模式建空目录）');
    assert.ok(!existsSync(join(root, 'changes', 'demo-feature', 'specs', 'cli', 'spec.md')), 'spec.md 必须不存在（外栈自管）');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('回归：init 之后 list 能看到新 change（路由与既有命令互通）', () => {
  const root = makeSandbox(true);
  try {
    assert.equal(bridge(['init', 'demo', '--branch', 'REQ-7'], root).status, 0);
    const listResult = bridge(['list', root], root);
    assert.equal(listResult.status, 0, `stderr: ${listResult.stderr}`);
    const listing = JSON.parse(listResult.stdout);
    assert.equal(listing.layout, 'standalone');
    assert.equal(listing.changes.length, 1);
    assert.equal(listing.changes[0].name, 'demo');
    assert.equal(listing.changes[0].has_state, true);
    assert.equal(listing.changes[0].stage, 'planning');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});