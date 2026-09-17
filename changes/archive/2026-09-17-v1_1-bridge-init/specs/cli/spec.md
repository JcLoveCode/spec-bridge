## Purpose

`bridge init` 是 spec-bridge 单入口路由的"开 change"子命令。它把开一个新 change 从 5 步手动折叠成 1 步 CLI 调用，并把变更的规划产物模板（proposal / design / tasks / spec / execution-contract）与 `.bridge.yaml` 状态机入口一次性落盘。

## ADDED Requirements

### Requirement: bridge init 命令一键脚手架

`bridge.mjs` SHALL 提供 `init <name>` 子命令，自动探测项目根、探测 layout、创建 change 目录、写入四个规划产品模板 + execution-contract 模板 + `.bridge.yaml` + `.bridge.log`。

#### Scenario: 成功脚手架一个新 change

- **WHEN** 用户在 spec-bridge 兼容的仓库（含 `changes/` 或 `openspec/`）下执行 `node bridge.mjs init v1_1-bridge-init`
- **THEN** 系统创建 `changes/v1_1-bridge-init/` 目录，内含 `proposal.md`、`design.md`、`tasks.md`、`specs/cli/spec.md`、`execution-contract.md` 五个非空模板文件
- **AND** `.bridge.yaml` 含 `stage: planning`、`layout: <检测值>`、`branch: <传入或 null>`、`capabilities: <传入或 null>`
- **AND** `.bridge.log` 含首条 ISO 时间戳大事记
- **AND** stdout 输出 `<changeDir>` 绝对路径 + 一行 next hint

#### Scenario: 已存在同名 change 时拒绝覆盖

- **WHEN** 用户执行 `node bridge.mjs init v1_1-bridge-init` 且 `changes/v1_1-bridge-init/` 已存在
- **THEN** 系统退出码 `3`
- **AND** stderr 输出 `change 'v1_1-bridge-init' already exists at <absolute path>`
- **AND** 不修改任何已存在文件

#### Scenario: name 不符合 kebab-case 时拒绝

- **WHEN** 用户执行 `node bridge.mjs init Foo Bar` 或 `node bridge.mjs init --foo`
- **THEN** 系统退出码 `2` 并打印 usage

#### Scenario: 探测 standalone layout

- **WHEN** 项目根无 `openspec/` 子目录
- **THEN** `.bridge.yaml` 的 `layout: standalone`，changes 目录位于 `<projectRoot>/changes/<name>/`，基线目录 `<projectRoot>/specs/<cap>/spec.md`

#### Scenario: 探测 openspec layout

- **WHEN** 项目根含 `openspec/` 子目录
- **THEN** `.bridge.yaml` 的 `layout: openspec`，changes 目录位于 `<projectRoot>/openspec/changes/<name>/`

### Requirement: init 不写 receipts、不调 sync/verify、不写 hashes

`bridge init` SHALL NOT 调用 `bridge sync` 或 `bridge verify`，亦 SHALL NOT 写入 `artifacts_hash` / `contract_hash` / `published` / `spec_publication_receipt` 字段。hash 与回执属于 contracted → executing → archived 阶段。

#### Scenario: init 之后 .bridge.yaml 不含回执字段

- **WHEN** 成功执行 init 后
- **THEN** `.bridge.yaml` 中 `artifacts_hash`、`contract_hash`、`published`、`spec_publication_receipt` 字段均为 `null`
- **AND** `stage` 字段为 `planning`

### Requirement: 项目根探测失败时使用 cwd 兜底并打印提示

`bridge init` SHALL 在项目根探测失败（无 git toplevel、无含 `changes/` 的祖先目录）时回退到 cwd，并在 stderr 打印一行 fallback 提示；change 目录 SHALL 仍正常创建——standalone 布局自举，首个 change 落盘即确立布局。

#### Scenario: 非 git 仓库且无 changes/ 祖先目录

- **WHEN** 用户在 `/tmp/foo`（无 git、无 changes/ 祖先）执行 `node bridge.mjs init demo`
- **THEN** 系统使用 `/tmp/foo` 作为项目根继续执行
- **AND** stderr 打印 fallback 提示
- **AND** `demo` change 目录与 5 个模板文件成功创建，exit code 0
- **AND** `.bridge.yaml` 的 `layout: standalone`（首个 change 落盘即自举确立 standalone 布局）