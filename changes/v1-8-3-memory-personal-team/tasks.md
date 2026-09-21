# Tasks: v1-8-3-memory-personal-team

按 [executor-protocol](../../skills/spec-bridge/references/executor-protocol.md) 的"自动启发式"排成批次；每批 ≤2 任务时 inline，否则派发子代理。

## Batch 1 — cmd-memory.mjs 骨架 + 个人层 init

- [ ] **T1.1** 新建 `skills/spec-bridge/scripts/cmd-memory.mjs`：实现 `init` 子命令
  - `detectIdeMemory(projectRoot)`：检查 `.codebuddy/memory/` + 至少一个 `.md` + 统计 MEMORY.md 行数 + daily 文件数（**不读内容**）
  - `initPersonalMemory(changeDir, projectRoot)`：已存在 no-op + `[hint]`；否则写空骨架（§0 元信息 + §1/§2/§3 占位段）
  - 命令解析：`bridge memory init <dir> [--parent <id>]`
- [ ] **T1.2** 改 `cmd-init.mjs`：探测 IDE memory 后按需调 `bridge memory init <changeDir>`
  - 在写完 `.bridge.yaml` 后调（`autoProbe` 之前）
  - IDE memory 在场 → 跳过
  - 不在场 → 调 `initPersonalMemory(changeDir, projectRoot)`

完成定义：grep `cmd-memory` 在 bridge.mjs 注册；`node bridge memory init <tmp>` 在临时目录生成空骨架；二次 init no-op
审查时点：批末

## Batch 2 — 个人层 append + 写规则硬约束

- [ ] **T2.1** 改 `cmd-memory.mjs`：实现 `append` 子命令
  - 命令：`bridge memory append <dir> --text "<text>" [--section §1|§2|§3]`
  - 行为：在对应 section 追加一行 + 复用 `cmd-event.mjs` 的 `appendEvent`（不另起账本）
  - format 校验：stderr 提示"推荐 vX.Y.Z: 砍 X 因为 Y 格式"（不强制）
- [ ] **T2.2** 改 `SKILL.md`：新增 §x（写 memory 的硬约束） + §7 CHANGELOG 占位
  - §x 给"好/坏"示例
  - §7 占位段 `### v1.8-3 CHANGELOG（ADR-0013，memory-personal-team）`

完成定义：`bridge memory append <tmp> --text "v1.8.3: 砍 X 因为 Y"` 后 memory.md 末行追加；`--section §2` 写到 §2；append 后 `bridge event` 日志可查
审查时点：批末

## Batch 3 — probe memory_hint 字段 + cmd-adopt 探测

- [ ] **T3.1** 改 `cmd-probe.mjs`：输出 JSON 加 `memory_hint` 字段
  - 三态：`personal: "ide" | "bridge" | "none"`
  - `ide_path` / `ide_daily_count` / `ide_curated_lines`（ide 时填）
  - `bridge_path` / `bridge_lines`（bridge 时填）
  - `team_caps: []` / `team_total_lines: 0`（团队层）
- [ ] **T3.2** 改 `cmd-adopt.mjs`：探测 IDE memory + 按需调 `bridge memory init <changeDir>`（与 cmd-init.mjs D1 同逻辑）

完成定义：`bridge probe <change>` 输出 JSON 含 `memory_hint`；三态分别在临时项目根验证
审查时点：批末

## Batch 4 — archive-ready 守门 + archive 触发 sync

- [ ] **T4.1** 改 `cmd-archive-ready.mjs`：加"个人 memory 有内容 或 IDE memory 在场"守门
  - `ideMemoryOk = fs.existsSync('.codebuddy/memory/')`
  - `personalMemoryOk = memory.md exists + 决策段行 > 0`
  - 都不满足 → FAIL + stderr 给可读提示
- [ ] **T4.2** 改 `cmd-archive.mjs`（或 archive flow）：archive 成功后调 `bridge memory sync <changeDir>`
  - `execSync` 调 sync；失败 → stderr `[warn] memory sync failed`（不回滚 archive）
  - 成功 → appendEvent "memory sync completed"

完成定义：archive-ready 在 memory.md 空 + 无 IDE memory 时 FAIL；IDE 在场通过；archive 后 `.bridge/team/<cap>/memory.md` 含该 change 决策段
审查时点：批末

## Batch 5 — 团队层 sync + orphaned + reconcile

