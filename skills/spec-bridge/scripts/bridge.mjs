#!/usr/bin/env node
// bridge.mjs — spec-bridge 的确定性操作入口。
// 原则：prompt 管判断，代码管操作。SKILL.md 里的一切"必须精确"的动作都走这里。
//
// 用法：
//   node bridge.mjs sync <change-dir>                     # 发布 delta → 根基线 + 写回执
//   node bridge.mjs verify <change-dir>                   # 校验发布回执（closing guard）
//   node bridge.mjs state init <change-dir> [options]     # 初始化 .bridge.yaml
//   node bridge.mjs state get <change-dir> [field]        # 读状态（省略 field = 全部）
//   node bridge.mjs state set <change-dir> <field> <value>
//   node bridge.mjs state next <change-dir> <一句话>       # 写恢复提示 + 记大事记
//   node bridge.mjs event <change-dir> <一句话>            # 只记大事记
//   node bridge.mjs hashes <change-dir> [--check]         # 产物摘要 / 契约过期检测
//   node bridge.mjs layout <project-root>                 # 探测目录布局
//   node bridge.mjs list <project-root>                   # 列出活跃 change
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path, { join, resolve } from 'node:path';
import { run as runSync } from './vendor/cmd-sync.mjs';
import { run as runInit } from './cmd-init.mjs';
import { readState, writeState, appendEvent } from './vendor/bridge-state.mjs';
import { validatePublicationReceipt } from './vendor/spec-publication.mjs';

const ARTIFACTS = ['proposal.md', 'design.md', 'tasks.md'];

function usage(code = 2) {
  const text = [
    'Usage: bridge <command> [args]',
    '  init <name> [--capability <c>] [--branch <b>] [--layout <l>] [--capabilities <c>]',
    '                                     scaffold a new change dir (templates + state + log)',
    '  sync <change-dir>                  publish deltas to root baseline + receipt',
    '  verify <change-dir>                validate publication receipt (closing guard)',
    '  state init <change-dir> [--layout L] [--branch B] [--capabilities C]',
    '  state get <change-dir> [field]',
    '  state set <change-dir> <field> <value>',
    '  state next <change-dir> <one-line resume hint>',
    '  event <change-dir> <one-line event>',
    '  hashes <change-dir> [--check]      artifact digests / contract staleness check',
    '  layout <project-root>              detect openspec vs standalone layout',
    '  list <project-root>                list active changes (skips archive/)',
  ].join('\n');
  (code === 0 ? console.log : console.error)(text);
  process.exit(code);
}

function digest(entries) {
  const hash = createHash('sha256');
  for (const [name, content] of [...entries].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(name);
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

function walkSpecs(changeDir) {
  const specsDir = join(changeDir, 'specs');
  const files = [];
  if (!existsSync(specsDir)) return files;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === 'spec.md' && statSync(full).isFile()) files.push(full);
    }
  };
  walk(specsDir);
  return files.sort();
}

function currentHashes(changeDir) {
  const entries = [];
  for (const artifact of ARTIFACTS) {
    const file = join(changeDir, artifact);
    if (existsSync(file)) entries.push([artifact, readFileSync(file, 'utf-8')]);
  }
  for (const specFile of walkSpecs(changeDir)) {
    entries.push([path.relative(changeDir, specFile).split(path.sep).join('/'), readFileSync(specFile, 'utf-8')]);
  }
  const contractFile = join(changeDir, 'execution-contract.md');
  return {
    artifacts_hash: entries.length > 0 ? digest(entries) : null,
    contract_hash: existsSync(contractFile) ? digest([['execution-contract.md', readFileSync(contractFile, 'utf-8')]]) : null,
  };
}

function detectLayout(projectRoot) {
  const root = resolve(projectRoot);
  if (existsSync(join(root, 'openspec'))) {
    return { layout: 'openspec', changesDir: join(root, 'openspec', 'changes'), baselineDir: join(root, 'openspec', 'specs') };
  }
  return { layout: 'standalone', changesDir: join(root, 'changes'), baselineDir: join(root, 'specs') };
}

