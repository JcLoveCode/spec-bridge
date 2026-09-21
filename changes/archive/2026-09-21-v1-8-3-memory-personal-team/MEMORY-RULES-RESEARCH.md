# Memory 规则调研报告（v1.8-3 前置）

> 调研日期 2026-09-21。任务：v1.8-3 "走 A：memory 骨架 + 个人/团队记忆规则" 拍板前的
> 详细调研——现成 memory 读什么 / 不读什么、reconcile 怎么调、cap 边界怎么处理。
>
> 状态：**调研稿，未落 SDD**。等用户拍板（保留 / 调整 / 落 change）。

---

## 一、调研背景

### 1.1 触发点

用户拍板：

- v1.8-3 走 A 候选（a' memory 骨架 + 个人/团队记忆规则）
- 个人层：**先看 `.codebuddy/memory/` 有没有 IDE 自带的 memory；有就用自带的，
  没有就在 A 目录（changs/<name>/）生成**
- 团队层：完整化规则（个人 → 团队怎么汇总、cap 边界怎么处理、reconcile 怎么调）

### 1.2 与原 v1.8-3 规划的对比（路线调整）

`.codebuddy/memory/2026-09-21.md` 在 α 拍板时已写下原路线：

| 原 v1.8-3 规划（α 拍板） | 当前拍板 |
|---|---|
| v1.8-3 = `personal-team-summary` ——按业务领域（domain）+ consensus 三态标记 | v1.8-3 = `memory-personal-team` ——memory 骨架 + 个人/团队规则 |

**路线调整说明**：原 personal-team-summary 是"按 capability/domain + 三态标记"做
聚合层；现 memory-personal-team 是"按 memory 文件 + 个人/团队分层"做记忆层。两者**目
标重合（让团队看到过去的事）但机制不同**：

- 原规划：聚合 capability 层 + 加 consensus 标记（依赖 distill 已有产物 + 加新字段）
- 当前拍板：建独立 memory 目录 + 个人层（IDE 优先）+ 团队层（CLI 同步）

**潜在合并点**：个人 memory.md 实际承载的内容**可以**与 distill 出的 why.md 重合
（都是"决策段"），但**位置不同**——memory 在 changes/<name>/memory.md，why.md 在
specs/<cap>/why.md。

---

## 二、现有结构盘点

### 2.1 CodeBuddy memory（IDE 自带，**不属于 bridge 域**）

| 物理项 | 内容 | 写者 |
|---|---|---|
| `.codebuddy/memory/YYYY-MM-DD.md` | 当日 append-only buffer | IDE 自动 |
| `.codebuddy/memory/MEMORY.md` | 长期 curated 索引 | IDE / 助手提炼 |
| `.codebuddy/memory/<project-specific>.md` | 项目层（如果 IDE 支持）| IDE |

**关键边界**：

- README §1.1 a' 已定："bridge **不写** `.codebuddy/memory/`，避免与 IDE 填的 memory 冲突"
- bridge **读**这部分是另一回事——见 §3

### 2.2 bridge 现有目录与文件

| 物理项 | 内容 | 写者 | 读者 |
|---|---|---|---|
| `changes/<name>/.bridge.yaml` | 状态台账（stage / layout / workflow_kind / capabilities / parent / published / spec_publication_receipt） | bridge | bridge |
| `changes/<name>/.bridge.log` | 事件流（init / event / sync / archive） | bridge | bridge |
| `changes/<name>/proposal.md` | 5 件产物（proposal/design/tasks/spec/execution-contract） | 外栈 / AI（v1.8-2 后） | bridge |
| `changes/<name>/design.md` | 设计文档，含 `## Decisions` 段 | 外栈 / AI | bridge |
| `changes/<name>/specs/<cap>/spec.md` | capability 增量 spec | 外栈 / AI | bridge |
| `specs/<cap>/spec.md` | 根 baseline spec | bridge sync | bridge |
| `specs/<cap>/why.md` | 蒸馏产物（v1.5+，从 design.md ## Decisions 抽） | bridge distill | bridge |
| `changes/archive/<date>-<name>/` | 已归档 change（stage=archived） | bridge archive flow | 只读 |

**没有任何 memory 写读能力**——bridge 目前完全没碰 memory。

### 2.3 probe 输出格式（8 字段 KEY:value）

```
project_type: <standalone|openspec>
capabilities: <comma,list,or,(unset)>
stage: <planning|contracted|executing|archived>
inventory: <s1,s2,...>
advised_skill: <skill-name-or-(none)>
advised_reason: <why-this-skill>
advised_invocation: <use_skill-command>
next_hint: <from-bridge-next>
```

**新增 memory_hint 字段的位置**：放在 `stage` 之后（探测到的实际状态），`inventory`
之前（避免被 inventory 干扰路由）。

### 2.4 现有"边界声明"机制盘点

| 边界类型 | 声明字段 | 在哪写 | 现有用途 |
|---|---|---|---|
| capability 边界 | `.bridge.yaml: capabilities`（复数 / `--capabilities`）| `bridge init --capabilities a,b,c` | cmd-init 第 2 级推导 workflow_kind（取首值）；**没有**被 list / archive-ready 聚合用 |
| 单 capability（默认）| `.bridge.yaml: capabilities`（首值）| `flags.capability || defaultCapability(name)` | `cmd-init` 推断 specs/<cap>/ 目录名 |
| 项目栈（外栈）| detect-stack.mjs 双信号 | 项目根 + package.json | probe 路由 |
| bridge memory 边界 | **（本次新增）** | `bridge memory init / append / sync` | v1.8-3 待定 |

