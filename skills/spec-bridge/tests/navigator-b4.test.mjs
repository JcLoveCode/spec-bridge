// v1.2 Batch 4 测试（契约 R5 测试义务）：
// bridge pattern --tag 聚合——跨活跃+归档匹配 / 无匹配空列表 exit 0 / mention 计数 / 复发提示行。
// 接缝：spawn `node bridge.mjs <args>`（与 init-integration.test.mjs 同构）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-nav-b4-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

test('R5 场景 1：聚合匹配含归档（活跃 + 归档两条记录）', () => {
  const root = makeSandbox();
  try {
    // 活跃 change 带 tag
    assert.equal(bridge(['init', 'fix-live'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/fix-live', 'tags', 'authz-bypass,off-by-one'], root).status, 0);
    // 归档 change 带 tag（移入 archive/）
    assert.equal(bridge(['init', 'fix-old'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/fix-old', 'tags', 'authz-bypass'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/fix-old', 'stage', 'archived'], root).status, 0);
    mkdirSync(join(root, 'changes', 'archive'), { recursive: true });
    renameSync(join(root, 'changes', 'fix-old'), join(root, 'changes', 'archive', '2026-09-17-fix-old'));

    const result = bridge(['pattern', '--tag', 'authz-bypass', root], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const output = JSON.parse(result.stdout.split('\n→')[0]);
    assert.equal(output.matches.length, 2);
    const names = output.matches.map((m) => m.name).sort();
    assert.deepEqual(names, ['fix-live', 'fix-old']);
    const archived = output.matches.find((m) => m.name === 'fix-old');
    assert.equal(archived.location, 'archived');
    assert.equal(archived.stage, 'archived');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R5 场景 2：无匹配 → 空列表 exit 0（不是错误）', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'demo'], root).status, 0); // 无 tags
    const result = bridge(['pattern', '--tag', 'ghost-tag', root], root);
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout.split('\n→')[0]);
    assert.deepEqual(output.matches, []);
    assert.equal(output.total_mentions, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R5 加强：mention 计数来自 .bridge.log 的 tag=<t> 事件行', () => {
  const root = makeSandbox();
  try {
    assert.equal(bridge(['init', 'fix-live'], root).status, 0);
    assert.equal(bridge(['state', 'set', 'changes/fix-live', 'tags', 'authz-bypass'], root).status, 0);
    appendFileSync(join(root, 'changes', 'fix-live', '.bridge.log'), '- 2026-09-18T00:00:00Z mention: tag=authz-bypass note=first\n', 'utf-8');
    appendFileSync(join(root, 'changes', 'fix-live', '.bridge.log'), '- 2026-09-18T01:00:00Z mention: tag=authz-bypass note=second\n', 'utf-8');
    appendFileSync(join(root, 'changes', 'fix-live', '.bridge.log'), '- 2026-09-18T02:00:00Z root-cause: tag=authz-bypass\n', 'utf-8');

    const result = bridge(['pattern', '--tag', 'authz-bypass', root], root);
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout.split('\n→')[0]);
    assert.equal(output.matches[0].mentions, 3);
    assert.equal(output.total_mentions, 3);
    assert.match(result.stdout, /pattern recurring.*consider a root-cause follow-up/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R5 加强：缺 --tag → usage exit 2', () => {
  const root = makeSandbox();
  try {
    const result = bridge(['pattern', root], root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage: bridge pattern --tag/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
