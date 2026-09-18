# External Proposal (matt fixture)

Fixture：模拟外部 matt 仓库已存在的 proposal（v1.3 D4 接管的另一形态）。
无 .bridge.yaml，无 5 模板以外产物，仅 `proposal.md` 在场。
`bridge adopt` 应识别 proposal.md 存在即可接管。

## Why

下游项目用 matt 整栈跑过 to-spec 出了 proposal.md，但还没建台账。

## What Changes

- 新增 xrouter 兼容层
- 保留既有 spec.md 入口

## Scope

### In Scope

- 接管 signal 接通

### Out of Scope

- 改 proposal.md 原文
