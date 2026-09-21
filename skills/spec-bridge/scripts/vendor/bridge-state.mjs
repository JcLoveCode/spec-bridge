// bridge-state.mjs — spec-bridge 的 .bridge.yaml 状态读写。
// 这是 vendor 时替换上游 state-loader.mjs 的唯一接缝（见 VENDOR.md）。
// 与上游保持相同 API（readState/writeState），字段换成 spec-bridge 的六字段 + 发布回执。
import fs from 'node:fs';
import path from 'node:path';

const STATE_FILE = '.bridge.yaml';
const LOG_FILE = '.bridge.log';

const BUILTIN_DEFAULTS = {
  // planning | contracted | executing | patching | archived | abandoned（后两个是终态；patching = ADR-0005 旁路）
  stage: 'planning',
  // openspec | standalone；null = 尚未探测。仓库级答案，首次使用时写入。
  layout: null,
  // 需求号分支名；sync/归档时校验"没跑错分支"。
  branch: null,
  // v1.2 (ADR-0004)：流程线声明 openspec | matt | builtin；缺省从 capabilities 首值推导。
  workflow_kind: null,
  // v1.2 (ADR-0005)：续作引用——父 change 目录名 + 其产物摘要快照（版本链可重放）。
  parent: null,
  parent_artifacts_hash: null,
  // 本次变更探测到的能力快照，逗号分隔，如 "openspec,superpowers,builtin"。
  capabilities: null,
  // v1.2 (ADR-0006)：模式标签，自由文本逗号分隔，跨变更聚类（bridge pattern）。
  tags: null,
  // 契约批准摘要；null = 未批准。执行前的硬门。
  contract_approved: null,
  // 4 产物内容摘要（proposal/specs/design/tasks），契约过期检测用。
  artifacts_hash: null,
  // execution-contract.md 内容摘要。
  contract_hash: null,
  // v1.8-1 (ADR-0011 D3)：外栈标识——bridge adopt 接管外栈产物时写入，null | 'matt' | 'openspec' | 'superpowers'。
  external_stack: null,
  // v1.8-1 (ADR-0011 D3)：adopt 时间戳（ISO 8601），仅 adopt 时写入。
  adopted_at: null,
  // 发布回执（由 vendored cmd-sync 写入）。
  published: false,
  spec_publication_receipt: null,
  // 恢复提示：阶段收尾时写一句话，跨会话/换对话重水合的第一入口。
  next: null,
  // 最近一条大事记（完整历史在 .bridge.log）。
  last_event: null,
};

function stateFilePath(changeDir) {
  return path.join(changeDir, STATE_FILE);
}

function logFilePath(changeDir) {
  return path.join(changeDir, LOG_FILE);
}

function oneLine(value) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/\s*\r?\n\s*/g, ' ').trim() || null;
}

/**
 * 读取 .bridge.yaml，缺省字段用默认值补齐。
 * 文件不存在也返回完整默认对象（内容级检测的兜底：状态丢了从产物重建）。
 */
