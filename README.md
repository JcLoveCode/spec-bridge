# Spec Bridge

> 组织级工作桥：把人和 agent 的产物汇总成个人+团队两层（跨迭代保留）；
> 导航员主动把你路由到正确的工具栈 skill；工作可丢给另一个窗口执行。

## 1. 业务目的

spec-bridge 解决三个根问题。**先看这张实装状态表**，决定哪段是已交付、哪段是规划：

| 业务目的 | 实装状态 |
|---|---|
| §1.1 桥（个人 + 团队 + 跨迭代保留） | v1.7+ 起实施 |
| §1.1 a' 两层记忆规则 | **v1.8-3** 实装（ADR-0013） |
| §1.2 导航员（路由到 superpowers / matt / openspec 三栈） | **v1.7** 实装（`bridge probe`） |
| §1.3 跨 session 传递（to-goal 集成） | **v1.7+** 起实施 |

### 1.1 桥：组织级跨人跨迭代汇总

把人和 agent 产生的产物——对话记忆、SDD 流程产物（spec / ticket / issue）、
bug 修复记录、版本迭代设计——汇总成两层：

- **个人层**：你一个人能回看的总纲。位置：`bridge personal/<name>/summary.md`（v1.7+ 实施）
- **团队层**：团队公用业务总纲。位置：`bridge team/<capability>/summary.md`（v1.7+ 实施）
- **跨迭代保留**：你的个人产物变了，团队总纲跟着重新汇总

#### a' 两层记忆规则（**v1.8-3** 实装 / ADR-0013）

bridge 拥有"两层记忆"——**个人层**（探测 IDE 自带 memory 优先 + fallback 在 change 下建空骨架）+ **团队层**（archive 触发 CLI 同步 + hash 校验 + cap 边界 + orphaned 沉淀）。

**个人层**（零配置探测）：

| 探测结果 | bridge 行为 |
|---|---|
| `.codebuddy/memory/` 存在 | bridge **不写**个人 memory，probe 输出 `memory_hint.personal = "ide"` + 路径 + 行数 |
| `.codebuddy/memory/` 不存在 | bridge 生成空骨架 `changes/<name>/memory.md`（§0 元信息 + §1 决策段 + §2 卡住 + §3 父继承） |

**团队层**（archive 触发同步）：

- **触发时机**：`bridge state set stage archived` 时自动调 `bridge memory sync <changeDir>`
- **同步算法**：读个人层 §1 决策段 → 计算 sha256 → 按 `.bridge.yaml.capabilities` 落 `.bridge/team/<cap>/memory.md`
- **hash 校验**：hash 一致 no-op；hash 不一致追加决策段 + 更新 `last_synced_hash`
- **orphaned 沉淀**：capabilities 空或多 cap 不一致 → 落 `.bridge/team/orphaned/<change-id>.md`（人审后 reconcile 合并）

**写规则硬约束**（SKILL.md §4.5）：

- ✅ 好示例：`v1.8.3: 砍 --builtin flag 因为纯桥模式不需要逃生口`
- ❌ 坏示例：`改了 cmd-init.mjs 加 detectIdeMemory`（没 why）
- ❌ 坏示例：`2026-09-21 13:00 修复 bug`（流水账）

**bridge 的职责边界**：bridge 只填骨架结构和元信息（`generated_by`），**不替 AI 写 memory 内容**。AI 是决策者，bridge 是档案员。

### 1.2 导航员：把你路由到正确的工具栈能力

bridge probe 主动识别你正在做什么（**对话层**，不是文件系统层），
然后路由到对应工具栈的**具体 skill**：

| 对话意图 | 桥推荐调用 |
|---|---|
| 想开始一个新功能 / 新变更 | **openspec** `openspec-new-change` 或 **matt** `spec-executor`（按项目栈选） |
| 想写代码 + TDD | **superpowers** `tdd` |
| 想跑 SDD 流程（spec → contract → execute） | **openspec** `openspec-apply-change` 或 **matt** `to-spec` |
| 卡住了想 root-cause | **superpowers** `root-cause` 或 **matt** `reflection` |
| 这个变更做完了，要归档 | bridge `archive-ready`（自带）→ openspec `openspec-archive-change` 或 matt `archive` |
| 想跨 session 续作 | bridge `to-goal`（§1.3） |