**关键缺口**：

- `--capabilities` 字段**已被写**到台账但**没被消费**——`bridge list` 不会按 cap 分组，
  `bridge archive-ready` 只会遍历 specs/<cap>/ 子目录拿 spec.md
- cap 归属不明时（changs 下没有 spec.md 的 capability）**没有 orphan 处理**
- memory cap 与 `--capabilities` 字段的关系**未定义**——一个 change 可能属于多 cap，
  memory 写哪个？

### 2.5 现有"汇总算法"盘点

| 命令 | 物理操作 | 写入位置 |
|---|---|---|
| `bridge sync <dir>` | 把 change 内 specs/<cap>/spec.md 合并到根 specs/<cap>/spec.md + 写 receipt | 根 specs + .bridge.yaml |
| `bridge verify <dir>` | 读 receipt 重算 hash 校验 | 只读 + 比较 |
| `bridge distill <dir>` | 从 design.md ## Decisions 抽 `### D<N> — <name>` 段写到 specs/<cap>/why.md | change 内 specs/<cap>/why.md |
| `bridge archive-ready <dir>` | 守门 4 件（state / stage / sync / why.md） | 只读校验 |
| `bridge event <dir>` | appendEvent 写大事记到 .bridge.log | .bridge.log |
| `bridge mention / rootcause <dir> --tag` | 记录模式信号到 .bridge.log | .bridge.log |

**没有"个人 → 团队"的聚合算法**——sync 是"change → 根 baseline"（spec 合并），
不是"个人 → 团队"（memory 合并）。

---

## 三、个人层：bridge 读什么 / 不读什么

### 3.1 读什么（bridge 必须读）

| 读 | 用途 | 触发点 |
|---|---|---|
| **`.codebuddy/memory/` 是否存在** | 决定个人层物理位置（IDE 自带 vs bridge 自建）| `bridge memory init` / `bridge probe` |
| **`MEMORY.md` 的 §级标题列表** | 给 probe `memory_hint` 报告"个人层 N 条已提炼" | `bridge probe` |
| **`YYYY-MM-DD.md` 的最后修改日期 + 行数** | 给 probe `memory_hint` 报告"daily buffer 最后 X 日" | `bridge probe` |

**只读元信息**——不读正文内容（避免桥替 AI 总结污染）。

### 3.2 不读什么（bridge 禁止读）

| 不读 | 为什么 | 后果 |
|---|---|---|
| **个人层 `MEMORY.md` / `YYYY-MM-DD.md` 的正文** | bridge 不是 LLM 现场合并工具（AGENTS.md 禁事 1）；读了就要拼到 probe 输出里 = 现场合并 | AI 看到的是 bridge 替它做的总结，污染 AI 判断 |
| **`.codebuddy/memory/<project-specific>.md`** | 同上 | 同上 |
| **bridge 自己产出的 `changes/<name>/memory.md` 的正文** | 个人层内容由 AI / 人按规则填，bridge 只管"结构 + 元信息"（禁事 1 同理） | 同上 |
| **bridge 内部生成的 summary / digest 段** | bridge 不能"替 AI 总结"——禁事 1 | 不污染 AI 判断 |

### 3.3 团队层例外：bridge 机械读 team memory top 3 decision 段（v1.8-3 知识循环 3 流转 §B 需要）

按知识循环 §B（团队 → 个人），AI 在新需求开始时**需要知道团队上次决定过啥**。
bridge 在 `bridge probe` 时**机械读** `.bridge/team/<cap>/memory.md` 的 top 3 decision
段（按 INDEX.md 的 cap 列表逐 cap 取），输出到 probe 给 AI 看。

| 读 | 边界 |
|---|---|
| `.bridge/team/<cap>/memory.md` 的**前 3 个 decision 段**（按 INDEX 排序） | **不**改写、不重写、不总结 |
| **不读** team memory 的 stuck / orphan / rebuttals 段 | 那些是 reference 段，不进 probe |
| **不拼接** 多个 cap 的内容——每个 cap 单独一行 | AI 自己挑感兴趣的 cap 再去 cat 全文 |
| **不缓存**——每次 probe 都重读 | 避免 stale |

**关键边界**（不污染 bridge 逻辑）：

- bridge 输出"机械行"（如 `team=cli:[D1 add-cmd-init (D4), D2 superpowers-priority (D3), D5 PROPOSAL_TEMPLATE removed (D1)]`）
- bridge 不评论 / 推荐 / 排序这些 decision
- AI 看到后**自己决定**"这次新需求用 D1 还是反 D1" → 写新决策时带 `INHERIT D<N>: ...` 或 `UPDATE D<N>: ...` 前缀（详见 §3.5）

**核心规则**：

> bridge 读 memory 时**只读"有没有 / 多长 / 多旧"，不读"讲了什么"**。
> AI 要看 memory 内容 = AI 自己读 `.codebuddy/memory/` 或 `changes/<name>/memory.md`。

### 3.4 个人层写规则（与 §3.1/§3.2/§3.3 对应）

| 时机 | 写什么 | 谁来写 | 写在哪 |
|---|---|---|---|
| bridge init 时探测 IDE memory 在 | **不写**个人层 | bridge | （不写） |
| bridge init 时探测 IDE memory 不在 | 自动写**空骨架**（§0 元信息 + §1-N 占位）| bridge | `changes/<name>/memory.md` |
| AI 在 change 里做完决策 | append `vX.Y.Z: <decision> — <reason>` | AI 调 `bridge memory append` | 同上 |
| AI 走偏或卡住 | append `STUCK: <reason> — <resolution>` | AI 调同上 | 同上 |
| `--parent <id>` 续作 | 从父 archive memory.md 抽"决策段"复制 | bridge | 同上 |
| archive-ready 守门 | 个人层**有内容**或 IDE memory 在场 | bridge 守门 | （校验） |

