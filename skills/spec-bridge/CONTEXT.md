# Spec Bridge — 术语表

本文件只放术语，不放实现细节。

## Language

**变更（change）**：
一个有界的工作单元（一个功能或一个 bug），目录 `changes/<需求号>-<slug>/`，是契约、执行、归档的原子。
_避免_：任务（任务是 change 内的批次）、需求（需求是分支粒度）。

**需求号分支**：
承载 N 个变更的 git 分支，命名 `<需求号>`，是合并/推送/PR 的原子。变更与分支是 N:1。
_避免_：把"需求"当作 change 的同义词。

**能力阶梯（capability ladder）**：
探测结果决定每个功能槽位由谁供职：原生（openspec/superpowers）→ 次选（matt）→ 兜底（内置）。
按槽位补位，不按环境整体降级。

**功能槽位（slot）**：
工作流的一个独立能力位：规划产物、契约压缩、执行、调试、审查、归档合并、知识沉淀。
每个槽位独立探测、独立兜底。

**栈（Stack A / B / C）**：
项目层探测出的整栈选择。A = openspec + superpowers（规划半 + 执行半，缺一仍算 A）；
B = matt 整栈（自足）；C = 都没有 → 内置最小闭环（照跑不瘫痪）。

**契约（execution contract）**：
4 份规划产物压缩成的执行握手文件。转译不是复制。有批准门，内容级过期检测。
_避免_：spec（spec 是根基线里的规范条目）。

**发布回执（publication receipt）**：
`sync` 写入 `.bridge.yaml` 的 base64 编码记录（delta hash + 基线前后 hash）。
三处消费：closing guard 放行、why 蒸馏的"已发布"标记、`spec-rev` 陈旧判定。

**根基线（published baseline）**：
`specs/<capability>/spec.md` 的集合。发布产物，不是事实源；事实源是 `changes/`（delta 永不删除）。

**单向蒸馏（unidirectional distillation）**：
知识只从 change/基线流向 why 笔记，永不回流 specs。规则见 ADR-0003。

**why 笔记**：
`specs/<capability>/why.md`。结论 + 溯源链接 + `spec-rev`。不进基线 hash。
_避免_：知识库（kb 是另一个项目的概念，本 skill 不用）。

**惰性（inert）**：
不匹配任何活跃变更的对话输入不创建、不修改任何状态文件——单入口路由的防污染原则。

**空仓库测试（fresh clone test）**：
skill 可用性的验收判据：`git init` 空仓库 + 装上 skill 即可用，零项目改动。

## Relationships

- 一个**需求号分支**承载 N 个**变更**
- 一个**变更**产出一份**契约**，消费一份**根基线**增量，留下一份**发布回执**
- **why 笔记**从属于**根基线**的 capability，晚于**发布回执**产生
- **功能槽位**属于**能力阶梯**的一层；**栈**是项目层的整体选择