- [ ] **T5.1** 改 `cmd-memory.mjs`：实现 `sync` 子命令
  - 读 `<dir>/memory.md`，抽"§1 决策段"（parse `vX.Y.Z:` 行）
  - 算 source hash（决策段拼接 sha256）
  - 对应 cap（按 `.bridge.yaml.capabilities` 或 default）：
    - 已存在 → 检查 last_synced_hash
    - hash 一致 → no-op
    - hash 不一致 → 追加决策段 + 更新 hash
- [ ] **T5.2** 改 `cmd-memory.mjs`：实现 `show` + `reconcile` 子命令
  - `show [<cap>]`：纯读 `cat` 个人或团队 memory，不改文件
  - `reconcile [--team] [--cap <cap>] [--include-orphaned]`：
    - `--team` 模式遍历所有 cap 重算
    - 单 cap 模式 + `--include-orphaned`：把 orphaned 决策交给人审归并
    - reconcile 时**不删**任何决策段，只标"reconcile YYYY-MM-DD by <actor>"
  - orphaned 逻辑：sync 时 capabilities 空或多 cap 不一致 → 落 `.bridge/team/orphaned/`

完成定义：sync 测试覆盖首次 / 一致 / 不一致 / 跨 change 累计；orphaned 测试覆盖空 cap + 多 cap 不一致；reconcile 测试覆盖 `--team` / `--include-orphaned` / 不删原 cap
审查时点：批末

## Batch 6 — 测试覆盖（31 cases / 9 文件）

- [ ] **T6.1** 新加 `memory-detect-ide.test.mjs`（3 测试）
- [ ] **T6.2** 新加 `memory-init-empty.test.mjs`（3 测试）
- [ ] **T6.3** 新加 `memory-append.test.mjs`（4 测试）
- [ ] **T6.4** 新加 `memory-sync-hash.test.mjs`（5 测试）
- [ ] **T6.5** 新加 `memory-orphaned.test.mjs`（3 测试）
- [ ] **T6.6** 新加 `memory-reconcile.test.mjs`（3 测试）
- [ ] **T6.7** 新加 `probe-memory-hint.test.mjs`（4 测试）
- [ ] **T6.8** 新加 `archive-ready-memory-gate.test.mjs`（3 测试）
- [ ] **T6.9** 新加 `memory-show-readonly.test.mjs`（3 测试）

完成定义：`npm test` 全绿；测试数 143 → 174+（新加 31 测试）
审查时点：批末

## Batch 7 — 文档 + ADR + AGENTS.md / README

- [ ] **T7.1** 新加 `skills/spec-bridge/docs/adr/0013-memory-personal-team-rules.md`：D1-D10 决策
- [ ] **T7.2** 改 `SKILL.md §7`：加 v1.8-3 CHANGELOG 段 + §x 写规则硬约束示例
- [ ] **T7.3** 改 `AGENTS.md`：业务目的 a' 改写为"两层规则完整版" + 禁事加"不替 AI 写 memory 内容"
- [ ] **T7.4** 改 `README.md §1.1 a'`：补两层规则段落

完成定义：grep v1.8-3 / memory-personal-team 在文档能找到
审查时点：批末

## Batch N — 归档

- [ ] **TN.1** `node skills/spec-bridge/scripts/bridge.mjs sync changes/v1-8-3-memory-personal-team` → 写回执
- [ ] **TN.2** `node skills/spec-bridge/scripts/bridge.mjs verify changes/v1-8-3-memory-personal-team` → PASS
- [ ] **TN.3** `node skills/spec-bridge/scripts/bridge.mjs distill changes/v1-8-3-memory-personal-team` → 写 specs/v1-8-3-memory-personal-team/why.md
- [ ] **TN.4** `node skills/spec-bridge/scripts/bridge.mjs archive-ready changes/v1-8-3-memory-personal-team` → PASS
- [ ] **TN.5** `git mv changes/v1-8-3-memory-personal-team changes/archive/2026-09-21-v1-8-3-memory-personal-team/`
- [ ] **TN.6** `node skills/spec-bridge/scripts/bridge.mjs state set changes/archive/2026-09-21-v1-8-3-memory-personal-team stage archived`
- [ ] **TN.7** `git add -A && git commit -m "v1.8-3: memory personal+team rules (个人层 IDE 优先 fallback + 团队层 CLI 同步 + hash 校验)"` + `git pushp origin v1-8-3-memory-personal-team`