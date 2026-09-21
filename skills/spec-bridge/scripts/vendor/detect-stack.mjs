// detect-stack.mjs — 项目栈自动探测（ADR-0011 D2 + ADR-0012 D2）
// v1.9-2 (ADR-0015)：保留为 fallback，v1.9-3+ 完全移除。
// 优先级：superpowers > matt > openspec > builtin。
// 仅在 v1.9-1 stacks 配置为空时调用（保持 backward compat）。

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

function packageJsonMentionsSuperpowers(projectRoot) {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return false;
  try {
    const text = readFileSync(pkgPath, 'utf-8');
    return /"superpowers"/.test(text);
  } catch {
    return false;
  }
}

function packageJsonMentionsMatt(projectRoot) {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return false;
  try {
    const text = readFileSync(pkgPath, 'utf-8');
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

  if (claudePlugin && packageJsonSuperpowers) {
    return { primary: 'superpowers', signals: { claudePlugin, packageJsonSuperpowers, packageJsonMattField, openspec } };
  }
  if (claudePlugin && packageJsonMattField) {
    return { primary: 'matt', signals: { claudePlugin, packageJsonSuperpowers, packageJsonMattField, openspec } };
  }
  if (openspec) {
    return { primary: 'openspec', signals: { claudePlugin, packageJsonSuperpowers, packageJsonMattField, openspec } };
  }
  return { primary: 'builtin', signals: { claudePlugin, packageJsonSuperpowers, packageJsonMattField, openspec } };
}