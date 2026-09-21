// tests/no-auto-detect.test.mjs — v1.9-2 行为验证
// 验证：stacks 配置优先于自动探测；无配置时探测 fallback 仍生效
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const BRIDGE = new URL('../scripts/bridge.mjs', import.meta.url).pathname;

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-v192-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function bridge(args, cwd) {
  return spawnSync(process.execPath, [BRIDGE, ...args], { cwd, encoding: 'utf-8' });
}

function rmTmp(root) {
  try { rmSync(root, { recursive: true, force: true }); } catch {}
}

function readYaml(changeDir) {
  return readFileSync(join(changeDir, '.bridge.yaml'), 'utf8');
}

test('v1.9-2: stacks 配置优先于探测（matt+openspec 配置胜过 superpowers 探测）', () => {
  const tmp = makeSandbox();
  try {
    // 项目根有 superpowers 信号（探测会推 superpowers）
    mkdirSync(join(tmp, '.claude-plugin'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({
      name: 'test-pkg',
      dependencies: { superpowers: '*' }
    }));

    // 但 stacks 配置成 openspec（应优先于探测）
    bridge(['stacks', 'set', 'openspec'], tmp);

    const result = bridge(['init', 'test-change'], tmp);
    assert.equal(result.status, 0, `init stderr: ${result.stderr}`);

    const yaml = readYaml(join(tmp, 'changes', 'test-change'));
    const match = yaml.match(/workflow_kind:\s*(\S+)/);
    assert.equal(match?.[1], 'openspec',
      `workflow_kind 应为 openspec（来自配置），实际为 ${match?.[1]}`);
  } finally {
    rmTmp(tmp);
  }
});

test('v1.9-2: 无 stacks 配置 + 有探测信号 → 探测 fallback 生效', () => {
  const tmp = makeSandbox();
  try {
    // 项目根有 matt 信号
    mkdirSync(join(tmp, '.claude-plugin'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({
      name: 'test-pkg',
      dependencies: { 'matt-skills': '*' }
    }));

    // 无 stacks 配置 → 走探测 fallback
    const result = bridge(['init', 'test-change'], tmp);
    assert.equal(result.status, 0, `init stderr: ${result.stderr}`);

    const yaml = readYaml(join(tmp, 'changes', 'test-change'));
    const match = yaml.match(/workflow_kind:\s*(\S+)/);
    assert.equal(match?.[1], 'matt',
      `workflow_kind 应为 matt（探测 fallback），实际为 ${match?.[1]}`);
  } finally {
    rmTmp(tmp);
  }
});

test('v1.9-2: adopt --stack 显式优先于 stacks 配置', () => {
  const tmp = makeSandbox();
  try {
    bridge(['stacks', 'set', 'matt'], tmp);

    const changeDir = join(tmp, 'changes', 'test-change');
    mkdirSync(join(changeDir, 'specs', 'cap'), { recursive: true });
    writeFileSync(join(changeDir, 'proposal.md'), '# Proposal');

    const result = bridge(['adopt', changeDir, '--stack', 'openspec'], tmp);
    assert.equal(result.status, 0, `adopt stderr: ${result.stderr}`);

    const yaml = readYaml(changeDir);
    const match = yaml.match(/external_stack:\s*(\S+)/);
    assert.equal(match?.[1], 'openspec',
      `external_stack 应为 openspec（来自 --stack），实际为 ${match?.[1]}`);
  } finally {
    rmTmp(tmp);
  }
});

test('v1.9-2: probe 输出 stack_hint 来自配置', () => {
  const tmp = makeSandbox();
  try {
    bridge(['stacks', 'set', 'matt,superpowers'], tmp);
    const changeDir = join(tmp, 'changes', 'test-change');
    mkdirSync(join(changeDir, 'specs', 'cap'), { recursive: true });
    writeFileSync(join(changeDir, '.bridge.yaml'), 'stage: planning\n');

    const result = bridge(['probe', changeDir], tmp);
    assert.equal(result.status, 0, `probe stderr: ${result.stderr}`);
    assert.match(result.stdout, /stack_hint: matt/,
      '应输出 stack_hint: matt（配置首个栈）');
  } finally {
    rmTmp(tmp);
  }
});