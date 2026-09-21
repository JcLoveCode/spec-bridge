# spec-bridge 调研：导航员激活现状 + 当前桥主要功能

> 调研日期 2026-09-20。当前 main = v1.6 完成版（HEAD `ae8d389`）。

## 一、导航员激活现状

> **"导航员激活"** = AI 助手能不能自动按 spec-bridge 的规矩进场工作。这件事由三层机制组成：
> - (a) **系统提示层**——SKILL.md 顶部的 `description:` 字段，告诉 IDE 何时自动调起这个 skill
> - (b) **规矩文档层**——SKILL.md §1 入口例程 + §2 能力探测 + §3 生命周期 + §6 跨协议路由
> - (c) **CLI 工具层**——AI 实际可调的 `bridge <命令>`，其中 `layout` 是探测项目结构

### 1.1 三层实装状态

| 层 | 实装？ | 详情 |
|---|---|---|
| **(a) 系统提示** | ✓ 自 v1.1 起就在 | `description:` 字段是单行大段英文，触发条件：①仓库含 `openspec/changes/*/` 或 `changes/*/.bridge.yaml`；②用户说 start/continue/resume/plan/contract/implement/execute/archive/sync/distill；③排除无关任务（来源：SKILL.md:3） |
| **(b) 规矩文档** | ✓ 已加固三道 | §1 五步不许跳（摸根 → 列 change → 三分流 → 多 change 别猜 → 恢复报快照）（来源：SKILL.md:24-35）；§2 三栈探测（openspec / matt / builtin）+ 能力层补槽（来源：SKILL.md:45-63）；§3 生命周期四拍 + 硬步骤栏（来源：SKILL.md:65-159）；§6 跨协议路由 + 多栈并存守卫（v1.3 起）（来源：SKILL.md:194-246） |
| **(c) CLI 工具** | ⚠ 部分缺失 | 14 条命令都有，**但没有 `bridge probe`**——你说的"bridge probe"对应实际是 `bridge layout`（探测项目根布局 standalone vs openspec）+ `bridge list`（列活跃 change）。v1.5 proposal/design/execution-contract 三处显式拒绝新增 `bridge probe`（来源：v1.5 proposal.md:49 + design.md:116 + execution-contract.md:34） |

### 1.2 用户期望但当前没有的

| 期望 | 当前状态 |
|---|---|
| `bridge probe` 主动激活导航员 | **未实装**——v1.5 拒绝、v1.6 未补，推到 v1.7+ |
| 路由表过期后自动巡检 | 未实装（v1.3 design.md 第 122 行只标"季度巡检任务"作为风险条目，未落地） |

### 1.3 "B7 是底层能力 + 后续版本基于它继续长" 是什么意思

**B7 打地基，v1.3 起高楼**：
- B7 把"每批开工前调 `bridge next`"和"进 executing 必须 `state set stage executing`"从软建议升级成"硬步骤栏"——这是导航员的**最低形态**（来源：v1.2-b7 design.md D1-D4）
- v1.3 在此之上加了"按栈路由表 + 跨协议推荐 + 多栈并存守卫"，把"AI 自动按规矩进场"的覆盖面从单栈 builtin 扩展到三栈（openspec / matt / builtin）并存场景（来源：v1.3 design.md D5 + SKILL.md:117-123 + SKILL.md:194-246）
- v1.4 / v1.5 / v1.6 都基于这套"导航员 + 档案员"框架继续长，**零次重做或推翻**（来源：v1.4/1.5/1.6 各自的 proposal §What Changes）

---

## 二、当前桥主要功能（业务化，共 14 条主线 + 4 条补充）

### 主线（按用户场景分组）

#### ① 开新工作

| # | 用户场景 | CLI / 段 | 一句业务话术 |
|---|---|---|---|
| 1 | 想开始一份新工作计划，懒得手敲一堆模板 | `bridge init <name>`（SKILL.md §3 planning） | **一键起架子**：自动建工作目录 + 4 份文档模板 + 台账 + 变更日志（来源：SKILL.md:87-91） |
| 2 | 已有 OpenSpec 或 Matt 工具生成的目录，想让桥认它 | `bridge adopt <dir>` | **接管外来工作目录**：只建台账不动产物，避免覆盖你已有的内容（来源：SKILL.md:78 + cmd-adopt.mjs） |
| 3 | 开续作（基于已归档工作做小补丁） | `bridge init <name> --parent <已归档id>` | **续作父快照**：自动复制父成果摘要到新台账，版本链可重放（来源：SKILL.md:90） |

#### ② 摸清项目

