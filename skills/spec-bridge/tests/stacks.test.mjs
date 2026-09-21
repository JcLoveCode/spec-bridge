// tests/stacks.test.mjs — bridge stacks 命令测试
// v1.9-1 / ADR-0014：手动配置能力栈
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const BRIDGE = new URL('../scripts/bridge.mjs', import.meta.url).pathname;

function makeTmpRoot() {
  return mkdtempSync(join(tmpdir(), 'bridge-stacks-'));
}

function rmTmp(root) {
  try { rmSync(root, { recursive: true, force: true }); } catch {}
}

function runBridge(args, cwd) {
  return execFileSync(process.execPath, [BRIDGE, ...args], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8'
  }).trim();
}

test('stacks-list-empty: empty config returns []', () => {
  const tmp = makeTmpRoot();
  try {
    const out = runBridge(['stacks', 'list'], tmp);
    assert.match(out, /\[\] \(empty\)/);
    assert.match(out, /Source: default/);
  } finally {
    rmTmp(tmp);
  }
});

test('stacks-set: set matt,superpowers → priority 1,2', () => {
  const tmp = makeTmpRoot();
  try {
    runBridge(['stacks', 'set', 'matt,superpowers'], tmp);
    const out = runBridge(['stacks', 'list'], tmp);
    assert.match(out, /"kind": "matt"/);
    assert.match(out, /"priority": 1/);
    assert.match(out, /"kind": "superpowers"/);
    assert.match(out, /"priority": 2/);
  } finally {
    rmTmp(tmp);
  }
});

test('stacks-add: add openspec → appended with priority 3', () => {
  const tmp = makeTmpRoot();
  try {
    runBridge(['stacks', 'set', 'matt,superpowers'], tmp);
    runBridge(['stacks', 'add', 'openspec'], tmp);
    const out = runBridge(['stacks', 'list'], tmp);
    assert.match(out, /"kind": "openspec"/);
    assert.match(out, /"priority": 3/);
  } finally {
    rmTmp(tmp);
  }
});

test('stacks-remove: remove matt → superpowers renumbers to priority 1', () => {
  const tmp = makeTmpRoot();
  try {
    runBridge(['stacks', 'set', 'matt,superpowers'], tmp);
    runBridge(['stacks', 'remove', 'matt'], tmp);
    const out = runBridge(['stacks', 'list'], tmp);
    assert.ok(!/matt/.test(out), 'matt should be removed');
    assert.match(out, /"kind": "superpowers"/);
    assert.match(out, /"priority": 1/);
  } finally {
    rmTmp(tmp);
  }
});

test('stacks-add-duplicate: no-op when kind already exists', () => {
  const tmp = makeTmpRoot();
  try {
    runBridge(['stacks', 'set', 'matt'], tmp);
    runBridge(['stacks', 'add', 'matt'], tmp);
    const data = JSON.parse(readFileSync(join(tmp, '.bridge-config.json'), 'utf8'));
    assert.equal(data.stacks.length, 1);
  } finally {
    rmTmp(tmp);
  }
});

test('stacks-set-invalid: throws on unknown kind', () => {
  const tmp = makeTmpRoot();
  try {
    assert.throws(() => runBridge(['stacks', 'set', 'foobar'], tmp), /Invalid stack/);
  } finally {
    rmTmp(tmp);
  }
});

test('stacks-add-invalid: throws on unknown kind', () => {
  const tmp = makeTmpRoot();
  try {
    assert.throws(() => runBridge(['stacks', 'add', 'bogus'], tmp), /Invalid stack/);
  } finally {
    rmTmp(tmp);
  }
});

test('stacks-persistence: config file contains all set stacks', () => {
  const tmp = makeTmpRoot();
  try {
    runBridge(['stacks', 'set', 'matt,openspec,superpowers'], tmp);
    const data = JSON.parse(readFileSync(join(tmp, '.bridge-config.json'), 'utf8'));
    assert.equal(data.stacks.length, 3);
    assert.deepEqual(
      data.stacks.map((s) => s.kind),
      ['matt', 'openspec', 'superpowers']
    );
  } finally {
    rmTmp(tmp);
  }
});