// 引擎纯函数测试：resolvePublicationContext 对 active / archive / 套娃 archive 路径都正确解析 projectRoot
// 修 v1.4 vendor bug（archive 路径走 else 分支算错 projectRoot）
// 对应 spec：specs/archive-publish-guard/spec.md R1 + 3 Scenario
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolvePublicationContext } from '../scripts/vendor/spec-publication.mjs';

function makeFixture(layout) {
  const root = mkdtempSync(join(tmpdir(), 'resolve-pub-ctx-'));
  if (layout === 'active') {
    mkdirSync(join(root, 'changes', 'v1-5-foo'), { recursive: true });
    return { root, changeDir: join(root, 'changes', 'v1-5-foo') };
  }
  if (layout === 'archive') {
    mkdirSync(join(root, 'changes', 'archive', '2026-09-18-v1-4-foo'), { recursive: true });
    return { root, changeDir: join(root, 'changes', 'archive', '2026-09-18-v1-4-foo') };
  }
  if (layout === 'nested-archive') {
    mkdirSync(join(root, 'changes', 'archive', '2026-09-18-v1-4-foo', 'sub', 'deep'), { recursive: true });
    return { root, changeDir: join(root, 'changes', 'archive', '2026-09-18-v1-4-foo', 'sub', 'deep') };
  }
  throw new Error(`unknown layout: ${layout}`);
}

test('Scenario: 活跃 change 路径 — projectRoot = dirname(changes)', () => {
  const { root, changeDir } = makeFixture('active');
  try {
    const ctx = resolvePublicationContext(changeDir);
    assert.equal(ctx.changeDir, changeDir);
    assert.equal(ctx.projectRoot, root);
    assert.equal(ctx.baselineSpecsDir, join(root, 'specs'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: archive 路径 — projectRoot = dirname(changes)，不再误算为 archive 目录', () => {
  const { root, changeDir } = makeFixture('archive');
  try {
    const ctx = resolvePublicationContext(changeDir);
    assert.equal(ctx.projectRoot, root, 'archive 路径必须解析回仓库根，不能停在 archive 目录');
    assert.equal(ctx.baselineSpecsDir, join(root, 'specs'), 'baselineSpecsDir 必须指向仓库根的 specs/');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Scenario: 套娃 archive 路径 — 任意深度都能解析回仓库根', () => {
  const { root, changeDir } = makeFixture('nested-archive');
  try {
    const ctx = resolvePublicationContext(changeDir);
    assert.equal(ctx.projectRoot, root, '套娃 archive 路径也必须解析回仓库根');
    assert.equal(ctx.baselineSpecsDir, join(root, 'specs'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});