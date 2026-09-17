# Vendored Engine Provenance

## 来源

- 上游仓库: https://github.com/MageByte-Zero/spec-superflow
- 上游版本: **v1.2.0**（本地 marketplace 快照: `~/.codebuddy/plugins/marketplaces/MageByte-Zero_spec-superflow`）
- 许可: MIT（随行保留于本目录 `LICENSE`，版权 MageByte）
- vendor 日期: 2026-09-17

## 为什么 vendor 而不是依赖

决策记录见 `../docs/adr/0002-vendored-sync-engine.md`。要点：openspec 装与不装都要能用（一条代码路径）；
发布回执的格式必须归 spec-bridge 管（closing guard / why 蒸馏 / 陈旧判定三处消费）。

## 文件清单与改动

| 文件 | 上游路径 (`scripts/lib/` + 根) | 改动 |
|---|---|---|
| `cmd-sync.mjs` | `scripts/lib/cmd-sync.mjs` | 4 处接缝改动，见下 |
| `spec-publication.mjs` | `scripts/lib/spec-publication.mjs` | 1 处：dist 导入 `../../dist/index.js` → `./dist/index.js` |
| `spec-paths.mjs` | `scripts/lib/spec-paths.mjs` | **零改动** |
| `dist/` | 根 `dist/`（编译产物，TS 源码在 `src/`） | **零改动**，只带编译产物不带 TS 源 |
| `bridge-state.mjs` | （替换 `scripts/lib/state-loader.mjs`） | **spec-bridge 自有文件**：同 API（readState/writeState），状态文件 `.spec-superflow.yaml` → `.bridge.yaml`，字段换成 spec-bridge 六字段 + 回执字段 |
| `LICENSE` | 根 `LICENSE` | 零改动 |

### `cmd-sync.mjs` 的 4 处接缝改动

1. `import { readState, writeState } from './state-loader.mjs'` → `from './bridge-state.mjs'`
2. `await import('../../dist/index.js')` → `await import('./dist/index.js')`
3. 冲突扫描：其他 change 的状态文件名 `.spec-superflow.yaml` → `.bridge.yaml`；终态判断 `state === 'closing' || 'abandoned'` → `stage === 'archived' || 'abandoned'`
4. 回执写入：目标文件 `.spec-superflow.yaml` → `.bridge.yaml`；字段 `spec_merged` → `published`（`spec_publication_receipt` 名称不变）

其余逻辑（跨 change 冲突检测、near-match 拒绝、全量候选验证、原子发布回滚、sha256 回执）**逐字节保留**。

## 布局兼容性（无需改动的原因）

`resolvePublicationContext` 只要求 change 目录的父目录名叫 `changes`：

- `openspec/changes/<name>/` → projectRoot = `openspec/` → 基线 = `openspec/specs/`（OpenSpec 原生）
- `changes/<name>/` → projectRoot = 仓库根 → 基线 = `specs/`

两种布局（`.spec-bridge.yaml` 的 `layout` 字段）引擎天然都支持。

## 升级协议

1. 对照上游新版本，`diff` 本目录与上游 `scripts/lib/` + `dist/`
2. 只重放"确定性引擎"的改动；接缝改动（上表 4 处 + bridge-state API）重新套用
3. 跑 `npm test`（本仓库 tests/ 里的用例就是回归防线）
4. 更新本文件的"上游版本"与改动清单
