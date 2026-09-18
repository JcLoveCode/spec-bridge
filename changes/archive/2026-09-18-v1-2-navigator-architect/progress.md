# Progress: v1-2-navigator-architect

## Batch 1 — 状态模板 + workflow_kind（2026-09-18，审查通过）

**改动**：
- `vendor/bridge-state.mjs`：BUILTIN_DEFAULTS +4 字段（workflow_kind / parent / parent_artifacts_hash / tags）；writeState 新增 `# === Workflow (v1.2) ===` 分区；新导出 `resolveParent`（活跃目录优先 → archive/*-<id> 前缀匹配）与 `checkStageTransition`（patching 校验：parent 必填 + 父必 archived）
- `cmd-init.mjs`：`--workflow-kind` 三级推导（显式 > capabilities 首值 ∈ 值域 > builtin）；显式非法值 exit 2；init 事件含 workflow 字段
- `bridge.mjs`：state set 的 stage 字段过 `checkStageTransition` 门（拒绝 exit 2）；stage 转换成功后 appendEvent 留痕；269 行 < 350 上限（C9 ✓）

**测试**：`tests/navigator-b1.test.mjs` 10 用例（R1 推导×3 + 非法值×2、R4 校验×3 + 幽灵父 + 归档前缀解析）。全量 35/35 绿。

**审查结论**：
- R1 三场景 + R4 双场景均对齐 spec；一处实现缺口当场修复（state set stage 原本不留痕 → 契约 R4 场景 2 要求事件追加，已补）
- C10 兼容性验证：旧 .bridge.yaml（v1.1 归档件）经 readState 的 defaults 合并自动补 null，既有 sync 测试不破
- 测试自身缺陷 1 处修正（git mv 目标目录不存在 → renameSync）

**spec-rev 备注**：无发布行为（属 Batch 8）。

## Batch 2 — init --parent 父快照（2026-09-18，审查通过）

**改动**：
- `cmd-init.mjs`：`--parent <archived-change-id>`——resolveParent 校验（存在 + stage=archived，否则 exit 2）→ 快照 `parent` + `parent_artifacts_hash` 写入新 change 台账；init 事件含 parent 字段；usage 更新
- 插入位置修正一处：parent 解析须在 changesDir 确定后执行（初始实现放在了变量定义之前）

**测试**：`tests/navigator-b2.test.mjs` 4 用例（R3 合法快照 / 父不存在 / 父未归档 / 归档前缀父）。全量 39/39 绿。

**审查结论**：
- R3 三场景对齐 spec；归档前缀解析复用 B1 的 resolveParent，零重复代码
- 失败路径（exit 2）不创建任何目录——惰性原则保持

## Batch 3 — bridge next 导航命令（2026-09-18，审查通过）

**改动**：新文件 `cmd-next.mjs`（纯读侧：stage/next/建议查表 + parent/workflow 展示）；bridge.mjs 路由 stub + usage。
**测试**：`navigator-b3.test.mjs` 7 用例（5 stage 参数化 + next 字段 + 不存在 exit 1 + parent/workflow 可见）。全量 48/48 绿。
**真实演示**：对本 change 自身运行 `bridge next` 输出三行导航——导航员首次给自己导航。

## Batch 4 — tags + bridge pattern 聚合（2026-09-18，审查通过）

**改动**：新文件 `cmd-pattern.mjs`（全库扫描含 archive；mention 计数来自 .bridge.log 的 `tag=<t>` 行；total ≥2 输出复发提示行）。
**测试**：`navigator-b4.test.mjs` 4 用例。全量 52/52 绿。
**修正**：归档目录名 `<date>-<id>` 前缀在输出时剥离——change 身份名与 `--parent` 引用保持一致（与 resolveParent 的 endsWith 匹配语义对齐）。

## Batch 5 — mention / rootcause 信号命令（2026-09-18，审查通过）

**改动**：新文件 `cmd-mention.mjs`（run + runRootcause 双入口；事件格式 `mention:|root-cause: tag=<t> note=…`；全库计数含本次；N≥2 建议行；tag 不在 tags 字段时 hint）。
**测试**：`navigator-b5.test.mjs` 5 用例（首次无建议 / 二次建议 / root-cause 前缀 / 跨 change 计数 / usage 与无效目录）。全量 57/57 绿。
**ADR-0007 落点**：桥只记台账历史，会话内"第二次"判定归协议（B7 补硬性步骤）。

## Batch 6 — rebuttal + 归档写保护（2026-09-18，审查通过）

**改动**：
- 新文件 `cmd-rebuttal.mjs`（`rebuttals/<date>-<time>-<slug>.md`；直接追加 .bridge.log **不调 appendEvent**——后者会刷新 last_event 违反 R7 零状态变更）
- bridge.mjs：sync 遇 archive/ 路径段 → exit 4 WRITE-PROTECTED；state set 对 archived 仅放行 stage；hashes --check archived 漂移 → 提示"开 follow-up，勿改原版"；verify 失败 → rebuttal/续作双轨提示
- 315 行 < 350 上限（C9 ✓）

**测试**：`navigator-b6.test.mjs` 5 用例。全量 62/62 绿。
**修正**：rebuttal 的 appendEvent 副作用（写 last_event）当场发现当场改为直接 appendFileSync——测试咬住了它，契约门语义生效。

## Batch 7 — SKILL.md 协议硬性步骤（2026-09-18，审查通过）

**改动**（SKILL.md 四处）：
- §3 planning：`bridge init` 一键脚手架成为推荐入口（--workflow-kind / --parent 说明）；state init 降为手工路径
- §3 executing：**模式信号硬性步骤**（ADR-0007）——"同类问题第二次出现且已找到根因 → 必须调 mention/rootcause"；导航命令说明
- §4 守卫：归档不可变（ADR-0005）+ patching 旁路 + rebuttal 双轨三条新守卫
- §5 速查表：12 命令全量（补 init/next/pattern/mention/rootcause/rebuttal 六行，含行为注记）

CONTEXT.md 无需改动（grill 会话已补 12 术语，核对通过）。

## Batch 8 — 归档四拍（2026-09-18）

- 拍 1 sync：发布 specs/cli/spec.md，回执写入 .bridge.yaml ✅
- 拍 2 verify：PASS ✅
- 拍 3 蒸馏：specs/cli/why.md 追加 v1.2 六条（D1/D2/D3/D4/D5/D7 + rebuttal 教训），spec-rev = fd27d451…f4bbd ✅
- 拍 4 归档：git mv → changes/archive/2026-09-18-v1-2-navigator-architect/ + stage archived ✅

**全程统计**：8 批次 / 62 项测试全绿（新增 33 项）/ bridge.mjs 315 行（< 350 上限）/ 契约门零漂移。
**Stack B 路径首次完整走通**：matt to-spec 出规划 + 桥台账导航 + matt spec-executor 纪律执行 + 桥归档——开发即验收达成。

