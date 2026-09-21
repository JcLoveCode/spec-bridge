// cmd-distill.mjs — `bridge distill <change-dir>` 子命令（v1.5 D2）。
// 从 design.md ## Decisions 蒸馏生成 specs/<cap>/why.md（仿 v1.3 specs/v1-3-research-xrouter/why.md 格式）。
// 配套 v1.5 D3: Batch N 写 "Batch N complete" 前 fs.existsSync(why.md) 校验。
// 与 cmd-init.mjs 风格对齐：default export run(args, { stdout, stderr })。
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { appendEvent, readState } from './vendor/bridge-state.mjs';

function parseArgs(rawArgs) {
  const positional = [];
  for (const token of rawArgs) {
    if (token.startsWith('--')) continue;
    positional.push(token);
  }
  return { positional };
}

function extractFirstSection(content, heading) {
  // 找 ## <heading> 段到下一个 ## 段
  const re = new RegExp(`^##\\s+${heading}\\s*$`, 'm');
  const m = content.match(re);
  if (!m) return null;
  const start = m.index + m[0].length;
  const after = content.slice(start);
  const next = after.match(/^##\s+/m);
  const block = next ? after.slice(0, next.index) : after;
  return block.trim();
}

function extractConclusion(content) {
  const block = extractFirstSection(content, 'Purpose');
  if (!block) return '(无 Purpose 段)';
  const firstParagraph = block.split(/\n\s*\n/)[0];
  // 去 HTML 注释 + 取第一行非空文本
  const cleaned = firstParagraph.replace(/^<!--.*?-->/gm, '').trim();
  return cleaned.split('\n')[0].trim() || '(Purpose 段无内容)';
}

function extractDecisions(content) {
  // 跨段抽取所有 ### D<N> — <name>：design.md 可能在 ## Decisions 段后接
  // ## Out-of-scope decisions（用 ## 格式但语义是 Decisions 子段），按段边界
  // truncate 会丢 D3+。安全前提：Out-of-scope 段用 - **D-X** 不用 ### D-。
  const itemRegex = /###\s+D(\d+)\s+—\s+([^\n]+)\n([\s\S]*?)(?=\n###\s+D\d+|\n##\s+|$)/g;
  const decisions = [];
  let m;
  while ((m = itemRegex.exec(content)) !== null) {
    const idx = parseInt(m[1], 10);
    const name = m[2].trim();
    const body = m[3];
    decisions.push({
      index: idx,
      name,
      decision: extractFirstValue(body, '决定'),
      reason: extractFirstValue(body, '理由'),
    });
  }
  if (decisions.length === 0) return null;
  decisions.sort((a, b) => a.index - b.index);
  return decisions;
}

function extractFirstValue(body, key) {
  // 找 **key**：，取后面第一条非空行（去 HTML 注释 + bullet 前缀）
  // 修 v1.5 实战 bug：原 regex /\s*([^\n]+)/ 在 **理由**：\n-bullet 时会把下一行 bullet 当成 value
  const markerRe = new RegExp(`\\*\\*${key}\\*\\*[：:]`);
  const m = body.match(markerRe);
  if (!m) return '';
  const after = body.slice(m.index + m[0].length);
  const firstLine = after.split('\n').find((l) => l.trim() && !l.trim().startsWith('<!--')) || '';
  return firstLine.replace(/^\s*[-*+]\s+/, '').trim();
}

function detectCapability(changeDir) {
  const specsDir = join(changeDir, 'specs');
  if (!existsSync(specsDir)) return null;
  for (const cap of readdirSync(specsDir)) {
    if (existsSync(join(specsDir, cap, 'spec.md'))) return cap;
  }
  return null;
}

function renderWhy(changeName, conclusion, decisions) {
  const dBlocks = decisions.map((d) => `### D${d.index} — ${d.name}\n\n来源：design.md D${d.index}\n理由：${d.reason}\n`).join('\n');

  return `# Why: ${changeName}

## Conclusion

${conclusion}

## Source-of-truth

唯一权威源：design.md ## Decisions

${dBlocks}

## spec-rev

待 sync 写回执后填（回执 hash 自动盖 spec.md，why.md 只引用）

## Non-Decisions（主动不做 / why 已知）

<!-- 来自 design.md ## Out-of-scope decisions；由 AI 跑 distill 后手动补 -->

## Open Questions for follow-up

<!-- 见 design.md ## Open Questions / 决策未覆盖的问题 -->
`;
}

export async function run(args, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const { positional } = parseArgs(args);

  if (positional.length === 0) {
    stderr.write('Usage: bridge distill <change-dir>\n');
    return { exitCode: 2 };
  }
  const changeDir = positional[0];

  if (!existsSync(join(changeDir, '.bridge.yaml'))) {
    stderr.write(`no .bridge.yaml under ${changeDir} — is it a bridge change directory?\n`);
    return { exitCode: 1 };
  }

  const designPath = join(changeDir, 'design.md');
  if (!existsSync(designPath)) {
    stderr.write(`no design.md under ${changeDir} — design required for distillation\n`);
    return { exitCode: 1 };
  }

  const cap = detectCapability(changeDir);
  if (!cap) {
    stderr.write(`no specs/<cap>/spec.md under ${changeDir} — cannot determine target capability\n`);
    return { exitCode: 1 };
  }

  // v1.8-1 (ADR-0011 C10)：external_stack change 的 design.md 通常是外栈格式，
  // 不含 bridge 的 ### D<N> — name 决策记录；distill 跳过并提示，不强写 why.md。
  // 调用方需另行调外栈自带工具生成对应"why"。
  const state = readState(changeDir);
  if (state.external_stack) {
    stderr.write(`skip: ${changeDir} is external_stack=${state.external_stack} — distill is bridge-internal; use the external stack's own why generator.\n`);
    appendEvent(changeDir, `distill: skipped (external_stack=${state.external_stack})`);
    return { exitCode: 0 };
  }

  const whyPath = join(changeDir, 'specs', cap, 'why.md');
  if (existsSync(whyPath)) {
    stderr.write(`refuse to overwrite existing why.md at ${whyPath} — delete it manually if intentional\n`);
    return { exitCode: 1 };
  }

  const designContent = readFileSync(designPath, 'utf-8');
  const decisions = extractDecisions(designContent);
  if (!decisions) {
    stderr.write(`no ## Decisions section in design.md (or no D1+ items) — distillation requires at least one decision\n`);
    return { exitCode: 1 };
  }
  const conclusion = extractConclusion(designContent);
  const changeName = basename(changeDir);

  const content = renderWhy(changeName, conclusion, decisions);
  writeFileSync(whyPath, content);

  appendEvent(changeDir, `distill: why.md written to specs/${cap}/why.md (${decisions.length} decisions)`);

  stdout.write(`distilled: ${whyPath}\n`);
  stdout.write(`  ${decisions.length} decisions extracted from design.md\n`);
  return { exitCode: 0 };
}