function listChanges(projectRoot) {
  const { layout, changesDir } = detectLayout(projectRoot);
  const changes = [];
  if (existsSync(changesDir)) {
    for (const dir of readdirSync(changesDir)) {
      if (dir === 'archive') continue;
      const dirPath = join(changesDir, dir);
      if (!statSync(dirPath).isDirectory()) continue;
      const state = existsSync(join(dirPath, '.bridge.yaml')) ? readState(dirPath) : null;
      changes.push({
        name: dir,
        has_state: Boolean(state),
        stage: state ? state.stage : null,
        next: state ? state.next : null,
      });
    }
  }
  return { layout, changesDir, changes };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) usage(2);

  if (command === 'init') {
    const result = await runInit(rest);
    process.exit(result.exitCode ?? 0);
  }

  if (command === 'sync') {
    const changeDir = rest[0];
    if (!changeDir) usage(2);
    const result = await runSync([changeDir]);
    process.exit(result.exitCode ?? 0);
  }

  if (command === 'verify') {
    const changeDir = rest[0];
    if (!changeDir) usage(2);
    const state = readState(changeDir);
    if (!state.published || !state.spec_publication_receipt) {
      console.error('FAIL: no publication receipt in .bridge.yaml (run sync first)');
      process.exit(1);
    }
    const report = validatePublicationReceipt(changeDir, state.spec_publication_receipt);
    if (report.pass) {
      console.log('PASS: publication receipt matches current deltas and published baseline');
      process.exit(0);
    }
    console.error(`FAIL: ${report.reason}`);
    process.exit(1);
  }

  if (command === 'state') {
    const [sub, changeDir, ...args] = rest;
    if (!sub || !changeDir) usage(2);
    if (sub === 'init') {
      const state = readState(changeDir);
      const options = {};
      for (let index = 0; index < args.length; index += 2) {
        const flag = args[index];
        if (!flag.startsWith('--')) usage(2);
        options[flag.slice(2)] = args[index + 1];
      }
      const next = writeState(changeDir, {
        ...state,
        ...(options.layout ? { layout: options.layout } : {}),
        ...(options.branch ? { branch: options.branch } : {}),
        ...(options.capabilities ? { capabilities: options.capabilities } : {}),
      });
      appendEvent(changeDir, 'state initialized');
      console.log(JSON.stringify(readState(changeDir), null, 2));
      process.exit(0);
    }
    if (sub === 'get') {
      const [field] = args;
      const state = readState(changeDir);
      if (!field) {
        console.log(JSON.stringify(state, null, 2));
        process.exit(0);
      }
      if (!(field in state)) {
        console.error(`unknown field: ${field}`);
        process.exit(2);
      }
      console.log(state[field] === null ? 'null' : String(state[field]));
      process.exit(0);
    }
    if (sub === 'set') {
      const [field, ...valueParts] = args;
      if (!field || valueParts.length === 0) usage(2);
      const state = readState(changeDir);
      if (!(field in state)) {
        console.error(`unknown field: ${field}`);
        process.exit(2);
      }
      writeState(changeDir, { ...state, [field]: valueParts.join(' ') });
      console.log(`${field} updated`);
      process.exit(0);
    }
    if (sub === 'next') {
      if (args.length === 0) usage(2);
      appendEvent(changeDir, `next: ${args.join(' ')}`);
      const state = readState(changeDir);
      writeState(changeDir, { ...state, next: args.join(' ') });
      console.log('next recorded');
      process.exit(0);
    }
    usage(2);
  }

  if (command === 'event') {
    const [changeDir, ...parts] = rest;
    if (!changeDir || parts.length === 0) usage(2);
    appendEvent(changeDir, parts.join(' '));
    console.log('event recorded');
    process.exit(0);
  }

  if (command === 'hashes') {
    const changeDir = rest[0];
    const check = rest.includes('--check');
    if (!changeDir) usage(2);
    const current = currentHashes(changeDir);
    if (!check) {
      console.log(JSON.stringify(current, null, 2));
      process.exit(0);
    }
    const state = readState(changeDir);
    const problems = [];
    if (state.artifacts_hash && current.artifacts_hash && state.artifacts_hash !== current.artifacts_hash) {
      problems.push('planning artifacts drifted since contract approval');
    }
    if (state.contract_hash && current.contract_hash && state.contract_hash !== current.contract_hash) {
      problems.push('execution-contract.md was edited after approval');
    }
    if (problems.length > 0) {
      console.error(`STALE: ${problems.join('; ')} → regenerate the contract before executing`);
      process.exit(1);
    }
    console.log('CURRENT: no drift detected');
    process.exit(0);
  }

  if (command === 'layout') {
    const projectRoot = rest[0];
    if (!projectRoot) usage(2);
    console.log(JSON.stringify(detectLayout(projectRoot), null, 2));
    process.exit(0);
  }

  if (command === 'list') {
    const projectRoot = rest[0];
    if (!projectRoot) usage(2);
    console.log(JSON.stringify(listChanges(projectRoot), null, 2));
    process.exit(0);
  }

  usage(2);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