### 3.4 个人层不写规则（硬约束）

1. **bridge 不写内容**——只填结构（§0 元信息）和元信息（行数 / 日期）
2. **bridge 不替 AI 总结**——不读 memory 正文做摘要，不合并到 probe 输出
3. **bridge 不写过程日志**——不把 `event log` 内容复制到 memory（这是 chat 风格的过程记录）
4. **每行必带 why**——append 命令校验文本必须含 `— <reason>` 段（最少 10 字理由）

### 3.5 个人层 append 关键字（v1.8-3 知识循环 3 流转 §C 需要）

AI 写决策时支持两个关键字前缀（服务 reconcile update）：

| 关键字 | 语义 | reconcile 触发行为 |
|---|---|---|
| **裸 append**（无前缀）| 新决策，无关联 | append 默认（`memory.md` 末尾追加）|
| **`INHERIT D<N>: ...`** | 这次决策"继承"团队层旧决策 D<N>——内容同，标 reference | append，但写一行 `[refers team D<N>]` 标记 |
| **`UPDATE D<N>: ...`** | 这次决策"更新"团队层旧决策 D<N>——why 改变 | reconcile 时查 team 同 key，update 旧行（留 audit）+ 写新行 |

**关键边界**：

- `UPDATE` 关键字只能引用**团队层**已有的 D<N>（不是个人层 D 编号）
- `INHERIT` 不动 team layer（只标 reference，避免改 team）
- bridge 不解析语义——按 `UPDATE D5: 起 X 因为 Y` 字面前缀匹配
- key 冲突（team 层有两个 D5）→ reconcile 报错让人工 review（不静默选第一个）

### 3.6 个人层示例（v1.8-3 知识循环展示）

`changes/v1-8-3-memory-personal-team/memory.md`：

```markdown
# Memory: v1-8-3-memory-personal-team

## §0 元信息（bridge 写）

- bridge-managed: true
- capabilities: cli,memory
- created_at: 2026-09-21

## §1 Decisions（AI 写）

### v1-8-3:1 2026-09-21 (fjc)
个人层位置选 A — changes/<name>/memory.md 与 .bridge.yaml 同级 — archive 时跟随

### v1-8-3:2 2026-09-21 (fjc)
UPDATE D5: 起个人 team memory 加 rebuttals/ 子目录 — 因为原版没 audit 落点 —

（团队层已有 D5"团队层位置选 A"，本次 update 改写）

### v1-8-3:3 2026-09-21 (fjc)
INHERIT D4: 团队层 reconcile 时机选 archive 自动 + cap 变更手动 — 团队已决定不加
### v1-8-3:4 2026-09-21 (fjc)
STUCK: cap 字段缺失导致 team reconcile 收不到 — 走 orphan 临时沉淀 + 人工 review

## §2 References

- 团队层决定：D5 起个人 team memory 加 rebuttals/
- 团队层决定：D4 reconcile 时机选 archive 自动
```

---

## 四、团队层：reconcile 怎么调

### 4.1 团队层物理位置

**与个人层和 IDE memory 完全解耦**：

```
.bridge/team/<cap>/memory.md          # 团队按 cap 聚合（一个 cap 一个文件，可 append + update）
.bridge/team/<cap>/rebuttals/<hash>.md # update 的 audit（v1.8-3 知识循环 §C）
.bridge/team/orphaned/<hash>.md       # 归属不明的决策（临时沉淀）
.bridge/team/stuck/<change-name>.md  # 卡住记录（独立 team 汇总）
.bridge/team/INDEX.md                # cap → memory.md 路径 + 行数 + 最后更新（自动生成）
```

**rebuttals/ 子目录说明**（v1.8-3 知识循环 3 流转 §C 需要）：

- 当团队层某决策被 update（个人层新决策"推翻"了旧决策）→ 旧决策 hash 落到
  `.bridge/team/<cap>/rebuttals/<hash>.md` 留 audit
- audit 文件记录"为什么改" + 旧决策原文 + 新决策 ref + 改的 change 名
- 旧决策在 team memory.md 仍保留，但标记 `[superseded by <new-ref> → rebuttals/<hash>]`
- AI / 人可随时 review 改的历史，**不丢任何决策**

**为什么不放在 `specs/<cap>/` 下**：

- `specs/<cap>/` 是 spec 的根 baseline（v1.5+ 实施）——加 memory 会污染 spec baseline 的语义
- `specs/<cap>/why.md` 已存在（v1.5+ distill 产物），与团队 memory 字段意义不同：
  - `specs/<cap>/why.md` = 该 cap 的"设计决策段"（能力粒度）
  - `.bridge/team/<cap>/memory.md` = 该 cap 的"个人 → 团队聚合"（记忆粒度，可变）
  - `.bridge/team/<cap>/rebuttals/` = 团队 memory 的 audit 落点

### 4.2 团队层 reconcile 算法（v1.8-3 实施）

#### 4.2.1 触发时机

