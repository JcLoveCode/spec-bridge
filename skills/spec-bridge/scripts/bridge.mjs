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
import { run as runAdopt } from './cmd-adopt.mjs';
import { run as runNext } from './cmd-next.mjs';
import { run as runProbe } from './cmd-probe.mjs';
import { run as runPattern } from './cmd-pattern.mjs';
import { run as runMention, runRootcause } from './cmd-mention.mjs';
import { run as runRebuttal } from './cmd-rebuttal.mjs';
import { run as runDistill } from './cmd-distill.mjs';
import { run as runArchiveReady } from './cmd-archive-ready.mjs';
import { readState, writeState, appendEvent, checkStageTransition } from './vendor/bridge-state.mjs';
import { validatePublicationReceipt } from './vendor/spec-publication.mjs';

const ARTIFACTS = ['proposal.md', 'design.md', 'tasks.md'];

function usage(code = 2) {
  const text = [
    'Usage: bridge <command> [args]',
    '  init <name> [--capability <c>] [--branch <b>] [--layout <l>] [--capabilities <c>]',
    '                                     scaffold a new change dir (templates + state + log)',
    '  adopt <change-dir>                 register an existing external change dir (no template writes; v1.3 D4)',
    '  next <change-dir>                  navigation: stage + next hint + advised action',
    '  pattern --tag <t> [root]           cross-change tag aggregation (incl. archive/)',
    '  mention <dir> --tag <t> [--note s] record pattern signal + history count (ADR-0007)',
    '  rootcause <dir> --tag <t> [--note s] structured root-cause signal (ADR-0007)',
    '  sync <change-dir>                  publish deltas to root baseline + receipt',
    '  verify <change-dir>                validate publication receipt (closing guard)',
    '  state init <change-dir> [--layout L] [--branch B] [--capabilities C]',
    '  state get <change-dir> [field]',
    '  state set <change-dir> <field> <value>',
    '  state next <change-dir> <one-line resume hint>',
    '  event <change-dir> <one-line event>',
    '  rebuttal <change-dir> <one-line objection>',
    '  distill <change-dir>                 distill design.md ## Decisions into specs/<cap>/why.md (v1.5 D2)',
    '  archive-ready <change-dir>           archive gatekeeper: validate why.md + sync + not-archived (v1.5 D3)',
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

export function detectLayout(projectRoot) {
  const root = resolve(projectRoot);
  // 修正（v1.3 Batch N 补丁）：原探测只看 `openspec/` 目录存在——会把 OpenSpec CLI 本地安装
  // （磁盘有、gitignored）误判为 openspec 布局，让 list 走 `openspec/changes/` 看不见 `changes/archive/` 历史。
  // 新信号：bridge 历史归档目录在哪 = layout 真信号。
  // 优先级：archive 历史化石 > openspec/config.yaml (OpenSpec CLI 标志) > openspec/ 目录在场 (v1.6 弱信号兜底) > 缺省 standalone。
  // v1.6 加 openspec/ 弱信号：spec/cli/spec.md R1 场景 1.5 要求"项目根含 openspec/ → openspec layout"，
  // 但 archive 化石优先级 1 保护 spec-bridge 仓库根（changes/archive/* 在场时根本不走到弱信号）。
  const bridgeArchive = join(root, 'changes', 'archive');
  const openspecArchive = join(root, 'openspec', 'changes', 'archive');
  if (existsSync(bridgeArchive) && hasAnyBridgeYaml(bridgeArchive)) {
    return { layout: 'standalone', changesDir: join(root, 'changes'), baselineDir: join(root, 'specs') };
  }
  if (existsSync(openspecArchive) && hasAnyBridgeYaml(openspecArchive)) {
    return { layout: 'openspec', changesDir: join(root, 'openspec', 'changes'), baselineDir: join(root, 'openspec', 'specs') };
  }
  if (existsSync(join(root, 'openspec', 'config.yaml'))) {
    return { layout: 'openspec', changesDir: join(root, 'openspec', 'changes'), baselineDir: join(root, 'openspec', 'specs') };
  }
  if (existsSync(join(root, 'openspec'))) {
    return { layout: 'openspec', changesDir: join(root, 'openspec', 'changes'), baselineDir: join(root, 'openspec', 'specs') };
  }
  return { layout: 'standalone', changesDir: join(root, 'changes'), baselineDir: join(root, 'specs') };
}

function hasAnyBridgeYaml(dir) {
  if (!existsSync(dir)) return false;
  for (const sub of readdirSync(dir)) {
    if (existsSync(join(dir, sub, '.bridge.yaml'))) return true;
  }
  return false;
}

function listChanges(projectRoot) {
  const { layout, changesDir } = detectLayout(projectRoot);
  const changes = [];
  const untracked_artifacts = [];
  let archived_count = 0;
  // v1.3 Batch 3 (D4)：untracked 探测信号——与 cmd-adopt.mjs ADOPT_SIGNALS 同源。
  const ADOPT_SIGNALS = ['proposal.md', 'design.md', 'tasks.md', 'execution-contract.md'];
  if (existsSync(changesDir)) {
    for (const dir of readdirSync(changesDir)) {
      const dirPath = join(changesDir, dir);
      if (!statSync(dirPath).isDirectory()) continue;
      if (dir === 'archive') {
        // v1.3 Batch N 补丁：只数不展示——让 agent 知道"有 N 条历史"，
        // 但不破坏 D5 "skip archive 避免喧宾夺主"。详情走 pattern/mention。
        archived_count = readdirSync(dirPath).filter(
          sub => statSync(join(dirPath, sub)).isDirectory()
        ).length;
        continue;
      }
      const state = existsSync(join(dirPath, '.bridge.yaml')) ? readState(dirPath) : null;
      if (state) {
        changes.push({
          name: dir,
          has_state: true,
          stage: state.stage,
          next: state.next,
        });
      } else {
        // untracked 段：列出有 artifact 无台账的目录（D4 list 副产品）
        const artifacts = [];
        for (const f of ADOPT_SIGNALS) {
          if (existsSync(join(dirPath, f))) artifacts.push(f);
        }
        const specsDir = join(dirPath, 'specs');
        if (existsSync(specsDir)) {
          for (const cap of readdirSync(specsDir)) {
            const specFile = join(specsDir, cap, 'spec.md');
            if (existsSync(specFile)) artifacts.push(`specs/${cap}/spec.md`);
          }
        }
        if (artifacts.length > 0) {
          untracked_artifacts.push({ name: dir, artifacts });
        }
      }
    }
  }
  return { layout, changesDir, changes, untracked_artifacts, archived_count };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) usage(2);

  if (command === 'init') {
    const result = await runInit(rest);
    process.exit(result.exitCode ?? 0);
  }

  // v1.3 Batch 3 (D4)：adopt 接入外栈已存在 change，只写台账不动产物。
  if (command === 'adopt') {
    const result = await runAdopt(rest);
    process.exit(result.exitCode ?? 0);
  }

  if (command === 'next') {
    const result = await runNext(rest);
    process.exit(result.exitCode ?? 0);
  }

  // v1.7 (ADR-0010/D4)：导航员激活 — 4 维度探测 + 4 级路由 + 合并 next hint + D5 stdout
  if (command === 'probe') {
    const result = await runProbe(rest);
    process.exit(result.exitCode ?? 0);
  }

  if (command === 'pattern') {
    const result = await runPattern(rest);
    process.exit(result.exitCode ?? 0);
  }

  if (command === 'mention' || command === 'rootcause') {
    const runner = command === 'mention' ? runMention : runRootcause;
    const result = await runner(rest);
    process.exit(result.exitCode ?? 0);
  }

  if (command === 'rebuttal') {
    const result = await runRebuttal(rest);
    process.exit(result.exitCode ?? 0);
  }

  if (command === 'distill') {
    // v1.5 D2：从 design.md ## Decisions 蒸馏生成 specs/<cap>/why.md，
    // 配套 D3 Batch N 校验 why.md 存在。归档前必跑。
    const result = await runDistill(rest);
    process.exit(result.exitCode ?? 0);
  }

  if (command === 'archive-ready') {
    // v1.5 D3: archive 前置守门员 — 校验 why.md 全在 + 已 sync + 未 archived。
    // 跑通后才允许进入 git mv + state set archived 流程（Batch N 后两步）。
    const result = await runArchiveReady(rest);
    process.exit(result.exitCode ?? 0);
  }

  if (command === 'sync') {
    const changeDir = rest[0];
    if (!changeDir) usage(2);
    // v1.2 (ADR-0005/D5)：归档写保护——sync 拒绝 archive/ 路径，exit 4。
    if (resolve(changeDir).split(path.sep).includes('archive')) {
      console.error(`WRITE-PROTECTED: ${changeDir} is under changes/archive/ — archived changes are immutable (ADR-0005). Open a follow-up: init <name> --parent <change-id>`);
      process.exit(4);
    }
    // v1.8-1 (ψ3-1 B)：透传 --external-skip 等 flag 给 cmd-sync。
    const syncArgs = [changeDir, ...rest.slice(1)];
    const result = await runSync(syncArgs);
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
    // v1.2 (R3-Q2 双轨)：偏差提示——记录异议或开续作，二选一由人决定。
    console.error('— consider: bridge rebuttal <dir> "<objection>" (记录异议) or init <name> --parent <change-id> (开续作修复)');
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
      const value = valueParts.join(' ');
      // v1.2 (ADR-0005/D5)：归档写保护——archived change 仅放行 stage 字段（patching 出口）。
      if (state.stage === 'archived' && field !== 'stage') {
        console.error(`WRITE-PROTECTED: change is archived — only 'stage' may change (ADR-0005). Other edits belong in a follow-up`);
        process.exit(2);
      }
      if (field === 'stage') {
        const gate = checkStageTransition(changeDir, value);
        if (!gate.ok) {
          console.error(`transition rejected: ${gate.reason}`);
          process.exit(2);
        }
      }
      writeState(changeDir, { ...state, [field]: value });
      if (field === 'stage') appendEvent(changeDir, `stage: ${state.stage} → ${value}`);
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
      // v1.2 (ADR-0005/D5)：归档漂移提示续作，不鼓励改原版。
      if (state.stage === 'archived') {
        console.error(`STALE: ${problems.join('; ')} — archived change is immutable. Open a follow-up: init <name> --parent <change-id>, do not edit the original (ADR-0005)`);
        process.exit(1);
      }
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

// v1.8-1 (ADR-0011 D5)：避免被 import 时副作用触发 main()（cmd-init 调 cmd-probe 间接 import bridge.mjs）。
// 仅当本文件作为入口执行时（argv[1] === 本文件路径）才自动跑 main()。
import { fileURLToPath } from 'node:url';
const __isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (__isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
