---
external: true
synthesized_by: to-spec (matt-skills)
synthesized_at: 2026-09-21
status: ready-for-agent
---

# v1.8-1: bridge as active navigator — making init a probe-triggering navigator

## Problem Statement

spec-bridge 在 v1.7 已实现 "probe 激活导航员"（`bridge probe` 4 级路由输出 advised_skill），但有三个根本缺口让导航员沦为"探测后等用户手动"：

1. **`bridge init` 默认走 builtin**：当前 init 默认生成 5 件模板（proposal/design/tasks/spec/execution-contract），违反 README §1.2 的导航员职责——导航员应该是 "推荐外栈 skill 让用户走外栈"，不是 "自己生成 spec"。README §1.2 明确把"导航员"列为 3 大根问题之一，但当前 init 行为直接生成 5 件模板 = **导航员退化成 spec 生成器**。

2. **`bridge init` 和 `bridge probe` 是两个独立命令**：用户必须先 init 拿到台账，再手动 probe 让 AI 知道推荐哪个 skill。这中间用户可能直接编辑 5 件模板，跳过导航推荐。README §1.2 第 1 段："引导用户**主动**生成 spec"——但当前流程 init 后没有主动引导。

3. **`bridge adopt` 接管外栈产物后，下一阶段 hint 不够清楚**：当前 `.bridge.yaml` 写 `next: edit proposal/design/tasks/spec — when stable, write execution-contract.md`，对 matt / openspec workflow 没有指明 "调 `use_skill to-spec`" / "调 openspec-propose"。SKILL.md 也没有对应条目。

**用户痛点**：v1.7 之后，用户反馈 "不知道 bridge init 后下一步该调哪个 skill" —— 实际存在 `bridge init --workflow-kind matt` 这个已实装的能力，但 SKILL.md 没有突出，默认值仍是 builtin，导航员事实上没起作用。

## Solution

**把 bridge init 改造为 "导航员优先" 的入口**：

1. **`bridge init <name>` 默认行为变化**（**新增 `--builtin` 逃生口**）：
   - **默认**：只建台账（`.bridge.yaml` + `.bridge.log`）+ 空 specs/ 目录
   - **默认**完成后**自动**调 `bridge probe`，probe 输出（advised_skill / advised_invocation / advised_reason）直接接 init 的 stdout
   - **逃生口**：`--builtin` 强制走 v1.7 旧 5 模板（向后兼容）
   - **逃生口**：`--no-auto-probe` 跳过自动 probe（CI / 脚本用）

2. **`bridge init` 自动探测项目栈**（新增 `--workflow-kind` 自动推导）：
   - 检测 `.claude-plugin/` + `package.json` 含 matt-skills 字段 → 推 matt
   - 检测 `openspec/` 目录 → 推 openspec
   - 都不在 → fallback builtin
   - **当前 `--workflow-kind <kind>` 显式标志保留**（覆盖自动探测）

3. **`bridge probe` 输出新增 `advised_invocation` 字段**（一行 KEY:value）：
   - `advised_invocation: use_skill <skill-name>` —— AI 可机械执行，无需再查 SKILL.md
   - 不影响现有 advised_skill / advised_reason 输出

4. **`bridge adopt` 强化**：
   - 接管后写 `external_stack: <matt|openspec>` 字段到 `.bridge.yaml`
   - 接管后写 `adopted_at: <ISO 8601>` 字段
   - 接管后改 `next` hint：`next: use_skill to-spec — synthesize the conversation into a matt spec (adopted from matt at <ts>)`
   - 接管后写 `.bridge.log` 一条大事记：`adopted external <stack> stack`

5. **文档 + ADR**：
   - 新增 ADR-0011（v1.8-1 版）替代之前的 v1.8-2 personal-team-summary ADR
   - SKILL.md §1.5（probe 段）补 "init-after-probe" 行为说明
   - SKILL.md 头部新增 CHANGELOG 段（v1.8.0 breaking change 提示）

