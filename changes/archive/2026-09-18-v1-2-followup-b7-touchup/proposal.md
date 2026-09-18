# v1.2 follow-up — B7 硬性步骤栏补完

## 动机（ADR-0005：parent = 2026-09-18-v1-2-navigator-architect）

v1.2 把 `bridge next` / `bridge mention` / `bridge pattern` 等导航命令都交付了，但 SKILL.md §3 把"每批前调 next"写成"建议"而非"硬性步骤"。直接后果：

- v1.2 自身执行期（B1→B8）每批开头没调 `bridge next`——AI 按记忆推进
- 更糟：`stage` 从批准门到归档全程停在 `contracted`，跳过了 `executing` 拍
- 归档后 `bridge next` 输出正确（已在 archive/2026-09-18-... 上验证），但**执行期是盲的**

B7 的设计意图是"SKILL.md 协议"，但落地只完成了"文档内容"没完成"硬性步骤"。本变更专修这一缺口。

## 用户故事

- 当我打开一个新 follow-up change 时，我能从 SKILL.md 直接看到"开工前先调 `bridge next`"
- 当 `bridge next` 看到 `stage=contracted` 时，它会主动提示"该进入 executing 了"
- 当执行期出现"stage 长时间停在某状态"时，next 命令的提示文案足够具体（点名 Batch N）

## Out of Scope

- 不重写 v1.2 自身的 stage 轨迹（归档内容不可修改，ADR-0005）
- 不给 next 命令加主动调度（hook / 监听）——属 v1.3
- 不改其他 §（§1 入口 / §2 能力探测 / §4 惰性原则 / §5 why 蒸馏）

## 工作流

`workflow_kind: matt`（与原 v1.2 一致）。本变更体量极小，跳过 matt `/to-spec` 重演（v1.2 的 R3 父引用 + 蓝图已明示 B7 内容，SKILL.md 修订是桥自有协议，不依赖外部工具栈）。