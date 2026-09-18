# v1-3-research-xrouter

## Purpose

v1.3 桥导航员角色的前置研究：读 4 套下游栈全部 SKILL.md，产 cited 笔记，为 v1.3 改桥 `next` 命令提供 evidence base。

## Requirements

### Requirement: research-evidence-base

The system SHALL 产出一份 cited markdown 笔记到 `.scratch/v1-3-cross-stack-research.md`，覆盖 5 套栈（spec-bridge / openspec-cn / spec-superflow / superpowers / matt）的全部 skill。

#### Scenario: 笔记完整性

- **WHEN** v1.3 实现期 change 启动时
- **THEN** 该 change 引用本笔记作为 design §Decisions 的 evidence base

#### Scenario: 笔记可被外部 reviewer 复核

- **WHEN** reviewer 读笔记时
- **THEN** 每条断言附文件路径 + 行号，reviewer 可定位到原 SKILL.md 验证

#### Scenario: 笔记覆盖 5 套栈

- **WHEN** bridge next 在 stage=executing 时给出跨协议路由建议
- **THEN** 建议引用的下游 skill 必须在笔记 §2-§6 中已 evidence-based 介绍