| 触发 | 谁调 | 时机 |
|---|---|---|
| **A. change archive 自动** | bridge archive flow | `bridge archive-ready` 通过后**自动**调 `bridge memory sync <dir>` |
| **B. cap 边界变更手动** | AI / 人 | `bridge memory reconcile --team`（重算所有 cap） |
| **C. 个人 memory 修订** | AI / 人 | manual（不触发——避免每次新合并都重算） |

**自动触发只（A）**：archive 时把该 change 的 memory 个人 margin 抽到 `.bridge/team/<cap>/`。
**B 仅手动**——cap 边界变化不频繁（按 `--capabilities` 字段调整）。
**C 不触发**——个人 memory 修订不影响团队层（团队层只反映已 archive 的）。

#### 4.2.2 reconcile 算法（CLI，6 步 — 知识循环 3 流转 §C 需要）

```
bridge memory reconcile <dir> [--team] [--cap <cap>]
```

1. **遍历** `changes/archive/` 下所有 stage=archived 的目录
2. **抽每条 change** 的 memory.md（个人层）正文
3. **解析** 每行为 `{ ts, type, ref, text }` 结构（type=decision / stuck / other）
4. **按 cap 分组**：
   - `decision` 行的 cap = `--capabilities` 字段的首值
   - `stuck` 行 = 单独目录 `.bridge/team/stuck/<change-name>.md`
   - 归属不明（cap 字段缺失）→ `.bridge/team/orphaned/<sha256(line)[:12]>.md`
5. **写入 team memory**（append 或 update）：
   - **裸 append** 行 → 追加到 `.bridge/team/<cap>/memory.md`
   - **`INHERIT D<N>`** 行 → 追加，但写一行 `[refers team D<N>]` 标记
   - **`UPDATE D<N>`** 行 → 查 team memory 是否有 D<N>：
     - 有 → update 旧行（标 `[superseded: <hash>]`）+ 旧行 hash + 旧正文落
       `.bridge/team/<cap>/rebuttals/<hash>.md`
     - 无 → 报 audit 错误让人工（不静默 append）
     - 多个 D<N> 同 key → 报 conflict 错误让人工
   - 写入失败 → 保留旧文件不变（不破坏 team memory）
6. **重算 INDEX.md** —— 按 cap 列表 + 行数 + 最后更新 + rebuttals 计数

#### 4.2.3 reconcile 输出格式

```
reconciled: 23 changes
  cap=cli       → .bridge/team/cli/memory.md (+12 lines, last=2026-09-21)
  cap=archive   → .bridge/team/archive/memory.md (+5 lines, last=2026-09-21)
  cap=probe     → .bridge/team/probe/memory.md (+8 lines, last=2026-09-21)
  orphan        → .bridge/team/orphaned/ (+2 files)
  skipped (cap unset): 1 change
```

#### 4.2.4 reconcile 不写什么（硬约束）

- **不替 AI 现场合并**——CLI 读 memory.md → 按行追加 / update，**不解析语义**
  （不重写、不去重、不排序、不写"摘要"）
- **不删孤儿** —— orphan 沉淀保留，由人工 review
- **不跨 cap 合并** —— 个人 memory 一行只入一个 cap，归属不明入 orphan
- **不删 audit** —— superseded 决策不删，标 `[superseded: <hash>]` 指向 rebuttals/
- **不静默 append UPDATE 失败** —— team 找不到 D<N> 或多个 D<N> 冲突时，**报错让人工**（不静默改成 append）

### 4.3 团队层 reconcile 与现有流程的关系

| 现有流程 | v1.8-3 增加的 hook |
|---|---|
| `bridge archive-ready <dir>` | 通过后**建议**（不强制）调用 `bridge memory sync <dir>` |
| `bridge archive <dir>`（git mv + state set） | **建议**在 git mv 前先 `bridge memory sync <dir>` |
| `bridge sync <dir>`（spec 合并） | **不动**——memory 走独立通道（避免混淆 spec baseline 与 memory） |
| `bridge verify <dir>`（receipt 校验） | **不动**——memory 不在 receipt 字段名里（AGENTS.md 禁事 3） |
| `bridge distill <dir>` | **不动**——distill 写到 specs/<cap>/why.md，与 team memory.md 是并行产物 |

**关键边界**：

- memory 是**记录**，spec 是**规约**——两条独立通道，互不污染
- team memory.md **不进入** sync 的基线合并（sync 只合并 specs/<cap>/spec.md）
- team memory.md **不进入** distill 的 why.md 抽取（distill 只从 design.md ## Decisions 抽）

---

## 五、个人 vs 团队：内容范围对比

| 维度 | 个人层（changes/<name>/memory.md） | 团队层（.bridge/team/<cap>/memory.md）|
|---|---|---|
| **粒度** | 1 change = 1 file | 1 cap = 1 file（跨 change 聚合）|
| **来源** | AI / 人按规则 append | bridge reconcile 从个人层抽 |
| **物理位置** | changes/<name>/ | .bridge/team/<cap>/ |
| **时机** | change 生命周期内 | change archive 后 |
| **可改** | change 内可改（stage=archived 不可改） | append + update 双模式（update 留 audit rebuttals/）|

### 4.5 update 与 audit 详细算法（v1.8-3 知识循环 §C 落地）

**触发**：`bridge memory reconcile <dir>` 时遇到个人 memory 行带 `UPDATE D<N>: ...` 前缀

**算法 4 步**：

1. **查 team key**：在 `.bridge/team/<cap>/memory.md` 找匹配 `## D<N> ...` 段
2. **3 种结果**：

