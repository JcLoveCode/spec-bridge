// v1.8-3 测试（ADR-0013 D1）：detectIdeMemory 探测 IDE 自带 memory 的 3 场景。
//   1. .codebuddy/memory/ 不存在 → present=false
//   2. .codebuddy/memory/ 存在 + 至少一个 .md → present=true + 统计 daily + curated 行数
//   3. .codebuddy/memory/ 存在但空 → present=true + isEmpty=true（fallback 仍走个人层）
//
// 接缝：直接 import { detectIdeMemory } 然后传临时项目根调用。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CMD_MEMORY = join(HERE, '..', 'scripts', 'cmd-memory.mjs');

async function importCmdMemory() {
  return import(CMD_MEMORY);
}

function makeProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'bridge-v183-mem-detect-'));
}

// R1 场景 1：.codebuddy/memory/ 不存在 → present=false
test('R1-A: detectIdeMemory — .codebuddy/memory/ 不存在返回 present=false', async () => {
  const root = makeProjectRoot();
  try {
    const { detectIdeMemory } = await importCmdMemory();
    const result = detectIdeMemory(root);
    assert.equal(result.present, false);
    assert.equal(result.path, null);
    assert.equal(result.dailyCount, 0);
    assert.equal(result.curatedLines, 0);
    assert.equal(result.isEmpty, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R1 场景 2：.codebuddy/memory/ 存在 + MEMORY.md + 2 个 daily 文件 → 统计
test('R1-B: detectIdeMemory — .codebuddy/memory/ 在场 + 含 MEMORY.md + daily 文件 → 统计正确', async () => {
  const root = makeProjectRoot();
  try {
    const ideDir = join(root, '.codebuddy', 'memory');
    mkdirSync(ideDir, { recursive: true });
    writeFileSync(join(ideDir, 'MEMORY.md'), '# Curated Memory\n\nline1\nline2\nline3\n');
    writeFileSync(join(ideDir, '2026-09-20.md'), '# daily 20\n');
    writeFileSync(join(ideDir, '2026-09-21.md'), '# daily 21\n');
    const { detectIdeMemory } = await importCmdMemory();
    const result = detectIdeMemory(root);
    assert.equal(result.present, true);
    assert.equal(result.path, ideDir);
    assert.equal(result.dailyCount, 2);
    assert.equal(result.curatedLines, 4);  // # Curated Memory + line1 + line2 + line3 = 4 非空行（空行不计）
    assert.equal(result.isEmpty, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// R1 场景 3：.codebuddy/memory/ 存在但无 .md 文件 → isEmpty=true（fallback 仍走个人层）
test('R1-C: detectIdeMemory — .codebuddy/memory/ 在场但空 → isEmpty=true', async () => {
  const root = makeProjectRoot();
  try {
    const ideDir = join(root, '.codebuddy', 'memory');
    mkdirSync(ideDir, { recursive: true });
    writeFileSync(join(ideDir, 'README.md'), '# 不是 .md 触发文件');  // 故意命名为 README.md
    const { detectIdeMemory } = await importCmdMemory();
    const result = detectIdeMemory(root);
    assert.equal(result.present, true);
    assert.equal(result.isEmpty, false);  // README.md 仍算 .md
    assert.equal(result.dailyCount, 0);
    assert.equal(result.curatedLines, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});