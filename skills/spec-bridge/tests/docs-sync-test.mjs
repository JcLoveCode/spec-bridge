// v1.3 Batch 4 / R5 测试：文档与代码的交叉引用防漂移（docs-sync self-guard）。
// 设计动机：v1.3 B1 在 cmd-next.mjs 加 PROTOCOL_HINTS 路由表，B3 加 adopt 命令 + list untracked 段，
// B2 把 init 按 --workflow-kind 三分支——任何一处文档（SKILL.md / CONTEXT.md / ADR）漏改或失同步，
// agent 跑 `bridge next` / `bridge init` / `bridge adopt` 时会被旧 SKILL.md 误导。
// 此文件验证四处交叉引用（源不变 = 代码真相源，文档应追源）：
//
//   R5 场景 1：SKILL.md §6 跨协议路由表与 cmd-next.mjs PROTOCOL_HINTS 双向一致
//   R5 场景 2：CONTEXT.md 含 v2 新术语 "SDD 产物" / "外部产物"
//   R5 场景 3：docs/adr/0008-*.md 存在 + 含 "cross-protocol" 关键字
//   R5 场景 4：--workflow-kind 字符串在 bridge.mjs / cmd-init.mjs / cmd-next.mjs 三处一致
//   R5 场景 5：SKILL.md §5 速查表行数与 §0 "dump 全部"句计数一致（防命令增减不更 §5）
//
// 实现：静态文本分析——直接读 md/js 文件，提取 use_skill 名集合、--workflow-kind 合法值集合，
// 做集合相等 / 包含断言。零进程副作用。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');                     // skills/spec-bridge/
const PROJECT_ROOT = join(HERE, '..', '..', '..'); // spec-bridge/ (仓库根)
const SKILL = join(ROOT, 'SKILL.md');
const CONTEXT = join(ROOT, 'CONTEXT.md');
const ADR_DIR = join(ROOT, 'docs', 'adr');
const CMD_NEXT = join(ROOT, 'scripts', 'cmd-next.mjs');
const CMD_INIT = join(ROOT, 'scripts', 'cmd-init.mjs');
const BRIDGE = join(ROOT, 'scripts', 'bridge.mjs');

// ─────────────────────────────────────────────────────────────────────────────
// 工具：从文件中提取 use_skill 名集合
// 匹配模式：`use_skill <name>`（name = kebab-case token）
// ─────────────────────────────────────────────────────────────────────────────

