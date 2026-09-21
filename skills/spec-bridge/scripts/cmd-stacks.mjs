// cmd-stacks.mjs — bridge stacks 命令
// v1.9-1 / ADR-0014：手动配置能力栈（去掉自动探测）
//
// 用法：
//   bridge stacks list                    # 查询当前配置
//   bridge stacks set matt,superpowers    # 覆盖式设置
//   bridge stacks add openspec            # 增加一个栈
//   bridge stacks remove matt             # 删除一个栈
//
// 配置写入 <repo>/.bridge-config.json（项目级）

import { readBridgeConfig, setStacks, addStack, removeStack, VALID_STACKS } from './config-utils.mjs';

export function run(args) {
  const projectRoot = args.projectRoot;
  const subCommand = args._[0];

  switch (subCommand) {
    case 'list': {
      const config = readBridgeConfig(projectRoot);
      if (config.stacks.length === 0) {
        console.log('[] (empty)');
        console.log(`Source: ${config.source}`);
        return;
      }
      console.log(JSON.stringify(config.stacks, null, 2));
      console.log(`Source: ${config.source}`);
      break;
    }

    case 'set': {
      const kinds = (args._[1] || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (kinds.length === 0) {
        throw new Error('Usage: bridge stacks set <kind1,kind2,...>');
      }
      const invalid = kinds.filter((k) => !VALID_STACKS.includes(k));
      if (invalid.length > 0) {
        throw new Error(`Invalid stack(s): ${invalid.join(', ')}. Must be one of: ${VALID_STACKS.join(', ')}`);
      }
      setStacks(projectRoot, kinds);
      console.log(`Stacks set: ${kinds.join(', ')}`);
      break;
    }

    case 'add': {
      const kind = args._[1];
      if (!kind) throw new Error('Usage: bridge stacks add <kind>');
      addStack(projectRoot, kind);
      const config = readBridgeConfig(projectRoot);
      console.log(`Stacks: ${config.stacks.map((s) => s.kind).join(', ')}`);
      break;
    }

    case 'remove': {
      const kind = args._[1];
      if (!kind) throw new Error('Usage: bridge stacks remove <kind>');
      removeStack(projectRoot, kind);
      const config = readBridgeConfig(projectRoot);
      console.log(`Stacks: ${config.stacks.map((s) => s.kind).join(', ') || '(empty)'}`);
      break;
    }

    default:
      throw new Error(`Unknown subcommand: ${subCommand}. Usage: bridge stacks [list|set|add|remove]`);
  }
}

export const usage = `bridge stacks [list|set|add|remove] [...]
  Manage configured ability stacks (v1.9-1, replaces auto-detect).
  
  Subcommands:
    list                 show current stacks + source
    set <kind1,kind2..>  overwrite with priority = order (matt,superpowers → matt=1, superpowers=2)
    add <kind>           append one stack (priority = max+1)
    remove <kind>        delete one stack (priorities renumbered)
  
  Valid kinds: openspec, matt, superpowers, builtin
  
  Config written to: <repo>/.bridge-config.json (project-level override)`;