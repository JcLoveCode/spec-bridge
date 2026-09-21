// detect-stack.mjs — 项目栈自动探测（ADR-0011 D2）
// 输入：projectRoot（git 仓库根或 sandbox 根）
// 输出：{ primary: 'matt'|'openspec'|'builtin', signals: { claudePlugin, packageJsonMattField, openspecDir } }
// 优先级：matt > openspec > builtin
// 复用方：cmd-init.mjs（默认 workflow_kind 派生）；cmd-adopt.mjs 当前用独立启发式（D3 信号），不调用此模块。
//
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
    return { primary: 'builtin', signals: { claudePlugin: false, packageJsonMattField: false, openspecDir: false } };
  }
  const claudePlugin = hasClaudePlugin(projectRoot);
  const openspecDir = hasOpenspecDir(projectRoot);
  const packageJsonMattField = packageJsonMentionsMatt(projectRoot);

  // 优先级 1：matt（需 .claude-plugin + package.json 含 matt-skills 两个信号同时在场）
  if (claudePlugin && packageJsonMattField) {
    return { primary: 'matt', signals: { claudePlugin, packageJsonMattField, openspecDir } };
  }
  // 优先级 2：openspec（openspec/ 目录在场）
  if (openspecDir) {
    return { primary: 'openspec', signals: { claudePlugin, packageJsonMattField, openspecDir } };
  }
  // 兜底：builtin
  return { primary: 'builtin', signals: { claudePlugin, packageJsonMattField, openspecDir } };
}