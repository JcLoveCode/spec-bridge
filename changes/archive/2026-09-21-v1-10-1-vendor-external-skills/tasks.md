# v1.10-1 Tasks — Vendor External Matt Skills

> 按 execution-contract.md 的 C1-C12 + T1-T3 拆 4 个 batch。
> 每个 batch 完成 = 1 个 commit。

## Batch 1 — Vendor 搬运（C1-C5）

- [x] **T1.1** C1 新建 `skills/external-matt/README.md`（vendor 目录说明）
- [x] **T1.2** C2 新建 `skills/external-matt/VENDOR.md`（上游 commit + 版本 + 同步策略 + 许可证声明）
- [x] **T1.3** C3 新建 `skills/external-matt/LICENSE`（上游 MIT 许可证副本）
- [x] **T1.4** C4 复制 6 个 SKILL.md 到 `skills/external-matt/engineering/{name}/SKILL.md`：
  - [x] to-spec/SKILL.md
  - [x] to-tickets/SKILL.md
  - [x] to-goal/SKILL.md
  - [x] goal-crafter/SKILL.md
  - [x] spec-executor/SKILL.md
  - [x] execute-spec-in-fork/SKILL.md
- [x] **T1.5** C5 验证 0 行修改（与上游完全一致）

**commit 边界**：1 commit（"v1.10-1: vendor 6 matt skills"）

## Batch 2 — Probe 改动（C6-C8 + T1）

- [x] **T2.1** 改 `skills/spec-bridge/scripts/cmd-probe.mjs`：加 `advised_skill_path` 字段输出
- [x] **T2.2** 路径映射表：matt→to-spec, openspec→(无), superpowers→(无), builtin→不输出
- [x] **T2.3** 保留 `advised_invocation` 字段不变（C7 向前兼容）
- [x] **T2.4** 写 `tests/probe-vendor-path.test.mjs`（T1 4 场景）

**commit 边界**：1 commit（"v1.10-1: probe 加 advised_skill_path 字段 + 4 测试"）

## Batch 3 — 文档同步（C9-C11 + T2）

- [x] **T3.1** C9 改 `skills/spec-bridge/SKILL.md` §6 路由表：加 vendor 路径注释
- [x] **T3.2** C10 改 `README.md` §1.3：状态改 v1.10 vendor + 双路径说明 + 许可证链接
- [x] **T3.3** C11 新建 `skills/spec-bridge/docs/adr/0017-vendor-external-matt.md`
- [x] **T3.4** 写 `tests/vendor-external-matt.test.mjs`（T2 3 场景）

**commit 边界**：1 commit（"v1.10-1: 文档同步 + ADR-0017 + vendor 完整性测试"）

## Batch 4 — 边界保护（C12 + T3）

- [x] **T4.1** C12 验证不动其他 CLI 逻辑（除 cmd-probe 加输出字段）
- [x] **T4.2** T3 v1.9-2 探测 fallback 验证测试
- [x] **T4.3** 全套测试 197/197 不破坏

**commit 边界**：与 Batch 3 合并（边界保护非新功能）

## 依赖关系

- B1 不依赖任何东西（纯文件复制）
- B2 依赖 B1（probe 输出 vendor 路径需要 vendor 文件存在）
- B3 依赖 B1（文档引用 vendor 路径）
- B4 依赖 B2 + B3（验证整体不破坏）

## 收尾任务

- [ ] **T5.1** `bridge sync changes/v1-10-1-...`（含 external_skip，因 spec frontmatter `external: true`）
- [ ] **T5.2** `bridge verify changes/v1-10-1-...`（校验 baseline + receipt）
- [ ] **T5.3** `bridge distill changes/v1-10-1-...`（因 external:true 自动跳过）
- [ ] **T5.4** `git add -A && git mv changes/v1-10-1-... changes/archive/2026-09-21-v1-10-1-vendor-external-skills`
- [ ] **T5.5** `bridge state set changes/archive/2026-09-21-v1-10-1-... stage archived`（触发 memory sync）