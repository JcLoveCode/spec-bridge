# Execution Contract: v1.8-1-bridge-as-navigator

> 由 α 流程（use_skill to-spec 综合 spec）→ 用户拍板硬约束清单（φ-α）→ 写盘。
> 拍板时间：2026-09-21
> baseline: main @ 4dcb3f2
> workflow: matt（外栈）

---

## 硬约束清单（实现期不可违反）

### 边界类（破坏 v1.7 行为）

#### C1 — `bridge init <name>` 默认**不**生成 5 件模板

- **当前 v1.7**：`bridge init <name>` = 生成 proposal.md / design.md / tasks.md / specs/<cap>/spec.md / execution-contract.md 5 件模板
- **v1.8-1**：`bridge init <name>` = **只**建 `.bridge.yaml` + `.bridge.log` + 空 `specs/` 目录；**不**生成 5 件模板
- **影响**：所有 v1.7 的 init 调用变行为（breaking change）
- **逃生口**：见 C3
- **验收**：执行 `bridge init foo`，断言 `changes/foo/` 下**只有** `.bridge.yaml` + `.bridge.log` + `specs/`，**无** proposal.md / design.md / tasks.md / execution-contract.md

#### C2 — `bridge init <name>` 默认完成后**自动**调 `bridge probe`

- **当前 v1.7**：`bridge init <name>` 返回就结束
- **v1.8-1**：`bridge init <name>` 完成后**自动**调 `bridge probe <change-dir>`，probe stdout 追加到 init stdout
- **影响**：init 不再"返回就结束"，会跑 probe（多 ~100ms）
- **逃生口**：见 C4
- **验收**：执行 `bridge init foo`，断言 stdout 含 `advised_invocation: use_skill ...`（来自 probe 输出）

### 逃生口类（保留 v1.7 兼容）

#### C3 — `bridge init --builtin` 强制走 v1.7 旧行为

- **行为**：加 `--builtin` 标志时，`bridge init` 必须生成 5 件模板（v1.7 行为）+ 跳过 probe
- **影响**：CI / 脚本加这一行即可恢复 v1.7
- **验收**：执行 `bridge init foo --builtin`，断言 `changes/foo/` 下有 proposal.md / design.md / tasks.md / specs/<cap>/spec.md / execution-contract.md 5 件模板，且 stdout 无 `advised_invocation:` 行

#### C4 — `bridge init --no-auto-probe` 跳过自动 probe

- **行为**：加 `--no-auto-probe` 标志时，init 只建台账 + 不调 probe
- **影响**：CI 用，避免 probe stdout 噪音
- **验收**：执行 `bridge init foo --no-auto-probe`，断言 stdout 无 `advised_invocation:` 行

### probe 输出类

#### C5 — `bridge probe` 输出必须含 `advised_invocation: use_skill <skill>` 字段

- **格式**：KEY:value 文本（D5 输出格式）
- **映射表**：
  - `advised_skill: 'matt-to-spec'` → `advised_invocation: 'use_skill to-spec'`
  - `advised_skill: 'openspec-propose'` → `advised_invocation: 'use_skill openspec-propose'`
  - `advised_skill: 'superpowers-tdd'` → `advised_invocation: 'use_skill tdd'`
  - `advised_skill: '(none)'` → `advised_invocation: '(fallback to builtin: edit proposal/design/tasks/spec)'`
- **验收**：执行 `bridge probe .`，断言 stdout 含 `advised_invocation:` 行（无论 advised_skill 是哪种）

### adopt 类

#### C6 — `bridge adopt` 必须写 `external_stack: <matt|openspec>` 字段到 `.bridge.yaml`

- **位置**：`.bridge.yaml` 新增 `# === External stack ===` 段
- **值域**：`null` / `'matt'` / `'openspec'` / `'superpowers'`
- **验收**：执行 `bridge adopt changes/<x> --stack matt`，断言 `.bridge.yaml` 含 `external_stack: matt`

#### C7 — `bridge adopt` 必须写 `adopted_at: <ISO 8601>` 字段到 `.bridge.yaml`

- **格式**：ISO 8601 datetime（如 `2026-09-21T03:30:04.000Z`）
- **验收**：执行 `bridge adopt changes/<x> --stack matt`，断言 `.bridge.yaml` 含 `adopted_at: 2026-...`（日期格式匹配）

#### C8 — `bridge adopt` 接管后必须改 `next` 提示为 `use_skill to-spec — synthesize the conversation...`

