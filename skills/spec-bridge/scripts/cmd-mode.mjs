// cmd-mode.mjs — bridge mode 命令
// v1.9-1 / ADR-0014：mode 强度级别切换
//
// 用法：
//   bridge mode              # 查询当前模式
//   bridge mode full         # 设置为全功能（默认）
//   bridge mode memory       # 只启用个人/团队 memory
//   bridge mode navigator    # 只推荐外栈，不建 memory/builtin
//   bridge mode off          # 关闭所有自动行为
//
// 参考 ponytail：/ponytail [lite|full|ultra|off]

import { readBridgeConfig, setMode, VALID_MODES } from './config-utils.mjs';

export function run(args) {
  const projectRoot = args.projectRoot;

  // 无参数：查询模式
  if (args._.length === 0) {
    const config = readBridgeConfig(projectRoot);
    console.log(`Current mode: ${config.mode}`);
    console.log(`Source: ${config.source}`);
    return;
  }

  // 带参数：设置模式
  const newMode = args._[0];
  setMode(projectRoot, newMode);
  console.log(`Mode set to: ${newMode}`);
}

export const usage = `bridge mode [preset]
  Manage bridge strength preset (v1.9-1).
  
  Presets:
    full       memory + navigator + builtin (default)
    memory     personal/team memory only
    navigator  recommend external stacks only
    off        disable all auto behavior

  Without argument, print current preset and config source.`;