| # | 用户场景 | CLI / 段 | 一句业务话术 |
|---|---|---|---|
| 4 | 让工具替我判断"这是 OpenSpec 项目还是自带项目还是 Matt 项目" | `bridge layout <root>` | **摸清项目根布局**：告诉你三栈探测结果（来源：SKILL.md:27 + bridge.mjs:103-126 detectLayout） |
| 5 | 想看手头有几份工作计划 / 有没有未建台账的外栈产物 | `bridge list <root>` | **列活跃工作清单 + 外栈未接管产物**：v1.3 起输出两段——`changes[]` 和 `untracked_artifacts[]`，有外栈产物时先问你别自动覆盖（来源：SKILL.md:28-29 + SKILL.md:37-40 多栈守卫） |

#### ③ 推进中的导航

| # | 用户场景 | CLI / 段 | 一句业务话术 |
|---|---|---|---|
| 6 | 不确定当前工作走到哪一步 / 下一步该干啥 | `bridge next <dir>` | **导航**：报当前拍点 + 下一步建议 + 按栈推荐该调哪个工具（来源：SKILL.md:142 + cmd-next.mjs PROTOCOL_HINTS） |
| 7 | 三栈并存（OpenSpec / Matt / 自带）混着用，工具会不会搞混 | `bridge next` 输出 `→ protocol:` 段 | **按栈点名**：自动告诉该调 OpenSpec 的 `openspec-apply-change` 还是 Matt 的 `spec-executor` 还是自带 TDD（来源：SKILL.md:198-208） |
| 8 | 同一类问题在本次工作里第二次出现，想标记免得第三次 | `bridge mention <dir> --tag <t>` 或 `bridge rootcause <dir> --tag <t>` | **模式信号**：写台账事件 + 全库计数，同标签出现 ≥2 次自动建议开续作（来源：SKILL.md:137-140） |
| 9 | 想查"以前哪个工作干过类似的事" | `bridge pattern --tag <t>` | **跨工作聚合**：按标签找出所有打过该标签的工作（含已归档），N≥2 提示复盘（来源：SKILL.md:187） |

#### ④ 执行约束

| # | 用户场景 | CLI / 段 | 一句业务话术 |
|---|---|---|---|
| 10 | 工作还没开始正式执行，先冻结一份"承诺清单"备查 | `bridge hashes <dir>` + `state set contract_approved` | **契约批准门**：算出文档指纹 + 标记"已批准"才能往下走（来源：SKILL.md:99-113） |
| 11 | 不知道执行过程里是不是偷偷改过规划文档 | `bridge hashes <dir> --check` | **防偷偷改动**：对比已批准时的指纹，漂移就停下不让你跑（来源：SKILL.md:131-135） |

#### ⑤ 收尾归档

| # | 用户场景 | CLI / 段 | 一句业务话术 |
|---|---|---|---|
| 12 | 一份工作做完了，想把变更合并到正式规范并签个收条 | `bridge sync <dir>` | **发布基线**：把变更说明合并到正式 spec，写下带签名的状态记录（来源：SKILL.md:147） |
| 13 | 想验证刚才的发布有没有被改坏 | `bridge verify <dir>` | **复核发布**：重算基线指纹 + 校验签名，失败给两条补救路径（开续作 / 写异议）（来源：SKILL.md:148） |
| 14 | 不想手写"为什么这样做"的说明文档 | `bridge distill <dir>` | **自动生成"为什么这样做"说明**：从设计文档"决策段"抽出，写到基线旁（来源：SKILL.md:149） |

#### ⑥ 归档守门

| # | 用户场景 | CLI / 段 | 一句业务话术 |
|---|---|---|---|
| 15 | 归档前想确认四件前置条件都齐了 | `bridge archive-ready <dir>` | **归档前一次性检查**：台账已建 / 未归档 / 已发布 / why.md 已写（来源：cmd-archive-ready.mjs + bridge.mjs:52） |

### 补充功能

| # | 用户场景 | CLI / 段 | 一句业务话术 |
|---|---|---|---|
| 16 | 想对已发布成果提一条"我觉得不对"的异议，不改任何状态 | `bridge rebuttal <dir> <一句话>` | **落盘异议**：写到 `rebuttals/`，零状态变更，是否升级由人决定（来源：SKILL.md:168） |
| 17 | 想追加一条变更日志但不动其他字段 | `bridge event <dir> <text>` | **追加大事记**：写到 `.bridge.log`（来源：SKILL.md:190） |
| 18 | 直接读写台账字段 | `bridge state init/get/set/next <dir>` | **台账读写四件套**：含 workflow_kind / parent / tags（来源：SKILL.md:183） |

---

## 三、未验证项

- `bridge probe` 是否在某次 commit 留过原型代码 → **全仓库零原型**（来源：13 个 .mjs 文件 + 全部 change 归档）只在 v1.5 三处出现"不开 bridge probe"——可能 v1.7+ 才写
- 路由表过期后的"季度巡检"任务 → v1.3 design.md 第 122 行只标为风险条目未落地