- **位置**：`.bridge.yaml` 的 `next:` 字段
- **格式**：`use_skill to-spec — synthesize the conversation into a matt spec (adopted from <stack> at <ts>)`
- **验收**：执行 `bridge adopt changes/<x> --stack matt`，断言 `.bridge.yaml` 的 `next:` 字段值含 `use_skill to-spec`

### 字段 schema 类

#### C9 — `.bridge.yaml` schema 必须扩 `external_stack` 和 `adopted_at` 两个字段

- **当前 v1.7**：state set 拒绝 unknown field（φ4 手工 patch 绕过验证过）
- **v1.8-1**：`external_stack` 和 `adopted_at` 必须列入合法字段表
- **验收**：执行 `bridge state set changes/<x> external_stack matt`，exit code = 0（不是 "unknown field"）

### distill 类（spec 路径边界，D7-当前决策）

#### C10 — `bridge distill` 读 `specs/<cap>/spec.md` 时，遇到 frontmatter `external: true` **必须跳过**

- **判断方式**：读 spec.md 顶部 frontmatter（YAML 块 `---\n...\n---`），含 `external: true` → 跳过
- **行为**：跳过**该** spec.md 的蒸馏（不读 `## Decisions`，不写 `why.md`）
- **影响**：matt / openspec 产物不污染 bridge distill 路径
- **验收**：
  - 准备 fixtures：specs/<cap>/spec.md 含 `external: true` frontmatter
  - 执行 `bridge distill changes/<x>`
  - 断言 `specs/<cap>/why.md` **不**存在（distill 跳过）

### 文档 / ADR 类

#### C11 — SKILL.md 头部必须新增 `## CHANGELOG` 段

- **位置**：`skills/spec-bridge/SKILL.md` 头部（frontmatter 之后，## 之前）
- **内容**：
  ```
  ## CHANGELOG
  - v1.8.0 (2026-09-21): init 默认行为变（breaking）—— 详见 ADR-0011 / SKILL.md §1.5
  - v1.7.0 (2026-09-21): probe 激活导航员 —— 详见 ADR-0010
  ```
- **验收**：`head -20 skills/spec-bridge/SKILL.md | grep "## CHANGELOG"` 命中

#### C12 — ADR-0011（v1.8-1 版）必须存在

- **路径**：`skills/spec-bridge/docs/adr/0011-bridge-as-navigator.md`
- **内容**：涵盖 C1-C11 关键决策 + D7 当前决策记录
- **验收**：`ls skills/spec-bridge/docs/adr/0011-*` 命中；`grep -E "C1|C2|...|C11" skills/spec-bridge/docs/adr/0011-bridge-as-navigator.md` 全部命中

---

## 测试约束（实现期必须满足）

#### T1 — v1.7 的 `probe-active-navigator.test.mjs` 必须**不破坏**

- **当前 v1.7 状态**：10/10 pass（commit 535c204）
- **v1.8-1 后**：probe 行为未变，只新增 `advised_invocation` 字段输出——现有断言可能 grep `advised_skill`，**新增一行不破坏**
- **验收**：执行 `node --test skills/spec-bridge/tests/probe-active-navigator.test.mjs`，10/10 仍 pass

#### T2 — v1.8-1 新增 `init-auto-probe.test.mjs`，覆盖 10 个场景

- **测试场景**（对应 C1-C8 的可测点）：
  1. `bridge init foo` 在 matt 项目下 → exit 0, advised_invocation 含 `use_skill`
  2. `bridge init foo` 在 openspec 项目下 → exit 0, workflow_kind=openspec
  3. `bridge init foo --builtin` → exit 0, 生成 5 件模板
  4. `bridge init foo --no-auto-probe` → exit 0, 无 advised_* 行
  5. `bridge init foo --workflow-kind matt` → exit 0, workflow_kind=matt
  6. `bridge adopt foo --stack matt` → exit 0, .bridge.yaml 含 external_stack=matt + adopted_at
  7. `bridge adopt foo` 自动探测 → 探测正确
  8. `bridge probe foo` 在 matt 项目下 → advised_invocation=use_skill to-spec
  9. `bridge probe foo` 在无外栈项目下 → advised_invocation=(fallback to builtin...)
  10. `bridge init foo` 失败场景（已存在 change dir） → exit 3
- **验收**：执行 `node --test skills/spec-bridge/tests/init-auto-probe.test.mjs`，10/10 pass

#### T3 — 测试 seam 不新增（沿用 v1.7）

