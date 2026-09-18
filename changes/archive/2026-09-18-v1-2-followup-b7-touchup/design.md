# v1.2 follow-up B7 — 设计

## Decisions（继承 + 补足）

继承 v1.2 R3-R4 + ADR-0004~0007，本变更新增：

**D1. 硬性步骤栏的最小形态**：用 markdown 的 `> hard step` 引用块标记，每条对应一个 CLI 守卫点（不是软文）。具体两条：

  > **hard step** — entering executing:
  > `node <bridge> state set <dir> stage executing` — 否则 `bridge next` 永远停在 contracted
  
  > **hard step** — before each batch:
  > `node <bridge> next <dir>` — 看 stage/next/advised 三行确认当前拍点；不一致时停下核对

**D2. next 命令的"stage-aware"扩展**：保留现有按 stage 出建议的逻辑，新增：

  - `stage=contracted` 且 `contract_approved` 已填 → advised 改为 "approve run / proceed to executing"
  - `stage=executing` → 输出当前 batch 提示（读 `next` 字段 + 末尾追加"→ Batch N: ..."，前提是 `next` 字段是 batch 命名）
  - `stage=archived` → 保持当前 R3 守门提示（已归档，勿改原版）

**D3. 测试三层覆盖**：

  1. 单元：navigator-b3.test.mjs 增 2 用例（contracted with approved → advised 改文案；executing with batch named → 含 Batch 提示）
  2. 集成：spawn `bridge next` 在 tmpdir 验证完整流程
  3. 协议自证：本 follow-up 自身的每批开头调一次 `bridge next` 并把输出截到 progress.md

**D4. 文档格式约束**：硬性步骤栏放在 §3 顶部"进入 executing"段，每条 2 行（说明 + 命令），与 §3 现有"何时推进"段正交（一个说"是什么"，一个说"不许跳"）。

## 接口边界

- `cmd-next.mjs`：扩展 5-15 行（新增 stage-aware 提示分支）
- `SKILL.md`：§3 顶部 + 1 段硬性步骤栏（约 15 行 markdown）
- `tests/navigator-b3.test.mjs`：+2 用例
- 不改 `bridge.mjs` 行数（仍 < 350 上限 C9）
- 不改 `.bridge.yaml` schema（next 字段已存在）

## 风险

- **R-low**：stage-aware 提示文案需与现有 v1.2 部署兼容——老 next 输出无 batch 提示，新版加，不破坏老调用方
- **R-low**：测试依赖 `next` 字段当前为字符串格式——若未来结构化（JSON）需额外 schema 迁移
- **R-med**：硬性步骤栏没强制执行（仍靠 AI 自觉）——但**这是 v1.3 的 hook 工作**，B7 先做到"文档明示 + 命令文案提示"