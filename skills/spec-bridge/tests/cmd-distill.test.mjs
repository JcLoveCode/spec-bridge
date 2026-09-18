// 引擎纯函数测试：cmd-distill 子命令从 design.md ## Decisions 蒸馏生成 specs/<cap>/why.md
// 对应 spec：specs/archive-publish-guard/spec.md R2（蒸馏 CLI 守卫）
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '../scripts/cmd-distill.mjs';

const DESIGN_FIXTURE = `# Design: fixture

## Purpose

一句话：测试蒸馏 fixture

## Decisions

### D1 — 测试决策一

**选项**：
- A. 选项 A
- B. 选项 B

**决定**：**A**

**理由**：选项 A 更直接最小改动

### D2 — 测试决策二

**选项**：...
**决定**：...
**理由**：选项 B 显式命令
`;

function makeFixture(opts = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cmd-distill-'));
  const changeDir = join(root, 'changes', 'v1-5-fixture');
  mkdirSync(join(changeDir, 'specs', 'fixture-cap'), { recursive: true });
  writeFileSync(join(changeDir, '.bridge.yaml'), 'stage: contracted\n');
  writeFileSync(join(changeDir, 'design.md'), opts.design ?? DESIGN_FIXTURE);
  writeFileSync(join(changeDir, 'specs', 'fixture-cap', 'spec.md'), '## Purpose\n\nspec body\n');
  if (opts.whyExists) {
    writeFileSync(join(changeDir, 'specs', 'fixture-cap', 'why.md'), 'pre-existing content');
  }
  return { root, changeDir };
}

function silentIO() {
  return {
    stdout: { write: () => {} },
    stderr: { write: () => {} },
  };
}

function captureIO() {
  const stdout = [];
  const stderr = [];
  return {
    stdout: { write: (msg) => stdout.push(String(msg)) },
    stderr: { write: (msg) => stderr.push(String(msg)) },
    out: () => stdout.join(''),
    err: () => stderr.join(''),
  };
}

test('Scenario: design.md 有 D1+D2 → 生成 why.md（Conclusion + Source-of-truth + 2 条 D + spec-rev）', async () => {
  const { root, changeDir } = makeFixture();
  try {
    const io = captureIO();
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 0);
    const whyPath = join(changeDir, 'specs', 'fixture-cap', 'why.md');
    assert.ok(existsSync(whyPath), 'why.md should exist after distill');
    const content = readFileSync(whyPath, 'utf-8');
    assert.match(content, /^# Why: v1-5-fixture/m);
    assert.match(content, /## Conclusion/);
    assert.match(content, /一句话：测试蒸馏 fixture/);
    assert.match(content, /## Source-of-truth/);
    assert.match(content, /### D1 — 测试决策一/);
    assert.match(content, /### D2 — 测试决策二/);
    assert.match(content, /选项 A 更直接最小改动/);
    assert.match(content, /## spec-rev/);
    assert.match(io.out(), /distilled: .*why\.md/);
    assert.match(io.out(), /2 decisions extracted/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: design.md 缺 ## Decisions 段 → exit 1 + stderr 含提示', async () => {
  const design = `# Design: fixture

## Purpose

no decisions section here at all
`;
  const { root, changeDir } = makeFixture({ design });
  const io = captureIO();
  try {
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 1);
    assert.match(io.err(), /no .*## Decisions/i);
    assert.ok(!existsSync(join(changeDir, 'specs', 'fixture-cap', 'why.md')), 'why.md should not be written on failure');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: why.md 已存在 → exit 1 + 拒绝覆盖', async () => {
  const { root, changeDir } = makeFixture({ whyExists: true });
  const io = captureIO();
  try {
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 1);
    assert.match(io.err(), /refuse to overwrite/i);
    const whyPath = join(changeDir, 'specs', 'fixture-cap', 'why.md');
    assert.equal(readFileSync(whyPath, 'utf-8'), 'pre-existing content', 'pre-existing why.md must remain intact');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: design.md 不存在 → exit 1 + stderr 含提示', async () => {
  const { root, changeDir } = makeFixture();
  const { unlinkSync } = await import('node:fs');
  unlinkSync(join(changeDir, 'design.md'));
  const io = captureIO();
  try {
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 1);
    assert.match(io.err(), /no design\.md/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: change-dir 缺 .bridge.yaml → exit 1（不是有效 change dir）', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cmd-distill-'));
  const fakeDir = join(root, 'not-a-change');
  mkdirSync(fakeDir, { recursive: true });
  const io = captureIO();
  try {
    const result = await run([fakeDir], io);
    assert.equal(result.exitCode, 1);
    assert.match(io.err(), /no \.bridge\.yaml/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: design.md 含 ## Out-of-scope decisions 子段 → D1+D2+D3 全部抽到（v1.5 实战场景）', async () => {
  // design.md 在 ## Decisions 后接 ## Out-of-scope decisions（用 ## 格式但语义是子段）
  // 旧实现按 ## 段边界截断会丢 D3+。新实现跨段抽取。
  const design = `# Design: v1-5-like

## Purpose

跨段测试

## Decisions

### D1 — 决策一

**选项**：A / B
**决定**：A
**理由**：选 A

### D2 — 决策二

**选项**：A / B
**决定**：B
**理由**：选 B

### D3 — 决策三（Out-of-scope 之后仍要抽到）

**选项**：A / B
**决定**：A
**理由**：选 A 即使跨段

## Out-of-scope decisions（明确不做的）

- **D-A**: 不补 v1.4
- **D-B**: 不重写 vendor
`;
  const { root, changeDir } = makeFixture({ design });
  const io = captureIO();
  try {
    const result = await run([changeDir], io);
    assert.equal(result.exitCode, 0);
    assert.match(io.out(), /3 decisions extracted/, 'must extract D1+D2+D3 across ## Out-of-scope segment');
    const content = readFileSync(join(changeDir, 'specs', 'fixture-cap', 'why.md'), 'utf-8');
    assert.match(content, /### D1 — 决策一/);
    assert.match(content, /### D2 — 决策二/);
    assert.match(content, /### D3 — 决策三/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});