| 结果 | 行为 |
|---|---|
| **唯一匹配** | 进入 update：旧决策 hash 写到 rebuttals + 旧行标 superseded + 新行追加 |
| **零匹配** | 报 audit 错误（sterr）：`UPDATE D<N>: team has no D<N> in cap=<cap>` |
| **多匹配** | 报 conflict 错误：列多个 D<N> 段让人选 |

3. **update 写入**：旧段原文写到 `.bridge/team/<cap>/rebuttals/<old-hash>.md`，新决策写
   `.bridge/team/<cap>/memory.md` 末尾追加，旧决策行标 `[superseded by <new-ref> → rebuttals/<old-hash>]`

4. **audit rebuttal 文件**（`.bridge/team/<cap>/rebuttals/<old-hash>.md`）：

```markdown
# Rebuttal: D<N> in cap=<cap>

- **由**：<change-name>:reconcile 触发
- **旧决策**：<reviewed-date>（原 hash: <old-hash>）
  <原决策正文>
- **新决策**：<updated-date> → <new-ref>
  <新决策正文>
- **冲突**：无 / 有 → 见 rebuttals/<conflict-hash>.md
```

**关键边界**：

- audit 文件**不**进 sync 合并（与 team memory 一样是独立通道）
- audit 文件**不**进 INDEX.md 索引（只是 reference）
- key 冲突时 audit 文件留多份，让人决定

### 4.6 team memory 写入示例（v1.8-3 知识循环 §C 演示）

`changes/v1-8-3-memory-personal-team/memory.md` 个人层写入：
```markdown
### v1-8-3:2 2026-09-21 (fjc)
UPDATE D5: 起个人 team memory 加 rebuttals/ 子目录 — 因为原版没 audit 落点 —
```

reconcile 后 `.bridge/team/cli/memory.md` 团队层：

```markdown
## D1 砍 X 因为原因 — 2026-09-20 (v1-5-list-update D1)
原决策。

## D2 起 Y 因为 Z — 2026-09-20 (v1-5-list-update D2)
原决策。

## D5 团队层位置选 A — 2026-09-21 (v1-8-1 D5, [superseded by v1-8-3:2 → rebuttals/a1b2.md])
[原决策 + rebuttals/a1b2.md 指向]

## D5 起个人 team memory 加 rebuttals/ 子目录 — 2026-09-21 (v1-8-3:2)
起个人 team memory 加 rebuttals/ 子目录 — 因为原版没 audit 落点 —
```

`rebuttals/a1b2.md` audit 文件：

```markdown
# Rebuttal: D5 in cap=cli

- **由**：v1-8-3-memory-personal-team:reconcile 触发
- **旧决策**：2026-09-21 (v1-8-1 D5)
  团队层位置选 A — 因为 .bridge 与团队层明确隔离
- **新决策**：2026-09-21 (v1-8-3:2)
  起个人 team memory 加 rebuttals/ 子目录 — 因为原版没 audit 落点
- **冲突**：无
```
| **读法** | AI 直接读 | AI 直接读（团队全局视图） |
| **冲突处理** | 不冲突（每 change 自己）| 冲突走 `bridge rebuttal` 标记 |

---

## 六、probe `memory_hint` 字段设计

### 6.1 输出位置与格式

放在 `stage` 之后（探测到的状态），`inventory` 之前（避免被 inventory 干扰路由）：

```
project_type: <standalone|openspec>
capabilities: <comma,list,or,(unset)>
stage: <planning|contracted|executing|archived>
memory_hint: personal=<source>(<meta>); team=<cap-list>:[<top-3-decisions-summary>]
inventory: <s1,s2,...>
advised_skill: <skill-name-or-(none)>
advised_reason: <why-this-skill>
advised_invocation: <use_skill-command>
next_hint: <from-bridge-next>
```

### 6.2 `memory_hint` 三种格式

| 探测结果 | memory_hint |
|---|---|
| IDE memory 在场 | `personal=ide(.codebuddy/memory/, daily=12, curated=4); team=cli:[D1 add-cmd-init (D4), D2 superpowers-priority (D3), D5 PROPOSAL_TEMPLATE removed (D1)]` |
| IDE memory 不在，bridge 建了个人层 | `personal=bridge(<path>, lines=N); team=cli:[...]` |
| 两者都不在 + 桥未建 | `personal=none; team=<rcl-cnt>` |

**`<top-3-decisions-summary>` 格式**（按 INDEX.md 顺序，每个 cap 取 top 3）：

```
team=cli:[D1 add-cmd-init (v1-8-1:D4), D2 superpowers-priority (v1-8-2:D3), D5 PROPOSAL_TEMPLATE removed (v1-8-2:D1)]
```

每个段 `<D-key> <name-decision> (<origin-change>:<origin-decision>)` —— origin
是个人层写这条决策的 change ref。

### 6.3 `memory_hint` 字段不做什么

- **不读个人层正文**——个人 memory（IDE 自带 / bridge 自建）bridge 只读元信息
- **机械读 team 顶层 decision 段**——按 INDEX.md 顺序 + 每个 cap top 3，**不**改写 / 总结 / 排序
- **不拼接多 cap**——每个 cap 单独一段，AI 自己挑感兴趣的
- **不缓存**——每次 probe 都重读（避免 stale）
- **不拼接到 advised_skill**——memory_hint 是元信息，不参与路由决策
- **不进 receipt**——AGENTS.md 禁事 3："不要改 4 个 receipt 字段名"

---

## 七、关键决策点（待用户拍板）

### 决策 1：个人层物理位置

