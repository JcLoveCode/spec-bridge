// v1.10-1 Batch 3 测试（T2）：
// vendor 目录完整性 3 场景验证（D1 + C1-C5 + VENDOR.md 协议）
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..'); // tests/ → skills/spec-bridge/ → skills/ → 仓库根
const VENDOR = join(ROOT, 'skills', 'external-matt');

const EXPECTED_SKILLS = [
  'to-spec',
  'to-tickets',
  'to-goal',
  'goal-crafter',
  'spec-executor',
  'execute-spec-in-fork',
];

test('T2.1: vendor 目录存在 6 个 SKILL.md', () => {
  for (const skill of EXPECTED_SKILLS) {
    const path = join(VENDOR, 'engineering', skill, 'SKILL.md');
    assert.ok(existsSync(path), `${path} should exist (vendor missing skill: ${skill})`);
    const content = readFileSync(path, 'utf-8');
    // 每个 SKILL.md 必须有 frontmatter（以 --- 开头）
    assert.match(content, /^---\nname: /m, `${skill}/SKILL.md must have frontmatter`);
  }
});

test('T2.2: VENDOR.md 含上游 commit + 版本 + 许可证声明', () => {
  const vendorPath = join(VENDOR, 'VENDOR.md');
  assert.ok(existsSync(vendorPath), 'VENDOR.md should exist');
  const content = readFileSync(vendorPath, 'utf-8');
  // 必填字段
  assert.match(content, /commit/i, 'VENDOR.md must mention commit');
  assert.match(content, /1\.2\.3-to-goal\.2/, 'VENDOR.md must pin upstream version');
  assert.match(content, /MIT/i, 'VENDOR.md must mention MIT license');
  // 同步策略
  assert.match(content, /手动/, 'VENDOR.md must describe manual sync strategy');
});

test('T2.3: LICENSE 文件存在且含 MIT 字样', () => {
  const licensePath = join(VENDOR, 'LICENSE');
  assert.ok(existsSync(licensePath), 'LICENSE should exist');
  const content = readFileSync(licensePath, 'utf-8');
  assert.match(content, /MIT License/i, 'LICENSE must contain "MIT License"');
  // 版权归属
  assert.match(content, /Copyright/i, 'LICENSE must contain copyright notice');
});

test('T2.4 (边界): vendor 内容与上游一致（spot check: to-goal SKILL.md 含 5 段模板）', () => {
  // 不发起网络请求，仅校验内容结构（手动同步的 C5 0 修改验证通过 readFileSync 内容匹配）
  const toGoalPath = join(VENDOR, 'engineering', 'to-goal', 'SKILL.md');
  const content = readFileSync(toGoalPath, 'utf-8');
  // 5 段模板：Current state / Execution order / Completion criteria / Constraints / Context
  assert.match(content, /Current state/, 'to-goal must have Current state section');
  assert.match(content, /Execution order/, 'to-goal must have Execution order section');
  assert.match(content, /Completion criteria/, 'to-goal must have Completion criteria section');
  assert.match(content, /Constraints/, 'to-goal must have Constraints section');
  assert.match(content, /Context/, 'to-goal must have Context section');
});