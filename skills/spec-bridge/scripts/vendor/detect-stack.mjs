// detect-stack.mjs — 项目栈自动探测（ADR-0011 D2 + ADR-0012 D2）
// 输入：projectRoot（git 仓库根或 sandbox 根）
// 输出：{ primary: 'superpowers'|'matt'|'openspec'|'builtin', signals: { claudePlugin, packageJsonSuperpowers, packageJsonMattField, openspec } }
// 优先级：superpowers > matt > openspec > builtin（v1.8-2 起 superpowers 加入优先级）
// 复用方：cmd-init.mjs（默认 workflow_kind 派生）；cmd-adopt.mjs 当前用独立启发式（D3 信号），不调用此模块。
//
// superpowers 信号（需同时满足，v1.8-2 新增）：
//   - .claude-plugin/ 目录在场
//   - package.json 含 `"superpowers"` 字段（dependencies / devDependencies / keywords / name / description 任一）
// matt 信号（需同时满足）：
//   - .claude-plugin/ 目录在场
//   - package.json 含 `"matt-skills"` 字段（dependencies / devDependencies / keywords 任一）
// openspec 信号：
//   - openspec/ 目录在场
// 都不在场：builtin 兜底。

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function hasClaudePlugin(projectRoot) {
  try {
    return statSync(join(projectRoot, '.claude-plugin')).isDirectory();
  } catch {
    return false;
  }
}

function hasOpenspecDir(projectRoot) {
  try {
    return statSync(join(projectRoot, 'openspec')).isDirectory();
  } catch {
    return false;
  }
}

// package.json 含 `"superpowers"` 字段（任一位置）。
// v1.8-2 (ADR-0012 D2)：与 matt 同等强度的双信号组件。
function packageJsonMentionsSuperpowers(projectRoot) {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return false;
  try {
    const text = readFileSync(pkgPath, 'utf-8');
    // 不解析 JSON（避免依赖 + 加快）；用字符串扫描。
    // 匹配严格带双引号的 `"superpowers"`，避免 `@scope/superpowers-util` 子串误判。
    return /"superpowers"/.test(text);
  } catch {
    return false;
  }
}

// package.json 含 `"matt-skills"` 字段（任一位置）。
function packageJsonMentionsMatt(projectRoot) {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return false;
  try {
    const text = readFileSync(pkgPath, 'utf-8');
    // 不解析 JSON（避免依赖 + 加快）；用字符串扫描。
    return /"matt-skills"/.test(text);
  } catch {
    return false;
  }
}

export function detectStack(projectRoot) {
  if (!projectRoot) {
    return { primary: 'builtin', signals: { claudePlugin: false, packageJsonSuperpowers: false, packageJsonMattField: false, openspec: false } };
  }
  const claudePlugin = hasClaudePlugin(projectRoot);
  const openspec = hasOpenspecDir(projectRoot);
  const packageJsonSuperpowers = packageJsonMentionsSuperpowers(projectRoot);
  const packageJsonMattField = packageJsonMentionsMatt(projectRoot);

  // 优先级 1：superpowers（v1.8-2 新增）—— .claude-plugin/ + package.json 含 "superpowers" 双信号
  if (claudePlugin && packageJsonSuperpowers) {
    return { primary: 'superpowers', signals: { claudePlugin, packageJsonSuperpowers, packageJsonMattField, openspec } };
  }
  // 优先级 2：matt —— .claude-plugin/ + package.json 含 "matt-skills" 双信号
  if (claudePlugin && packageJsonMattField) {
    return { primary: 'matt', signals: { claudePlugin, packageJsonSuperpowers, packageJsonMattField, openspec } };
  }
  // 优先级 3：openspec —— openspec/ 目录在场
  if (openspec) {
    return { primary: 'openspec', signals: { claudePlugin, packageJsonSuperpowers, packageJsonMattField, openspec } };
  }
  // 兜底：builtin
  return { primary: 'builtin', signals: { claudePlugin, packageJsonSuperpowers, packageJsonMattField, openspec } };
}