| 选项 | 优 | 劣 |
|---|---|---|
| **A. changes/<name>/memory.md**（与 .bridge.yaml 同级）| 与 bridge state 同级，archive 时跟着移动 | 1 change × 1 file 文件多 |
| B. changes/<name>/specs/<cap>/memory.md | 与 spec 同级 | 与 cap 概念混淆（memory 不属于 spec）|
| C. .bridge/memory/<change-name>.md | 与 team memory 同级 | 个人 vs 团队边界不清 |

**倾向 A**（与 .bridge.yaml 同级）——理由与现行 `--capability` 单 cap 推断机制契合。

### 决策 2：团队层物理位置

| 选项 | 优 | 劣 |
|---|---|---|
| **A. .bridge/team/<cap>/memory.md** | 与个人层明确隔离 | 新建目录 |
| B. specs/<cap>/memory.md | 复用现有 specs 目录 | 与 spec baseline 语义混淆（AGENTS.md 禁事 1） |

**倾向 A**（独立目录）——理由：memory 是记录、spec 是规约，两条独立通道。

### 决策 3：reconcile 默认时机

| 选项 | 优 | 劣 |
|---|---|---|
| **A. archive 时自动 + cap 变更手动** | 自动汇集，手动审 | archive 流程多一步 |
| B. 完全手动 | 简单 | 容易忘调，团队层数据不全 |
| C. 每次 probe 自动 reconcile | 一致 | 性能问题（probe 调一次全量聚合太重）|

**倾向 A**（archive 自动 + 变更手动）——理由：archive 是天然的"个人→团队"触发点，
cap 变更不频繁。

### 决策 4：bridge 读不读 memory 正文

**已选**：不读。只读元信息（有没有 / 多长 / 多旧）。

### 决策 5：v1.8-3 与原 personal-team-summary 的关系

| 选项 | 描述 |
|---|---|
| A. 替代（原规划作废） | v1.8-3 改成 memory-personal-team，原 personal-team-summary 取消 |
| B. 合并（memory 是底层机制，team summary 是上层规则）| v1.8-3 = memory 骨架 + 个人/团队规则；原 consensus 三态标记在团队 memory.md 实现 |
| D. 分两步（v1.8-3 = memory 骨架，v1.8-4 = team summary） | 拆细拍 |

**倾向 C（分两步）**——理由：调研阶段范围小好拍板，每行只承载一件事。
但用户当前拍板"完整化个人和团队规则"暗示走 B（合并）。

### 决策 6：个人层 append 校验

| 选项 | 描述 |
|---|---|
| A. 校验必须含 `— <reason>` 段（最少 10 字）| 强制每行带 why |
| B. 软提示（不通过时 warn 但仍写）| 不卡 AI |
| C. 不校验 | 信任 AI |

**倾向 A**（硬校验）——理由：memory 的价值在 why，没 why 等于 chat 记录（违反不写规则 3）。

### 决策 7：probe memory_hint 含团队 memory 实际内容

**已选 A**（含 top 3 decision 摘要）——理由：知识循环 §B 需要 AI 看到团队历史决策；
按 cap × top 3 控制输出量，避免爆。

### 决策 8：团队层 bridge 是否可变

| 选项 | 描述 |
|---|---|
| **A. append + update 双模式**（update 留 audit）| 支持知识循环 §C；改动较多（reconcile 算法 + rebuttals/）|
| B. append-only（不重写）| 简单，调研报告原方案 |

**倾向 A**（双模式）——理由：用户拍板要求"个人做新需求改变团队记忆 → why 改变 → 同步更新"；
append-only 不支持这个循环。

### 决策 9：个人层 append 关键字

| 选项 | 描述 |
|---|---|
| **A. 支持 `UPDATE D<N>` + `INHERIT D<N>` + 裸 append 三模式** | 服务知识循环 §C；改动（reconcile 解析）|
| B. 只支持裸 append | 简单，reconcile 不会 update |

**倾向 A**（三模式）——理由：知识循环 §C 需要 UPDATE 触发 team update；INHERIT
标记 reference 不动 team；裸 append 是默认。

### 决策 10：UPDATE 触发条件

| 选项 | 描述 |
|---|---|
| **A. 个人层 append 含 `UPDATE D<N>: ...` 字面前缀 + reconcile 时查 team 同 key** | bridge 不解析语义，按字面匹配 |
| B. bridge 解析决策含义推断 update | 复杂，易错（违反禁事 1）|

**倾向 A**（字面匹配）——理由：bridge 不该"懂"语义；AI 显式声明 `UPDATE` 关键字
= 人类 / AI 自己的责任。

### 决策 11：update audit 落点

| 选项 | 描述 |
|---|---|
| **A. `.bridge/team/<cap>/rebuttals/<hash>.md` 独立审计目录** | 改 team memory 也方便找 audit |
| B. 与 team memory.md 同一文件分段 | 简单，但 memory.md 会变臃肿 |
| C. 不留 audit，只 update | 简单，但丢历史（违反禁事 1）|

**倾向 A**（独立目录）——理由：audit 是 reference，不该污染 memory.md 主体；用户拍板
"同步更新到团队知识库-why 和最终"暗示两边都留痕。

### 决策 12：v1.8-3 与原 personal-team-summary 的关系（路线调整）

**已选 B**（合并）——理由：用户当前拍板"完整化个人和团队规则"+ "知识循环 3 流转"
本质就是 personal-team-summary 的合并版（consensus 三态标记在 team memory.md 的
rebuttals/ 目录里实现——archived / superseded / orphaned 三态天然映射）。

---

## 八、风险点