**导航员的本质**：不是"探测项目装了什么栈"——是"探测你在做什么对话，
然后告诉你该调**谁**的 **skill**"。桥本身只负责"汇总 + 归档 + 蒸馏"
三件自带能力；TDD / SDD / root-cause / spec-execution 这类执行纪律由
superpowers / matt / openspec 三家供。

### 1.3 跨 session 传递（to-goal 集成，**v1.7+** 实装）

把当前工作编译成 portable execution goal，可丢给：

- **另一个 IDE 窗口**（同对话）
- **另一个 agent**（Codex / Pi / Claude Code）
- **另一个 session**（断电续作）

**Goal block 六段**（来自 matt-skills `to-goal` skill）：

| 段 | 内容 |
|---|---|
| Goal | 一句话目标（bounded outcome） |
| Current state | 分支 / HEAD 基线 / 脏文件保护 / 已完成项 / 已知 gap |
| Execution order | 最短依赖路径 |
| Completion criteria | 从源 spec/ticket 直接继承 + 验证命令 + diff 复核 + commit 条件 |
| Constraints | 不 push / 不改无关文件 / 用最小验证 / 跨 session 安全 |
| Context | approved source / 设计文档 / 验证接缝 / 先看什么 |

**Session recommendation**（自动给）：

- Session：fresh（一次性） | persistent goal loop（跨 context）
- Capability：Lightweight | Standard | Advanced
- Intensity：Low | Medium | High
- 例：authorization migration + concurrency → `Advanced + High`
- 例：复制既有模式的小改 → `Lightweight + Low`（**用小模型省 token**）

bridge 不重新发明 to-goal——直接抄过来，完整内容见
`skills/spec-bridge/skills/to-goal/SKILL.md`。

## 2. 实现（v1.x 现在提供的）

### 2.1 三栈流水线

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

### 2.2 设计铁律

1. **状态只在磁盘**（`changes/<name>/.bridge.yaml`）——换对话、聊岔了、隔几天都不丢；
   不匹配当前消息的输入是惰性的，不碰任何状态。
2. **prompt 管判断，代码管操作**——合并/校验/回执全部走确定性 CLI（Node ≥ 20），
   绝不让 LLM 现场合并文本。
3. **零配置**——`git init` 空仓库 + 装上即用，零项目改动（AGENTS.md 指针是可选加强）。

### 2.3 14 条 CLI 命令速查

完整业务化速查见 [NAVIGATOR-AND-FUNCTIONS.md](./NAVIGATOR-AND-FUNCTIONS.md)。
简要分类：

| 类别 | 命令 |
|---|---|
| 开新工作 | `bridge init / adopt` |
| 摸项目 | `bridge layout / list` |
| 推进导航 | `bridge next / probe / mention / rootcause / pattern` |
| 执行约束 | `bridge hashes / state set` |
| 收尾归档 | `bridge sync / verify / distill / archive-ready` |
| 维护 | `bridge rebuttal / event / state` |

归档引擎 vendor 自 spec-superflow v1.2.0（MIT，见
[skills/spec-bridge/scripts/vendor/VENDOR.md](./skills/spec-bridge/scripts/vendor/VENDOR.md)）：
跨 change 冲突检测、near-match 拒绝、原子发布回滚、sha256 发布回执。

## 3. 安装

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

## 4. 使用

对 Agent 说一句话即可：

- 开新变更 → "用 spec-bridge 开始一个变更：\<需求号\> \<一句话意图\>"
- 继续 → "继续上次的变更" / "帮我看看现在该干什么"
- 归档 → "这个 change 可以归档了"

项目想强制路由时，可在 AGENTS.md 手动加一段指针（见 SKILL.md §1）；
可选的 `bridge init` 口子已预留在项目级 `.spec-bridge.yaml`。

## 5. 仓库结构

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

## 6. 开发

```bash
npm test        # node >= 20
```

上游引擎升级、接缝改动清单、升级协议：见
[skills/spec-bridge/scripts/vendor/VENDOR.md](./skills/spec-bridge/scripts/vendor/VENDOR.md)。

## License

MIT（本仓库原创部分）。
`skills/spec-bridge/scripts/vendor/` 内为 vendored 代码，版权与许可见该目录的 `LICENSE` 与 `VENDOR.md`。
