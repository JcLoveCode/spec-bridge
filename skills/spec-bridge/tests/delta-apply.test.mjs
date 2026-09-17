// 引擎纯函数测试：delta 四操作、near-match 拒绝、幂等 no-op。
// 夹具格式对齐上游 docs/examples/add-dark-mode。
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDeltaToBaselineDetailed } from '../scripts/vendor/spec-publication.mjs';

const ADDED = `# Capability Spec

## ADDED Requirements

### Requirement: User can use dark mode

The system SHALL provide a dark theme variant for the primary user interface.

#### Scenario: User manually switches theme

- **WHEN** the user activates the theme toggle
- **THEN** the interface switches between light and dark mode immediately
`;

const ADDED_SECOND = `## ADDED Requirements

### Requirement: User preference persists

The system SHALL persist an explicit user theme choice across reloads.

#### Scenario: Saved choice overrides system preference

- **WHEN** a returning user has a saved theme choice
- **THEN** the application loads using the saved choice
`;

const MODIFIED = `## MODIFIED Requirements

### Requirement: User can use dark mode

The system SHALL provide a dark theme variant and respect reduced-motion preferences.

#### Scenario: User manually switches theme

- **WHEN** the user activates the theme toggle
- **THEN** the interface switches between light and dark mode immediately
`;

test('ADDED on empty baseline creates canonical baseline with Purpose', () => {
  const result = applyDeltaToBaselineDetailed('', ADDED, 'ui-theme');
  assert.ok(result.changed);
  assert.match(result.content, /## Purpose/);
  assert.match(result.content, /## Requirements/);
  assert.match(result.content, /### Requirement: User can use dark mode/);
  assert.deepEqual(result.operations, [{ operation: 'ADDED', status: 'applied' }]);
  // 基线绝不能带 delta 头
  assert.doesNotMatch(result.content, /##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements/);
});

test('ADDED is an idempotent no-op on a synchronized baseline', () => {
  const first = applyDeltaToBaselineDetailed('', ADDED, 'ui-theme');
  const second = applyDeltaToBaselineDetailed(first.content, ADDED, 'ui-theme');
  assert.equal(second.changed, false);
  assert.equal(second.operations[0].status, 'skipped');
});

test('MODIFIED applies and is idempotent on re-run', () => {
  const baseline = applyDeltaToBaselineDetailed('', ADDED, 'ui-theme').content;
  const modified = applyDeltaToBaselineDetailed(baseline, MODIFIED, 'ui-theme');
  assert.ok(modified.changed);
  assert.match(modified.content, /reduced-motion preferences/);
  const again = applyDeltaToBaselineDetailed(modified.content, MODIFIED, 'ui-theme');
  assert.equal(again.changed, false);
  assert.equal(again.operations[0].status, 'skipped');
});

test('near-match requirement names are rejected, never guessed', () => {
  const baseline = applyDeltaToBaselineDetailed('', ADDED, 'ui-theme').content;
  const nearDelta = ADDED.replace(
    '### Requirement: User can use dark mode',
    '### Requirement: user can use dark mode',
  );
  assert.throws(
    () => applyDeltaToBaselineDetailed(baseline, nearDelta, 'ui-theme'),
    /near-match/,
  );
});

test('REMOVED of a missing requirement is a skipped no-op, not an error', () => {
  const baseline = applyDeltaToBaselineDetailed('', ADDED, 'ui-theme').content;
  const removedDelta = `## REMOVED Requirements

- ### Requirement: Ghost requirement that never existed
`;
  const result = applyDeltaToBaselineDetailed(baseline, removedDelta, 'ui-theme');
  assert.equal(result.changed, false);
  assert.equal(result.operations[0].status, 'skipped');
});

test('RENAMED applies, but renaming onto an existing requirement throws', () => {
  let baseline = applyDeltaToBaselineDetailed('', ADDED, 'ui-theme').content;
  baseline = applyDeltaToBaselineDetailed(baseline, ADDED_SECOND, 'ui-theme').content;

  const renameOk = `## RENAMED Requirements

- FROM: \`### Requirement: User can use dark mode\`
- TO: \`### Requirement: Theme follows user choice\`
`;
  const renamed = applyDeltaToBaselineDetailed(baseline, renameOk, 'ui-theme');
  assert.ok(renamed.changed);
  assert.match(renamed.content, /### Requirement: Theme follows user choice/);

  const renameCollision = `## RENAMED Requirements

- FROM: \`### Requirement: Theme follows user choice\`
- TO: \`### Requirement: User preference persists\`
`;
  assert.throws(
    () => applyDeltaToBaselineDetailed(renamed.content, renameCollision, 'ui-theme'),
    /Cannot rename/,
  );
});
