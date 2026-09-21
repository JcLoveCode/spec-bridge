// v1.8-1 Batch 6（C10）：distill 跳过 external_stack change 的 frontmatter 蒸馏
// external change（adopt 来的）的 design.md 通常是外栈格式，不含 bridge 的 ### D<N> — name 格式
// distill 必须检测到时跳过并提示，不强写 why.md
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const BRIDGE_BIN = join(REPO_ROOT, 'skills', 'spec-bridge', 'scripts', 'bridge.mjs');

function makeSandbox() {
  return mkdtempSync(join(tmpdir(), 'bridge-v181-distill-'));
}

import { spawnSync } from 'node:child_process';

function bridgeSync(args, cwd = REPO_ROOT) {
  const r = spawnSync(process.execPath, [BRIDGE_BIN, ...args], {
    cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

describe('B6 distill-skip-external（C10）', () => {
  test('B6 T1: external_stack change 调 distill → 跳过 + exit 0 + 写 stderr 提示', () => {
    const root = makeSandbox();
    try {
      // adopt 用于外栈产物接管：先建 changeDir + 4 件模板，再 adopt
      const changeDir = join(root, 'changes', 'demo');
      mkdirSync(changeDir, { recursive: true });
      writeFileSync(join(changeDir, 'proposal.md'), '# proposal', 'utf-8');
      writeFileSync(join(changeDir, 'design.md'), '# design', 'utf-8');
      writeFileSync(join(changeDir, 'tasks.md'), '# tasks', 'utf-8');
      mkdirSync(join(changeDir, 'specs', 'demo'), { recursive: true });
      writeFileSync(join(changeDir, 'specs', 'demo', 'spec.md'), '---\nkind: matt\n---\n# spec\n', 'utf-8');

      let r = bridgeSync(['adopt', 'changes/demo', '--stack', 'matt'], root);
      assert.equal(r.status, 0, `adopt stderr: ${r.stderr}`);

      // 2) 写入外栈风格的 design.md（无 ### D<N> — name）
      writeFileSync(join(changeDir, 'design.md'),
        '# Design (matt format)\n\n## Why matt\n\n外栈有自己的决策记录格式。\n', 'utf-8');

      // 3) 调 distill，应跳过
      r = bridgeSync(['distill', 'changes/demo'], root);
      assert.equal(r.status, 0, `distill should exit 0 on external, got ${r.status} stderr: ${r.stderr}`);
      assert.match(r.stderr, /skip.*external_stack/is, `stderr should mention external skip: ${r.stderr}`);
      assert.ok(!existsSync(join(changeDir, 'specs', 'demo', 'why.md')), 'why.md should NOT be created for external');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('B6 T2: builtin change 调 distill → 正常写 why.md（外部栈跳过不影响 builtin）', () => {
    const root = makeSandbox();
    try {
      let r = bridgeSync(['init', 'demo', '--builtin'], root);
      assert.equal(r.status, 0, `init --builtin stderr: ${r.stderr}`);

      const changeDir = join(root, 'changes', 'demo');
      // 写符合 bridge 格式的 design.md（### D1 — name + 决定/理由）
      writeFileSync(join(changeDir, 'design.md'),
        '# Design\n\n## Decisions\n\n### D1 — test decision\n\n**决定**：xxx\n**理由**：yyy\n\n## Purpose\n\ntest purpose\n', 'utf-8');

      r = bridgeSync(['distill', 'changes/demo'], root);
      assert.equal(r.status, 0, `distill builtin stderr: ${r.stderr}`);
      assert.ok(existsSync(join(changeDir, 'specs', 'demo', 'why.md')), 'why.md should be created for builtin');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