## User Stories

1. As a new spec-bridge user, I want `bridge init my-feature` to automatically show me which external skill to invoke (matt / openspec / superpowers), so that I don't have to remember to run `bridge probe` separately.

2. As a spec-bridge user with a matt-skills plugin enabled, I want `bridge init` to detect that and default to `--workflow-kind matt` (only state file + empty specs/), so that I can call `use_skill to-spec` next instead of editing placeholder templates.

3. As a spec-bridge user with an OpenSpec project, I want `bridge init` to default to `--workflow-kind openspec`, so that I don't accidentally generate conflicting bridge templates on top of an openspec-managed project.

4. As a user migrating from v1.7 to v1.8, I want `bridge init --builtin` to preserve v1.7 behavior (5 templates written, no auto-probe), so that my existing scripts/CI don't break.

5. As a user with an externally-created change (from matt `to-spec` or openspec-propose), I want `bridge adopt changes/my-feature --stack matt` to detect the right workflow and write a clear "use_skill to-spec" next hint, so that I know exactly what to invoke next.

6. As a CLI script caller, I want `bridge init --no-auto-probe` to skip the auto-probe step, so that I can script init without interactive probe output.

7. As a CI pipeline, I want `bridge init --json` to emit machine-readable JSON (vs current prose), so that downstream tooling can parse the probe recommendation.

8. As a reviewer reading the change directory, I want `cat .bridge.yaml` to include an `external_stack` field when the change was adopted from an external workflow, so that I know the provenance.

9. As an AI agent receiving a probe recommendation, I want the advised_skill line to be accompanied by the exact `use_skill <skill>` invocation syntax, so that I can mechanically call it without re-reading docs.

10. As a user on a project with no external skills installed, I want `bridge init` to fall back to builtin (current 5-template behavior) with a clear log message "no external skills detected — falling back to builtin", so that I am not stuck.

11. As a v1.7 script user, I want all existing `bridge init <name>` calls (without flags) to keep working in v1.8 (still produce 5 templates by default), so that breaking-change surface is opt-in via a flag (NOT default-on).

12. As a bridge tester, I want the test seam to remain at CLI exit code + .bridge.yaml field + .bridge.log tail line, so that I don't have to mock the probe output format or add new test seams.

13. As a future spec-bridge maintainer, I want the v1.8-1 ADR to explicitly document the v1.8 vs v1.7 behavior diff and the `--builtin` escape hatch, so that I don't accidentally remove the escape hatch later.

## Implementation Decisions

**D1 — init 默认行为变化 = breaking change，但提供逃生口**

`bridge init` 行为变化矩阵：

| 调用 | v1.7 行为 | v1.8-1 行为 |
|---|---|---|
| `bridge init <name>` | 生成 5 件模板 | 只建台账 + 自动 probe |
| `bridge init <name> --builtin` | (无此 flag) | **生成 5 件模板**（v1.7 兼容） |
| `bridge init <name> --no-auto-probe` | (无此 flag) | 只建台账，跳过 probe |
| `bridge init <name> --workflow-kind <k>` | 只生成 k=matt/openspec 时只建台账 | 行为不变（向后兼容） |

**breaking 范围**：所有 v1.7 的 `bridge init <name>` 无 flag 调用会变行为。

**escape hatch**：用户脚本加 `--builtin` 一行即可回 v1.7 行为。

**实现位置**：`skills/spec-bridge/scripts/cmd-init.mjs` 函数 `run`：
- 行 313-321 改为：默认走 "只建台账" 分支；`flags.builtin` 为 true 才走 5 件模板分支
- 默认 `flags.autoProbe` 为 true；`flags.noAutoProbe` 显式关

**D2 — 项目栈自动探测**

新模块 `skills/spec-bridge/scripts/vendor/detect-stack.mjs`：
- 输入：`projectRoot`
- 输出：`{ primary: 'matt'|'openspec'|'builtin', signals: { claudePluginDir, packageJsonMattField, openspecDir } }`
- 优先级：matt (`.claude-plugin/` + package.json `matt-skills`) > openspec (`openspec/` dir) > builtin
- 输出被 `bridge init` 和 `bridge adopt` 都复用