1. **"替 AI 总结"边界模糊**——AI 容易把"做了什么"塞进 memory（属于过程日志），
   本质该写"为什么这么做"。SKILL.md §x 加硬示例："做完决策记 `v1.8.3: 砍 X 因为 Y`"
   禁止 `我做了 X` 风格。
2. **cap 边界声明**——已有 `--capabilities` 复用；新开 change 不给 --capabilities 时按
   `defaultCapability(name)` 落，但**没设 capabilities 字段**会让 team reconcile 收
   不到那条决策（落 orphan）。
3. **IDE memory 内容质量不可控** —— bridge 只"声明"它存在 + 路径，**不读个人正文**（避免
   bridge 替 AI 做总结）。但用户期望"看到 memory 内容"——这必须由 AI 自己去读。
4. **memory 与 archive 顺序**——必须 archive 前先 `memory sync`（否则个人 memory 没抽
   到团队层就 archive 了）。`bridge archive-ready` 守门要加这条校验。
6. **memory 跨项目**——README §1.1 a' 只管本项目根 `.codebuddy/memory/`，不跨项目。
   v1.8-3 团队层也只在本项目根。**跨项目 memory 是下下拍**（不在 v1.8-3 范围）。
7. **memory 与现有 receipt 字段的边界**——AGENTS.md 禁事 3 写"不要改 4 个 receipt
   字段名"——memory 内容**不进** receipt（避免污染 v1.5+ 现有的 spec publication
   receipt）。
8. **不读个人层正文的边界 case**——AI 如果问"项目上次讲过啥？" bridge 不直接回答个人内容，
   但 probe `memory_hint` 会**机械读 team top 3** 报告给 AI 看——AI 自己挑 cap 的再用
   `bridge memory show <cap>` 读全文。这是设计上的"惰性 + bridge 不替 AI 总结"。

### 8.1 v1.8-3 知识循环新风险（个人 → 团队 update 引入）

9. **UPDATE 关键字被滥用**——AI 写 `UPDATE D5: ...` 但其实意思是"提个新决策"。约束：
   - bridge reconcile 时 team 找不到 D<N> → **报错不静默 append**（不让 D<N> 冲突）
   - SKILL.md §x 加示例：UPDATE 关键字 = "改的不是新决策而是推翻旧决策"
10. **team update 时 race condition**——两个 change 同时 archive 都带 UPDATE D5：哪个赢？
    约束：reconcile 加**乐观锁**（读 team memory 写入前先读 + 加文件锁 + 写回）
    —— v1.8-3 简化：单进程串行 reconcile（不引入锁文件库）；并发场景下下拍处理
11. **rebuttals/ 目录膨胀**——长期迭代后 audit 文件变多。约束：
    - INDEX.md 加 rebuttals_count 字段
    - `bridge memory reconcile --prune` 子命令按"被引用次数 ≤ 1"软删（不删原文件，写"pruned"标记）
12. **probe 输出的 team top 3 是 stale**——AI 看到时可能 team 已 update。约束：
    - probe 每次都重读（不缓存，§6.3 已定）
    - 但跨 AI session 时无法保证一致——接受这个最终一致性

---

## 九、下一拍建议（待用户拍板）

### 选项 A：开 v1.8-3 change 走完整 SDD（含知识循环 3 流转，推荐）

- 路径：`changes/v1-8-3-memory-personal-team/`
- 4 件产物：proposal / design / tasks / spec（外加 execution-contract）
- 新 ADR：`0013-memory-personal-team-knowledge-cycle.md` ——把 §3 个人层规则、§4 团队层
  reconcile 算法（含 §4.5 update + audit）、§6 probe memory_hint 字段（含 top 3
  decision 摘要）、§3.5 append 关键字（UPDATE / INHERIT）写入项目宪法
- 实装顺序（**5 批**，含知识循环）：
  - **Batch 1**：探测能力 + 个人层 init 骨架（写最简 memory.md 模板 + 元信息）
  - **Batch 2**：个人层 append（硬校验 why + UPDATE/INHERIT 关键字识别）
  - **Batch 3**：团队层 sync + reconcile（append + update + rebuttals/ 写入）
  - **Batch 4**：probe memory_hint 字段（含 team top 3 decision 摘要）+ archive-ready
    守门加"memory 已 sync"
  - **Batch N**：archive + commit + push
- 测试：**15+ cases**（探测 / 补 / append 关键字 / UPDATE 触发 / INHERIT 触发 /
  rebuttals/ 写入 / probe 显示 top 3 / archive-ready 守门 / key 冲突报错 /
  hash 一致性 / 边界：append-only 兼容）

### 选项 B：先小步（拆 §3.5 关键字 + §4.5 update 为下拍）

- v1.8-3-1 = 个人层 init + 裸 append + 团队层 sync（reconcile 只 append）
- v1.8-3-2 = append 关键字 + UPDATE + rebuttals/
- v1.8-3-3 = probe memory_hint 团队 top 3

### 选项 C：调研稿先冻结一轮（含 §8.1 新风险）

- v1.8-3 = A 选项但**只做调研报告里决策 1-7 + 决策 12** 的部分
- 决策 8-11（双模式 / 关键字 / audit 落点）作为下拍

---

## 十、调研结论

**v1.8-3 = memory 骨架 + 个人/团队规则 + 知识循环 3 流转** 是 v1.8 系列"a' memory
骨架"业务目的的**最自然实施**。但有几条**硬约束**需要用户拍板前明确：