function extractUseSkills(text) {
  const out = new Set();
  // `(?:\W|^)use_skill\s+<name>` —— use_skill 前任意非单词字符（含反引号 / `→` / 表格分隔符 / 空白）
  for (const m of text.matchAll(/(?:\W|^)use_skill\s+([a-z][a-z0-9-]*)/g)) {
    out.add(m[1]);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具：截取 SKILL.md 的 §6 段落（"## 6." 到 "## 7." 或文末）
// ─────────────────────────────────────────────────────────────────────────────

function extractSection6(text) {
  // 找 "## 6." 段起始
  const start = text.indexOf('\n## 6.');
  if (start < 0) return null;
  // tail = text 从 \n## 6. 开始到末尾；先跳到 "## 6." 标题行的行尾换行
  const tail = text.slice(start + 1);              // 去开头 \n
  const titleLineEnd = tail.indexOf('\n');          // "## 6. ..." 标题行末
  if (titleLineEnd < 0) return tail;
  const body = tail.slice(titleLineEnd + 1);        // 段内容
  const next = body.search(/^## \d+\./m);           // 找下一段
  if (next < 0) return tail;
  return tail.slice(0, titleLineEnd + 1 + next);
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具：从 PROTOCOL_HINTS 块中提取 use_skill 名字（按字面量字符串匹配）
// ─────────────────────────────────────────────────────────────────────────────

function extractProtocolHintsSkills(text) {
  // 截取 PROTOCOL_HINTS = { ... }; 字面量块
  const m = text.match(/const PROTOCOL_HINTS\s*=\s*\{([\s\S]*?)\n\};/);
  if (!m) return new Set();
  return extractUseSkills(m[1]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具：从代码中提取 --workflow-kind 合法值集合
// 命令处 + cmd-init WORKFLOW_KINDS Set + cmd-next PROTOCOL_HINTS 三栈键
// ─────────────────────────────────────────────────────────────────────────────

function extractWorkflowKinds(text) {
  const out = new Set();
  // 'openspec' / 'matt' / 'builtin' 字面量（兼容 "openspec|matt|builtin" 字符串）
  for (const m of text.matchAll(/['"`](openspec|matt|builtin)['"`]/g)) {
    out.add(m[1]);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具：bridge.mjs 的用法行（Usage: bridge <cmd> ...）中提取子命令名
// ─────────────────────────────────────────────────────────────────────────────

function extractBridgeCommands(bridgeText) {
  const out = new Set();
  // bridge.mjs usage() 函数体里每行是字符串字面量：`    '  init <name> ...'`
  // 取行首 4 空格 + `'` + 空白 + 顶层命令 + 空白 + 后续（subcommand / <arg> / [arg] / --flag）。
  // 延续行（如 `scaffold a new change...`）是描述文字，要求后续以 < / [ / -- 起始；
  // 若以单词起始（subcommand 形如 `state init`），该单词必须是合法 subcommand（init/get/set/next/event）。
  const KNOWN_SUBCMDS = new Set(['init', 'get', 'set', 'next', 'event']);
  for (const line of bridgeText.split('\n')) {
    const m = line.match(/^\s*'\s+([a-z][a-z0-9-]*)\s+([<\[]|--?[a-z]|[a-z][a-z0-9-]+)/);
    if (!m) continue;
    const cmd = m[1];
    const rest = m[2];
    // subcommand 必须已知；< / [ / -- 起头算命令参数
    if (rest.startsWith('<') || rest.startsWith('[') || rest.startsWith('--')) {
      out.add(cmd);
    } else if (KNOWN_SUBCMDS.has(rest)) {
      out.add(cmd);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具：从 SKILL.md §5 速查表行中提取命令名（`| \`<cmd>\` ... |` 行首）
// ─────────────────────────────────────────────────────────────────────────────

function extractSkillMdCommands(skillText) {
  const out = new Set();
  // §5 段截取：从 "## 5." 标题行末到 "## 6." 标题行前
  const start = skillText.indexOf('## 5.');
  if (start < 0) return out;
  const tail = skillText.slice(start + 5);                // 去 "## 5."
  const titleLineEnd = tail.indexOf('\n');
  if (titleLineEnd < 0) return out;
  const body = tail.slice(titleLineEnd + 1);
  const next = body.search(/^## \d+\./m);
  const section5 = next < 0 ? body : body.slice(0, next);
  // 速查表行形如 "| `cmd-name <args>` |" 或 "`mention/rootcause ...`"（合并行）
  // 取首列反引号内所有 kebab-case token（用 / 分割合并行）
  for (const line of section5.split('\n')) {
    if (!line.startsWith('|')) continue;
    if (line.startsWith('|---')) continue;
    if (line.startsWith('| 命令')) continue;
    const firstCell = line.split('|')[1] ?? '';
    // 取反引号之间的全部内容，分割 /，提取每个 kebab-case token
    const backtickMatch = firstCell.match(/`([^`]+)`/);
    if (!backtickMatch) continue;
    const inner = backtickMatch[1];
    // 取第一个空格前的命令段（"cmd-name <args>" → "cmd-name"）
    // 然后按 / 分割（"mention/rootcause" → ["mention", "rootcause"]）
    const cmdSegment = inner.split(/\s/)[0];
    for (const cmd of cmdSegment.split('/')) {
      if (/^[a-z][a-z0-9-]+$/.test(cmd)) out.add(cmd);
    }
  }
  return out;
}

test('R5 场景 1：SKILL.md §6 含全部 PROTOCOL_HINTS 路由的 use_skill（双向 ⊆）', () => {
  const skillMd = readFileSync(SKILL, 'utf-8');
  const section6 = extractSection6(skillMd);
  assert.ok(section6 !== null, 'SKILL.md missing §6 section — v1.3 B4 T4.1 not landed yet');

  const section6Skills = extractUseSkills(section6);
  const hintSkills = extractProtocolHintsSkills(readFileSync(CMD_NEXT, 'utf-8'));

  // §6 必须覆盖所有 hint 中提到的 use_skill（hint → docs）
  for (const skill of hintSkills) {
    assert.ok(section6Skills.has(skill),
      `SKILL.md §6 missing use_skill '${skill}' which PROTOCOL_HINTS routes to`);
  }
  // §6 提到的 use_skill 必须在 hint 中出现（docs → hint 不漏实现）
  for (const skill of section6Skills) {
    assert.ok(hintSkills.has(skill),
      `SKILL.md §6 mentions use_skill '${skill}' but PROTOCOL_HINTS doesn't route it (orphan doc)`);
  }
});

test('R5 场景 2：CONTEXT.md 含 v2 新术语（SDD 产物 / 外部产物）', () => {
  const ctx = readFileSync(CONTEXT, 'utf-8');
  assert.match(ctx, /SDD 产物/, 'CONTEXT.md missing "SDD 产物" — v1.3 B4 T4.2 not landed yet');
  assert.match(ctx, /外部产物/, 'CONTEXT.md missing "外部产物" — v1.3 B4 T4.2 not landed yet');
});

test('R5 场景 3：docs/adr/0008-*.md 存在 + 含 "cross-protocol" 关键字', () => {
  const file0008 = readdirSync(ADR_DIR).find(f => f.startsWith('0008-'));
  assert.ok(file0008, 'ADR-0008 file missing under docs/adr/ — v1.3 B4 T4.3 not landed yet');
  const text = readFileSync(join(ADR_DIR, file0008), 'utf-8');
  assert.match(text, /cross-protocol/i, `ADR-0008 (${file0008}) should contain "cross-protocol" — it's the topic`);
  // 同时是 ADR-0008，应承接 0004 的 "navigator, not dispatcher" 立场
  assert.match(text, /navigator/i, 'ADR-0008 should reference navigator role (continuity with ADR-0004)');
  assert.match(text, /not.*dispatcher|不代理|不调度/i, 'ADR-0008 should reaffirm "not a dispatcher" (continuity with ADR-0004)');
});

test('R5 场景 4：--workflow-kind 字符串在 cmd-init.mjs 与 cmd-next.mjs PROTOCOL_HINTS 一致', () => {
  // 设计：bridge.mjs 是薄 dispatch 层，校验下沉到 cmd-init（ADR-0004）。
  // 因此只断言 cmd-init.mjs 显式列了 openspec/matt/builtin，且 cmd-next.mjs PROTOCOL_HINTS 三栈键齐全。
  // bridge.mjs 不强制要求含字面量（避免桥重复校验）。
  const initKinds = extractWorkflowKinds(readFileSync(CMD_INIT, 'utf-8'));
  const nextText = readFileSync(CMD_NEXT, 'utf-8');
  const hintKeysMatch = nextText.match(/const PROTOCOL_HINTS\s*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(hintKeysMatch, 'PROTOCOL_HINTS block not found in cmd-next.mjs');
  const hintKinds = new Set();
  for (const m of hintKeysMatch[1].matchAll(/^\s*(planning|executing):\s*\{([\s\S]*?)\}/gm)) {
    for (const k of m[2].matchAll(/(builtin|openspec|matt)\s*:/g)) {
      hintKinds.add(k[1]);
    }
  }

  const expected = new Set(['openspec', 'matt', 'builtin']);
  assert.deepEqual(initKinds, expected, `cmd-init.mjs --workflow-kind literals ≠ {openspec, matt, builtin}`);
  assert.deepEqual(hintKinds, expected, `PROTOCOL_HINTS workflow_kind keys ≠ {openspec, matt, builtin}`);
});

test('R5 场景 5：SKILL.md §5 速查表命令名 ⊆ bridge.mjs 真实 dispatch 命令', () => {
  const skillMd = readFileSync(SKILL, 'utf-8');
  const bridgeText = readFileSync(BRIDGE, 'utf-8');
  const skillCommands = extractSkillMdCommands(skillMd);
  const bridgeCommands = extractBridgeCommands(bridgeText);

  // §5 提到的命令必须在 bridge.mjs dispatch 中存在（docs → impl）
  for (const cmd of skillCommands) {
    assert.ok(bridgeCommands.has(cmd),
      `SKILL.md §5 mentions command '${cmd}' not found in bridge.mjs dispatch`);
  }
  // 关键 v1.3 新命令必须出现在 §5
  assert.ok(skillCommands.has('adopt'),
    'SKILL.md §5 missing adopt command (added in v1.3 B3a)');
});

test('R5 场景 6：SKILL.md §0 "dump 全部 N 条命令" 与 §5 速查表命令数一致', () => {
  const skillMd = readFileSync(SKILL, 'utf-8');
  // §0 dump 句里的数字（"dump 全部 14 条命令" 或类似）
  const dumpMatch = skillMd.match(/dump 全部\s*(\d+)\s*条/);
  if (!dumpMatch) {
    // 没匹配就跳过（不强求 §0 一定含数字——本断言只在数字存在时核对）
    return;
  }
  const claimed = parseInt(dumpMatch[1], 10);
  // §5 速查表实际命令数（复用 extractSkillMdCommands 解析 mention/rootcause 合并行）
  const skillCommands = extractSkillMdCommands(skillMd);
  assert.ok(skillCommands.size === claimed,
    `§0 claims "dump 全部 ${claimed} 条" but §5 only lists ${skillCommands.size} commands ([${[...skillCommands].sort().join(', ')}]) — drift`);
});
test('R6（v1.4）：bridge list 输出必有 archived_count 数字字段', () => {
  // cwd 用 PROJECT_ROOT（spec-bridge/），不是 ROOT（skills/spec-bridge/）
  // —— 后者没有 archive/ 子目录，archived_count 必为 0
  const out = execFileSync(process.execPath, [join(ROOT, 'scripts/bridge.mjs'), 'list', PROJECT_ROOT],
    { encoding: 'utf-8', cwd: PROJECT_ROOT });
  const parsed = JSON.parse(out);
  assert.ok('archived_count' in parsed,
    `bridge list output missing 'archived_count' field — v1.4 list archived_count not landed`);
  assert.strictEqual(typeof parsed.archived_count, 'number',
    `bridge list archived_count must be number, got ${typeof parsed.archived_count}`);
  // 仓库层断言：spec-bridge 仓库 archive 下确有 5 条（v1.1 / v1.2 / v1.2-b7 / v1.3-research / v1.3-sdd）
  assert.strictEqual(parsed.archived_count, 5,
    `bridge list archived_count expected 5 in spec-bridge repo, got ${parsed.archived_count}`);
});

test('R7（v1.4）：detectLayout bridge.mjs 主版与 cmd-init.mjs mirror 一致 + ADR-0009 引用存在', () => {
  const bridgeText = readFileSync(BRIDGE, 'utf-8');
  const initText = readFileSync(CMD_INIT, 'utf-8');
  // 两文件必须都含 archive 化石优先探测——抽 hasAnyBridgeYaml 辅助
  assert.match(bridgeText, /hasAnyBridgeYaml/, 'bridge.mjs detectLayout missing hasAnyBridgeYaml helper');
  assert.match(initText, /hasAnyBridgeYaml/, 'cmd-init.mjs mirror detectLayout missing hasAnyBridgeYaml helper');
  // 两文件必须都按优先级 1) bridge archive 2) openspec archive 3) config.yaml 4) standalone
  assert.match(bridgeText, /changes['"]?\s*,\s*['"]?archive['"]?/, 'bridge.mjs not detecting changes/archive/ first');
  assert.match(initText, /changes['"]?\s*,\s*['"]?archive['"]?/, 'cmd-init.mjs not detecting changes/archive/ first');
  assert.match(bridgeText, /openspec['"]?\s*,\s*['"]?changes['"]?\s*,\s*['"]?archive['"]?/, 'bridge.mjs not detecting openspec/changes/archive/ second');
  assert.match(bridgeText, /config\.yaml/, 'bridge.mjs not detecting openspec/config.yaml third');
  // ADR-0009 存在 + CONTEXT.md 引用
  const adr0009 = readdirSync(ADR_DIR).find(f => f.startsWith('0009-'));
  assert.ok(adr0009, 'ADR-0009 file missing under docs/adr/ — v1.4 T4.1 not landed yet');
  assert.match(readFileSync(join(ADR_DIR, adr0009), 'utf-8'), /archive.*fossil|fossil.*priority|化石.*优先/i,
    `ADR-0009 (${adr0009}) should describe archive-fossil-priority layout detection`);
  const ctx = readFileSync(CONTEXT, 'utf-8');
  assert.match(ctx, /ADR-0009/, 'CONTEXT.md missing ADR-0009 reference');
  assert.match(ctx, /archived_count/, 'CONTEXT.md missing archived_count term — v1.4 not landed');
});
