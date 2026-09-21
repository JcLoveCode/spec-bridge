# v1.10-1 Vendor External Matt Skills — Execution Contract

> **状态**：draft（等用户拍板 C1-C12 + T1-T3）
> **关联**：spec.md D1-D6 + T1-T4
> **目标**：把 6 个核心工程能力 skill 从 tt-a1i/matt-skills-with-to-goal vendor 到 spec-bridge

## 一、硬约束清单（C1-C12）

### 文件搬运（vendor 内容）
- **C1** 新建 `skills/external-matt/README.md`（说明这是 vendor 目录，引用 VENDOR.md）
- **C2** 新建 `skills/external-matt/VENDOR.md`（上游 commit hash + 版本号 `1.2.3-to-goal.2` + 同步策略 + 许可证声明）
- **C3** 新建 `skills/external-matt/LICENSE`（上游 MIT 许可证副本）
- **C4** 复制 6 个 SKILL.md 到 `skills/external-matt/engineering/{name}/SKILL.md`：
  - `to-spec/SKILL.md`
  - `to-tickets/SKILL.md`
  - `to-goal/SKILL.md`
  - `goal-crafter/SKILL.md`
  - `spec-executor/SKILL.md`
  - `execute-spec-in-fork/SKILL.md`
- **C5** vendor 内容**0 行修改**（与上游完全一致，D6 边界）

### probe 接缝
- **C6** `skills/spec-bridge/scripts/cmd-probe.mjs` 加 `advised_skill_path` 字段输出
  - 仅 advised_skill 有值时输出
  - 仅当外栈（matt / openspec / superpowers）时输出
  - 仅当 vendor 内置时输出路径
- **C7** `advised_invocation` 字段**保留不变**（向前兼容，D3 理由）
- **C8** 路径使用仓库内相对路径 `skills/external-matt/engineering/{name}/SKILL.md`（D3 断网可用）

### 文档同步
- **C9** `skills/spec-bridge/SKILL.md` §6 路由表路径补全（D4）
  - 加 `to-spec / to-tickets / to-goal / goal-crafter` 4 个 vendor 路径注释
- **C10** `README.md` §1.3 改状态（D5）
  - 标题：`1.3 跨 session 传递（to-goal 集成，**v1.10** vendor）`
  - 内容：vendor 路径 + use_skill 路径双路径说明
  - 加 VENDOR.md 许可证链接
- **C11** 新建 `skills/spec-bridge/docs/adr/0017-vendor-external-matt.md`（D7 ADR）
  - D1 独立命名理由
  - D2 手动同步策略理由
  - D3 advised_skill_path 设计权衡
  - 引用 AGENTS.md §5

### 边界保护
- **C12** 不动 `cmd-*` 其他 CLI 逻辑（除 cmd-probe 加输出字段）
  - 不写 to-goal 编译代码
  - 不改 4 件产物格式
  - 不动 .bridge.yaml schema
  - 不替 AI 加载 vendor SKILL.md

## 二、测试约束（T1-T3）

- **T1** 新增 `skills/spec-bridge/tests/probe-vendor-path.test.mjs`（D3 T1，4 场景）
  - advised_skill=`(none)` → 不输出 advised_skill_path
  - advised_skill=matt 且 vendor 内置 → 输出路径
  - advised_skill=matt 但 vendor 未内置 → 不输出该字段
  - advised_skill=builtin → 不输出该字段
- **T2** 新增 `skills/spec-bridge/tests/vendor-external-matt.test.mjs`（D3 T2，3 场景）
  - 6 个 SKILL.md 文件存在
  - VENDOR.md 含 commit hash + 版本号 + 许可证声明
  - LICENSE 文件存在且含 MIT 字样
- **T3** v1.9-2 探测 fallback 不破坏（1 场景）
  - `bridge probe` 在 advised_skill=`(none)` 时正确输出 fallback 文案

## 三、必填产物（按 spec-bridge α 流程）

1. ✅ `execution-contract.md`（本文）
2. ✅ `specs/v1-10-1-vendor-external-skills/spec.md`（Step 1 已写）
3. ✅ `.bridge.yaml`（init 已自动建）
4. ✅ `.bridge.log`（init 已自动建）
5. ⚠️ `tasks.md`（待写，按 T1-T4 + C1-C12 拆任务）
6. ⚠️ ADR-0017（实现期写）

## 四、α 流程进度

- **Step 1** ✅ bridge init → 台账就位
- **Step 2** ✅ use_skill to-spec 综合 spec
- **Step 3** ✅ spec 写盘（`specs/v1-10-1.../spec.md`，211 行）
- **Step 4** ⚠️ adopt（写盘后调 `bridge adopt changes/v1-10-1-... --stack matt`）
- **Step 5** ⚠️ 写 tasks.md（按 T1-T4 + C1-C12 拆 4-6 个 task）
- **Step 6** ⚠️ advance to contracted + contract_approved=true
- **Step 7** ⚠️ use_skill implement（实现 vendor 搬运 + probe 改动）
- **Step 8** ⚠️ use_skill tdd（跑 7 个新测试）
- **Step 9** ⚠️ bridge archive-ready（4 前置条件全过）
- **Step 10** ⚠️ 蒸馏（distill 跳过 external）+ git mv archive
- **Step 11** ⚠️ bridge state set stage archived（触发 memory sync）

## 五、实现路径（实现期）

按 T1-T4 + C1-C12 的 4 batch 拆：

- **B1（vendor 搬运）**：C1-C5（6 个 SKILL.md + README + VENDOR + LICENSE），0 行代码
- **B2（probe 改动）**：C6-C8 + T1（cmd-probe.mjs 加 advised_skill_path 字段 + 4 测试）
- **B3（文档同步）**：C9-C11（SKILL.md §6 路由表 + README §1.3 改状态 + ADR-0017）+ T2（vendor 完整性 3 测试）
- **B4（边界保护）**：C12 + T3（v1.9-2 fallback 验证测试）

**commit 边界**：
- B1 单 commit（纯文件复制）
- B2 单 commit（probe 改动 + 测试）
- B3 单 commit（文档 + ADR + 测试）
- B4 不单独 commit（与 B3 合并，因 C12 是边界保护不是新功能）

## 六、风险

- **R1**：vendor 文件可能与上游未来版本漂移 → 手动同步 + VENDOR.md 版本钉死
- **R2**：probe advised_skill_path 可能影响老调用方 → 保留 advised_invocation 字段不动
- **R3**：搬运路径错误导致用户找不到文件 → VENDOR.md 路径表 + 测试覆盖
- **R4**：上游许可证变更 → LICENSE 副本 + VENDOR.md 许可证声明 + 升级时复核

## 七、待用户拍

### υ 选项（写 execution-contract 还是先列硬约束 review）

- **υ1**（推荐）：直接调 `bridge adopt changes/v1-10-1-...` + advance + implement
- **υ2**：先 review C1-C12 + T1-T3，改了再 implement
- **υ3**：先改 spec（D1-D6 + T1-T4），改了再走 α 流程

**当前选择**：υ1（按 α 拍板的"一气呵成"模式，参考 v1.8-1 χ1）