1. 个人层**不读** memory 正文（bridge 只看元信息；top 3 摘要**只来自团队层**）
2. 团队层**走 CLI** reconcile（不让 LLM 现场合并）
3. 个人层 append **硬校验**含 `— <reason>` 段
4. reconcile **默认 archive 时自动 + cap 变更手动**
5. 团队层**双模式**（append + update），update 留 audit rebuttals/
7. 个人层 append 支持 **UPDATE / INHERIT** 关键字
8. probe `memory_hint` 含 **team top 3 decision 摘要**（按 cap × top 3 控制输出量）

### 10.1 v1.8-3 知识循环业务故事（一页图）

```
[个人层] changes/<name>/memory.md
   ↑ AI append 一行决策（裸 append / UPDATE D5 / INHERIT D5）
   ↓ archive 时被 reconcile 读取
[团队层] .bridge/team/<cap>/memory.md
   ↑ reconcile 按 key 决策：append 新决策 / update 旧决策（同 key）
   ↑ 被 superseded 的旧决策 hash 写到 rebuttals/<hash>.md（audit）
[probe 字段] memory_hint 输出 team top 3 decision 摘要
   ↑ AI 看到摘要
   ↑ AI 调 bridge memory show <cap> 读全文 / 自行 cat
[下个 change] AI 据团队历史决策写新决策（裸 append / UPDATE / INHERIT）
   ↑ 循环回到第一步
```

---

## 十一、知识循环 3 流转（v1.8-3 用户拍板补充）

### 11.1 用户期望的"知识循环"业务话术

> 个人记忆积累更新 → 团队记忆更新 → 个人做下一个需求遇到了团队记忆 → 使用团队
> 记忆完成本次相同业务领域的需求。
> 或者开了一个分支当有团队记忆的时候 → 个人的做的新需求改变了团队记忆 → why
> 改变。进入个人知识库，最终效果 → 同步更新到团队知识库-why 和最终。

### 11.2 3 流转落点对照

| 流转 | 业务话术 | 落地 |
|---|---|---|
| **A. 个人 → 团队（积累）** | change 内 AI 写决策 → archive 同步到团队 | §4.2.2 step 5 |
| **B. 团队 → 个人（复用）** | 下个 change 开始 → AI 看到团队历史 → 写新决策时带 INHERIT 或 UPDATE | §3.3 bridge 机械读 + §3.5 INHERIT 关键字 |
| **C. 个人 → 团队（why 改变）** | 新决策推翻旧 → 旧行 superseded + 新行追加 + rebuttals/ audit | §3.5 UPDATE 关键字 + §4.2.2 step 5 + §4.5 update 算法 |

### 11.3 循环闭环图

```
  ┌──────────── 个人层（changes/<name>/memory.md）────────────┐
  │ AI 写裸 / UPDATE / INHERIT 决策                            │
  └──────────────────────────────────────────────────────────┘
                              ↓ archive
  ┌─────────────── 团队层（.bridge/team/<cap>/memory.md）────────┐
  │ reconcile append / update + rebuttals/ 留 audit             │
  └────────────────────────────────────────────────────────────┘
                              ↓ probe 读 top 3
  ┌──────── probe 输出（memory_hint 字段）─────────┐
  │ team=cli:[D1 ..., D2 ..., D5 ...]              │
  └────────────────────────────────────────────────┘
                              ↓ AI 看到
  ┌──────────── 下个 change 开始 ────────────────────┐
  │ AI 据摘要写 INHERIT / UPDATE / 裸决策            │
  └────────────────────────────────────────────────┘
                              ↓ → 回到个人层（循环）
```

### 11.4 为什么"知识循环"是这个设计

1. **个人层 append 关键字（UPDATE / INHERIT）**——让 AI 显式声明"这次决策与团队历史决策
   的关系"。bridge 不替 AI 猜，**字面前缀匹配**。
2. **probe 机械读 team top 3**——让 AI 在新需求开始时就"看到团队上次决定过啥"。
   bridge 不评论 / 推荐，**机械行**输出。
3. **reconcile update + audit**——让 why 改变可追溯，**不丢任何决策**。superseded 行
   保留 + rebuttals/ 落 audit = "why 改变的 history"。

### 11.5 知识循环落地的新设计点（与原决策 5 对比）

| 维度 | 原 personal-team-summary（α 拍板） | 调研报告原 memory 方案 | **v1.8-3 知识循环** |
|---|---|---|---|
| 团队层数据来源 | distill 已有 why.md | bridge reconcile 从个人层抽 | bridge reconcile 从个人层抽（一致）|
| 团队层是否可变 | consensus 三态标记（approved / contested / unreviewed）| append-only | append + update 双模式（rebuttals/ audit）|
| probe 显示 | 仅元信息 | 仅元信息 | team top 3 decision 摘要 |
| 个人层 append 关键字 | 无 | 无 | UPDATE / INHERIT / 裸三模式 |
| 个人层 → 团队 → 个人循环 | 不显式支持 | 不显式支持 | **显式支持**（知识循环 3 流转）|
| 共识标记 | 三态（approved / contested / unreviewed）| 无 | rebuttals/ 三态天然映射（archived / superseded / orphaned）|

**结论**：v1.8-3 知识循环 = memory 骨架 + 原 consensus 三态标记的"机制级合并版"，
调研报告 §决策 12 已选 B（合并）。
6. v1.8-3 与原 personal-team-summary 的关系：**倾向合并（v1.8-3 既建 memory 又落 consensus 标记）**

**等你拍板**：保留 / 调整 / 落 change / 分两步。