**自动推导规则**：
- `flags['workflow-kind']` 显式 → 用显式
- 否则 → 调 `detect-stack.mjs` 推 primary
- 默认 `flags['workflow-kind'] = primary`

**D3 — adopt 增强字段**

`.bridge.yaml` 新增字段（仅 adopt 时写）：

```yaml
# === External stack (v1.8-1 D3) ===
external_stack: matt          # null | 'matt' | 'openspec' | 'superpowers'
adopted_at: 2026-09-21T...    # ISO 8601, set by adopt only
```

**adopt 行为变化**：
- 检测 change dir 顶层文件判断 stack：4 件标准模板 + 缺 `.bridge.yaml` → matt；含 `openspec/` 子目录 → openspec；其它 → builtin
- 默认 `--stack auto`（探测）
- 写 `external_stack` + `adopted_at` + 改 `workflow_kind` + 改 `next` 提示

**D4 — probe 输出 advised_invocation 字段**

`bridge probe` stdout 输出新增一行（KEY:value 格式，D5）：

```
advised_invocation: use_skill to-spec
```

**关键**：advised_invocation 是**给 AI 看的执行命令**，**不是给人类读的**。

**实现位置**：`skills/spec-bridge/scripts/cmd-probe.mjs` 函数 `routeSkill`，增加映射：
- `advised_skill: 'matt-to-spec'` → `advised_invocation: 'use_skill to-spec'`
- `advised_skill: 'openspec-propose'` → `advised_invocation: 'use_skill openspec-propose'`
- `advised_skill: 'superpowers-tdd'` → `advised_invocation: 'use_skill tdd'`
- `advised_skill: '(none)'` → `advised_invocation: '(fallback to builtin: edit proposal/design/tasks/spec)'`

**D5 — init 后自动 probe 的 stdout 格式**

`bridge init` 完成后调 `bridge probe`，probe 输出**追加**到 init 的 stdout（**不**嵌套、不调子进程 subprocess 阻塞）：

```
<change-dir>
next: <bridge next advice based on workflow_kind>
advised_skill: <skill-name>
advised_invocation: use_skill <skill-name>
advised_reason: <text>
→ <bridge next advice as full sentence>
```

**实现**：init 函数末尾 `if (autoProbe) await runProbe([changeDir], ...)` 复用 stdout。

**D6 — backward compat + escape hatch**

- v1.7 默认：`bridge init <name>` = 生成 5 件模板，无 probe
- v1.8 默认：`bridge init <name>` = 只建台账 + 自动 probe
- **breaking change** —— SKILL.md 加 CHANGELOG 段显著提示
- **逃生口 1**：`--builtin` 标志强制 v1.7 行为（保留 5 件模板）
- **逃生口 2**：`--no-auto-probe` 跳过自动 probe
- **逃生口 3**：`--workflow-kind <kind>` 显式覆盖自动探测

**D7 — external spec 路径（matt / openspec 产物的 spec.md 不污染 bridge spec 源）**

bridge 的 `.bridge.yaml` 把 `specs/<cap>/spec.md` 视为 source-of-truth（v1.7 distill 依赖它）。但 matt `to-spec` 输出和 bridge 的 spec.md 模板格式完全不同（matt = Problem Statement / Solution / User Stories；bridge = ADDED Requirements / Scenarios）。

**冲突解决**：
- matt 输出的 spec.md 写到 `specs/<cap>/spec.md` 同位置，但加 **frontmatter `external: true`** 标识
- `bridge distill` 读 `specs/<cap>/spec.md` 时，**遇到 `external: true` frontmatter 跳过蒸馏**（不读 `## Decisions`）
- `bridge archive-ready` 检查时，**遇到 `external: true` 跳过 spec.md 校验**（改用 `bridge adopt` 的产物作为 source-of-truth 入口）
- `.bridge.yaml` 新增字段：`external_spec: true`（标记整个 change 是外栈产物）