- **seam**：CLI exit code + `.bridge.yaml` 字段 + `.bridge.log` 末行文本
- **不新增**：probe stdout 文本细节 / CLI 内部函数 mock / 任何 v1.7 没用过的 seam
- **验收**：v1.8-1 测试**不**引入 mock / spy / vi 之类

---

## 必填产物清单（v1.8-1 archive 前必须存在）

| 文件 | 内容 | 来源 |
|---|---|---|
| `proposal.md` | 可选（matt 流程不需要）| 不写也行 |
| `design.md` | 可选（matt 流程不需要；bridge distill 需要 ## Decisions 段）| 当前为 init 模板空文件 |
| `tasks.md` | 可选（matt 流程不需要）| 当前为 init 模板空文件 |
| `specs/v1-8-1-bridge-as-navigator/spec.md` | **必填**（matt 格式 7 段 + SPEC READY） | ✓ 已写盘 |
| `execution-contract.md` | **必填**（本文档） | ✓ 本文件 |
| `.bridge.yaml` | 必填（stage=contracted） | 待 advance |
| `.bridge.log` | 必填（大事记） | ✓ 已记 |

---

## α 流程进度

```
[ ✓ ] Step 1: bridge init v1-8-1-bridge-as-navigator
[ ✓ ] Step 2: use_skill to-spec → spec 综合完成
[ ✓ ] Step 3: spec 写盘到 specs/v1-8-1-bridge-as-navigator/spec.md
[ ✓ ] Step 4: 模拟 adopt (φ4)
[ ✓ ] Step 5: 写 execution-contract.md (本文件)
[ ✗ ] Step 6: advance to contracted (改 .bridge.yaml stage)
[ ✗ ] Step 7: use_skill implement (走实现)
[ ✗ ] Step 8: use_skill tdd (TDD 在约定接缝做测试)
[ ✗ ] Step 9: bridge archive-ready
[ ✗ ] Step 10: 蒸馏 + git mv archive
[ ✗ ] Step 11: archive 完成
[ ✗ ] Step 12: 才开 v1.8-2 / v1.8-3
```

---

## 实现路径（待 Step 6 advance 后走）

按 α "走外栈 skill 流程"：

1. `use_skill implement` 加载（matt implement skill）
2. 调 implement 在约定接缝做 TDD（**先**写 `init-auto-probe.test.mjs` 失败，**再**改 `cmd-init.mjs` 让它通过）
3. 逐条实现 C1-C12 硬约束
4. 写 ADR-0011（v1.8-1 版）
5. 改 SKILL.md（CHANGELOG 段 + §1.5 init-after-probe 描述）
6. 全测试通过：v1.7 probe 测试 + v1.8-1 init-auto-probe 测试 + 现有测试套
7. `bridge archive-ready` 校验
8. 蒸馏（design.md ## Decisions → specs/<cap>/why.md）
9. git mv 到 changes/archive/2026-09-21-v1-8-1-bridge-as-navigator/
10. archive 完成，开 v1.8-2

---

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| C1 breaking change 影响 v1.7 用户 | C3 + C4 双逃生口；C11 SKILL.md CHANGELOG 段显著提示 |
| C9 schema 改造影响所有 .bridge.yaml 读写路径 | T2 测试 10 场景覆盖；T1 v1.7 测试不破坏兜底 |
| C10 distill 改造漏读 frontmatter 导致 matt 产物误蒸馏 | T2 场景 9 + 10 覆盖；frontmatter 解析逻辑独立函数（易测试） |
| 实现期 init 默认变 → CI 升级会卡 | C3 + C4 逃生口 + CHANGELOG 段；CI 文档要求加 `--builtin` |

---

## 待用户拍（实现前必拍）

- ❓ **C10 / D7-当前 vs D7-B 边界**（前面 spec 第 D7 段标"待 ρ 拍板"）—— φ-α 接受了 D7-当前，但实现期可能调 D7-B（更干净）
- ❓ **Step 6 advance 时机**——现在 advance，还是等 user 看完本 execution-contract.md 再 advance？
- ❓ **Step 7 implement 调用**——调 `use_skill implement`（matt），还是手动 TDD？

---

拍板实现期路径（继续 υ 流程）：
- **χ1**：现在 advance 到 contracted + 调 `use_skill implement`（最 α 严格）
- **χ2**：现在 advance，但 **不**调 implement，让用户先看本 execution-contract.md 内容
- **χ3**：**不** advance，停在这里，让用户 review 本文件
