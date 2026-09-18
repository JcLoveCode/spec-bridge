# 不可变历史与链式续作

"做歪了 / bug 修复 / 回炉重做"的共同解法（OpenSpec delta 累加、matt goal CLOSED + 新 goal）是 **never overwrite**。归档变更的 `spec.md` 拒绝编辑；一切修正 = 新开 **follow-up 变更**，metadata 携带 `parent` + `parent_artifacts_hash` 链式引用。状态机加旁路态 `patching`：`archived → patching → re-archived`，patching 的 parent 必填且必须已归档。

## Considered Options

- **归档内子目录 `fixes/`**：被否——fixes 内的 spec 无法 sync 进根基线，与发布回执流程冲突。
- **版本号命名（v2/v3 spec）**：被否——版本树可读性差，且与 delta 累加哲学相悖。
- **原地修改原版**：被否——历史失真，回执链断裂。

## Consequences

- 版本化的形态是**不可变历史 + 链式引用**，不是版本号。
- follow-up 的 why 蒸馏自动携带 `parent_artifacts_hash`，未来可重构出版本树。
