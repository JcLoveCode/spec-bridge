// config-utils.mjs — bridge 配置读写工具
// v1.9-1 / ADR-0014：命令面板 + 持久化配置
//
// 配置文件位置（按优先级）：
//   1. 项目级：<projectRoot>/.bridge-config.json
//   2. 全局：~/.config/spec-bridge/config.json
//   3. 默认值：{ mode: 'full', stacks: [] }
//
// 配置格式：
//   {
//     "version": "1.9",
//     "mode": "full|memory|navigator|off",
//     "stacks": [{ "kind": "matt", "priority": 1 }],
//     "lastUsedStack": "matt",
//     "updatedAt": "ISO-8601"
//   }
//
// 设计参考 ponytail：~/.config/ponytail/config.json

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

export const VALID_MODES = ['full', 'memory', 'navigator', 'off'];
export const VALID_STACKS = ['openspec', 'matt', 'superpowers', 'builtin'];
export const CONFIG_FILENAME = '.bridge-config.json';
export const GLOBAL_CONFIG_DIR = join(homedir(), '.config', 'spec-bridge');
export const GLOBAL_CONFIG_PATH = join(GLOBAL_CONFIG_DIR, 'config.json');

export const DEFAULT_CONFIG = Object.freeze({
  mode: 'full',
  stacks: []
});

/**
 * 读取 bridge 配置（按优先级：项目级 → 全局 → 默认值）
 * @param {string} projectRoot - 项目根路径
 * @returns {{mode: string, stacks: Array, source: string}}
 */
export function readBridgeConfig(projectRoot) {
  const projectPath = join(projectRoot, CONFIG_FILENAME);
  if (existsSync(projectPath)) {
    try {
      const raw = JSON.parse(readFileSync(projectPath, 'utf8'));
      return { ...validateConfig(raw), source: 'project' };
    } catch (err) {
      throw new Error(`Invalid project config at ${projectPath}: ${err.message}`);
    }
  }

  if (existsSync(GLOBAL_CONFIG_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(GLOBAL_CONFIG_PATH, 'utf8'));
      return { ...validateConfig(raw), source: 'global' };
    } catch (err) {
      throw new Error(`Invalid global config at ${GLOBAL_CONFIG_PATH}: ${err.message}`);
    }
  }

  return { ...DEFAULT_CONFIG, source: 'default' };
}

/**
 * 写入 bridge 配置到项目级 .bridge-config.json（合并现有配置）
 * @param {string} projectRoot
 * @param {object} updates - 要更新的字段（部分更新）
 */
export function writeBridgeConfig(projectRoot, updates) {
  const configPath = join(projectRoot, CONFIG_FILENAME);

  let existing = {};
  if (existsSync(configPath)) {
    existing = JSON.parse(readFileSync(configPath, 'utf8'));
  }

  const merged = validateConfig({
    ...existing,
    ...updates,
    version: '1.9',
    updatedAt: new Date().toISOString()
  });

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
}

/**
 * 验证配置（只保留合法字段，过滤非法 stack）
 * @param {object} raw
 * @returns {{mode: string, stacks: Array}}
 */
export function validateConfig(raw) {
  const mode = VALID_MODES.includes(raw.mode) ? raw.mode : DEFAULT_CONFIG.mode;

  let stacks = [];
  if (Array.isArray(raw.stacks)) {
    stacks = raw.stacks
      .filter((s) => s && VALID_STACKS.includes(s.kind))
      .map((s, i) => ({
        kind: s.kind,
        priority: Number.isInteger(s.priority) && s.priority > 0 ? s.priority : i + 1
      }))
      .sort((a, b) => a.priority - b.priority);
  }

  return {
    mode,
    stacks,
    lastUsedStack: VALID_STACKS.includes(raw.lastUsedStack) ? raw.lastUsedStack : null,
    version: raw.version || '1.9',
    updatedAt: raw.updatedAt || null
  };
}

/**
 * 设置 mode（便捷方法）
 * @param {string} projectRoot
 * @param {string} mode
 */
export function setMode(projectRoot, mode) {
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`Invalid mode: ${mode}. Must be one of: ${VALID_MODES.join(', ')}`);
  }
  writeBridgeConfig(projectRoot, { mode });
}

/**
 * 设置 stacks（覆盖式）
 * @param {string} projectRoot
 * @param {string[]} kinds - 按顺序
 */
export function setStacks(projectRoot, kinds) {
  const stacks = kinds
    .filter((k) => VALID_STACKS.includes(k))
    .map((kind, i) => ({ kind, priority: i + 1 }));
  writeBridgeConfig(projectRoot, { stacks });
}

/**
 * 添加一个 stack（追加到末尾，priority = max + 1）
 * @param {string} projectRoot
 * @param {string} kind
 */
export function addStack(projectRoot, kind) {
  if (!VALID_STACKS.includes(kind)) {
    throw new Error(`Invalid stack: ${kind}. Must be one of: ${VALID_STACKS.join(', ')}`);
  }
  const config = readBridgeConfig(projectRoot);
  if (config.stacks.some((s) => s.kind === kind)) {
    return; // 已存在
  }
  const maxPriority = config.stacks.reduce((m, s) => Math.max(m, s.priority), 0);
  config.stacks.push({ kind, priority: maxPriority + 1 });
  writeBridgeConfig(projectRoot, { stacks: config.stacks });
}

/**
 * 删除一个 stack
 * @param {string} projectRoot
 * @param {string} kind
 */
export function removeStack(projectRoot, kind) {
  const config = readBridgeConfig(projectRoot);
  const stacks = config.stacks.filter((s) => s.kind !== kind);
  // 重新分配 priority（保持紧凑连续）
  stacks.forEach((s, i) => (s.priority = i + 1));
  writeBridgeConfig(projectRoot, { stacks });
}

/**
 * 推荐栈（v1.9-3 / ADR-0016）：上下文感知
 * 优先级：lastUsedStack > stacks[0] > builtin
 * @param {{mode: string, stacks: Array, lastUsedStack?: string}} config
 * @returns {string}
 */
export function getRecommendedStack(config) {
  if (config.lastUsedStack && VALID_STACKS.includes(config.lastUsedStack)) {
    return config.lastUsedStack;
  }
  if (config.stacks.length > 0) {
    return config.stacks[0].kind;
  }
  return 'builtin';
}

/**
 * 重置 lastUsedStack（context-aware 重置）
 * @param {string} projectRoot
 */
export function resetLastUsedStack(projectRoot) {
  writeBridgeConfig(projectRoot, { lastUsedStack: null });
}