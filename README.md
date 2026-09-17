# Spec Bridge

**单入口工作流路由**：把你自装的 [OpenSpec](https://github.com/Fission-AI/OpenSpec)（规划）、
[Superpowers](https://github.com/obra/superpowers)（执行纪律）、
[Matt-skills](https://github.com/tt-a1i/matt-skills-with-to-goal)（整栈备胎）接成一条流水线。
三家缺谁都不瘫痪——每个功能槽位独立探测、独立兜底。

```
你说"开始/继续这个变更"
        │
        ▼
   spec-bridge（唯一入口）
        │  探测：项目层定栈（openspec / matt / 内置）+ 能力层补槽位
        ▼
   planning ── 4 产物（openspec 生成 / to-spec / 手写模板）
        ▼
   contracted ── 契约压缩（4 产物 → 1 份 execution-contract.md）+ 显式批准门
        ▼
   executing ── 三档执行器（superpowers TDD/SDD → spec-executor+tdd → 内置协议）
        │        每批审查进台账；hash 检测契约过期
        ▼
   archived ── sync → verify → why 蒸馏 → 归档（一个用户可见步骤，内部四拍）
```

## 设计铁律

1. **状态只在磁盘**（`changes/<name>/.bridge.yaml`）——换对话、聊岔了、隔几天都不丢；
   不匹配当前消息的输入是惰性的，不碰任何状态。
2. **prompt 管判断，代码管操作**——合并/校验/回执全部走确定性 CLI（Node ≥ 20），
   绝不让 LLM 现场合并文本。
3. **零配置**——`git init` 空仓库 + 装上即用，零项目改动（AGENTS.md 指针是可选加强）。

归档引擎 vendor 自 spec-superflow v1.2.0（MIT，见
[skills/spec-bridge/scripts/vendor/VENDOR.md](./skills/spec-bridge/scripts/vendor/VENDOR.md)）：
跨 change 冲突检测、near-match 拒绝、原子发布回滚、sha256 发布回执。
发布回执三处消费：closing guard 放行 / why 蒸馏的"已发布"标记 / `spec-rev` 陈旧判定。

## 安装

### Claude Code / CodeBuddy（Marketplace）

```bash
/plugin marketplace add JcLoveCode/spec-bridge
/plugin install spec-bridge@JcLoveCode
```

### 手动（v1 过渡）

```bash
git clone https://github.com/JcLoveCode/spec-bridge ~/skills-repos/spec-bridge
ln -s ~/skills-repos/spec-bridge/skills/spec-bridge ~/.codebuddy/skills/spec-bridge
# Claude Code 用户：ln -s … ~/.claude/skills/spec-bridge
```

## 使用

对 Agent 说一句话即可：

- 开新变更 → "用 spec-bridge 开始一个变更：\<需求号\> \<一句话意图\>"
- 继续 → "继续上次的变更" / "帮我看看现在该干什么"
- 归档 → "这个 change 可以归档了"

项目想强制路由时，可在 AGENTS.md 手动加一段指针（见 SKILL.md §1）；
可选的 `bridge init` 口子已预留在项目级 `.spec-bridge.yaml`。

## 仓库结构

```
skills/spec-bridge/
├── SKILL.md                 入口：触发条件 + 三分流路由 + 探测流程
├── CONTEXT.md               术语表
├── docs/adr/                0001 单入口路由 / 0002 vendor-sync 引擎 / 0003 单向蒸馏
├── references/              契约映射 / 执行器协议 / 子代理派发模板
├── scripts/
│   ├── bridge.mjs           确定性 CLI（sync/verify/state/hashes/layout/list）
│   └── vendor/              vendored 引擎 + VENDOR.md 溯源 + 上游 MIT LICENSE
└── tests/                   引擎回归用例（node --test）
```

## 开发

```bash
npm test        # node >= 20
```

上游引擎升级、接缝改动清单、升级协议：见
[skills/spec-bridge/scripts/vendor/VENDOR.md](./skills/spec-bridge/scripts/vendor/VENDOR.md)。

## License

MIT（本仓库原创部分）。
`skills/spec-bridge/scripts/vendor/` 内为 vendored 代码，版权与许可见该目录的 `LICENSE` 与 `VENDOR.md`。
