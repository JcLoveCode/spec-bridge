// tests/mode.test.mjs — bridge mode 命令测试
// v1.9-1 / ADR-0014：mode 强度级别切换
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const BRIDGE = new URL('../scripts/bridge.mjs', import.meta.url).pathname;

function makeTmpRoot() {
  return mkdtempSync(join(tmpdir(), 'bridge-mode-'));
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

test('mode-get-default: no config returns full + source default', () => {
  const tmp = makeTmpRoot();
  try {
    const out = runBridge(['mode'], tmp);
    assert.match(out, /Current mode: full/);
    assert.match(out, /Source: default/);
  } finally {
    rmTmp(tmp);
  }
});

test('mode-set-and-get: set navigator persists', () => {
  const tmp = makeTmpRoot();
  try {
    runBridge(['mode', 'navigator'], tmp);
    const out = runBridge(['mode'], tmp);
    assert.match(out, /Current mode: navigator/);
    assert.match(out, /Source: project/);
  } finally {
    rmTmp(tmp);
  }
});

test('mode-set-off: sets off', () => {
  const tmp = makeTmpRoot();
  try {
    runBridge(['mode', 'off'], tmp);
    const out = runBridge(['mode'], tmp);
    assert.match(out, /Current mode: off/);
  } finally {
    rmTmp(tmp);
  }
});

test('mode-set-memory: sets memory', () => {
  const tmp = makeTmpRoot();
  try {
    runBridge(['mode', 'memory'], tmp);
    const out = runBridge(['mode'], tmp);
    assert.match(out, /Current mode: memory/);
  } finally {
    rmTmp(tmp);
  }
});

test('mode-invalid: throws on invalid mode', () => {
  const tmp = makeTmpRoot();
  try {
    assert.throws(() => runBridge(['mode', 'foobar'], tmp), /Invalid mode/);
  } finally {
    rmTmp(tmp);
  }
});

test('mode-write-file: config file exists at .bridge-config.json', () => {
  const tmp = makeTmpRoot();
  try {
    runBridge(['mode', 'navigator'], tmp);
    const configPath = join(tmp, '.bridge-config.json');
    assert.ok(existsSync(configPath), '.bridge-config.json should exist');
    const data = JSON.parse(readFileSync(configPath, 'utf8'));
    assert.equal(data.mode, 'navigator');
    assert.equal(data.version, '1.9');
    assert.ok(data.updatedAt, 'updatedAt should be set');
  } finally {
    rmTmp(tmp);
  }
});