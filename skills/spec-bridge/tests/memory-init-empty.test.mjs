// v1.8-3 测试（ADR-0013 D2）：initPersonalMemory 在 IDE memory 不在场时写空骨架 + 幂等。
//   1. IDE 不在场 → 写空骨架（含 §0 元信息 + §1/§2/§3 占位段）
//   2. memory.md 已存在 → no-op（不覆盖）
//   3. IDE memory 在场 → no-op（个人层走 IDE）
//
// 接缝：直接 import { initPersonalMemory } + 创建临时 changeDir（带 .bridge.yaml 模拟 init 后的台账）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CMD_MEMORY = join(HERE, '..', 'scripts', 'cmd-memory.mjs');

async function importCmdMemory() {
  return import(CMD_MEMORY);
}

function makeProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'bridge-v183-mem-init-'));
}

// 模拟 init 后的台账（initPersonalMemory 读 capabilities / parent 字段）
function fakeStateYaml(changeDir, { capabilities = 'default', parent = null } = {}) {
  writeFileSync(join(changeDir, '.bridge.yaml'),
    capabilities ? `capabilities: ${capabilities}\n${parent ? `parent: ${parent}\n` : ''}` : `${parent ? `parent: ${parent}\n` : ''}`);
}

// R2 场景 A：IDE 不在场 → 写空骨架（含 §0 元信息 + §1/§2/§3 占位段）
test('R2-A: initPersonalMemory — IDE 不在场 → 写空骨架（含 §0 元信息 + §1/§2/§3 占位段）', async () => {
  const root = makeProjectRoot();
  try {
    const changeDir = join(root, 'changes', 'foo');
    mkdirSync(changeDir, { recursive: true });
    fakeStateYaml(changeDir, { capabilities: 'v1-8-3-memory' });
    const { initPersonalMemory } = await importCmdMemory();
    const result = initPersonalMemory(changeDir, root);
    assert.equal(result.skipped, false);
    assert.ok(existsSync(join(changeDir, 'memory.md')), 'memory.md 必须生成');
    const content = readFileSync(join(changeDir, 'memory.md'), 'utf8');
    assert.match(content, /## §0 元信息/);
    assert.match(content, /## §1 决策段（vX\.Y\.Z: 砍 X 因为 Y）/);
    assert.match(content, /## §2 卡住 \/ 走偏/);
    assert.match(content, /## §3 父 archive 继承/);
    assert.match(content, /capabilities: v1-8-3-memory/);
    assert.match(content, /generated_by: bridge v1\.8\.3/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R2 场景 B：memory.md 已存在 → no-op（保护已有内容）
test('R2-B: initPersonalMemory — memory.md 已存在 → no-op（不覆盖）', async () => {
  const root = makeProjectRoot();
  try {
    const changeDir = join(root, 'changes', 'foo');
    mkdirSync(changeDir, { recursive: true });
    fakeStateYaml(changeDir);
    const existing = '# 已有 memory\n我自己写的内容\n';
    writeFileSync(join(changeDir, 'memory.md'), existing);
    const { initPersonalMemory } = await importCmdMemory();
    const result = initPersonalMemory(changeDir, root);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'exists');
    const content = readFileSync(join(changeDir, 'memory.md'), 'utf8');
    assert.equal(content, existing);  // 内容不被覆盖
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R2 场景 C：IDE memory 在场 + 非空 → no-op（个人层走 IDE）
test('R2-C: initPersonalMemory — IDE memory 在场 → no-op（个人层走 IDE）', async () => {
  const root = makeProjectRoot();
  try {
    const ideDir = join(root, '.codebuddy', 'memory');
    mkdirSync(ideDir, { recursive: true });
    writeFileSync(join(ideDir, 'MEMORY.md'), '# IDE curated\n');
    writeFileSync(join(ideDir, '2026-09-21.md'), '# daily\n');
    const changeDir = join(root, 'changes', 'foo');
    mkdirSync(changeDir, { recursive: true });
    fakeStateYaml(changeDir);
    const { initPersonalMemory } = await importCmdMemory();
    const result = initPersonalMemory(changeDir, root);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'ide_present');
    assert.ok(!existsSync(join(changeDir, 'memory.md')), 'IDE 在场时不该生成个人 memory.md');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});