**这个决策是 v1.8-1 的扩展点** —— 之前 D1-D6 没考虑这个边界。如果改回 D6 之前的"matt 产物写到独立路径"方案，需要 v1.8-2/3 时统一处理。

**D8 — CHANGELOG + ADR-0011**

SKILL.md 头部新增 `## CHANGELOG` 段：
```
## CHANGELOG
- v1.8.0 (2026-09-21): init 默认行为变（breaking）—— 详见 ADR-0011 / SKILL.md §1.5
- v1.7.0 (2026-09-21): probe 激活导航员 —— 详见 ADR-0010
```

ADR-0011（v1.8-1 版）内容：
- 状态：提议 → v1.8-1 archive 后改 "已批准"
- 核心条款：D1 默认 init 不再生成 5 模板 / D2 探测栈 / D3 adopt 增强字段 / D4 advised_invocation / D6 backward compat / D7 external spec frontmatter
- 决策记录：`bridge init --builtin` 逃生口的存在（防维护期被无脑删除）

## Testing Decisions

**测试接缝（seam）**：单 seam —— CLI exit code + `.bridge.yaml` 字段 + `.bridge.log` 末行文本（沿用 v1.7 seam，不新增）。

**测试模块**：`skills/spec-bridge/tests/init-auto-probe.test.mjs`（v1.8-1 新增）。

**测试用例**（对应 user stories 1-12 中可测的）：

| # | 测什么 | 期望 |
|---|---|---|
| 1 | `bridge init foo` 在 matt 项目下 | exit 0, 只 .bridge.yaml + .bridge.log, advised_invocation 含 `use_skill` |
| 2 | `bridge init foo` 在 openspec 项目下 | exit 0, workflow_kind=openspec |
| 3 | `bridge init foo --builtin` | exit 0, 生成 5 件模板 |
| 4 | `bridge init foo --no-auto-probe` | exit 0, 无 advised_* 行 |
| 5 | `bridge init foo --workflow-kind matt` | exit 0, workflow_kind=matt（即使在 builtin 项目）|
| 6 | `bridge adopt foo --stack matt` | exit 0, .bridge.yaml 含 external_stack=matt + adopted_at |
| 7 | `bridge adopt foo` 自动探测 | 探测正确 |
| 8 | `bridge probe foo` 在 matt 项目下 | advised_invocation=use_skill to-spec |
| 9 | `bridge probe foo` 在无外栈项目下 | advised_invocation=(fallback to builtin...) |
| 10 | `bridge init foo` 失败场景（已存在 change dir）| exit 3 |

**好测试的样子**（沿用 v1.7 标准）：
- 只测外部行为（stdout / exit code / 文件落盘），不测 probe 内部函数
- 用 `node bridge.mjs` 真调子进程，不用 mock
- fixture 临时目录 + 跑完即清
- 串行断言：`assert.equal(exitCode, 0)` + `assert.match(stdout, /advised_invocation: use_skill/)` + `assert.match(fs.readFileSync('.bridge.log', 'utf-8'), /adopted external matt/)`

**Prior art**：
- `skills/spec-bridge/tests/probe-active-navigator.test.mjs`（v1.7，10/10 pass）—— 参考它的 fixture + assertion 风格
- `skills/spec-bridge/tests/init.test.mjs`（v1.2）—— 参考它的 init 行为测试

## Out of Scope

1. **§1.1 个人/团队层 summary**：这是 v1.8-2（单独 change）
2. **§1.3 to-goal 集成**：这是 v1.8-3（单独 change）
3. **`bridge init` UI / Web 化**：仍 CLI only
4. **`bridge adopt` 自动跨 host 拉产物**：仅本地目录接管
5. **AI 自动调用 skill（v1.7 C3 约束保持）**：probe 只输出 advised_invocation，AI 决策是否调
6. **新探针信号**（如检测 `package.json` 是否有特定 plugin 字段）：v1.8-1 仅做最少必要探测（openspec dir + .claude-plugin dir + builtin fallback），复杂探测留 v1.8-2/3
7. **matt / openspec 产物的同步到 bridge specs/ 根**：仅靠 `external: true` frontmatter 区分；不动 v1.7 distill 逻辑

