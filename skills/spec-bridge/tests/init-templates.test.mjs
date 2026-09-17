// 模板常量单元测试（契约 R1 测试义务的一部分）：
// 5 模板非空 + 必含节段标记 + 占位符齐备（fillTemplate 可替换）。
// 模板是 spec 的下界（Escalation E3）：渲染出空串/缺节段时查模板，不是查测试。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROPOSAL_TEMPLATE,
  DESIGN_TEMPLATE,
  TASKS_TEMPLATE,
  SPEC_TEMPLATE,
  CONTRACT_TEMPLATE,
} from '../scripts/cmd-init.mjs';

const ALL = { PROPOSAL_TEMPLATE, DESIGN_TEMPLATE, TASKS_TEMPLATE, SPEC_TEMPLATE, CONTRACT_TEMPLATE };

test('5 个模板均为非空字符串', () => {
  for (const [name, template] of Object.entries(ALL)) {
    assert.equal(typeof template, 'string', `${name} 应为 string`);
    assert.ok(template.trim().length > 50, `${name} 不应为空或过短`);
  }
});

test('proposal 模板含 Intent Lock 与 Scope Fence 源节段', () => {
  assert.match(PROPOSAL_TEMPLATE, /## Why/);
  assert.match(PROPOSAL_TEMPLATE, /## What Changes/);
  assert.match(PROPOSAL_TEMPLATE, /## Scope/);
  assert.match(PROPOSAL_TEMPLATE, /### In Scope/);
  assert.match(PROPOSAL_TEMPLATE, /### Out of Scope/);
});

test('design 模板含 why 蒸馏唯一权威源节段（ADR-0003）', () => {
  assert.match(DESIGN_TEMPLATE, /## Purpose/);
  assert.match(DESIGN_TEMPLATE, /## Decisions/);
  assert.match(DESIGN_TEMPLATE, /### D1 —/);
});

test('tasks 模板含批次结构与归档尾拍', () => {
  assert.match(TASKS_TEMPLATE, /## Batch 1/);
  assert.match(TASKS_TEMPLATE, /sync changes\/\{\{NAME\}\}/);
  assert.match(TASKS_TEMPLATE, /verify changes\/\{\{NAME\}\}/);
  assert.match(TASKS_TEMPLATE, /why\.md/);
  assert.match(TASKS_TEMPLATE, /changes\/archive\//);
});

test('spec 模板含 OpenSpec delta 语法骨架', () => {
  assert.match(SPEC_TEMPLATE, /## Purpose/);
  assert.match(SPEC_TEMPLATE, /## ADDED Requirements/);
  assert.match(SPEC_TEMPLATE, /### Requirement:/);
  assert.match(SPEC_TEMPLATE, /#### Scenario:/);
  assert.match(SPEC_TEMPLATE, /\*\*WHEN\*\*/);
  assert.match(SPEC_TEMPLATE, /\*\*THEN\*\*/);
});

test('contract 模板含六段握手结构（contract-mapping.md 模板）', () => {
  assert.match(CONTRACT_TEMPLATE, /## Intent Lock/);
  assert.match(CONTRACT_TEMPLATE, /## Scope Fence/);
  assert.match(CONTRACT_TEMPLATE, /## Approved Requirements/);
  assert.match(CONTRACT_TEMPLATE, /## Constraints/);
  assert.match(CONTRACT_TEMPLATE, /## Execution Batches/);
  assert.match(CONTRACT_TEMPLATE, /## Escalation Rules/);
});

test('占位符齐备：{{NAME}} / {{CAP}} 可被 fillTemplate 替换', () => {
  assert.match(PROPOSAL_TEMPLATE, /\{\{NAME\}\}/);
  assert.match(DESIGN_TEMPLATE, /\{\{NAME\}\}/);
  assert.match(TASKS_TEMPLATE, /\{\{NAME\}\}/);
  assert.match(TASKS_TEMPLATE, /\{\{CAP\}\}/);
  assert.match(CONTRACT_TEMPLATE, /\{\{NAME\}\}/);
  assert.match(CONTRACT_TEMPLATE, /\{\{CAP\}\}/);
});