// 端到端测试：sync 发布 → 回执 → verify（closing guard）→ 篡改检测 → 跨 change 冲突。
// 覆盖 vendored cmd-sync 的完整编排路径与 .bridge.yaml 接缝。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run as runSync } from '../scripts/vendor/cmd-sync.mjs';
import { readState, writeState } from '../scripts/vendor/bridge-state.mjs';
import { validatePublicationReceipt } from '../scripts/vendor/spec-publication.mjs';

function fakeStream() {
  return { chunks: [], write(chunk) { this.chunks.push(String(chunk)); } };
}

function makeProject() {
  const root = mkdtempSync(join(tmpdir(), 'spec-bridge-'));
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function makeChange(root, name, specContent, { stage = 'planning' } = {}) {
  const changeDir = join(root, 'changes', name, 'specs', 'ui-theme');
  mkdirSync(changeDir, { recursive: true });
  writeFileSync(join(changeDir, 'spec.md'), specContent, 'utf-8');
  const dir = join(root, 'changes', name);
  writeState(dir, { stage, layout: 'standalone', branch: 'REQ-100' });
  return dir;
}

const DELTA = `# Capability Spec

## ADDED Requirements

### Requirement: User can use dark mode

The system SHALL provide a dark theme variant for the primary user interface.

#### Scenario: User manually switches theme

- **WHEN** the user activates the theme toggle
- **THEN** the interface switches between light and dark mode immediately
`;

test('sync publishes the baseline, writes a receipt, and verify passes', async () => {
  const { root, cleanup } = makeProject();
  try {
    const changeDir = makeChange(root, 'REQ-100-dark-mode', DELTA);
    const stdout = fakeStream();
    const result = await runSync([changeDir], { stdout, stderr: fakeStream() });
    assert.equal(result.exitCode, 0, stdout.chunks.join(''));

    const baseline = readFileSync(join(root, 'specs', 'ui-theme', 'spec.md'), 'utf-8');
    assert.match(baseline, /## Requirements/);
    assert.match(baseline, /### Requirement: User can use dark mode/);
    assert.doesNotMatch(baseline, /##\s+ADDED\s+Requirements/);

    const state = readState(changeDir);
    assert.equal(state.published, true);
    assert.ok(state.spec_publication_receipt, 'receipt must be written to .bridge.yaml');

    const report = validatePublicationReceipt(changeDir, state.spec_publication_receipt);
    assert.ok(report.pass, report.reason);
  } finally {
    cleanup();
  }
});

test('verify fails after the published baseline is tampered with', async () => {
  const { root, cleanup } = makeProject();
  try {
    const changeDir = makeChange(root, 'REQ-100-dark-mode', DELTA);
    await runSync([changeDir], { stdout: fakeStream(), stderr: fakeStream() });

    const baselineFile = join(root, 'specs', 'ui-theme', 'spec.md');
    appendFileSync(baselineFile, '\nSneaky post-publication edit.\n', 'utf-8');

    const state = readState(changeDir);
    const report = validatePublicationReceipt(changeDir, state.spec_publication_receipt);
    assert.equal(report.pass, false);
    assert.match(report.reason, /published baseline has changed/);
  } finally {
    cleanup();
  }
});

test('the same requirement modified by two active changes is a hard conflict', async () => {
  const { root, cleanup } = makeProject();
  try {
    // 先发布基线，种子 change 归档退出竞争
    const seed = makeChange(root, 'REQ-100-dark-mode', DELTA);
    await runSync([seed], { stdout: fakeStream(), stderr: fakeStream() });
    writeState(seed, { stage: 'archived' });

    // 两个活跃 change 同时 MODIFIED 同一条需求（ADDED 不参与冲突检测，MODIFIED 才算）
    const MODIFIED_SAME = `## MODIFIED Requirements

### Requirement: User can use dark mode

The system SHALL provide a dark theme variant tuned by brand team.

#### Scenario: User manually switches theme

- **WHEN** the user activates the theme toggle
- **THEN** the interface switches between light and dark mode immediately
`;
    const first = makeChange(root, 'REQ-101-brand-theme', MODIFIED_SAME, { stage: 'contracted' });
    makeChange(root, 'REQ-102-contrast', MODIFIED_SAME, { stage: 'contracted' });

    const stdout = fakeStream();
    const result = await runSync([first], { stdout, stderr: fakeStream() });
    assert.equal(result.exitCode, 1);
    assert.match(stdout.chunks.join(''), /conflict/i);
  } finally {
    cleanup();
  }
});

test('terminal changes are excluded from conflict detection', async () => {
  const { root, cleanup } = makeProject();
  try {
    const first = makeChange(root, 'REQ-100-dark-mode', DELTA);
    await runSync([first], { stdout: fakeStream(), stderr: fakeStream() });
    writeState(first, { stage: 'archived' }); // 终态：不再是竞争输入

    const MODIFIED_NEXT = `## MODIFIED Requirements

### Requirement: User can use dark mode

The system SHALL provide a dark theme variant with high contrast.

#### Scenario: User manually switches theme

- **WHEN** the user activates the theme toggle
- **THEN** the interface switches between light and dark mode immediately
`;
    const second = makeChange(root, 'REQ-101-contrast', MODIFIED_NEXT, { stage: 'contracted' });
    const stdout = fakeStream();
    const result = await runSync([second], { stdout, stderr: fakeStream() });
    assert.equal(result.exitCode, 0, stdout.chunks.join(''));
  } finally {
    cleanup();
  }
});
