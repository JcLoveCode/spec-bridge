// v1.8-2 测试（ADR-0012 D2 superpowers 加入项目栈探测优先级）：
// R2 测试义务：superpowers 加入 detect-stack + 优先级 superpowers > matt > openspec > builtin。
//
// 接缝同 init-auto-probe.test.mjs B5：用 sandbox + mkdir/writeFileSync 模拟项目根信号 + spawn bridge 命令验证派生结果。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', 'scripts', 'bridge.mjs');

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-v182-detect-'));
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

// R2 场景 1：双信号在 → primary = superpowers
test('R2-A: superpowers 项目（.claude-plugin + package.json 含 "superpowers"）→ workflow_kind=superpowers', () => {
  const root = makeSandbox();
  try {
    mkdirSync(join(root, '.claude-plugin'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'superpowers-test',
      keywords: ['superpowers', 'tdd'],
    }), 'utf-8');
    const r = bridge(['init', 'foo', '--no-auto-probe'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    assert.equal(readYamlField(root, 'foo', 'workflow_kind'), 'superpowers');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R2 场景 2：缺 .claude-plugin/（仅 package.json 含 superpowers）→ 不派 superpowers，兜底 builtin
test('R2-B: 缺 .claude-plugin/（仅 package.json 含 superpowers）→ 不派 superpowers', () => {
  const root = makeSandbox();
  try {
    // 不建 .claude-plugin/
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'superpowers-test',
      keywords: ['superpowers'],
    }), 'utf-8');
    const r = bridge(['init', 'foo', '--no-auto-probe'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    // 应兜底到 builtin（openspec/ 也不在场）
    assert.notEqual(readYamlField(root, 'foo', 'workflow_kind'), 'superpowers', '缺 .claude-plugin/ 不能派 superpowers');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R2 场景 3：缺 superpowers 字段（.claude-plugin + matt-skills）→ workflow_kind=matt（matt 仍胜出）
test('R2-C: 缺 superpowers 字段（仅 matt 信号）→ workflow_kind=matt（matt 优先）', () => {
  const root = makeSandbox();
  try {
    mkdirSync(join(root, '.claude-plugin'), { recursive: true });
    // package.json 仅含 matt-skills，不含 superpowers
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      dependencies: { 'matt-skills': '*' },
    }), 'utf-8');
    const r = bridge(['init', 'foo', '--no-auto-probe'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    // matt 仍胜出（双信号在 + priority 2 优先于 openspec）
    assert.equal(readYamlField(root, 'foo', 'workflow_kind'), 'matt');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R2 场景 4：双信号 + matt-skills + openspec/ 都在场 → superpowers 胜出（优先级 1）
test('R2-D: superpowers + matt + openspec 三信号全在 → superpowers 胜出', () => {
  const root = makeSandbox();
  try {
    mkdirSync(join(root, '.claude-plugin'), { recursive: true });
    mkdirSync(join(root, 'openspec'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      keywords: ['superpowers'],
      dependencies: { 'matt-skills': '*' },
    }), 'utf-8');
    const r = bridge(['init', 'foo', '--no-auto-probe'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    // v1.8-2 (ADR-0012 D2)：openspec layout → changeDir 在 openspec/changes/foo/
    // superpowers 优先级 1 高于 matt (2) 和 openspec (3)
    const raw = readFileSync(join(root, 'openspec', 'changes', 'foo', '.bridge.yaml'), 'utf-8');
    assert.match(raw, /^workflow_kind: superpowers/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R2 场景 5：package.json 含 superpowers 但用 npm 子串（@scope/superpowers-util）→ 不误判
test('R2-E: 仅子串匹配（@scope/superpowers-util）不触发 superpowers 探测', () => {
  const root = makeSandbox();
  try {
    mkdirSync(join(root, '.claude-plugin'), { recursive: true });
    // 字段名是 @scope/superpowers-util（带连字符），不是独立 "superpowers" 字段
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      dependencies: { '@scope/superpowers-util': '*' },
    }), 'utf-8');
    const r = bridge(['init', 'foo', '--no-auto-probe'], root);
    assert.equal(r.status, 0, `init stderr: ${r.stderr}`);
    // 应兜底到 builtin（matt-skills 不在场 + superpowers 仅子串）
    assert.notEqual(readYamlField(root, 'foo', 'workflow_kind'), 'superpowers');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});