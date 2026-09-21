// v1.8-1 Batch N（ψ3-1 选项 B）：sync --external-skip
// external_stack change 的 spec.md 是外栈格式（无 openspec ADDED/MODIFIED 段），
// sync 默认校验会拒绝。--external-skip 选项跳过 openspec 校验 + 不写根 baseline +
// 写 synthetic-publication-receipt 占位 + exit 0。
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = process.cwd();
const BRIDGE_BIN = join(REPO_ROOT, 'skills', 'spec-bridge', 'scripts', 'bridge.mjs');

function makeSandbox() {
  return mkdtempSync(join(tmpdir(), 'bridge-v181-sync-skip-'));
}

function bridge(args, cwd = REPO_ROOT) {
  const r = spawnSync(process.execPath, [BRIDGE_BIN, ...args], {
    cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

describe('sync --external-skip（ψ3-1 选项 B）', () => {
  test('B7 T1: external_stack change + --external-skip → exit 0 + 写合成回执', () => {
    const root = makeSandbox();
    try {
      // 1) 建 external_stack change（adopt 流程 + 外栈 spec.md）
      const changeDir = join(root, 'changes', 'demo');
      mkdirSync(changeDir, { recursive: true });
      writeFileSync(join(changeDir, 'proposal.md'), '# proposal', 'utf-8');
      writeFileSync(join(changeDir, 'design.md'), '# design', 'utf-8');
      writeFileSync(join(changeDir, 'tasks.md'), '# tasks', 'utf-8');
      mkdirSync(join(changeDir, 'specs', 'demo'), { recursive: true });
      writeFileSync(join(changeDir, 'specs', 'demo', 'spec.md'),
        '---\nexternal: true\nsynthesized_by: to-spec (matt-skills)\n---\n# spec (matt format, no openspec ADDED)\n',
        'utf-8');
      let r = bridge(['adopt', 'changes/demo', '--stack', 'matt'], root);
      assert.equal(r.status, 0, `adopt stderr: ${r.stderr}`);
      r = bridge(['state', 'set', 'changes/demo', 'stage', 'executing'], root);
      assert.equal(r.status, 0, `state set stderr: ${r.stderr}`);

      // 2) 不带 --external-skip 应失败（matt 格式 spec 无 ADDED 段）
      r = bridge(['sync', 'changes/demo'], root);
      assert.notEqual(r.status, 0, `sync without --external-skip should fail, got ${r.status}`);
      assert.match(r.stderr, /Invalid delta spec/i);

      // 3) 带 --external-skip 应成功
      r = bridge(['sync', 'changes/demo', '--external-skip'], root);
      assert.equal(r.status, 0, `sync --external-skip stderr: ${r.stderr}`);
      assert.match(r.stdout, /external.*skip|synthetic.*receipt/i);

      // 4) .bridge.yaml 应有 synthetic receipt + published: true
      const stateRaw = readFileSync(join(changeDir, '.bridge.yaml'), 'utf-8');
      assert.match(stateRaw, /^published: true/m);
      assert.match(stateRaw, /^spec_publication_receipt: /m);

      // 5) 根 specs/ 不应有 baseline（不开外栈 baseline 写）
      assert.ok(!existsSync(join(root, 'specs', 'demo', 'spec.md')),
        'baseline should NOT be written for external_stack skip');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('B7 T2: builtin change + --external-skip → 仍走 openspec 校验（不影响 builtin）', () => {
    const root = makeSandbox();
    try {
      let r = bridge(['init', 'demo', '--builtin'], root);
      assert.equal(r.status, 0, `init --builtin stderr: ${r.stderr}`);

      const changeDir = join(root, 'changes', 'demo');
      // 写 openspec 兼容的 spec.md（必须用 ### Requirement: + Scenario with **WHEN**/**THEN** bullet 格式）
      writeFileSync(join(changeDir, 'specs', 'demo', 'spec.md'),
        `## ADDED Requirements

### Requirement: User can test builtin

The system SHALL do X.

#### Scenario: first scenario

- **WHEN** the user triggers test
- **THEN** the system does X
`,
        'utf-8');

      r = bridge(['state', 'set', 'changes/demo', 'stage', 'executing'], root);
      assert.equal(r.status, 0, `state set stderr: ${r.stderr}`);

      // builtin change 配 --external-skip 应正常 sync（不强制跳过 openspec 校验）
      r = bridge(['sync', 'changes/demo', '--external-skip'], root);
      assert.equal(r.status, 0, `sync --external-skip on builtin should still work: ${r.stderr}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('B7 T3: bridge sync 无 --external-skip + 无 state → 走原 openspec 校验（向后兼容）', () => {
    const root = makeSandbox();
    try {
      // 不 init，直接建 changeDir + openspec 兼容 spec.md（模拟无 .bridge.yaml 旧调用方）
      const changeDir = join(root, 'changes', 'demo');
      mkdirSync(join(changeDir, 'specs', 'demo'), { recursive: true });
      writeFileSync(join(changeDir, 'specs', 'demo', 'spec.md'),
        `## ADDED Requirements

### Requirement: legacy no-state call

The system SHALL do Y.

#### Scenario: legacy call

- **WHEN** no .bridge.yaml exists
- **THEN** sync still validates via openspec protocol
`,
        'utf-8');

      // 无 .bridge.yaml + 无 --external-skip：原 openspec 校验路径（不进 synthetic-skip 分支）
      const r = bridge(['sync', 'changes/demo'], root);
      assert.equal(r.status, 0, `sync no-state should still validate: ${r.stderr}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('B7 T4: 隐式外栈（spec frontmatter synthesized_by）配 --external-skip → 跳过 openspec 校验（v1.8-1 自身场景）', () => {
    const root = makeSandbox();
    try {
      // 建 changeDir + external 风格 spec.md（无 state.external_stack，但 frontmatter 是外栈）
      const changeDir = join(root, 'changes', 'demo');
      mkdirSync(changeDir, { recursive: true });
      mkdirSync(join(changeDir, 'specs', 'demo'), { recursive: true });
      writeFileSync(join(changeDir, 'specs', 'demo', 'spec.md'),
        `---
external: true
synthesized_by: to-spec (matt-skills)
---

# v1.8-1 spec (matt format)

## Problem Statement

matt style.

## ADDED Requirements

none — external stack owns spec format.
`,
        'utf-8');
      // 写最小 state 让 verify 路径走通
      writeFileSync(join(changeDir, '.bridge.yaml'),
        `stage: executing
layout: standalone
workflow_kind: matt
`, 'utf-8');

      // 隐式外栈（无 state.external_stack 但 frontmatter 标了）配 --external-skip 应成功
      const r = bridge(['sync', 'changes/demo', '--external-skip'], root);
      assert.equal(r.status, 0, `sync --external-skip on implicit external should work: ${r.stderr}`);
      const stateRaw = readFileSync(join(changeDir, '.bridge.yaml'), 'utf-8');
      assert.match(stateRaw, /^published: true/m);
      assert.match(stateRaw, /^external_stack: to-spec/m);
      assert.match(stateRaw, /^spec_publication_receipt: /m);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