## Further Notes

1. **对 v1.7 测试的影响**：v1.7 的 `probe-active-navigator.test.mjs` 应该不受影响（probe 行为未变，只新增 `advised_invocation` 字段输出 —— 但现有断言可能 grep `advised_skill` 行，**新增一行不破坏**）。

2. **对 SKILL.md 的更新**：§1.5 段新增 "init-after-probe" 行为描述 + 头部新增 CHANGELOG 段。

3. **matt-skills 兼容性**：`matt-skills` 已支持 `to-spec` / `implement` / `spec-executor` / `tdd`（之前用 `use_skill` 实测可用）。但 v1.8-1 仅产出 spec，**不调** `implement` / `spec-executor` / `tdd`（留给用户拍板）。

4. **风险点**：
   - breaking change（默认行为变更）→ 必须保留 `--builtin` 逃生口 + SKILL.md 显著提示
   - `bridge init` 后调 `bridge probe` 是额外一次子进程调用，可能慢 ~100ms —— 但 init 不在 hot path，影响可接受
   - D7 的 `external: true` frontmatter 跳过 distill 是新增的解析逻辑，需要在 `cmd-distill.mjs` 加判断

5. **D7 决策边界**（**待 ρ 拍板后可能调整**）：
   - 当前决策：matt 产物的 spec.md 加 frontmatter `external: true` 写到 `specs/<cap>/spec.md` 同位置
   - 备选 A：matt 产物写到独立路径如 `specs/<cap>/external/matt-spec.md`
   - 备选 B：matt 产物不写盘，仅在 .bridge.yaml 用 `external_spec_path: <path>` 引用
   - **当前选 D7 是 "既兼容又最小改动"**，但 `bridge distill` 实现复杂度会增加

6. **v1.8-1 → v1.8-2/3 的衔接**：
   - v1.8-1 archive 后，开 v1.8-2（个人/团队层）和 v1.8-3（to-goal）走相同外栈流程
   - 这两个 change 的 spec 也用 to-spec 综合 + 写到 `specs/<cap>/spec.md` 加 `external: true`
   - 但 v1.8-2/3 的 spec 内容**更业务化**（个人/团队层 summary 设计），D7 frontmatter 方案适用

7. **open questions（v1.8-1 实现期可能要回**）：
   - D7 的 `external: true` frontmatter 在 `bridge distill` 解析时怎么判？直接读 frontmatter 还是文件存在性探测？→ **实现时定**
   - `bridge adopt --stack auto` 探测顺序：matt > openspec > builtin？还是看顶层文件？→ **D3 已定：4 件标准模板 + 缺 .bridge.yaml → matt**
   - v1.7 的 init 测试是否会因 v1.8-1 默认行为变化而 fail？→ **D6 已说明需 `--builtin` 逃逸**

---

```text
SPEC READY

- Status: ready for implementation
- Source: changes/v1-8-1-bridge-as-navigator/specs/v1-8-1-bridge-as-navigator/spec.md (this file)
- Repository: /Users/fujunchuan/IdeaProjects/spec-bridge
- Baseline: main @ 4dcb3f2
- Test seam: CLI exit code + .bridge.yaml field + .bridge.log tail line (v1.7 seam, no new seam)
- Non-goals: §1.1 personal/team summary (v1.8-2), §1.3 to-goal (v1.8-3), init UI, adopt cross-host
- External authority: standard git perms (commit/push), no remote services needed
- Next route: fork + /spec-executor (single context, ~12 tasks fits) OR manual implement (user choice ρ1/ρ2)
```
