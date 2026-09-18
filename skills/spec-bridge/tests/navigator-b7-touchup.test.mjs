// v1.2 follow-up B7 / R2 测试：SKILL.md §3 硬性步骤栏存在性
// 验证 §3 含 "hard step" 至少 2 次 + "state set stage executing" 字面量 + "bridge next" 字面量。
// 这是"硬性步骤栏"落地的最小自证（设计 D1/D4）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, '..', 'SKILL.md');

test('R2 场景 1：SKILL.md §3 硬性步骤栏存在（至少 2 条 hard step）', () => {
  const md = readFileSync(SKILL, 'utf-8');
  const hardStepCount = (md.match(/hard step/g) ?? []).length;
  assert.ok(hardStepCount >= 2, `expected ≥2 "hard step" markers, got ${hardStepCount}`);
});

test('R2 场景 2：硬性步骤栏引用 "state set ... stage executing" 命令（允许 <dir> 占位）', () => {
  const md = readFileSync(SKILL, 'utf-8');
  // 占位符 <dir> 在 SKILL.md 中合法——测试允许其存在
  assert.match(md, /state set\s+<\w+>\s+stage executing/);
});

test('R2 场景 3：硬性步骤栏引用 "bridge next" 命令字面量', () => {
  const md = readFileSync(SKILL, 'utf-8');
  // 命中硬性步骤栏的 "bridge next"，不是 §5 速查表
  const stepBlock = md.split('### executing')[1]?.split('### archived')[0] ?? '';
  assert.match(stepBlock, /bridge next/, 'hard step block under executing must mention bridge next');
});

test('R2 场景 4：硬性步骤栏位于 §3 executing 段内（非 §1/§2/§4/§5）', () => {
  const md = readFileSync(SKILL, 'utf-8');
  const executingSection = md.split('### executing')[1]?.split('### archived')[0] ?? '';
  assert.match(executingSection, /> \*\*hard step — entering executing\*\*/);
  assert.match(executingSection, /> \*\*hard step — before each batch\*\*/);
});