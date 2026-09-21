# spec-bridge 项目现状（v1.6 归档后）

> 调研日期 2026-09-20。第一版发布 v1.1，最近一次迭代 v1.6（自动识别项目类型的边界兜底补强），已归档进 `changes/archive/2026-09-20-v1-6-init-detectlayout-fix/`。当前 `changes/` 顶层无活跃变更，全套自动化测试 98/98 通过。

## 一、现在能做什么

### 1. 新建一份工作计划

- **一键起架子**：敲 `bridge init <name>`，自动建出工作目录 + 5 份文档（项目方案 / 技术设计 / 任务表 / 契约 / spec 增量）+ 状态台账 + 变更日志（来源：specs/cli/spec.md:11-18）
- **自动识别项目类型**：工具自动判断这个仓库是"自管独立目录"还是"接外部 OpenSpec 协议"，不用你告诉它（来源：specs/cli/spec.md:33-41）
- **三栈模板选择**：可以声明走 OpenSpec 工具栈 / Matt 整栈 / 内置模板。后两者只建台账，产物由各自工具生成（来源：specs/v1-3-sdd-meta-navigator/spec.md:9-26）
- **续作父快照**：开续作时带 `--parent <已归档-id>`，自动复制父成果摘要到新台账——版本链可重放（来源：specs/cli/spec.md:103-115）
- **接管已有工作目录**：`bridge adopt <dir>` 把 OpenSpec / Matt 栈生成的目录收编进来——只建台账，不动产物（来源：specs/v1-3-sdd-meta-navigator/spec.md:52-69）

### 2. 让工具告诉你下一步该干啥

- **下一步建议**：`bridge next <dir>` 输出当前决策点 + 下一步建议（例："已批准契约，请进入执行"），按工作流类型给出"推荐调哪个工具"的提示（来源：SKILL.md §6.1）
- **重复模式信号**：执行中遇到同类问题第二次出现，调 `bridge mention/rootcause <dir> --tag <t>` 记录；桥全库计数，N≥2 自动建议开续作（来源：specs/cli/spec.md:145-162）
- **跨计划标签聚合**：`bridge pattern --tag <t>` 找出所有打过同标签的计划（含已归档），便于摸清"同类事以前怎么处理的"（来源：specs/cli/spec.md:131-143）

### 3. 验证计划完整性（"我没改错吧"）

- **产物摘要**：`bridge hashes <dir>` 算当前 4 份文档指纹；`--check` 对比台账里的指纹，漂移提示回归（来源：bridge.mjs usage 第 53 行）
- **基线发布**：`bridge sync <dir>` 把变更说明合并到正式 spec 并写下带签名的状态记录（来源：bridge.mjs usage 第 43 行）
- **发布复核**：`bridge verify <dir>` 重算基线指纹 + 校验状态记录，失败给出两个补救路径（开续作或写复验异议）（来源：bridge.mjs usage 第 44 行；SKILL.md §4）

### 4. 归档完成的工作（"这事结了"）

- **4 步完成归档**（SKILL.md §3 "archived"）：
  1. `bridge sync <dir>` 发布基线
  2. `bridge verify <dir>` 校验状态记录
  3. `bridge distill <dir>` 从设计文档"决策段"抽出"为什么这样做"说明，写到基线旁
  4. `git mv` 移到 `changes/archive/<日期>-<name>/` + `bridge state set ... stage archived`
- **提炼自动化**：`bridge distill` 是 CLI 子命令（不是手写），从设计文档"## Decisions"段抽出决策生成 why.md（来源：specs/archive-publish-guard/spec.md:44-64）
- **归档前置检查**：`bridge archive-ready <dir>` 一次性校验 4 个前置条件（台账已建 / 未归档 / 已发布 / why.md 已提炼），全部满足才允许 git mv（来源：specs/archive-publish-guard/spec.md:28-43；bridge.mjs usage 第 52 行）

### 5. 记录异议与维护

- **复验异议落盘**：`bridge rebuttal <dir> <text>` 写时间戳标记的备注到 `rebuttals/`，不改任何状态字段（来源：specs/cli/spec.md:164-171）
- **追加变更日志**：`bridge event <dir> <text>` 往台账变更日志写一条（来源：bridge.mjs usage 第 49 行）
- **状态读写**：`bridge state init/get/set/next <dir>` 直接读写台账字段（来源：bridge.mjs usage 第 45-48 行）

## 二、已知遗留（按对用户的影响分组）

### 1. v1.4 那条历史归档跑校验会失败

- **症状**：v1.4（list-archive-visibility）那条已归档的计划，跑 `bridge verify` 会 FAIL 报"基线自发布后已变更"（来源：changes/archive/2026-09-18-v1-5-vendor-distill-guard/progress.md:27-37）
- **根因**：v1.4 归档时上游对接工具的解析路径有 bug，把 archive 子目录错认成仓库根，导致当时写下的状态记录是"假的"（archive 下没有 spec 基线 → 全部填空占位）；v1.5 修了工具算法，但旧状态记录已成历史值
- **为什么不修**：归档件按"档案柜规则"不可改（SKILL.md §4），强行修要破规则；目前偏差靠 v1.4 的 `rebuttals/2026-09-18-095010-verify-fail-vendor-spec-.md` 人工标注（标签 `vendor-archive-resolve-bug`），由人决定是否升级为续作（来源：rebuttals 文件全文；v1-5 progress.md:40-47）
- **影响范围**：仅 v1.4 这一条。其他归档件校验正常（v1.5 之后归档的都用新算法写的真状态记录）

### 2. 上游对接工具升级会让历史归档永久失效（结构性隐患）

- **症状**：每次升级上游对接工具，所有历史归档的状态记录都会因为算法不同而全部 verify FAIL（来源：changes/archive/2026-09-18-v1-5-vendor-distill-guard/progress.md:261 已知遗留第 3 条；changes/archive/2026-09-20-v1-6-init-detectlayout-fix/progress.md:69 复述）
- **根因**：对接工具自带的发布签名格式不带版本字段——升级前算的指纹和升级后算的对不上，且无法区分"真的改了"和"算法变了"
- **当前状态**：未解，v1.6 明确不修（属于独立 spec 范畴），v1.7+ 候选（来源：changes/archive/2026-09-20-v1-6-init-detectlayout-fix/proposal.md 第 33-34 行 "Out of Scope"）

## 三、未验证项

- README 第 14-23 段流程图描述的"编排全自动"是从骨架图外推，业务行为未在源码中字面声明。