export function readState(changeDir) {
  const filePath = stateFilePath(changeDir);
  if (!fs.existsSync(filePath)) {
    return { ...BUILTIN_DEFAULTS };
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return { ...BUILTIN_DEFAULTS, ...parseYaml(raw) };
}

/**
 * 把状态对象写回 .bridge.yaml。字段顺序固定，注释分区，人可直接读。
 */
export function writeState(changeDir, state) {
  const merged = { ...BUILTIN_DEFAULTS, ...state };
  const lines = [];
  lines.push('# .bridge.yaml — spec-bridge change state');
  lines.push('# Derived data. Always rebuildable from artifacts. Lost/corrupt → fall back to content-level detection.');
  lines.push('');
  lines.push('# === Lifecycle ===');
  lines.push(`stage: ${merged.stage || 'planning'}`);
  lines.push(`layout: ${oneLine(merged.layout) ?? 'null'}`);
  lines.push(`branch: ${oneLine(merged.branch) ?? 'null'}`);
  lines.push('');
  lines.push('# === Workflow (v1.2) ===');
  lines.push(`workflow_kind: ${oneLine(merged.workflow_kind) ?? 'null'}`);
  lines.push(`parent: ${oneLine(merged.parent) ?? 'null'}`);
  lines.push(`parent_artifacts_hash: ${merged.parent_artifacts_hash ?? 'null'}`);
  lines.push('');
  lines.push('# === Capabilities (probed once per change) ===');
  lines.push(`capabilities: ${oneLine(merged.capabilities) ?? 'null'}`);
  lines.push(`tags: ${oneLine(merged.tags) ?? 'null'}`);
  lines.push('');
  lines.push('# === Contract gate ===');
  lines.push(`contract_approved: ${oneLine(merged.contract_approved) ?? 'null'}`);
  lines.push(`artifacts_hash: ${merged.artifacts_hash ?? 'null'}`);
  lines.push(`contract_hash: ${merged.contract_hash ?? 'null'}`);
  lines.push('');
  lines.push('# === External stack (v1.8-1 ADR-0011 D3) ===');
  lines.push(`external_stack: ${oneLine(merged.external_stack) ?? 'null'}`);
  lines.push(`adopted_at: ${oneLine(merged.adopted_at) ?? 'null'}`);
  lines.push('');
  lines.push('# === Publication receipt (written by vendored sync) ===');
  lines.push(`published: ${merged.published === true ? 'true' : 'false'}`);
  lines.push(`spec_publication_receipt: ${merged.spec_publication_receipt ?? 'null'}`);
  lines.push('');
  lines.push('# === Resume ===');
  lines.push(`next: ${oneLine(merged.next) ?? 'null'}`);
  lines.push(`last_event: ${oneLine(merged.last_event) ?? 'null'}`);
  fs.writeFileSync(stateFilePath(changeDir), lines.join('\n') + '\n', 'utf-8');
  return merged;
}

/**
 * 更新单个字段。
 */
export function updateField(changeDir, field, value) {
  const state = readState(changeDir);
  state[field] = value;
  writeState(changeDir, state);
  return state;
}

/**
 * 追加一条大事记到 .bridge.log（纯文本、只增不删），并刷新 last_event。
 */
export function appendEvent(changeDir, line) {
  const entry = oneLine(line);
  if (!entry) return readState(changeDir);
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFilePath(changeDir), `- ${timestamp} ${entry}\n`, 'utf-8');
  return updateField(changeDir, 'last_event', entry);
}

/**
 * v1.2 (ADR-0005/D3)：定位父 change——活跃目录优先，其次归档目录（<date>-<id> 前缀）。
 * 返回 { dir, state } 或 null。纯读操作。
 */
export function resolveParent(changesDir, parentId) {
  if (!parentId) return null;
  const active = path.join(changesDir, parentId);
  if (fs.existsSync(path.join(active, STATE_FILE))) {
    return { dir: active, state: readState(active) };
  }
  const archiveDir = path.join(changesDir, 'archive');
  if (fs.existsSync(archiveDir)) {
    for (const entry of fs.readdirSync(archiveDir)) {
      if (entry !== parentId && !entry.endsWith(`-${parentId}`)) continue;
      const dir = path.join(archiveDir, entry);
      if (fs.existsSync(path.join(dir, STATE_FILE))) return { dir, state: readState(dir) };
    }
  }
  return null;
}

/**
 * v1.2 (ADR-0005/D4)：stage 转换校验。patching 旁路要求 parent 必填且父已归档。
 * 返回 { ok: true } 或 { ok: false, reason }。纯读操作，不改状态。
 */
export function checkStageTransition(changeDir, nextStage) {
  if (nextStage !== 'patching') return { ok: true };
  const state = readState(changeDir);
  if (!state.parent) {
    return { ok: false, reason: `patching requires a parent — open a follow-up with --parent ${path.basename(changeDir)}-fix-N first` };
  }
  const changesDir = path.dirname(path.resolve(changeDir));
  const parent = resolveParent(changesDir, state.parent);
  if (!parent) return { ok: false, reason: `parent '${state.parent}' not found in ${changesDir}` };
  if (parent.state.stage !== 'archived') {
    return { ok: false, reason: `parent '${state.parent}' is stage=${parent.state.stage}, not archived` };
  }
  return { ok: true };
}

// Minimal YAML parser — top-level flat fields only, zero dependencies.
// 与上游 state-loader 同款：字符串、null、整数、true/false。
function parseYaml(content) {
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(\w[\w_]*):\s*(.*)/);
    if (!match) continue;
    const val = match[2].trim();
    if (val === 'null' || val === '') {
      result[match[1]] = null;
    } else if (val === 'true') {
      result[match[1]] = true;
    } else if (val === 'false') {
      result[match[1]] = false;
    } else if (/^\d+$/.test(val)) {
      result[match[1]] = parseInt(val, 10);
    } else {
      result[match[1]] = val;
    }
  }
  return result;
}
